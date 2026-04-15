


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE TYPE "public"."checklist_source" AS ENUM (
    'master',
    'ai_generated',
    'manual'
);


ALTER TYPE "public"."checklist_source" OWNER TO "postgres";


CREATE TYPE "public"."contract_type" AS ENUM (
    'fixed_price',
    'cost_plus'
);


ALTER TYPE "public"."contract_type" OWNER TO "postgres";


CREATE TYPE "public"."document_status" AS ENUM (
    'draft',
    'sent',
    'accepted',
    'superseded',
    'approved',
    'rejected',
    'voided',
    'paid'
);


ALTER TYPE "public"."document_status" OWNER TO "postgres";


CREATE TYPE "public"."document_type" AS ENUM (
    'proposal',
    'change_order',
    'client_invoice'
);


ALTER TYPE "public"."document_type" OWNER TO "postgres";


CREATE TYPE "public"."draw_status" AS ENUM (
    'Pending',
    'Invoiced',
    'Paid'
);


ALTER TYPE "public"."draw_status" OWNER TO "postgres";


CREATE TYPE "public"."estimate_status" AS ENUM (
    'draft',
    'sent',
    'accepted',
    'superseded',
    'voided'
);


ALTER TYPE "public"."estimate_status" OWNER TO "postgres";


CREATE TYPE "public"."issue_severity" AS ENUM (
    'Critical',
    'Warning',
    'Info'
);


ALTER TYPE "public"."issue_severity" OWNER TO "postgres";


CREATE TYPE "public"."job_stage" AS ENUM (
    'intake',
    'takeoff',
    'estimate',
    'contract',
    'selections',
    'procurement',
    'schedule',
    'draws',
    'construction'
);


ALTER TYPE "public"."job_stage" OWNER TO "postgres";


CREATE TYPE "public"."procurement_depends_on" AS ENUM (
    'contract_signed',
    'selection_locked',
    'none'
);


ALTER TYPE "public"."procurement_depends_on" OWNER TO "postgres";


CREATE TYPE "public"."procurement_status" AS ENUM (
    'Pending',
    'Ordered',
    'Confirmed',
    'Delivered',
    'Issue'
);


ALTER TYPE "public"."procurement_status" OWNER TO "postgres";


CREATE TYPE "public"."selection_status" AS ENUM (
    'not_started',
    'in_progress',
    'selected',
    'locked',
    'on_hold'
);


ALTER TYPE "public"."selection_status" OWNER TO "postgres";


CREATE TYPE "public"."sub_status" AS ENUM (
    'tentative',
    'scheduled',
    'confirmed',
    'on_site',
    'complete',
    'cancelled'
);


ALTER TYPE "public"."sub_status" OWNER TO "postgres";


CREATE TYPE "public"."user_role" AS ENUM (
    'admin',
    'pm',
    'bookkeeper',
    'sub',
    'client',
    'vendor'
);


ALTER TYPE "public"."user_role" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_company_compliance"("p_company_id" "uuid") RETURNS TABLE("has_coi_gl" boolean, "coi_gl_expired" boolean, "has_coi_wc" boolean, "coi_wc_expired" boolean, "has_w9" boolean, "has_general_contract" boolean, "is_compliant" boolean)
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT
    (coi_gl_path IS NOT NULL) AS has_coi_gl,
    (coi_gl_expires IS NOT NULL AND coi_gl_expires < CURRENT_DATE) AS coi_gl_expired,
    (coi_wc_path IS NOT NULL) AS has_coi_wc,
    (coi_wc_expires IS NOT NULL AND coi_wc_expires < CURRENT_DATE) AS coi_wc_expired,
    (w9_path IS NOT NULL) AS has_w9,
    (general_contract_signed_at IS NOT NULL) AS has_general_contract,
    (
      coi_gl_path IS NOT NULL AND
      (coi_gl_expires IS NULL OR coi_gl_expires >= CURRENT_DATE) AND
      w9_path IS NOT NULL AND
      general_contract_signed_at IS NOT NULL
    ) AS is_compliant
  FROM companies
  WHERE id = p_company_id;
$$;


ALTER FUNCTION "public"."get_company_compliance"("p_company_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_job_files"("p_job_id" "uuid") RETURNS TABLE("id" "uuid", "category" "text", "filename" "text", "display_name" "text", "storage_path" "text", "size_bytes" integer, "mime_type" "text", "client_visible" boolean, "created_at" timestamp with time zone, "uploaded_by" "uuid")
    LANGUAGE "sql" SECURITY DEFINER
    AS $$ SELECT id, category, filename, display_name, storage_path, size_bytes, mime_type, client_visible, created_at, uploaded_by FROM file_attachments WHERE job_id = p_job_id ORDER BY category, created_at DESC; $$;


ALTER FUNCTION "public"."get_job_files"("p_job_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  INSERT INTO profiles (id, email, full_name, role)
  VALUES (
    NEW.id, NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'sub')
  );
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;


ALTER FUNCTION "public"."handle_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_assigned_to_job"("p_job_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM job_assignments
    WHERE job_id = p_job_id AND user_id = auth.uid()
  );
$$;


ALTER FUNCTION "public"."is_assigned_to_job"("p_job_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_client_on_job"("p_job_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM job_assignments ja
    JOIN profiles p ON p.id = ja.user_id
    WHERE ja.job_id = p_job_id AND ja.user_id = auth.uid() AND p.role = 'client'
  );
$$;


ALTER FUNCTION "public"."is_client_on_job"("p_job_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_cost_plus_client"("p_job_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM jobs j
    JOIN job_assignments ja ON ja.job_id = j.id
    JOIN profiles p ON p.id = ja.user_id
    WHERE j.id = p_job_id
      AND j.contract_type = 'cost_plus'
      AND ja.user_id = auth.uid()
      AND p.role = 'client'
  );
$$;


ALTER FUNCTION "public"."is_cost_plus_client"("p_job_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_internal"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.internal_access ia
    WHERE ia.profile_id = auth.uid()
      AND ia.is_active = true
  );
$$;


ALTER FUNCTION "public"."is_internal"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_internal_email"("p_email" "text") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE email = lower(p_email)
      AND role IN ('admin', 'pm', 'bookkeeper', 'sub')
      AND is_active = true
  );
$$;


ALTER FUNCTION "public"."is_internal_email"("p_email" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_sub_on_job"("p_job_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM job_assignments ja
    JOIN profiles p ON p.id = ja.user_id
    WHERE ja.job_id = p_job_id AND ja.user_id = auth.uid() AND p.role IN ('sub','vendor')
  );
$$;


ALTER FUNCTION "public"."is_sub_on_job"("p_job_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rls_auto_enable"() RETURNS "event_trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog'
    AS $$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$$;


ALTER FUNCTION "public"."rls_auto_enable"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_baseline_on_insert_sub_schedule"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.job_baselines jb
    WHERE jb.job_id = NEW.job_id
  ) THEN
    IF NEW.baseline_start_date IS NULL THEN
      NEW.baseline_start_date := NEW.start_date;
    END IF;

    IF NEW.baseline_end_date IS NULL THEN
      NEW.baseline_end_date := NEW.end_date;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_baseline_on_insert_sub_schedule"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."set_updated_at"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."checklist_items" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "job_id" "uuid",
    "stage" "public"."job_stage" NOT NULL,
    "label" "text" NOT NULL,
    "is_required" boolean DEFAULT false NOT NULL,
    "source" "public"."checklist_source" DEFAULT 'master'::"public"."checklist_source" NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."checklist_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."companies" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "type" "text" DEFAULT 'sub'::"text" NOT NULL,
    "phone" "text",
    "email" "text",
    "address" "text",
    "notes" "text",
    "coi_gl_path" "text",
    "coi_gl_expires" "date",
    "coi_wc_path" "text",
    "coi_wc_expires" "date",
    "coi_type" "text",
    "w9_path" "text",
    "w9_received_at" timestamp with time zone,
    "general_contract_path" "text",
    "general_contract_signed_at" timestamp with time zone,
    "general_contract_signed_by" "text",
    "can_be_scheduled" boolean DEFAULT false NOT NULL,
    "can_supply_materials" boolean DEFAULT false NOT NULL,
    "requires_coi" boolean DEFAULT false NOT NULL,
    "requires_w9" boolean DEFAULT false NOT NULL,
    "requires_signed_contract" boolean DEFAULT false NOT NULL,
    "company_name" "text",
    "is_subcontractor" boolean DEFAULT false NOT NULL,
    "is_vendor" boolean DEFAULT false NOT NULL,
    "is_service_company" boolean DEFAULT false NOT NULL,
    "primary_address" "text",
    "billing_same_as_primary" boolean DEFAULT true NOT NULL,
    "billing_address" "text",
    CONSTRAINT "companies_coi_type_check" CHECK (("coi_type" = ANY (ARRAY['gl_only'::"text", 'wc_only'::"text", 'both'::"text"]))),
    CONSTRAINT "companies_type_check" CHECK (("type" = ANY (ARRAY['sub'::"text", 'vendor'::"text", 'both'::"text"])))
);


ALTER TABLE "public"."companies" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."company_compliance_documents" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "doc_type" "text" NOT NULL,
    "label" "text",
    "storage_path" "text",
    "expires_at" "date",
    "received_at" timestamp with time zone,
    "signed_by" "text",
    "notes" "text",
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "chk_compliance_doc_type" CHECK (("doc_type" = ANY (ARRAY['coi_gl'::"text", 'coi_wc'::"text", 'w9'::"text", 'general_contract'::"text", 'other'::"text"])))
);


ALTER TABLE "public"."company_compliance_documents" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."company_contacts" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "full_name" "text" NOT NULL,
    "title" "text",
    "email" "text",
    "phone" "text",
    "is_primary" boolean DEFAULT false NOT NULL,
    "role_scheduling" boolean DEFAULT false NOT NULL,
    "role_invoicing" boolean DEFAULT false NOT NULL,
    "role_compliance" boolean DEFAULT false NOT NULL,
    "role_general" boolean DEFAULT true NOT NULL,
    "notes" "text",
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."company_contacts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."company_memberships" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "profile_id" "uuid" NOT NULL,
    "receives_job_notifications" boolean DEFAULT true NOT NULL,
    "receives_compliance_notifications" boolean DEFAULT false NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "contact_type" "text",
    "is_company_admin" boolean DEFAULT false NOT NULL,
    "phone" "text",
    "title" "text",
    CONSTRAINT "company_memberships_contact_type_check" CHECK (("contact_type" = ANY (ARRAY['admin'::"text", 'bookkeeping'::"text", 'project_manager'::"text", 'scheduler'::"text", 'insurance'::"text", 'estimator'::"text", 'primary_rep'::"text", 'safety_officer'::"text", 'owners_rep'::"text"])))
);


