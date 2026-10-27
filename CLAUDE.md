# Standing rules

Public website forms must never collect medical or clinical information. No free-text message fields on public forms. Clinical information goes through the CharmHealth patient portal only.

## Database changes

Never run SQL against the production database (or any live Supabase project backing this
repo) from an agent session, for any reason, including "safe" idempotent migrations.

All database schema changes go to the user as reviewed SQL (typically an addition to
`server/supabase/ops.sql`, following its existing idempotent, documented-rollback
convention). The user runs it themselves, in the Supabase SQL editor or via
`server/scripts/apply-schema.mjs` with their own `DATABASE_URL`.

This applies regardless of how credentials are obtained in a session (a pasted access
token, a connection string, `vercel env pull`, or any other path) and regardless of
whether Preview and Production happen to share a single database.
