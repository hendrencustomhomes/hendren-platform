# Schedule Module — Baseline Architecture

**Date:** 2026-04-11
**Status:** Approved direction — v1 model
**Scope:** Architecture and data model direction only. No SQL, no UI implementation.

---

## A. Overview

A baseline is a frozen snapshot of the scheduled start and end dates for every item in a job's schedule, captured at a specific point in time by a deliberate user action. It serves as a reference layer for measuring how far the live schedule has drifted from the original plan.

The baseline exists because a schedule in active execution changes constantly — dates shift due to weather, material delays, subcontractor availability, and owner decisions. Without a stable reference, it is impossible to quantify how much a project has slipped, accelerated, or been re-sequenced since planning was completed. The baseline provides that stable reference.

The baseline is intentionally separate from the main schedule UI. The main schedule pages are operational tools — project managers use them to coordinate daily work. Overlaying baseline comparison data on those pages would add visual noise to a surface that must remain fast and readable under time pressure. Baseline analysis belongs on a dedicated overlay page used for reporting and project health review.

The baseline is not a lock and carries no restriction authority. It does not prevent schedule edits, does not require approval before changes can be made, and does not create any read-only state on schedule items. Its sole function is comparison. The live schedule is always the authoritative record of what is planned. The baseline is a measuring stick held alongside it.

---

## B. Core Principles

**One baseline per job.** A job has either no active baseline or exactly one. There is no concept of baseline versions, baseline history, or multiple simultaneous baselines. Rebaseline version history is out of scope for v1.

**Baseline is reference only.** The baseline holds dates for comparison. It has no effect on schedule resolution, dependency propagation, task triggers, or any other operational behavior.

**No locks.** Baseline activation does not lock any schedule item, any field, or any page. Users retain full editing authority at all times regardless of baseline state.

**No out-of-sync state.** The system must never present a state where the baseline is described as out of sync, stale, or invalid. Once set, a baseline remains valid as a reference for the dates it captured. The live schedule diverges from it; that divergence is the variance the baseline is designed to measure. There is no mechanism by which the baseline becomes broken.

**Total variance only.** The baseline records the original plan date and the current date. It shows the net difference between them — the total drift. It does not record each individual shift as a separate field. A schedule item that moved three times has one baseline start date and one current start date; the variance between them is the total movement.

**Logs handle detailed history.** Individual shift events, the magnitude of each shift, the reasons for each change, and the sequence of movements over time all belong to the schedule log layer. The baseline does not duplicate or replace that function. The baseline answers "how far did we drift from the original plan." Logs answer "what happened and why."

---

## C. Baseline Activation

A baseline is activated by a deliberate user action. The project manager or authorized user navigates to the appropriate control and clicks **Set Baseline**. This action captures the current scheduled start and end dates for every existing schedule item on the job and writes them as baseline dates.

Once a baseline is active for a job, the UI replaces the **Set Baseline** button with a non-interactive **Baseline Active** indicator. This indicator communicates that a baseline exists and is in effect. It is not a button and does not trigger any action when clicked.

Baseline is set once at the job level. The normal workflow does not include repeated rebaselining. The exception for per-item baseline overwrites is defined in Section F and is narrow by design.

There is no automatic baseline activation. The system does not set a baseline on job creation, on schedule publish, or on any other lifecycle event. Activation is always an explicit user decision.

---

## D. Baseline Data Model Direction

The v1 baseline is stored directly on schedule items. Each `sub_schedule` row will carry two additional fields:

- `baseline_start_date` — the start date at the time baseline was set, or at the time the item was created if baseline was already active
- `baseline_end_date` — the end date under the same conditions

These fields are null for jobs that have no active baseline and for items created before baseline was set but before the activation action was taken (the activation action populates them). For items created after baseline activation, the fields are populated automatically at creation time as described in Section E.

A job-level baseline-active marker will also be required. This flag indicates that the job has an active baseline and controls UI state (Set Baseline vs. Baseline Active), auto-population behavior for new items, and reporting availability. The exact storage location — a field on the `jobs` table or a separate `job_baselines` record — is a v1 implementation decision deferred to the schema design phase.

SQL implementation and migration are out of scope for this document.

---

## E. New Items After Baseline

When a new schedule item is added to a job that already has an active baseline, the item must receive baseline dates automatically at creation time. The item's initial scheduled start and end dates become its baseline dates.