ALTER TABLE "public"."company_memberships" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."company_trade_assignments" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "company_id" "uuid" NOT NULL,
    "trade_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."company_trade_assignments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."cost_codes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "trade_id" "uuid",
    "cost_code" "text" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "is_active" boolean DEFAULT true NOT NULL,
    "sort_order" integer DEFAULT 100 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."cost_codes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."document_line_items" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "document_id" "uuid" NOT NULL,
    "job_id" "uuid" NOT NULL,
    "trade" "text" NOT NULL,
    "description" "text" NOT NULL,
    "client_label" "text",
    "qty" numeric(10,3),
    "unit" "text",
    "unit_cost" numeric(10,2),
    "lump_amount" numeric(12,2),
    "show_detail_to_client" boolean DEFAULT false NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."document_line_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."documents" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "job_id" "uuid" NOT NULL,
    "doc_type" "public"."document_type" NOT NULL,
    "doc_number" "text",
    "status" "public"."document_status" DEFAULT 'draft'::"public"."document_status" NOT NULL,
    "title" "text",
    "notes" "text",
    "client_message" "text",
    "adds_draw_milestone" boolean DEFAULT false NOT NULL,
    "new_draw_description" "text",
    "new_draw_amount" numeric(12,2),
    "draw_schedule_id" "uuid",
    "payment_due_date" "date",
    "paid_at" timestamp with time zone,
    "paid_by" "uuid",
    "valid_until" "date",
    "created_by" "uuid",
    "sent_at" timestamp with time zone,
    "sent_by" "uuid",
    "approved_at" timestamp with time zone,
    "approved_by" "uuid",
    "rejected_at" timestamp with time zone,
    "rejected_by" "uuid",
    "rejection_note" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."documents" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."draw_schedule" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "job_id" "uuid" NOT NULL,
    "milestone" "text" NOT NULL,
    "amount" numeric(12,2) DEFAULT 0 NOT NULL,
    "draw_date" "date",
    "status" "public"."draw_status" DEFAULT 'Pending'::"public"."draw_status" NOT NULL,
    "change_order_id" "uuid",
    "sort_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."draw_schedule" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."estimate_items" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "job_id" "uuid" NOT NULL,
    "master_price_sheet_id" "uuid",
    "trade" "text" NOT NULL,
    "description" "text" NOT NULL,
    "qty" numeric(10,3),
    "unit" "text",
    "unit_cost" numeric(10,2),
    "extended_cost" numeric(12,2) GENERATED ALWAYS AS ((COALESCE("qty", (0)::numeric) * COALESCE("unit_cost", (0)::numeric))) STORED,
    "notes" "text",
    "sort_order" integer DEFAULT 0 NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."estimate_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."estimate_line_items" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "estimate_id" "uuid" NOT NULL,
    "takeoff_item_id" "uuid",
    "cost_code" "text",
    "label" "text" NOT NULL,
    "amount" numeric(12,2) DEFAULT 0 NOT NULL,
    "is_visible_to_client" boolean DEFAULT true NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."estimate_line_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."estimates" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "job_id" "uuid" NOT NULL,
    "title" "text" DEFAULT 'Estimate'::"text" NOT NULL,
    "status" "public"."estimate_status" DEFAULT 'draft'::"public"."estimate_status" NOT NULL,
    "margin_pct" numeric(5,2) DEFAULT 15 NOT NULL,
    "overhead_pct" numeric(5,2) DEFAULT 10 NOT NULL,
    "is_change_order" boolean DEFAULT false NOT NULL,
    "parent_estimate_id" "uuid",
    "signature_path" "text",
    "signed_at" timestamp with time zone,
    "signed_by_name" "text",
    "signed_ip" "text",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."estimates" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."file_attachment_access" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "file_attachment_id" "uuid" NOT NULL,
    "company_id" "uuid" NOT NULL,
    "granted_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."file_attachment_access" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."file_attachments" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "job_id" "uuid" NOT NULL,
    "category" "text" DEFAULT 'other'::"text" NOT NULL,
    "filename" "text" NOT NULL,
    "storage_path" "text" NOT NULL,
    "size_bytes" integer,
    "mime_type" "text",
    "uploaded_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "display_name" "text",
    "notes" "text",
    "client_visible" boolean DEFAULT false NOT NULL,
    "companies_visible" boolean DEFAULT false NOT NULL,
    "company_scope" "text",
    "document_id" "uuid",
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "visibility_scope" "text" DEFAULT 'internal_only'::"text" NOT NULL,
    "include_in_packet" boolean DEFAULT false NOT NULL,
    "entity_type" "text" DEFAULT 'job'::"text" NOT NULL,
    "schedule_item_id" "uuid",
    "procurement_item_id" "uuid",
    "task_id" "uuid",
    CONSTRAINT "file_attachments_company_scope_check" CHECK ((("company_scope" = ANY (ARRAY['all'::"text", 'selected'::"text"])) OR ("company_scope" IS NULL))),
    CONSTRAINT "file_attachments_company_visibility_consistency_check" CHECK (((("companies_visible" = false) AND ("company_scope" IS NULL)) OR (("companies_visible" = true) AND ("company_scope" = ANY (ARRAY['all'::"text", 'selected'::"text"]))))),
    CONSTRAINT "file_attachments_entity_type_check" CHECK (("entity_type" = ANY (ARRAY['job'::"text", 'schedule_item'::"text", 'procurement_item'::"text", 'task'::"text"]))),
    CONSTRAINT "file_attachments_folder_check" CHECK (("category" = ANY (ARRAY['contracts'::"text", 'plans'::"text", 'photos'::"text", 'selections'::"text", 'permits'::"text", 'lien-waivers'::"text", 'change-orders'::"text", 'other'::"text", 'coi'::"text", 'w9'::"text", 'general-contract'::"text", 'admin'::"text"]))),
    CONSTRAINT "file_attachments_visibility_scope_check" CHECK (("visibility_scope" = ANY (ARRAY['internal_only'::"text", 'tagged_external'::"text", 'all_external_except_client'::"text", 'all_external_including_client'::"text"])))
);


ALTER TABLE "public"."file_attachments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."file_trade_tags" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "file_attachment_id" "uuid" NOT NULL,
    "trade_id" "uuid" NOT NULL
);


ALTER TABLE "public"."file_trade_tags" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."internal_access" (
    "profile_id" "uuid" NOT NULL,
    "is_admin" boolean DEFAULT false NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "role" "text" DEFAULT 'general'::"text" NOT NULL,
    CONSTRAINT "internal_access_role_check" CHECK (("role" = ANY (ARRAY['project_manager'::"text", 'general'::"text"])))
);


ALTER TABLE "public"."internal_access" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."internal_role_assignments" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "profile_id" "uuid" NOT NULL,
    "role_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."internal_role_assignments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."internal_roles" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "key" "text" NOT NULL,
    "label" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."internal_roles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."invoice_line_items" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "document_id" "uuid" NOT NULL,
    "job_id" "uuid" NOT NULL,
    "description" "text" NOT NULL,
    "amount" numeric(12,2) NOT NULL,
    "source_price_sheet_item_id" "uuid",
    "sort_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."invoice_line_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."issues" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "job_id" "uuid" NOT NULL,
    "severity" "public"."issue_severity" DEFAULT 'Warning'::"public"."issue_severity" NOT NULL,
    "stage" "public"."job_stage",
    "title" "text" NOT NULL,
    "detail" "text",
    "logged_by" "uuid",
    "resolved" boolean DEFAULT false NOT NULL,
    "resolved_by" "uuid",
    "resolved_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."issues" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."job_assignments" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "job_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "assigned_by" "uuid",
    "assigned_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."job_assignments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."job_baselines" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "job_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid"
);


ALTER TABLE "public"."job_baselines" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."job_checklist_state" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "job_id" "uuid" NOT NULL,
    "checklist_item_id" "uuid" NOT NULL,
    "is_checked" boolean DEFAULT false NOT NULL,
    "checked_by" "uuid",
    "checked_at" timestamp with time zone
);


ALTER TABLE "public"."job_checklist_state" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."job_client_contacts" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "job_client_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "label" "text",
    "email" "text",
    "phone" "text",
    "is_primary" boolean DEFAULT false NOT NULL,
    "receives_notifications" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."job_client_contacts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."job_clients" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "job_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "client_kind" "text" NOT NULL,
    "company_name" "text",
    "is_primary" boolean DEFAULT false NOT NULL,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "job_clients_client_kind_check" CHECK (("client_kind" = ANY (ARRAY['individual'::"text", 'company'::"text"])))
);


ALTER TABLE "public"."job_clients" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."job_company_invitations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "job_id" "uuid" NOT NULL,
    "company_id" "uuid" NOT NULL,
    "role_on_job" "text" NOT NULL,
    "source" "text" DEFAULT 'manual'::"text" NOT NULL,
    "invited_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "invited_by" "uuid",
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "job_company_invitations_role_on_job_check" CHECK (("role_on_job" = ANY (ARRAY['subcontractor'::"text", 'vendor'::"text", 'both'::"text"]))),
    CONSTRAINT "job_company_invitations_source_check" CHECK (("source" = ANY (ARRAY['manual'::"text", 'schedule'::"text", 'procurement'::"text"])))
);


ALTER TABLE "public"."job_company_invitations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."job_deadlines" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "job_id" "uuid" NOT NULL,
    "stage" "public"."job_stage" NOT NULL,
    "deadline" "date" NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."job_deadlines" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."job_drive_links" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "job_id" "uuid" NOT NULL,
    "label" "text" NOT NULL,
    "url" "text" NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL
);


ALTER TABLE "public"."job_drive_links" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."job_logs" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "job_id" "uuid" NOT NULL,
    "author_id" "uuid",
    "body" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."job_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."job_scope_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "job_id" "uuid" NOT NULL,
    "scope_type" "text",
    "label" "text" NOT NULL,
    "value_text" "text",
    "value_number" numeric,
    "notes" "text",
    "sort_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."job_scope_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."job_selections" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "job_id" "uuid" NOT NULL,
    "item_label" "text" NOT NULL,
    "status" "text" DEFAULT 'required'::"text" NOT NULL,
    "chosen_value" "text",
    "notes" "text",
    "sort_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "job_selections_status_check" CHECK (("status" = ANY (ARRAY['required'::"text", 'in_progress'::"text", 'selected'::"text", 'approved'::"text"])))
);


