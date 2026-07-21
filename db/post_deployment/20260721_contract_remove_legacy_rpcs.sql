-- CONTRACT migration: DO NOT APPLY WITH EXPAND MIGRATIONS.
-- Apply only after the owner-scoped backend has been deployed, verified, and
-- the previous backend version is no longer receiving traffic.

REVOKE ALL ON FUNCTION find_similar_jobs(UUID, INT) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION match_messages(vector, FLOAT, INT) FROM PUBLIC, anon, authenticated, service_role;

DROP FUNCTION IF EXISTS find_similar_jobs(UUID, INT);
DROP FUNCTION IF EXISTS match_messages(vector, FLOAT, INT);
