# Task AI autonomous redesign progress

Run started: 2026-07-18 (Australia/Melbourne)
Branch: `feature/task-ai-ux-safety-redesign`
Starting commit: `1477828`

## Prerequisite gate — Steps 1–7

- **Status:** COMPLETE — implementation and authorization remediation verified locally.
- **Files changed by this run:** This progress document only.
- **Tests run:**
  - `python3 -m pytest -q` in `backend/`
  - `npm test` in `frontend/`
  - `npm run build` in `frontend/`
  - `npx tsc --noEmit` in `mobile/`
  - `git diff --check`
  - `git ls-files -u`
- **Results:** Backend 132 passed; frontend 5 passed; frontend production build passed with existing deprecation/chunk-size warnings; mobile TypeScript passed; no whitespace errors; no unresolved Git conflicts.
- **Commit hash:** Pending prerequisite remediation commit.
- **Blocker:** The backend Supabase client uses `SUPABASE_SERVICE_KEY`, so route queries bypass user RLS. `GET /chats/{chat_id}/messages` and `DELETE /chats/{chat_id}` authenticate a bearer token but do not verify that the chat belongs to that user. `POST /chat` accepts a caller-provided `chat_id` and reads/writes it without an ownership check, including when no authenticated user was established. Similar-job lookup authenticates the caller but does not verify ownership of the source job; `find_similar_jobs` is `SECURITY DEFINER` and intentionally returns cross-user job data. No authorization tests cover these boundaries.
- **Known limitations:** Existing Steps 1–7 changes are uncommitted and were preserved. The migrations under `db/migrations/` are additive and have not been applied remotely. The repository has no configured web lint command, component/navigation test framework, or mobile test command yet.
- **Next phase:** Phase 8 remains pending until the verified prerequisite work is committed.

## Phase status

| Phase | Status | Commit | Notes |
|---|---|---|---|
| 8 — Responsive application shell | BLOCKED / NOT STARTED | — | Stopped by the Steps 1–7 prerequisite gate. |
| 9 — Camera-first dashboard | NOT STARTED | — | Depends on Phase 8. |
| 10 — DIY eligibility interface | NOT STARTED | — | Depends on Phase 9. |
| 11 — Diagnosis-result redesign | NOT STARTED | — | Depends on Phase 10. |
| 12 — Guided repair mode | NOT STARTED | — | Depends on Phase 11. |
| 13 — Public landing page | NOT STARTED | — | Depends on Phase 12. |
| 14 — Final QA | NOT STARTED | — | Depends on Phases 8–13. |

## Pre-Phase 8 authorisation remediation

- **Status:** COMPLETE — local verification passed; no remote migration was applied.
- **Ownership boundary:** Verified Supabase JWT identity now selects chat and job collections, owns every chat read/write/delete and source job used for similarity, and scopes message/job similarity candidates to that same user.
- **API contract:** Web and mobile use `GET /chats` and `GET /jobs`; job/chat request-body ownership claims were removed. Legacy `GET /chats/{user_id}` and `GET /jobs/{user_id}` remain compatible but ignore the supplied ID. Direct-object denials return a non-disclosing 404.
- **Database:** Added owner-scoped, service-role-only similarity functions and revoked the legacy cross-user functions. The additive migration is recorded locally in `db/migrations/20260718_enforce_private_record_ownership.sql` and was not applied remotely.
- **Regression coverage:** User A own-chat workflow; cross-user chat message read/list/update/delete denial; cross-user job/image/diagnosis/safety/similarity denial; body/path user-ID override resistance; missing, invalid and expired bearer tokens; authorised chat and similarity workflows.
- **Equivalent-pattern review:** The affected service-role queries were inspected. `/analyse` and `/inpaint` do not accept private record identifiers or load stored private records, so they are not equivalent IDOR instances and were not expanded into this remediation.
- **Verification:** Backend 142 passed (including 10 authorisation cases); frontend 5 passed; web production build passed; mobile TypeScript passed. The mobile package has no test script.
- **Next:** Resume the autonomous redesign loop at Phase 8 after the remediation commit.