ALTER TABLE "public"."job_selections" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."job_tasks" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "job_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "task_type" "text" NOT NULL,
    "status" "text" DEFAULT 'open'::"text" NOT NULL,
    "due_at" timestamp with time zone,
    "released_at" timestamp with time zone,
    "assignee_type" "text",
    "assignee_profile_id" "uuid",
    "assignee_company_id" "uuid",
    "assignee_job_client_contact_id" "uuid",
    "linked_schedule_id" "uuid",
    "linked_procurement_id" "uuid",
    "visible_to_external" boolean DEFAULT false NOT NULL,
    "requires_file_upload" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "job_tasks_assignee_shape" CHECK (((("assignee_type" IS NULL) AND ("assignee_profile_id" IS NULL) AND ("assignee_company_id" IS NULL) AND ("assignee_job_client_contact_id" IS NULL)) OR (("assignee_type" = 'internal_profile'::"text") AND ("assignee_profile_id" IS NOT NULL) AND ("assignee_company_id" IS NULL) AND ("assignee_job_client_contact_id" IS NULL)) OR (("assignee_type" = 'company'::"text") AND ("assignee_company_id" IS NOT NULL) AND ("assignee_profile_id" IS NULL) AND ("assignee_job_client_contact_id" IS NULL)) OR (("assignee_type" = 'job_client_contact'::"text") AND ("assignee_job_client_contact_id" IS NOT NULL) AND ("assignee_profile_id" IS NULL) AND ("assignee_company_id" IS NULL)))),
    CONSTRAINT "job_tasks_assignee_type_check" CHECK ((("assignee_type" IS NULL) OR ("assignee_type" = ANY (ARRAY['internal_profile'::"text", 'company'::"text", 'job_client_contact'::"text"])))),
    CONSTRAINT "job_tasks_status_check" CHECK (("status" = ANY (ARRAY['open'::"text", 'in_progress'::"text", 'complete'::"text", 'cancelled'::"text", 'blocked'::"text"]))),
    CONSTRAINT "job_tasks_task_type_check" CHECK (("task_type" = ANY (ARRAY['general'::"text", 'selection'::"text", 'approval'::"text", 'signature'::"text", 'invoice'::"text", 'schedule'::"text", 'procurement'::"text"])))
);


ALTER TABLE "public"."job_tasks" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."jobs" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "client_name" "text" NOT NULL,
    "project_address" "text" NOT NULL,
    "pm_id" "uuid",
    "color" "text" DEFAULT '#3B8BD4'::"text" NOT NULL,
    "sqft" integer,
    "lot_sqft" integer,
    "referral_source" "text",
    "scope_notes" "text",
    "current_stage" "public"."job_stage" DEFAULT 'intake'::"public"."job_stage" NOT NULL,
    "contract_type" "public"."contract_type" DEFAULT 'fixed_price'::"public"."contract_type" NOT NULL,
    "margin_pct" numeric(5,2) DEFAULT 15 NOT NULL,
    "overhead_pct" numeric(5,2) DEFAULT 10 NOT NULL,
    "drive_folder_url" "text",
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "last_touched_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "job_name" "text",
    "client_email" "text",
    "client_phone" "text",
    "garage_code" "text",
    "lockbox_code" "text",
    "gate_code" "text",
    "parking_notes" "text",
    "neighborhood_requirements" "text",
    "estimator_profile_id" "uuid",
    "bookkeeper_profile_id" "uuid"
);


ALTER TABLE "public"."jobs" OWNER TO "postgres";


COMMENT ON TABLE "public"."jobs" IS 'Hendren Platform - staging baseline validated';



CREATE TABLE IF NOT EXISTS "public"."linked_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "owner_type" "text" NOT NULL,
    "owner_id" "uuid" NOT NULL,
    "job_id" "uuid",
    "log_type" "text",
    "note" "text",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."linked_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."master_price_sheet" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "trade" "text" NOT NULL,
    "description" "text" NOT NULL,
    "unit" "text" NOT NULL,
    "unit_cost" numeric(10,2) DEFAULT 0 NOT NULL,
    "lead_days" integer DEFAULT 7 NOT NULL,
    "vendor" "text",
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."master_price_sheet" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."procurement_items" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "job_id" "uuid" NOT NULL,
    "estimate_item_id" "uuid",
    "trade" "text" NOT NULL,
    "description" "text" NOT NULL,
    "vendor" "text",
    "qty" numeric(10,3),
    "unit" "text",
    "unit_cost" numeric(10,2),
    "extended_cost" numeric(12,2) GENERATED ALWAYS AS ((COALESCE("qty", (0)::numeric) * COALESCE("unit_cost", (0)::numeric))) STORED,
    "lead_days" integer DEFAULT 0 NOT NULL,
    "required_on_site_date" "date",
    "order_by_date" "date" GENERATED ALWAYS AS (
CASE
    WHEN ("required_on_site_date" IS NOT NULL) THEN ("required_on_site_date" - "lead_days")
    ELSE NULL::"date"
END) STORED,
    "ordered_date" "date",
    "confirmed_date" "date",
    "delivered_date" "date",
    "status" "public"."procurement_status" DEFAULT 'Pending'::"public"."procurement_status" NOT NULL,
    "depends_on" "public"."procurement_depends_on" DEFAULT 'contract_signed'::"public"."procurement_depends_on" NOT NULL,
    "selection_reference" "text",
    "notes" "text",
    "sort_order" integer DEFAULT 0 NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "procurement_group" "text",
    "linked_schedule_id" "uuid",
    "is_client_supplied" boolean DEFAULT false,
    "is_sub_supplied" boolean DEFAULT false,
    "requires_tracking" boolean DEFAULT true,
    "cost_code" "text",
    "assigned_company_id" "uuid",
    "released_at" timestamp with time zone,
    "vendor_eta_start" timestamp with time zone,
    "vendor_eta_end" timestamp with time zone,
    "vendor_response_notes" "text",
    "buffer_working_days" integer DEFAULT 5 NOT NULL,
    CONSTRAINT "procurement_items_buffer_working_days_check" CHECK (("buffer_working_days" >= 0))
);


ALTER TABLE "public"."procurement_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "full_name" "text" NOT NULL,
    "email" "text" NOT NULL,
    "role" "public"."user_role" DEFAULT 'sub'::"public"."user_role" NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "company" "text",
    "phone" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "is_admin" boolean DEFAULT false NOT NULL,
    "is_project_manager" boolean DEFAULT false NOT NULL
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."punchlist_items" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "sub_schedule_id" "uuid" NOT NULL,
    "job_id" "uuid" NOT NULL,
    "text" "text" NOT NULL,
    "is_done" boolean DEFAULT false NOT NULL,
    "completed_by" "uuid",
    "completed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."punchlist_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."risk_overrides" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "job_id" "uuid" NOT NULL,
    "risk_id" "text" NOT NULL,
    "note" "text" NOT NULL,
    "overridden_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."risk_overrides" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."schedule_edit_presence" (
    "job_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "last_seen_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."schedule_edit_presence" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."schedule_item_dependencies" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "job_id" "uuid" NOT NULL,
    "predecessor_type" "text" NOT NULL,
    "predecessor_id" "uuid" NOT NULL,
    "successor_type" "text" NOT NULL,
    "successor_id" "uuid" NOT NULL,
    "reference_point" "text" NOT NULL,
    "offset_working_days" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "sid_no_self_reference" CHECK ((NOT (("predecessor_type" = "successor_type") AND ("predecessor_id" = "successor_id")))),
    CONSTRAINT "sid_predecessor_type_check" CHECK (("predecessor_type" = ANY (ARRAY['schedule'::"text", 'procurement'::"text"]))),
    CONSTRAINT "sid_reference_point_check" CHECK (("reference_point" = ANY (ARRAY['start'::"text", 'end'::"text"]))),
    CONSTRAINT "sid_successor_type_check" CHECK (("successor_type" = ANY (ARRAY['schedule'::"text", 'procurement'::"text"])))
);


ALTER TABLE "public"."schedule_item_dependencies" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."selections" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "job_id" "uuid" NOT NULL,
    "category" "text" NOT NULL,
    "item" "text" NOT NULL,
    "vendor" "text",
    "model_no" "text",
    "color_finish" "text",
    "budget" numeric(10,2),
    "actual_cost" numeric(10,2),
    "deadline" "date",
    "status" "public"."selection_status" DEFAULT 'not_started'::"public"."selection_status" NOT NULL,
    "notes" "text",
    "sort_order" integer DEFAULT 0 NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "procurement_buffer_days" integer DEFAULT 14
);


ALTER TABLE "public"."selections" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."shared_documents" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "document_id" "uuid" NOT NULL,
    "job_id" "uuid" NOT NULL,
    "shared_with" "uuid" NOT NULL,
    "shared_by" "uuid",
    "shared_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "first_read_at" timestamp with time zone
);


ALTER TABLE "public"."shared_documents" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."stage_history" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "job_id" "uuid" NOT NULL,
    "from_stage" "public"."job_stage",
    "to_stage" "public"."job_stage" NOT NULL,
    "advanced_by" "uuid",
    "advanced_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."stage_history" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."sub_schedule" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "job_id" "uuid" NOT NULL,
    "trade" "text" NOT NULL,
    "sub_name" "text",
    "sub_user_id" "uuid",
    "start_date" "date",
    "end_date" "date",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "confirmed_date" "date",
    "trade_contact" "text",
    "is_critical_path" boolean DEFAULT false NOT NULL,
    "status" "public"."sub_status" DEFAULT 'tentative'::"public"."sub_status" NOT NULL,
    "depends_on" "public"."procurement_depends_on" DEFAULT 'contract_signed'::"public"."procurement_depends_on" NOT NULL,
    "is_released" boolean DEFAULT false,
    "release_date" "date",
    "notification_window_days" integer DEFAULT 14,
    "cost_code" "text",
    "assigned_company_id" "uuid",
    "released_at" timestamp with time zone,
    "duration_working_days" integer,
    "buffer_working_days" integer DEFAULT 0 NOT NULL,
    "include_saturday" boolean DEFAULT false NOT NULL,
    "include_sunday" boolean DEFAULT false NOT NULL,
    "is_locked" boolean DEFAULT false NOT NULL,
    "baseline_start_date" "date",
    "baseline_end_date" "date",
    "shift_reason_type" "text",
    "shift_reason_note" "text",
    CONSTRAINT "sub_schedule_buffer_working_days_check" CHECK (("buffer_working_days" >= 0)),
    CONSTRAINT "sub_schedule_duration_working_days_check" CHECK ((("duration_working_days" IS NULL) OR ("duration_working_days" >= 1)))
);


ALTER TABLE "public"."sub_schedule" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."takeoff_items" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "job_id" "uuid" NOT NULL,
    "cost_code" "text",
    "trade" "text" NOT NULL,
    "description" "text" NOT NULL,
    "qty" numeric(10,3),
    "unit" "text",
    "unit_cost" numeric(10,2),
    "extended_cost" numeric(12,2) GENERATED ALWAYS AS ((COALESCE("qty", (0)::numeric) * COALESCE("unit_cost", (0)::numeric))) STORED,
    "notes" "text",
    "sort_order" integer DEFAULT 0 NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."takeoff_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."trades" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "name" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "sort_order" integer DEFAULT 100 NOT NULL,
    "notes" "text",
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."trades" OWNER TO "postgres";


ALTER TABLE ONLY "public"."checklist_items"
    ADD CONSTRAINT "checklist_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."companies"
    ADD CONSTRAINT "companies_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."company_compliance_documents"
    ADD CONSTRAINT "company_compliance_documents_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."company_contacts"
    ADD CONSTRAINT "company_contacts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."company_memberships"
    ADD CONSTRAINT "company_memberships_company_id_profile_id_key" UNIQUE ("company_id", "profile_id");



