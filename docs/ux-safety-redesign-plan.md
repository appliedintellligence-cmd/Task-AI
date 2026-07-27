# Task AI — UX & Safety Redesign Plan

Branch: `feature/task-ai-ux-safety-redesign`

This document tracks the baseline state at the start of the redesign and the
implementation checklist derived from the pre-redesign audit. No screens are
redesigned and no API contracts are changed in this baseline-preparation step.

---

## Baseline state (recorded before any redesign work)

Captured on branch creation. This separates **pre-existing** conditions from any
failures introduced later so regressions are attributable.

### Backend tests
- **No test suite exists.** There are no `test_*.py` / `*_test.py` files and no
  `tests/` directory in `backend/`.
- `pytest` is **not installed** in the environment (`No module named pytest`).
- Result: nothing to run. This is an **existing gap**, not a new failure.

### Frontend production build
- Command: `npm run build` (Vite 8) in `frontend/`.
- **Result: PASS** (exit 0). Output: `dist/index.html`, one CSS chunk (~49.7 kB),
  one JS chunk (~549.8 kB).
- Non-blocking warnings (pre-existing, not build blockers — no action taken):
  - `@vitejs/plugin-react-oxc is deprecated` (deprecation notice only).
  - Chunk larger than 500 kB after minification (bundle-size advisory).

### Build blockers found and fixed in this step
- **None.** The build already succeeds, so no build-blocker fixes were required.

### Secret / env hygiene
- `frontend/.env` and `backend/.env` are gitignored and untracked — confirmed not
  staged or committed. No environment-variable names changed.

---

## Existing vs new failures

| Area | Existing (pre-redesign) | New (introduced this step) |
|------|-------------------------|----------------------------|
| Backend tests | No tests; pytest not installed | None |
| Frontend build | Passes (deprecation + chunk-size warnings only) | None |

---

## Implementation checklist (post-baseline)

Derived from the audit. Ordered by the recommended sequence. None of these are
performed in the baseline-preparation commit.

### 1. Routing correctness
- [ ] Resolve `/results`: either register the route or remove the orphaned
      `Results.jsx` / `Home.jsx` and open jobs the way `ChatSidebar` does.
- [ ] Add a catch-all route so unknown paths don't render a blank page.
- [ ] Stop `History.jsx` (and orphaned `Home.jsx`) navigating to the dead
      `/results` route.

### 2. Safety display + validation
- [ ] Render the safety fields the backend already returns on web:
      `when_to_call_professional`, `is_structural`, per-step `safety_note`,
      `safety_equipment`, `root_cause` (mobile `RepairCard` already shows these).
- [ ] Add a backend safety-validation/gating layer for structural,
      high-severity, and regulated-trade (electrical/gas/plumbing/asbestos) work.
      (Deferred until API-contract changes are explicitly approved.)

### 3. Legal disclaimer + acknowledgement
- [ ] Add a shared "general information only / not professional advice" disclaimer
      (web) with acknowledgement, mirrored in mobile `RepairCard.tsx`.

### 4. Error / empty / retry states
- [ ] Replace silent fetch failures with visible errors + retry in `History.jsx`,
      `Home.jsx`, `ChatPage.jsx`, `ChatSidebar.jsx`.
- [ ] Surface inpaint failures to the user in `ChatMessage.jsx`.
- [ ] Fix `Results.jsx` reporting "Saved" when the save request fails.

### 5. Consolidate duplicate history experiences
- [ ] Choose one canonical history surface and one open-job path (remove the
      three-way split between `/history`, sidebar "Past repairs", and orphaned
      `Home.jsx` "Recent repairs").

### 6. Object-URL cleanup + dead controls
- [ ] Revoke object URLs created in `PhotoUpload.jsx`, `ChatInput.jsx`,
      `useChat.js`.
- [ ] Wire up or remove the inert "Upload another photo" button in
      `ChatMessage.jsx`.

### 7. Accessibility
- [ ] Make the `PhotoUpload` dropzone keyboard-operable.
- [ ] Add `aria-label`s to icon-only buttons; add accessible names to the
      `Settings` toggle; use labels instead of placeholders; fix `alt` text.

### 8. Tests
- [ ] Add backend tests (validators, pipeline JSON, safety gating) and install
      `pytest`.
- [ ] Add frontend tests for routing, object-URL revocation, and error states.

---

## Constraints for this baseline step (honoured)
- Backend API contracts unchanged.
- No screens redesigned.
- Only build blockers fixed (none were present).
- No environment-variable names changed; no secrets committed.
