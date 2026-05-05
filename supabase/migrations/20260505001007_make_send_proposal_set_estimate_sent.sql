-- Migration: make_send_proposal_set_estimate_sent
-- Version:   20260505001007
-- Applied:   2026-05-05 (live on dev branch via Supabase apply_migration)
--
-- Purpose:
--   Add estimates.status = 'sent' inside the same atomic UPDATE that locks the estimate,
--   eliminating the consistency gap where the RPC could succeed but the app-side
--   status update could fail independently.
--
-- Behavior changes vs create_send_proposal_function (20260502140430):
--   - Step 1 (estimate lock UPDATE) now also sets status = 'sent'::estimate_status
--   - New precondition guard: estimates.status must be 'staged' before the RPC proceeds
--   - Variable rename: v_current_status → v_proposal_status (disambiguation)
--   - New variable: v_estimate_status estimate_status
--   - All other steps, signatures, SECURITY DEFINER, and search_path are unchanged
--
-- Rollback notes:
--   Simple rollback IS possible if no rows have been sent under this version yet.
--   Re-apply the function body from 20260502140430_create_send_proposal_function.sql.
--   If rows have already been sent, estimates.status = 'sent' will have been set atomically —
--   rolling back the function will not revert existing data. The data state would still be
--   consistent (status=sent accurately reflects sent proposals), but future sends would lose
--   the atomic guarantee until the next forward migration.
--
-- There is no destructive schema change here — only a function replacement.

CREATE OR REPLACE FUNCTION public.send_proposal(
  p_estimate_id   uuid,
  p_job_id        uuid,
  p_user_id       uuid,
  p_snapshot_json jsonb,
  p_title         text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_proposal_status  TEXT;
  v_estimate_status  estimate_status;
  v_now              TIMESTAMPTZ := now();
  v_doc_id           UUID;
BEGIN
  -- Verify the estimate belongs to the given job
  IF NOT EXISTS (
    SELECT 1 FROM estimates WHERE id = p_estimate_id AND job_id = p_job_id
  ) THEN
    RAISE EXCEPTION 'Estimate % not found for job %', p_estimate_id, p_job_id;
  END IF;

  -- Guard: estimate must be in 'staged' status before send
  -- (app requires staging; this enforces it at the DB layer atomically)
  SELECT status INTO v_estimate_status
  FROM estimates
  WHERE id = p_estimate_id;

  IF v_estimate_status <> 'staged' THEN
    RAISE EXCEPTION
      'Cannot send: estimate status is ''%'' (must be ''staged'')',
      v_estimate_status;
  END IF;

  -- Lock the proposal_structures row to prevent concurrent sends.
  -- If no row exists yet the proposal is effectively in draft.
  SELECT proposal_status INTO v_proposal_status
  FROM proposal_structures
  WHERE estimate_id = p_estimate_id
  FOR UPDATE;

  IF NOT FOUND THEN
    v_proposal_status := 'draft';
  END IF;

  IF v_proposal_status <> 'draft' THEN
    RAISE EXCEPTION
      'Cannot send: proposal status is ''%'' (must be ''draft'')',
      v_proposal_status;
  END IF;

  -- Step 1: lock the estimate AND set status = 'sent' atomically in one UPDATE.
  -- If any subsequent step fails, this UPDATE rolls back with the transaction.
  UPDATE estimates
  SET
    status        = 'sent'::estimate_status,
    locked_at     = v_now,
    locked_by     = p_user_id,
    locked_reason = 'proposal_sent'
  WHERE id = p_estimate_id;

  -- Step 2: transition proposal structure to sent + locked
  INSERT INTO proposal_structures (
    estimate_id, proposal_status, locked_at, locked_by, locked_reason, updated_at
  ) VALUES (
    p_estimate_id, 'sent', v_now, p_user_id, 'proposal_sent', v_now
  )
  ON CONFLICT (estimate_id) DO UPDATE SET
    proposal_status = 'sent',
    locked_at       = v_now,
    locked_by       = p_user_id,
    locked_reason   = 'proposal_sent',
    updated_at      = v_now;

  -- Step 3: create the immutable document snapshot.
  -- If this INSERT fails for any reason, steps 1 and 2 roll back too.
  INSERT INTO proposal_documents (
    job_id, estimate_id, doc_status, title, snapshot_json, created_by, created_at
  ) VALUES (
    p_job_id, p_estimate_id, 'sent', p_title, p_snapshot_json, p_user_id, v_now
  )
  RETURNING id INTO v_doc_id;

  RETURN v_doc_id;
END;
$$;

COMMENT ON FUNCTION public.send_proposal(uuid, uuid, uuid, jsonb, text) IS
  'Atomically locks an estimate, sets estimates.status = sent, transitions proposal_structures to sent, '
  'and creates the immutable proposal_documents snapshot — all in one transaction. '
  'Requires estimates.status = staged as precondition. '
  'Replaces prior version that omitted the status update from the atomic block.';