This automatic assignment must happen without any additional action from the user. The user adds a schedule item through the normal creation flow; the system detects that the job has an active baseline and writes `baseline_start_date` and `baseline_end_date` equal to the initial `start_date` and `end_date` values at the moment of insertion.

An item created after baseline activation with null baseline fields is an error state. No schedule item on a job with an active baseline may be orphaned from baseline reporting. Variance for a newly added item with identical baseline and current dates is zero, which is the correct initial state — the item was added to the plan and has not yet drifted.

This rule ensures that the baseline overlay page shows complete coverage of the job's schedule at all times after activation, including items that were not part of the original plan.

---

## F. Per-Item Baseline Reset Exception

Under normal circumstances, baseline dates are immutable once set. A real delay, a genuine schedule acceleration, or a planned re-sequencing does not overwrite the baseline — it creates variance, which is the intended and correct outcome.

A narrow exception exists for cases where the original baseline date was wrong from the start: a data entry error, a date typed in the wrong field, or a placeholder date that was never a real planned date. In these cases, the baseline date does not represent an original plan; it represents a mistake. Preserving it would produce meaningless variance in reporting.

A per-item baseline reset is permitted when the shift change reason type explicitly indicates a mis-entry or wrong original date. The specific type value that qualifies is defined as part of the shift change reason taxonomy (see Section H). When that type is selected, the system allows the baseline dates for that item to be overwritten with the corrected dates.

This is an exception flow, not a standard operation. The UI for per-item baseline reset is distinct from normal schedule editing. The reset requires an explicit change reason with the qualifying type. It cannot be triggered silently or in bulk.

Shift change types that represent real schedule movement — delay, weather, owner-directed change, subcontractor availability, and all similar operational reasons — do not qualify for baseline overwrite. These produce variance. The baseline holds.

---

## G. Variance Model

Variance is defined as the difference between the current scheduled date and the baseline date for a given item.

```
variance = current_start_date − baseline_start_date
```

A positive variance means the item has been pushed later than originally planned. A negative variance means it has been pulled earlier. Zero variance means the item is on its original plan.

The baseline records one reference point per date field per item. Multiple schedule shifts over time do not create multiple baseline fields and do not accumulate as separate deltas. The total variance — the net distance between where the item is now and where it was when the baseline was set — is the only measurement the baseline layer provides.

The baseline overlay compares:

- **Baseline start date** vs. **current scheduled start date**
- **Baseline end date** vs. **current scheduled end date**
- **Total variance** in working days for each

The overlay also supports a scheduled vs. actual framing: baseline as the planned schedule, current dates as the scheduled-forward state, and actual completion data (where available) as the execution record.

Detailed shift history — each individual movement, its date, its magnitude, and its reason — is the responsibility of the log layer. The baseline does not store that information.

---

## H. Shift Change Reason

Every schedule date change may carry a shift change reason. The reason consists of two components:

- **Type** — a structured classification selected from a defined list
- **Note** — a free-text field for additional context

The default type is null. A shift change with no reason selected is valid. Type is not required on every save. Product rules may later require a type for specific change magnitudes or item statuses; that enforcement is not part of v1.

The note is optional. It provides context that the type alone does not convey.

The type taxonomy determines behavior in two places:

1. **Per-item baseline reset eligibility.** Only a type that explicitly indicates a mis-entry or wrong original date unlocks the baseline overwrite exception for that item (Section F).
2. **Log classification.** Types enable filtering and aggregation of shift history in reporting.

The full type list is defined as part of the shift change reason feature implementation. At minimum, the taxonomy must include a type for mis-entry / wrong original date to support the baseline reset exception. All other types — delay, expedite, owner change, weather, scope change, and similar — represent real schedule movement and do not qualify for baseline overwrite.

---

## I. Baseline UI Surface

The baseline comparison view is a dedicated overlay page, separate from the main Labor Schedule and Material Schedule pages. It is not a modal or drawer within the existing schedule views.

The overlay page shows, for each schedule item with an active baseline:

- **Baseline start date** — the reference date from when the baseline was set
- **Current scheduled start date** — the live date as it stands today
- **Variance** — the difference in working days, displayed with sign (+ for slip, − for pull-in)
- **Baseline end date** and **current scheduled end date** with corresponding variance, where applicable

The overlay supports a scheduled vs. actual framing. Where actual completion dates exist, the overlay can show how the item resolved against both the baseline and the original schedule.