ALTER TABLE ONLY "public"."company_memberships"
    ADD CONSTRAINT "company_memberships_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."company_trade_assignments"
    ADD CONSTRAINT "company_trade_assignments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."cost_codes"
    ADD CONSTRAINT "cost_codes_code_unique" UNIQUE ("cost_code");



ALTER TABLE ONLY "public"."cost_codes"
    ADD CONSTRAINT "cost_codes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."document_line_items"
    ADD CONSTRAINT "document_line_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."documents"
    ADD CONSTRAINT "documents_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."draw_schedule"
    ADD CONSTRAINT "draw_schedule_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."estimate_items"
    ADD CONSTRAINT "estimate_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."estimate_line_items"
    ADD CONSTRAINT "estimate_line_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."estimates"
    ADD CONSTRAINT "estimates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."file_attachment_access"
    ADD CONSTRAINT "file_attachment_access_file_attachment_id_company_id_key" UNIQUE ("file_attachment_id", "company_id");



ALTER TABLE ONLY "public"."file_attachment_access"
    ADD CONSTRAINT "file_attachment_access_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."file_attachments"
    ADD CONSTRAINT "file_attachments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."file_trade_tags"
    ADD CONSTRAINT "file_trade_tags_file_trade_unique" UNIQUE ("file_attachment_id", "trade_id");



ALTER TABLE ONLY "public"."file_trade_tags"
    ADD CONSTRAINT "file_trade_tags_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."internal_access"
    ADD CONSTRAINT "internal_access_pkey" PRIMARY KEY ("profile_id");



ALTER TABLE ONLY "public"."internal_role_assignments"
    ADD CONSTRAINT "internal_role_assignments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."internal_role_assignments"
    ADD CONSTRAINT "internal_role_assignments_profile_role_unique" UNIQUE ("profile_id", "role_id");



ALTER TABLE ONLY "public"."internal_roles"
    ADD CONSTRAINT "internal_roles_key_key" UNIQUE ("key");



ALTER TABLE ONLY "public"."internal_roles"
    ADD CONSTRAINT "internal_roles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."invoice_line_items"
    ADD CONSTRAINT "invoice_line_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."issues"
    ADD CONSTRAINT "issues_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."job_assignments"
    ADD CONSTRAINT "job_assignments_job_id_user_id_key" UNIQUE ("job_id", "user_id");



ALTER TABLE ONLY "public"."job_assignments"
    ADD CONSTRAINT "job_assignments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."job_baselines"
    ADD CONSTRAINT "job_baselines_job_id_key" UNIQUE ("job_id");



ALTER TABLE ONLY "public"."job_baselines"
    ADD CONSTRAINT "job_baselines_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."job_checklist_state"
    ADD CONSTRAINT "job_checklist_state_job_id_checklist_item_id_key" UNIQUE ("job_id", "checklist_item_id");



ALTER TABLE ONLY "public"."job_checklist_state"
    ADD CONSTRAINT "job_checklist_state_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."job_client_contacts"
    ADD CONSTRAINT "job_client_contacts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."job_clients"
    ADD CONSTRAINT "job_clients_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."job_company_invitations"
    ADD CONSTRAINT "job_company_invitations_job_id_company_id_key" UNIQUE ("job_id", "company_id");



ALTER TABLE ONLY "public"."job_company_invitations"
    ADD CONSTRAINT "job_company_invitations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."job_deadlines"
    ADD CONSTRAINT "job_deadlines_job_id_stage_key" UNIQUE ("job_id", "stage");



ALTER TABLE ONLY "public"."job_deadlines"
    ADD CONSTRAINT "job_deadlines_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."job_drive_links"
    ADD CONSTRAINT "job_drive_links_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."job_logs"
    ADD CONSTRAINT "job_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."job_scope_items"
    ADD CONSTRAINT "job_scope_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."job_selections"
    ADD CONSTRAINT "job_selections_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."job_tasks"
    ADD CONSTRAINT "job_tasks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."jobs"
    ADD CONSTRAINT "jobs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."linked_logs"
    ADD CONSTRAINT "linked_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."master_price_sheet"
    ADD CONSTRAINT "master_price_sheet_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."procurement_items"
    ADD CONSTRAINT "procurement_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."punchlist_items"
    ADD CONSTRAINT "punchlist_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."risk_overrides"
    ADD CONSTRAINT "risk_overrides_job_id_risk_id_key" UNIQUE ("job_id", "risk_id");



ALTER TABLE ONLY "public"."risk_overrides"
    ADD CONSTRAINT "risk_overrides_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."schedule_edit_presence"
    ADD CONSTRAINT "schedule_edit_presence_pkey" PRIMARY KEY ("job_id", "user_id");



ALTER TABLE ONLY "public"."schedule_item_dependencies"
    ADD CONSTRAINT "schedule_item_dependencies_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."selections"
    ADD CONSTRAINT "selections_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."shared_documents"
    ADD CONSTRAINT "shared_documents_document_id_shared_with_key" UNIQUE ("document_id", "shared_with");



ALTER TABLE ONLY "public"."shared_documents"
    ADD CONSTRAINT "shared_documents_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."schedule_item_dependencies"
    ADD CONSTRAINT "sid_unique_edge" UNIQUE ("job_id", "predecessor_type", "predecessor_id", "successor_type", "successor_id", "reference_point", "offset_working_days");



ALTER TABLE ONLY "public"."stage_history"
    ADD CONSTRAINT "stage_history_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sub_schedule"
    ADD CONSTRAINT "sub_schedule_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."takeoff_items"
    ADD CONSTRAINT "takeoff_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."trades"
    ADD CONSTRAINT "trades_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."trades"
    ADD CONSTRAINT "trades_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."company_trade_assignments"
    ADD CONSTRAINT "uq_company_trade" UNIQUE ("company_id", "trade_id");



CREATE UNIQUE INDEX "company_memberships_company_id_profile_id_uidx" ON "public"."company_memberships" USING "btree" ("company_id", "profile_id");



CREATE INDEX "cost_codes_is_active_idx" ON "public"."cost_codes" USING "btree" ("is_active");



CREATE INDEX "cost_codes_sort_order_title_idx" ON "public"."cost_codes" USING "btree" ("sort_order", "title");



CREATE INDEX "cost_codes_trade_id_idx" ON "public"."cost_codes" USING "btree" ("trade_id");



CREATE INDEX "file_trade_tags_file_attachment_id_idx" ON "public"."file_trade_tags" USING "btree" ("file_attachment_id");



CREATE INDEX "file_trade_tags_trade_id_idx" ON "public"."file_trade_tags" USING "btree" ("trade_id");



CREATE INDEX "idx_cl_items_job_id" ON "public"."checklist_items" USING "btree" ("job_id");



CREATE INDEX "idx_cl_items_stage" ON "public"."checklist_items" USING "btree" ("stage");



CREATE INDEX "idx_cl_state_job_id" ON "public"."job_checklist_state" USING "btree" ("job_id");



CREATE INDEX "idx_companies_coi_gl_expires" ON "public"."companies" USING "btree" ("coi_gl_expires") WHERE ("coi_gl_expires" IS NOT NULL);



CREATE INDEX "idx_companies_coi_wc_expires" ON "public"."companies" USING "btree" ("coi_wc_expires") WHERE ("coi_wc_expires" IS NOT NULL);



CREATE INDEX "idx_companies_type" ON "public"."companies" USING "btree" ("type");



CREATE INDEX "idx_company_compliance_docs_company_id" ON "public"."company_compliance_documents" USING "btree" ("company_id");



CREATE INDEX "idx_company_compliance_docs_type" ON "public"."company_compliance_documents" USING "btree" ("doc_type");



CREATE INDEX "idx_company_contacts_company_id" ON "public"."company_contacts" USING "btree" ("company_id");



CREATE UNIQUE INDEX "idx_company_contacts_one_primary" ON "public"."company_contacts" USING "btree" ("company_id") WHERE ("is_primary" = true);



CREATE INDEX "idx_company_memberships_company" ON "public"."company_memberships" USING "btree" ("company_id");



CREATE INDEX "idx_company_trade_assignments_company_id" ON "public"."company_trade_assignments" USING "btree" ("company_id");



CREATE INDEX "idx_company_trade_assignments_trade_id" ON "public"."company_trade_assignments" USING "btree" ("trade_id");



CREATE INDEX "idx_doc_lines_doc_id" ON "public"."document_line_items" USING "btree" ("document_id");



CREATE INDEX "idx_docs_job_id" ON "public"."documents" USING "btree" ("job_id");



CREATE INDEX "idx_draw_job_id" ON "public"."draw_schedule" USING "btree" ("job_id");



CREATE INDEX "idx_estimate_items_job_id" ON "public"."estimate_items" USING "btree" ("job_id");



CREATE INDEX "idx_file_attachments_folder" ON "public"."file_attachments" USING "btree" ("job_id", "category");



CREATE INDEX "idx_file_attachments_job_id" ON "public"."file_attachments" USING "btree" ("job_id");



CREATE INDEX "idx_inv_lines_doc_id" ON "public"."invoice_line_items" USING "btree" ("document_id");



CREATE INDEX "idx_issues_job_id" ON "public"."issues" USING "btree" ("job_id");



CREATE INDEX "idx_issues_resolved" ON "public"."issues" USING "btree" ("resolved");



CREATE INDEX "idx_issues_severity" ON "public"."issues" USING "btree" ("severity");



CREATE INDEX "idx_ja_job_id" ON "public"."job_assignments" USING "btree" ("job_id");



CREATE INDEX "idx_ja_user_id" ON "public"."job_assignments" USING "btree" ("user_id");



CREATE INDEX "idx_jobs_contract_type" ON "public"."jobs" USING "btree" ("contract_type");



CREATE INDEX "idx_jobs_is_active" ON "public"."jobs" USING "btree" ("is_active");



CREATE INDEX "idx_jobs_pm_id" ON "public"."jobs" USING "btree" ("pm_id");



CREATE INDEX "idx_jobs_stage" ON "public"."jobs" USING "btree" ("current_stage");



CREATE INDEX "idx_logs_job_id" ON "public"."job_logs" USING "btree" ("job_id");



CREATE INDEX "idx_procurement_job_id" ON "public"."procurement_items" USING "btree" ("job_id");



CREATE INDEX "idx_procurement_order_by_date" ON "public"."procurement_items" USING "btree" ("order_by_date");



CREATE INDEX "idx_profiles_is_project_manager" ON "public"."profiles" USING "btree" ("is_project_manager");



CREATE INDEX "idx_punchlist_sub_id" ON "public"."punchlist_items" USING "btree" ("sub_schedule_id");



CREATE INDEX "idx_shared_docs_doc_id" ON "public"."shared_documents" USING "btree" ("document_id");



CREATE INDEX "idx_shared_docs_with" ON "public"."shared_documents" USING "btree" ("shared_with");



CREATE INDEX "idx_stage_hist_job_id" ON "public"."stage_history" USING "btree" ("job_id");



