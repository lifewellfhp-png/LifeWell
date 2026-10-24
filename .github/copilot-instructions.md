# Standing rules for AI coding assistants working in this repo

These rules apply to any AI assistant (Claude, Copilot, or otherwise)
working in this repository, regardless of which branch or task.

- Never run SQL against any database. If a change needs SQL, write it to
  a file for the project owner to review, with a rollback included, and
  don't run it.
- Never use, ask for or store the owner's admin password, MFA/recovery
  codes, session tokens or cookies.
- Never print secret values or environment variable values.
- Work only on the branch you were asked to work on. Push only for a
  preview deployment. Never merge to `main` or deploy to production —
  the owner does that after reviewing and approving.
- Use small, focused commits. Never run `git add -A` from the repo
  root — stage only the files you actually changed. The following
  untracked items must NEVER be committed:
  - `DIAGNOSTIC-REPORT.md`
  - `curative-logo-handoff/`
  - `florida-medicaid-logo-handoff/`
  - `payer-logo-assets/`
  - `payer-logo-update-2/`
  - `client/public/images/insurance/badges/US-TRICARE-Logo.svg.webp`