The main schedule pages — the Labor Schedule table and the Material Schedule table — do not display baseline data. They show operational schedule information only. Baseline columns, baseline hints, and variance indicators do not appear on those pages. This separation keeps the main pages clean and operationally focused.

Access to the baseline overlay is from a clearly labeled entry point, such as a link or tab adjacent to the schedule pages, visible only when a baseline is active for the job being viewed.

---

## J. Relationship to Logs

Baseline and logs are complementary layers that answer different questions. They are not redundant.

**Baseline answers:** How far has this item drifted from the original plan?

**Logs answer:** What individual changes were made, when, and why?

The baseline holds two dates per item and produces one variance number. It is a summary measurement, not a record of events. It does not store who changed what, when the change was made, what the previous values were before the change, or the reason for any individual movement.

Logs record each shift event with its timestamp, the user who made the change, the before and after values, the shift change reason type, and the note. Logs support audit trails, retrospective analysis, and root-cause review.

Reporting that requires both layers — for example, a view showing total variance alongside a breakdown of the shifts that produced it — joins baseline data with log data. Neither layer is a substitute for the other.

---

## K. Relationship to Editing

The baseline has no authority over editing. A project manager can change any schedule date on any item on any job at any time, regardless of whether a baseline is active. The baseline does not make any field read-only, does not require confirmation before changes are saved, and does not create any friction in the normal editing workflow.

When a schedule date changes on an item that has a baseline, the variance for that item updates to reflect the new current date against the unchanged baseline date. This happens automatically as part of the normal schedule state. No user action is required to keep the baseline current. The baseline is always correct because it never changes; the live schedule changes around it.

The system does not present any state in which the baseline is described as needing a refresh, being out of date, or requiring reconciliation. Variance changing is not a problem state. It is the expected behavior of a healthy baseline.

There is no concept of cascading a baseline update through dependencies. If a schedule item shifts and pushes a successor item, both items accumulate independent variance against their individual baselines. The relationship between their variances is visible in reporting but the baseline itself does not propagate.

---

## L. Multi-User Editing Warning

When two users are editing the same job's schedule simultaneously, the system shows a warning or flag to communicate that concurrent editing is in progress. It does not lock either user out of editing, does not queue their changes, and does not block saves.

The warning communicates that another user is currently making changes and that the two sets of changes may interfere. The decision about how to proceed belongs to the users, not the system. Both users retain full editing capability.

The last save wins in the case of a conflict on the same field. The warning exists to reduce the likelihood of unintentional overwrites by making concurrent activity visible. It does not enforce an ordering or resolution protocol.

This applies equally regardless of baseline state. A job with an active baseline is subject to the same multi-user warning behavior as a job without one.

---

## M. Out of Scope

The following are explicitly out of scope for the baseline v1 architecture and this document:

- **SQL schema and migrations.** The direction is defined in Section D; the implementation is deferred.
- **Baseline overlay UI implementation.** The surface is described in Section I; visual design and component implementation are deferred.
- **Logs schema.** Logs are referenced as the detailed history layer but their schema is a separate design effort.
- **Rebaseline version history.** There is one baseline per job. Prior baselines are not retained or accessible.
- **Hard locking or edit restrictions of any kind.** Baseline does not gate, block, or require approval for any schedule change.
- **Multi-user conflict resolution.** Section L defines the warning behavior. Merge logic, conflict queuing, and resolution protocols are out of scope.
- **Baseline for procurement items.** The v1 baseline applies to labor schedule items (`sub_schedule`). Procurement baseline is a future extension.
- **Automated or event-driven baseline activation.** Baseline is always set by explicit user action.

---

## N. Summary

The baseline is a reference layer — one per job — that captures scheduled dates at the moment a user explicitly sets it. It exists to measure total drift between the original plan and the current schedule. It does not restrict editing, does not produce an out-of-sync state, and does not store shift history.

Key decisions:

- **One baseline per job.** Set once, explicitly, by user action.
- **Per-item overwrite is a narrow exception,** permitted only when the change reason type identifies the original date as a mis-entry. Real delays and expedites produce variance; they do not overwrite the baseline.
- **Total variance only.** One reference date and one current date per item. The net difference is the variance.
- **Logs own detailed history.** Individual shift events, reasons, and audit trails belong to the log layer, not baseline fields.
- **No locks.** Baseline state does not affect editing authority in any way.
- **Clean UI separation.** Baseline data appears on a dedicated overlay page. It does not appear on the main schedule pages.