CREATE INDEX "idx_sub_sched_job_id" ON "public"."sub_schedule" USING "btree" ("job_id");



CREATE INDEX "idx_sub_schedule_start_date" ON "public"."sub_schedule" USING "btree" ("start_date");



CREATE INDEX "idx_sub_schedule_status" ON "public"."sub_schedule" USING "btree" ("status");



CREATE INDEX "internal_role_assignments_profile_id_idx" ON "public"."internal_role_assignments" USING "btree" ("profile_id");



CREATE INDEX "internal_role_assignments_role_id_idx" ON "public"."internal_role_assignments" USING "btree" ("role_id");



CREATE INDEX "job_client_contacts_job_client_id_idx" ON "public"."job_client_contacts" USING "btree" ("job_client_id");



CREATE INDEX "job_clients_job_id_idx" ON "public"."job_clients" USING "btree" ("job_id");



CREATE INDEX "job_scope_items_job_id_idx" ON "public"."job_scope_items" USING "btree" ("job_id");



CREATE INDEX "job_selections_job_id_idx" ON "public"."job_selections" USING "btree" ("job_id");



CREATE INDEX "job_selections_job_sort_idx" ON "public"."job_selections" USING "btree" ("job_id", "sort_order", "created_at");



CREATE INDEX "job_tasks_assignee_company_id_idx" ON "public"."job_tasks" USING "btree" ("assignee_company_id");



CREATE INDEX "job_tasks_assignee_job_client_contact_id_idx" ON "public"."job_tasks" USING "btree" ("assignee_job_client_contact_id");



CREATE INDEX "job_tasks_assignee_profile_id_idx" ON "public"."job_tasks" USING "btree" ("assignee_profile_id");



CREATE INDEX "job_tasks_job_id_idx" ON "public"."job_tasks" USING "btree" ("job_id");



CREATE INDEX "job_tasks_linked_procurement_id_idx" ON "public"."job_tasks" USING "btree" ("linked_procurement_id");



CREATE INDEX "job_tasks_linked_schedule_id_idx" ON "public"."job_tasks" USING "btree" ("linked_schedule_id");



CREATE INDEX "job_tasks_status_idx" ON "public"."job_tasks" USING "btree" ("status");



CREATE INDEX "job_tasks_task_type_idx" ON "public"."job_tasks" USING "btree" ("task_type");



CREATE INDEX "jobs_bookkeeper_profile_id_idx" ON "public"."jobs" USING "btree" ("bookkeeper_profile_id");



CREATE INDEX "jobs_estimator_profile_id_idx" ON "public"."jobs" USING "btree" ("estimator_profile_id");



CREATE INDEX "procurement_items_assigned_company_id_idx" ON "public"."procurement_items" USING "btree" ("assigned_company_id");



CREATE INDEX "procurement_items_released_at_idx" ON "public"."procurement_items" USING "btree" ("released_at");



CREATE INDEX "sid_job_id_idx" ON "public"."schedule_item_dependencies" USING "btree" ("job_id");



CREATE INDEX "sid_predecessor_idx" ON "public"."schedule_item_dependencies" USING "btree" ("predecessor_type", "predecessor_id");



CREATE INDEX "sid_successor_idx" ON "public"."schedule_item_dependencies" USING "btree" ("successor_type", "successor_id");



CREATE INDEX "sub_schedule_assigned_company_id_idx" ON "public"."sub_schedule" USING "btree" ("assigned_company_id");



CREATE INDEX "sub_schedule_released_at_idx" ON "public"."sub_schedule" USING "btree" ("released_at");



CREATE INDEX "takeoff_items_job_id_idx" ON "public"."takeoff_items" USING "btree" ("job_id");



CREATE OR REPLACE TRIGGER "documents_updated_at" BEFORE UPDATE ON "public"."documents" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE OR REPLACE TRIGGER "draw_schedule_updated_at" BEFORE UPDATE ON "public"."draw_schedule" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE OR REPLACE TRIGGER "estimate_items_updated_at" BEFORE UPDATE ON "public"."estimate_items" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE OR REPLACE TRIGGER "estimates_updated_at" BEFORE UPDATE ON "public"."estimates" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE OR REPLACE TRIGGER "jobs_updated_at" BEFORE UPDATE ON "public"."jobs" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE OR REPLACE TRIGGER "master_price_sheet_updated_at" BEFORE UPDATE ON "public"."master_price_sheet" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE OR REPLACE TRIGGER "procurement_items_updated_at" BEFORE UPDATE ON "public"."procurement_items" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE OR REPLACE TRIGGER "profiles_updated_at" BEFORE UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE OR REPLACE TRIGGER "schedule_item_dependencies_updated_at" BEFORE UPDATE ON "public"."schedule_item_dependencies" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE OR REPLACE TRIGGER "selections_updated_at" BEFORE UPDATE ON "public"."selections" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE OR REPLACE TRIGGER "set_companies_updated_at" BEFORE UPDATE ON "public"."companies" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE OR REPLACE TRIGGER "set_company_memberships_updated_at" BEFORE UPDATE ON "public"."company_memberships" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE OR REPLACE TRIGGER "set_file_attachments_updated_at" BEFORE UPDATE ON "public"."file_attachments" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE OR REPLACE TRIGGER "set_job_company_invitations_updated_at" BEFORE UPDATE ON "public"."job_company_invitations" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE OR REPLACE TRIGGER "set_job_selections_updated_at" BEFORE UPDATE ON "public"."job_selections" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "sub_schedule_updated_at" BEFORE UPDATE ON "public"."sub_schedule" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE OR REPLACE TRIGGER "takeoff_items_updated_at" BEFORE UPDATE ON "public"."takeoff_items" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE OR REPLACE TRIGGER "trg_companies_updated_at" BEFORE UPDATE ON "public"."companies" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_company_compliance_docs_updated_at" BEFORE UPDATE ON "public"."company_compliance_documents" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_company_contacts_updated_at" BEFORE UPDATE ON "public"."company_contacts" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_set_baseline_on_insert_sub_schedule" BEFORE INSERT ON "public"."sub_schedule" FOR EACH ROW EXECUTE FUNCTION "public"."set_baseline_on_insert_sub_schedule"();



ALTER TABLE ONLY "public"."checklist_items"
    ADD CONSTRAINT "checklist_items_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."company_compliance_documents"
    ADD CONSTRAINT "company_compliance_documents_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."company_contacts"
    ADD CONSTRAINT "company_contacts_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."company_memberships"
    ADD CONSTRAINT "company_memberships_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."company_memberships"
    ADD CONSTRAINT "company_memberships_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."company_trade_assignments"
    ADD CONSTRAINT "company_trade_assignments_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."company_trade_assignments"
    ADD CONSTRAINT "company_trade_assignments_trade_id_fkey" FOREIGN KEY ("trade_id") REFERENCES "public"."trades"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."cost_codes"
    ADD CONSTRAINT "cost_codes_trade_id_fkey" FOREIGN KEY ("trade_id") REFERENCES "public"."trades"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."document_line_items"
    ADD CONSTRAINT "document_line_items_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."document_line_items"
    ADD CONSTRAINT "document_line_items_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."documents"
    ADD CONSTRAINT "documents_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."documents"
    ADD CONSTRAINT "documents_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."documents"
    ADD CONSTRAINT "documents_draw_schedule_id_fkey" FOREIGN KEY ("draw_schedule_id") REFERENCES "public"."draw_schedule"("id");



ALTER TABLE ONLY "public"."documents"
    ADD CONSTRAINT "documents_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."documents"
    ADD CONSTRAINT "documents_paid_by_fkey" FOREIGN KEY ("paid_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."documents"
    ADD CONSTRAINT "documents_rejected_by_fkey" FOREIGN KEY ("rejected_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."documents"
    ADD CONSTRAINT "documents_sent_by_fkey" FOREIGN KEY ("sent_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."draw_schedule"
    ADD CONSTRAINT "draw_schedule_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."estimate_items"
    ADD CONSTRAINT "estimate_items_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."estimate_items"
    ADD CONSTRAINT "estimate_items_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."estimate_items"
    ADD CONSTRAINT "estimate_items_master_price_sheet_id_fkey" FOREIGN KEY ("master_price_sheet_id") REFERENCES "public"."master_price_sheet"("id");



ALTER TABLE ONLY "public"."estimate_line_items"
    ADD CONSTRAINT "estimate_line_items_estimate_id_fkey" FOREIGN KEY ("estimate_id") REFERENCES "public"."estimates"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."estimate_line_items"
    ADD CONSTRAINT "estimate_line_items_takeoff_item_id_fkey" FOREIGN KEY ("takeoff_item_id") REFERENCES "public"."takeoff_items"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."estimates"
    ADD CONSTRAINT "estimates_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."estimates"
    ADD CONSTRAINT "estimates_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."estimates"
    ADD CONSTRAINT "estimates_parent_estimate_id_fkey" FOREIGN KEY ("parent_estimate_id") REFERENCES "public"."estimates"("id");



ALTER TABLE ONLY "public"."file_attachment_access"
    ADD CONSTRAINT "file_attachment_access_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."file_attachment_access"
    ADD CONSTRAINT "file_attachment_access_file_attachment_id_fkey" FOREIGN KEY ("file_attachment_id") REFERENCES "public"."file_attachments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."file_attachment_access"
    ADD CONSTRAINT "file_attachment_access_granted_by_fkey" FOREIGN KEY ("granted_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."file_attachments"
    ADD CONSTRAINT "file_attachments_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."file_attachments"
    ADD CONSTRAINT "file_attachments_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."file_attachments"
    ADD CONSTRAINT "file_attachments_procurement_item_id_fkey" FOREIGN KEY ("procurement_item_id") REFERENCES "public"."procurement_items"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."file_attachments"
    ADD CONSTRAINT "file_attachments_schedule_item_id_fkey" FOREIGN KEY ("schedule_item_id") REFERENCES "public"."sub_schedule"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."file_attachments"
    ADD CONSTRAINT "file_attachments_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "public"."job_tasks"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."file_attachments"
    ADD CONSTRAINT "file_attachments_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."file_trade_tags"
    ADD CONSTRAINT "file_trade_tags_file_attachment_id_fkey" FOREIGN KEY ("file_attachment_id") REFERENCES "public"."file_attachments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."file_trade_tags"
    ADD CONSTRAINT "file_trade_tags_trade_id_fkey" FOREIGN KEY ("trade_id") REFERENCES "public"."trades"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."draw_schedule"
    ADD CONSTRAINT "fk_draw_schedule_change_order" FOREIGN KEY ("change_order_id") REFERENCES "public"."documents"("id");



ALTER TABLE ONLY "public"."procurement_items"
    ADD CONSTRAINT "fk_procurement_schedule" FOREIGN KEY ("linked_schedule_id") REFERENCES "public"."sub_schedule"("id");



ALTER TABLE ONLY "public"."internal_access"
    ADD CONSTRAINT "internal_access_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."internal_role_assignments"
    ADD CONSTRAINT "internal_role_assignments_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."internal_role_assignments"
    ADD CONSTRAINT "internal_role_assignments_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "public"."internal_roles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."invoice_line_items"
    ADD CONSTRAINT "invoice_line_items_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."invoice_line_items"
    ADD CONSTRAINT "invoice_line_items_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."issues"
    ADD CONSTRAINT "issues_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."issues"
    ADD CONSTRAINT "issues_logged_by_fkey" FOREIGN KEY ("logged_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."issues"
    ADD CONSTRAINT "issues_resolved_by_fkey" FOREIGN KEY ("resolved_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."job_assignments"
    ADD CONSTRAINT "job_assignments_assigned_by_fkey" FOREIGN KEY ("assigned_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."job_assignments"
    ADD CONSTRAINT "job_assignments_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."job_assignments"
    ADD CONSTRAINT "job_assignments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."job_baselines"
    ADD CONSTRAINT "job_baselines_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."job_baselines"
    ADD CONSTRAINT "job_baselines_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."job_checklist_state"
    ADD CONSTRAINT "job_checklist_state_checked_by_fkey" FOREIGN KEY ("checked_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."job_checklist_state"
    ADD CONSTRAINT "job_checklist_state_checklist_item_id_fkey" FOREIGN KEY ("checklist_item_id") REFERENCES "public"."checklist_items"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."job_checklist_state"
    ADD CONSTRAINT "job_checklist_state_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."job_client_contacts"
    ADD CONSTRAINT "job_client_contacts_job_client_id_fkey" FOREIGN KEY ("job_client_id") REFERENCES "public"."job_clients"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."job_clients"
    ADD CONSTRAINT "job_clients_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."job_company_invitations"
    ADD CONSTRAINT "job_company_invitations_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."job_company_invitations"
    ADD CONSTRAINT "job_company_invitations_invited_by_fkey" FOREIGN KEY ("invited_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."job_company_invitations"
    ADD CONSTRAINT "job_company_invitations_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."job_deadlines"
    ADD CONSTRAINT "job_deadlines_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."job_drive_links"
    ADD CONSTRAINT "job_drive_links_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."job_logs"
    ADD CONSTRAINT "job_logs_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."job_logs"
    ADD CONSTRAINT "job_logs_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."job_scope_items"
    ADD CONSTRAINT "job_scope_items_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."job_selections"
    ADD CONSTRAINT "job_selections_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."job_tasks"
    ADD CONSTRAINT "job_tasks_assignee_company_id_fkey" FOREIGN KEY ("assignee_company_id") REFERENCES "public"."companies"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."job_tasks"
    ADD CONSTRAINT "job_tasks_assignee_job_client_contact_id_fkey" FOREIGN KEY ("assignee_job_client_contact_id") REFERENCES "public"."job_client_contacts"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."job_tasks"
    ADD CONSTRAINT "job_tasks_assignee_profile_id_fkey" FOREIGN KEY ("assignee_profile_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."job_tasks"
    ADD CONSTRAINT "job_tasks_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."job_tasks"
    ADD CONSTRAINT "job_tasks_linked_procurement_id_fkey" FOREIGN KEY ("linked_procurement_id") REFERENCES "public"."procurement_items"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."job_tasks"
    ADD CONSTRAINT "job_tasks_linked_schedule_id_fkey" FOREIGN KEY ("linked_schedule_id") REFERENCES "public"."sub_schedule"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."jobs"
    ADD CONSTRAINT "jobs_bookkeeper_profile_id_fkey" FOREIGN KEY ("bookkeeper_profile_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."jobs"
    ADD CONSTRAINT "jobs_estimator_profile_id_fkey" FOREIGN KEY ("estimator_profile_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."jobs"
    ADD CONSTRAINT "jobs_pm_id_fkey" FOREIGN KEY ("pm_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."linked_logs"
    ADD CONSTRAINT "linked_logs_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."linked_logs"
    ADD CONSTRAINT "linked_logs_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."procurement_items"
    ADD CONSTRAINT "procurement_items_assigned_company_id_fkey" FOREIGN KEY ("assigned_company_id") REFERENCES "public"."companies"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."procurement_items"
    ADD CONSTRAINT "procurement_items_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."procurement_items"
    ADD CONSTRAINT "procurement_items_estimate_item_id_fkey" FOREIGN KEY ("estimate_item_id") REFERENCES "public"."estimate_items"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."procurement_items"
    ADD CONSTRAINT "procurement_items_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."punchlist_items"
    ADD CONSTRAINT "punchlist_items_completed_by_fkey" FOREIGN KEY ("completed_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."punchlist_items"
    ADD CONSTRAINT "punchlist_items_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."punchlist_items"
    ADD CONSTRAINT "punchlist_items_sub_schedule_id_fkey" FOREIGN KEY ("sub_schedule_id") REFERENCES "public"."sub_schedule"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."risk_overrides"
    ADD CONSTRAINT "risk_overrides_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."risk_overrides"
    ADD CONSTRAINT "risk_overrides_overridden_by_fkey" FOREIGN KEY ("overridden_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."schedule_edit_presence"
    ADD CONSTRAINT "schedule_edit_presence_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."schedule_edit_presence"
    ADD CONSTRAINT "schedule_edit_presence_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."schedule_item_dependencies"
    ADD CONSTRAINT "schedule_item_dependencies_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."selections"
    ADD CONSTRAINT "selections_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."selections"
    ADD CONSTRAINT "selections_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."shared_documents"
    ADD CONSTRAINT "shared_documents_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."shared_documents"
    ADD CONSTRAINT "shared_documents_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."shared_documents"
    ADD CONSTRAINT "shared_documents_shared_by_fkey" FOREIGN KEY ("shared_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."shared_documents"
    ADD CONSTRAINT "shared_documents_shared_with_fkey" FOREIGN KEY ("shared_with") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."stage_history"
    ADD CONSTRAINT "stage_history_advanced_by_fkey" FOREIGN KEY ("advanced_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."stage_history"
    ADD CONSTRAINT "stage_history_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sub_schedule"
    ADD CONSTRAINT "sub_schedule_assigned_company_id_fkey" FOREIGN KEY ("assigned_company_id") REFERENCES "public"."companies"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."sub_schedule"
    ADD CONSTRAINT "sub_schedule_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."sub_schedule"
    ADD CONSTRAINT "sub_schedule_sub_user_id_fkey" FOREIGN KEY ("sub_user_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."takeoff_items"
    ADD CONSTRAINT "takeoff_items_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."takeoff_items"
    ADD CONSTRAINT "takeoff_items_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE CASCADE;



CREATE POLICY "Admins can manage cost codes" ON "public"."cost_codes" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."internal_access"
  WHERE (("internal_access"."profile_id" = "auth"."uid"()) AND ("internal_access"."is_admin" = true) AND ("internal_access"."is_active" = true))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."internal_access"
  WHERE (("internal_access"."profile_id" = "auth"."uid"()) AND ("internal_access"."is_admin" = true) AND ("internal_access"."is_active" = true)))));



CREATE POLICY "Authenticated users can read cost codes" ON "public"."cost_codes" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."checklist_items" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "checklist_job_internal_all" ON "public"."checklist_items" USING (("public"."is_internal"() AND ("job_id" IS NOT NULL)));



CREATE POLICY "checklist_master_select" ON "public"."checklist_items" FOR SELECT USING ((("job_id" IS NULL) AND "public"."is_internal"()));



CREATE POLICY "checklist_master_write" ON "public"."checklist_items" USING (("public"."is_internal"() AND ("job_id" IS NULL)));



CREATE POLICY "checklist_state_internal_all" ON "public"."job_checklist_state" USING ("public"."is_internal"());



ALTER TABLE "public"."companies" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "companies_internal_all" ON "public"."companies" USING ("public"."is_internal"());



ALTER TABLE "public"."company_compliance_documents" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "company_compliance_documents_internal_all" ON "public"."company_compliance_documents" USING ("public"."is_internal"()) WITH CHECK ("public"."is_internal"());



ALTER TABLE "public"."company_contacts" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "company_contacts_internal_all" ON "public"."company_contacts" USING ("public"."is_internal"()) WITH CHECK ("public"."is_internal"());



ALTER TABLE "public"."company_memberships" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "company_memberships_internal_all" ON "public"."company_memberships" USING ("public"."is_internal"()) WITH CHECK ("public"."is_internal"());



ALTER TABLE "public"."company_trade_assignments" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "company_trade_assignments_internal_all" ON "public"."company_trade_assignments" USING ("public"."is_internal"()) WITH CHECK ("public"."is_internal"());



ALTER TABLE "public"."cost_codes" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "deadlines_internal_all" ON "public"."job_deadlines" USING ("public"."is_internal"());



CREATE POLICY "doc_line_items_client_select" ON "public"."document_line_items" FOR SELECT USING (("public"."is_client_on_job"("job_id") AND (EXISTS ( SELECT 1
   FROM "public"."shared_documents" "sd"
  WHERE (("sd"."document_id" = "document_line_items"."document_id") AND ("sd"."shared_with" = "auth"."uid"()))))));



CREATE POLICY "doc_line_items_internal_all" ON "public"."document_line_items" USING ("public"."is_internal"());



ALTER TABLE "public"."document_line_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."documents" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "documents_client_co_approve" ON "public"."documents" FOR UPDATE USING (("public"."is_client_on_job"("job_id") AND ("doc_type" = 'change_order'::"public"."document_type") AND ("status" = 'sent'::"public"."document_status") AND (EXISTS ( SELECT 1
   FROM "public"."shared_documents" "sd"
  WHERE (("sd"."document_id" = "documents"."id") AND ("sd"."shared_with" = "auth"."uid"()))))));



CREATE POLICY "documents_client_shared" ON "public"."documents" FOR SELECT USING (("public"."is_client_on_job"("job_id") AND (EXISTS ( SELECT 1
   FROM "public"."shared_documents" "sd"
  WHERE (("sd"."document_id" = "documents"."id") AND ("sd"."shared_with" = "auth"."uid"()))))));



CREATE POLICY "documents_internal_all" ON "public"."documents" USING ("public"."is_internal"());



ALTER TABLE "public"."draw_schedule" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "draw_schedule_cost_plus_client" ON "public"."draw_schedule" FOR SELECT USING ("public"."is_cost_plus_client"("job_id"));



CREATE POLICY "draw_schedule_internal_all" ON "public"."draw_schedule" USING ("public"."is_internal"());



CREATE POLICY "drive_links_client_select" ON "public"."job_drive_links" FOR SELECT USING ("public"."is_client_on_job"("job_id"));



CREATE POLICY "drive_links_internal_all" ON "public"."job_drive_links" USING ("public"."is_internal"());



ALTER TABLE "public"."estimate_items" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "estimate_items_internal_all" ON "public"."estimate_items" USING ("public"."is_internal"());



ALTER TABLE "public"."estimate_line_items" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "estimate_line_items_internal" ON "public"."estimate_line_items" USING ("public"."is_internal"());



ALTER TABLE "public"."estimates" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "estimates_internal" ON "public"."estimates" USING ("public"."is_internal"());



ALTER TABLE "public"."file_attachment_access" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "file_attachment_access_internal_all" ON "public"."file_attachment_access" USING ("public"."is_internal"()) WITH CHECK ("public"."is_internal"());



ALTER TABLE "public"."file_attachments" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "file_attachments_internal" ON "public"."file_attachments" USING ("public"."is_internal"());



ALTER TABLE "public"."file_trade_tags" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "file_trade_tags_internal_all" ON "public"."file_trade_tags" USING ("public"."is_internal"()) WITH CHECK ("public"."is_internal"());



ALTER TABLE "public"."internal_access" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "internal_access_self_read" ON "public"."internal_access" USING (("profile_id" = "auth"."uid"())) WITH CHECK (("profile_id" = "auth"."uid"()));



ALTER TABLE "public"."internal_role_assignments" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "internal_role_assignments_internal_all" ON "public"."internal_role_assignments" USING ("public"."is_internal"()) WITH CHECK ("public"."is_internal"());



ALTER TABLE "public"."internal_roles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "internal_roles_internal_all" ON "public"."internal_roles" USING ("public"."is_internal"()) WITH CHECK ("public"."is_internal"());



CREATE POLICY "inv_line_items_client_select" ON "public"."invoice_line_items" FOR SELECT USING (("public"."is_client_on_job"("job_id") AND (EXISTS ( SELECT 1
   FROM "public"."shared_documents" "sd"
  WHERE (("sd"."document_id" = "invoice_line_items"."document_id") AND ("sd"."shared_with" = "auth"."uid"()))))));



CREATE POLICY "inv_line_items_internal_all" ON "public"."invoice_line_items" USING ("public"."is_internal"());



ALTER TABLE "public"."invoice_line_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."issues" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "issues_internal_only" ON "public"."issues" USING ("public"."is_internal"());



ALTER TABLE "public"."job_assignments" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "job_assignments_external_own" ON "public"."job_assignments" FOR SELECT USING (("user_id" = "auth"."uid"()));



CREATE POLICY "job_assignments_internal_all" ON "public"."job_assignments" USING ("public"."is_internal"());



ALTER TABLE "public"."job_baselines" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "job_baselines_internal_all" ON "public"."job_baselines" USING ("public"."is_internal"());



ALTER TABLE "public"."job_checklist_state" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."job_client_contacts" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "job_client_contacts_internal_all" ON "public"."job_client_contacts" USING ("public"."is_internal"()) WITH CHECK ("public"."is_internal"());



ALTER TABLE "public"."job_clients" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "job_clients_internal_all" ON "public"."job_clients" USING ("public"."is_internal"()) WITH CHECK ("public"."is_internal"());



ALTER TABLE "public"."job_company_invitations" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "job_company_invitations_internal_all" ON "public"."job_company_invitations" USING ("public"."is_internal"()) WITH CHECK ("public"."is_internal"());



ALTER TABLE "public"."job_deadlines" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."job_drive_links" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."job_logs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "job_logs_internal_only" ON "public"."job_logs" USING ("public"."is_internal"());



ALTER TABLE "public"."job_scope_items" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "job_scope_items_internal_insert" ON "public"."job_scope_items" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_internal"());



CREATE POLICY "job_scope_items_internal_select" ON "public"."job_scope_items" FOR SELECT TO "authenticated" USING ("public"."is_internal"());



CREATE POLICY "job_scope_items_internal_update" ON "public"."job_scope_items" FOR UPDATE TO "authenticated" USING ("public"."is_internal"()) WITH CHECK ("public"."is_internal"());



ALTER TABLE "public"."job_selections" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "job_selections_insert_authenticated" ON "public"."job_selections" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "job_selections_select_authenticated" ON "public"."job_selections" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "job_selections_update_authenticated" ON "public"."job_selections" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);



ALTER TABLE "public"."job_tasks" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "job_tasks_internal_all" ON "public"."job_tasks" USING ("public"."is_internal"()) WITH CHECK ("public"."is_internal"());



ALTER TABLE "public"."jobs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "jobs_external_select" ON "public"."jobs" FOR SELECT USING (((NOT "public"."is_internal"()) AND "public"."is_assigned_to_job"("id")));



CREATE POLICY "jobs_internal_all" ON "public"."jobs" USING ("public"."is_internal"());



ALTER TABLE "public"."linked_logs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "linked_logs_internal_all" ON "public"."linked_logs" USING ("public"."is_internal"());



CREATE POLICY "master_price_internal_all" ON "public"."master_price_sheet" USING ("public"."is_internal"());



ALTER TABLE "public"."master_price_sheet" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "memberships_internal_all" ON "public"."company_memberships" USING ("public"."is_internal"());



ALTER TABLE "public"."procurement_items" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "procurement_items_internal_all" ON "public"."procurement_items" USING ("public"."is_internal"());



ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "profiles_insert" ON "public"."profiles" FOR INSERT WITH CHECK ((("auth"."uid"() = "id") OR (EXISTS ( SELECT 1
   FROM "public"."profiles" "profiles_1"
  WHERE (("profiles_1"."id" = "auth"."uid"()) AND ("profiles_1"."role" = 'admin'::"public"."user_role"))))));



CREATE POLICY "profiles_select" ON "public"."profiles" FOR SELECT USING ((("auth"."uid"() = "id") OR "public"."is_internal"()));



CREATE POLICY "profiles_update" ON "public"."profiles" FOR UPDATE USING ((("auth"."uid"() = "id") OR (EXISTS ( SELECT 1
   FROM "public"."profiles" "profiles_1"
  WHERE (("profiles_1"."id" = "auth"."uid"()) AND ("profiles_1"."role" = 'admin'::"public"."user_role"))))));



CREATE POLICY "punchlist_internal" ON "public"."punchlist_items" USING ("public"."is_internal"());



CREATE POLICY "punchlist_internal_all" ON "public"."punchlist_items" USING ("public"."is_internal"());



ALTER TABLE "public"."punchlist_items" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "punchlist_sub_complete" ON "public"."punchlist_items" FOR UPDATE USING (("public"."is_sub_on_job"("job_id") AND (EXISTS ( SELECT 1
   FROM "public"."sub_schedule" "s"
  WHERE (("s"."id" = "punchlist_items"."sub_schedule_id") AND ("s"."sub_user_id" = "auth"."uid"())))))) WITH CHECK (("is_done" = true));



CREATE POLICY "punchlist_sub_select" ON "public"."punchlist_items" FOR SELECT USING (("public"."is_sub_on_job"("job_id") AND (EXISTS ( SELECT 1
   FROM "public"."sub_schedule" "s"
  WHERE (("s"."id" = "punchlist_items"."sub_schedule_id") AND ("s"."sub_user_id" = "auth"."uid"()))))));



ALTER TABLE "public"."risk_overrides" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "risk_overrides_internal_only" ON "public"."risk_overrides" USING ("public"."is_internal"());



ALTER TABLE "public"."schedule_edit_presence" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "schedule_edit_presence_internal_all" ON "public"."schedule_edit_presence" USING ("public"."is_internal"());



ALTER TABLE "public"."schedule_item_dependencies" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."selections" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "selections_internal" ON "public"."selections" USING ("public"."is_internal"());



CREATE POLICY "shared_docs_client_read_receipt" ON "public"."shared_documents" FOR UPDATE USING (("shared_with" = "auth"."uid"())) WITH CHECK (("shared_with" = "auth"."uid"()));



CREATE POLICY "shared_docs_client_select" ON "public"."shared_documents" FOR SELECT USING (("shared_with" = "auth"."uid"()));



CREATE POLICY "shared_docs_internal_all" ON "public"."shared_documents" USING ("public"."is_internal"());



ALTER TABLE "public"."shared_documents" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "sid_internal_all" ON "public"."schedule_item_dependencies" USING ("public"."is_internal"());



ALTER TABLE "public"."stage_history" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "stage_history_client_select" ON "public"."stage_history" FOR SELECT USING ("public"."is_client_on_job"("job_id"));



CREATE POLICY "stage_history_internal_all" ON "public"."stage_history" USING ("public"."is_internal"());



ALTER TABLE "public"."sub_schedule" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "sub_schedule_internal_all" ON "public"."sub_schedule" USING ("public"."is_internal"());



CREATE POLICY "sub_schedule_sub_select" ON "public"."sub_schedule" FOR SELECT USING (("public"."is_sub_on_job"("job_id") AND (("sub_user_id" = "auth"."uid"()) OR ("sub_user_id" IS NULL))));



ALTER TABLE "public"."takeoff_items" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "takeoff_items_internal" ON "public"."takeoff_items" USING ("public"."is_internal"());



CREATE POLICY "takeoff_items_internal_insert" ON "public"."takeoff_items" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_internal"());



CREATE POLICY "takeoff_items_internal_select" ON "public"."takeoff_items" FOR SELECT TO "authenticated" USING ("public"."is_internal"());



CREATE POLICY "takeoff_items_internal_update" ON "public"."takeoff_items" FOR UPDATE TO "authenticated" USING ("public"."is_internal"()) WITH CHECK ("public"."is_internal"());



ALTER TABLE "public"."trades" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "trades_delete_admin" ON "public"."trades" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."internal_access" "ia"
  WHERE (("ia"."profile_id" = "auth"."uid"()) AND ("ia"."is_admin" = true) AND ("ia"."is_active" = true)))));



CREATE POLICY "trades_insert_admin" ON "public"."trades" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."internal_access" "ia"
  WHERE (("ia"."profile_id" = "auth"."uid"()) AND ("ia"."is_admin" = true) AND ("ia"."is_active" = true)))));



CREATE POLICY "trades_internal_all" ON "public"."trades" USING ("public"."is_internal"()) WITH CHECK ("public"."is_internal"());



CREATE POLICY "trades_update_admin" ON "public"."trades" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."internal_access" "ia"
  WHERE (("ia"."profile_id" = "auth"."uid"()) AND ("ia"."is_admin" = true) AND ("ia"."is_active" = true))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."internal_access" "ia"
  WHERE (("ia"."profile_id" = "auth"."uid"()) AND ("ia"."is_admin" = true) AND ("ia"."is_active" = true)))));



GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON FUNCTION "public"."get_company_compliance"("p_company_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_company_compliance"("p_company_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_company_compliance"("p_company_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_job_files"("p_job_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_job_files"("p_job_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_job_files"("p_job_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."is_assigned_to_job"("p_job_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_assigned_to_job"("p_job_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_assigned_to_job"("p_job_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_client_on_job"("p_job_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_client_on_job"("p_job_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_client_on_job"("p_job_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_cost_plus_client"("p_job_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_cost_plus_client"("p_job_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_cost_plus_client"("p_job_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_internal"() TO "anon";
GRANT ALL ON FUNCTION "public"."is_internal"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_internal"() TO "service_role";



GRANT ALL ON FUNCTION "public"."is_internal_email"("p_email" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."is_internal_email"("p_email" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_internal_email"("p_email" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_sub_on_job"("p_job_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_sub_on_job"("p_job_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_sub_on_job"("p_job_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "anon";
GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."rls_auto_enable"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_baseline_on_insert_sub_schedule"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_baseline_on_insert_sub_schedule"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_baseline_on_insert_sub_schedule"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "service_role";



GRANT ALL ON TABLE "public"."checklist_items" TO "anon";
GRANT ALL ON TABLE "public"."checklist_items" TO "authenticated";
GRANT ALL ON TABLE "public"."checklist_items" TO "service_role";



GRANT ALL ON TABLE "public"."companies" TO "anon";
GRANT ALL ON TABLE "public"."companies" TO "authenticated";
GRANT ALL ON TABLE "public"."companies" TO "service_role";



GRANT ALL ON TABLE "public"."company_compliance_documents" TO "anon";
GRANT ALL ON TABLE "public"."company_compliance_documents" TO "authenticated";
GRANT ALL ON TABLE "public"."company_compliance_documents" TO "service_role";



GRANT ALL ON TABLE "public"."company_contacts" TO "anon";
GRANT ALL ON TABLE "public"."company_contacts" TO "authenticated";
GRANT ALL ON TABLE "public"."company_contacts" TO "service_role";



GRANT ALL ON TABLE "public"."company_memberships" TO "anon";
GRANT ALL ON TABLE "public"."company_memberships" TO "authenticated";
GRANT ALL ON TABLE "public"."company_memberships" TO "service_role";



GRANT ALL ON TABLE "public"."company_trade_assignments" TO "anon";
GRANT ALL ON TABLE "public"."company_trade_assignments" TO "authenticated";
GRANT ALL ON TABLE "public"."company_trade_assignments" TO "service_role";



GRANT ALL ON TABLE "public"."cost_codes" TO "anon";
GRANT ALL ON TABLE "public"."cost_codes" TO "authenticated";
GRANT ALL ON TABLE "public"."cost_codes" TO "service_role";



GRANT ALL ON TABLE "public"."document_line_items" TO "anon";
GRANT ALL ON TABLE "public"."document_line_items" TO "authenticated";
GRANT ALL ON TABLE "public"."document_line_items" TO "service_role";



GRANT ALL ON TABLE "public"."documents" TO "anon";
GRANT ALL ON TABLE "public"."documents" TO "authenticated";
GRANT ALL ON TABLE "public"."documents" TO "service_role";



GRANT ALL ON TABLE "public"."draw_schedule" TO "anon";
GRANT ALL ON TABLE "public"."draw_schedule" TO "authenticated";
GRANT ALL ON TABLE "public"."draw_schedule" TO "service_role";



GRANT ALL ON TABLE "public"."estimate_items" TO "anon";
GRANT ALL ON TABLE "public"."estimate_items" TO "authenticated";
GRANT ALL ON TABLE "public"."estimate_items" TO "service_role";



GRANT ALL ON TABLE "public"."estimate_line_items" TO "anon";
GRANT ALL ON TABLE "public"."estimate_line_items" TO "authenticated";
GRANT ALL ON TABLE "public"."estimate_line_items" TO "service_role";



GRANT ALL ON TABLE "public"."estimates" TO "anon";
GRANT ALL ON TABLE "public"."estimates" TO "authenticated";
GRANT ALL ON TABLE "public"."estimates" TO "service_role";



GRANT ALL ON TABLE "public"."file_attachment_access" TO "anon";
GRANT ALL ON TABLE "public"."file_attachment_access" TO "authenticated";
GRANT ALL ON TABLE "public"."file_attachment_access" TO "service_role";



GRANT ALL ON TABLE "public"."file_attachments" TO "anon";
GRANT ALL ON TABLE "public"."file_attachments" TO "authenticated";
GRANT ALL ON TABLE "public"."file_attachments" TO "service_role";



GRANT ALL ON TABLE "public"."file_trade_tags" TO "anon";
GRANT ALL ON TABLE "public"."file_trade_tags" TO "authenticated";
GRANT ALL ON TABLE "public"."file_trade_tags" TO "service_role";



GRANT ALL ON TABLE "public"."internal_access" TO "anon";
GRANT ALL ON TABLE "public"."internal_access" TO "authenticated";
GRANT ALL ON TABLE "public"."internal_access" TO "service_role";



GRANT ALL ON TABLE "public"."internal_role_assignments" TO "anon";
GRANT ALL ON TABLE "public"."internal_role_assignments" TO "authenticated";
GRANT ALL ON TABLE "public"."internal_role_assignments" TO "service_role";



GRANT ALL ON TABLE "public"."internal_roles" TO "anon";
GRANT ALL ON TABLE "public"."internal_roles" TO "authenticated";
GRANT ALL ON TABLE "public"."internal_roles" TO "service_role";



GRANT ALL ON TABLE "public"."invoice_line_items" TO "anon";
GRANT ALL ON TABLE "public"."invoice_line_items" TO "authenticated";
GRANT ALL ON TABLE "public"."invoice_line_items" TO "service_role";



GRANT ALL ON TABLE "public"."issues" TO "anon";
GRANT ALL ON TABLE "public"."issues" TO "authenticated";
GRANT ALL ON TABLE "public"."issues" TO "service_role";



GRANT ALL ON TABLE "public"."job_assignments" TO "anon";
GRANT ALL ON TABLE "public"."job_assignments" TO "authenticated";
GRANT ALL ON TABLE "public"."job_assignments" TO "service_role";



GRANT ALL ON TABLE "public"."job_baselines" TO "anon";
GRANT ALL ON TABLE "public"."job_baselines" TO "authenticated";
GRANT ALL ON TABLE "public"."job_baselines" TO "service_role";



GRANT ALL ON TABLE "public"."job_checklist_state" TO "anon";
GRANT ALL ON TABLE "public"."job_checklist_state" TO "authenticated";
GRANT ALL ON TABLE "public"."job_checklist_state" TO "service_role";



GRANT ALL ON TABLE "public"."job_client_contacts" TO "anon";
GRANT ALL ON TABLE "public"."job_client_contacts" TO "authenticated";
GRANT ALL ON TABLE "public"."job_client_contacts" TO "service_role";



GRANT ALL ON TABLE "public"."job_clients" TO "anon";
GRANT ALL ON TABLE "public"."job_clients" TO "authenticated";
GRANT ALL ON TABLE "public"."job_clients" TO "service_role";



GRANT ALL ON TABLE "public"."job_company_invitations" TO "anon";
GRANT ALL ON TABLE "public"."job_company_invitations" TO "authenticated";
GRANT ALL ON TABLE "public"."job_company_invitations" TO "service_role";



GRANT ALL ON TABLE "public"."job_deadlines" TO "anon";
GRANT ALL ON TABLE "public"."job_deadlines" TO "authenticated";
GRANT ALL ON TABLE "public"."job_deadlines" TO "service_role";



GRANT ALL ON TABLE "public"."job_drive_links" TO "anon";
GRANT ALL ON TABLE "public"."job_drive_links" TO "authenticated";
GRANT ALL ON TABLE "public"."job_drive_links" TO "service_role";



GRANT ALL ON TABLE "public"."job_logs" TO "anon";
GRANT ALL ON TABLE "public"."job_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."job_logs" TO "service_role";



GRANT ALL ON TABLE "public"."job_scope_items" TO "anon";
GRANT ALL ON TABLE "public"."job_scope_items" TO "authenticated";
GRANT ALL ON TABLE "public"."job_scope_items" TO "service_role";



GRANT ALL ON TABLE "public"."job_selections" TO "anon";
GRANT ALL ON TABLE "public"."job_selections" TO "authenticated";
GRANT ALL ON TABLE "public"."job_selections" TO "service_role";



GRANT ALL ON TABLE "public"."job_tasks" TO "anon";
GRANT ALL ON TABLE "public"."job_tasks" TO "authenticated";
GRANT ALL ON TABLE "public"."job_tasks" TO "service_role";



GRANT ALL ON TABLE "public"."jobs" TO "anon";
GRANT ALL ON TABLE "public"."jobs" TO "authenticated";
GRANT ALL ON TABLE "public"."jobs" TO "service_role";



GRANT ALL ON TABLE "public"."linked_logs" TO "anon";
GRANT ALL ON TABLE "public"."linked_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."linked_logs" TO "service_role";



GRANT ALL ON TABLE "public"."master_price_sheet" TO "anon";
GRANT ALL ON TABLE "public"."master_price_sheet" TO "authenticated";
GRANT ALL ON TABLE "public"."master_price_sheet" TO "service_role";



GRANT ALL ON TABLE "public"."procurement_items" TO "anon";
GRANT ALL ON TABLE "public"."procurement_items" TO "authenticated";
GRANT ALL ON TABLE "public"."procurement_items" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."punchlist_items" TO "anon";
GRANT ALL ON TABLE "public"."punchlist_items" TO "authenticated";
GRANT ALL ON TABLE "public"."punchlist_items" TO "service_role";



GRANT ALL ON TABLE "public"."risk_overrides" TO "anon";
GRANT ALL ON TABLE "public"."risk_overrides" TO "authenticated";
GRANT ALL ON TABLE "public"."risk_overrides" TO "service_role";



GRANT ALL ON TABLE "public"."schedule_edit_presence" TO "anon";
GRANT ALL ON TABLE "public"."schedule_edit_presence" TO "authenticated";
GRANT ALL ON TABLE "public"."schedule_edit_presence" TO "service_role";



GRANT ALL ON TABLE "public"."schedule_item_dependencies" TO "anon";
GRANT ALL ON TABLE "public"."schedule_item_dependencies" TO "authenticated";
GRANT ALL ON TABLE "public"."schedule_item_dependencies" TO "service_role";



GRANT ALL ON TABLE "public"."selections" TO "anon";
GRANT ALL ON TABLE "public"."selections" TO "authenticated";
GRANT ALL ON TABLE "public"."selections" TO "service_role";



GRANT ALL ON TABLE "public"."shared_documents" TO "anon";
GRANT ALL ON TABLE "public"."shared_documents" TO "authenticated";
GRANT ALL ON TABLE "public"."shared_documents" TO "service_role";



GRANT ALL ON TABLE "public"."stage_history" TO "anon";
GRANT ALL ON TABLE "public"."stage_history" TO "authenticated";
GRANT ALL ON TABLE "public"."stage_history" TO "service_role";



GRANT ALL ON TABLE "public"."sub_schedule" TO "anon";
GRANT ALL ON TABLE "public"."sub_schedule" TO "authenticated";
GRANT ALL ON TABLE "public"."sub_schedule" TO "service_role";



GRANT ALL ON TABLE "public"."takeoff_items" TO "anon";
GRANT ALL ON TABLE "public"."takeoff_items" TO "authenticated";
GRANT ALL ON TABLE "public"."takeoff_items" TO "service_role";



GRANT ALL ON TABLE "public"."trades" TO "anon";
GRANT ALL ON TABLE "public"."trades" TO "authenticated";
GRANT ALL ON TABLE "public"."trades" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";







