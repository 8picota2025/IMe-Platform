#!/usr/bin/env bash
# Creates and removes its own database; never connects to the linked Supabase project.
set -euo pipefail
cd "$(dirname "$0")/.."
container="ime-whatsapp-sql-$$"
image="${WHATSAPP_TEST_POSTGRES_IMAGE:-public.ecr.aws/supabase/postgres:17.6.1.127}"
trap 'docker rm -f "$container" >/dev/null 2>&1 || true' EXIT
docker run --name "$container" --network none -e POSTGRES_HOST_AUTH_METHOD=trust \
  -e POSTGRES_PASSWORD=local-fixture-only -d "$image" \
  -c shared_preload_libraries=pg_cron,pg_net -c cron.database_name=postgres >/dev/null
ready=false
for attempt in $(seq 1 30); do
  if docker exec "$container" pg_isready -U supabase_admin -d postgres >/dev/null 2>&1; then ready=true; break; fi
  sleep 1
done
if [ "$ready" != true ]; then echo 'Local PostgreSQL did not start' >&2; exit 1; fi
{
  cat <<'SQL'
BEGIN;
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;
DO $$ DECLARE role_name text; BEGIN
  FOREACH role_name IN ARRAY ARRAY['anon','authenticated','service_role'] LOOP
    IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname = role_name) THEN EXECUTE format('CREATE ROLE %I',role_name); END IF;
  END LOOP;
END $$;
SQL
  for migration in \
    20260906020000_whatsapp_inbound_events.sql \
    20260909050000_whatsapp_inbound_body.sql \
    20260925143000_whatsapp_outbound_dispatch.sql \
    20260925160000_whatsapp_human_takeover.sql \
    20261002120500_whatsapp_identity_resilience.sql \
    20261014170000_whatsapp_pausa_debounce_prioridad.sql; do
    cat "supabase/migrations/$migration"
    echo
  done
  cat <<'SQL'
CREATE TABLE public.whatsapp_dispatch_auth(id smallint PRIMARY KEY, token text NOT NULL);
INSERT INTO public.whatsapp_dispatch_auth VALUES(1,'fixture-not-a-production-secret');
SELECT cron.schedule('recordatorio-carritos','0 * * * *','SELECT 1');
SQL
  cat supabase/migrations/20261002121000_recordatorio_cron_auth.sql
  cat supabase/tests/recordatorio_cron_auth.sql
  echo 'COMMIT;'
  cat supabase/tests/whatsapp_identity_resilience.sql
} | docker exec -i "$container" psql -U supabase_admin -d postgres -v ON_ERROR_STOP=1 >/dev/null
echo 'WhatsApp identity/resilience and cron SQL fixtures passed (isolated PostgreSQL).'
{
  cat <<'SQL'
BEGIN;
CREATE TABLE public.leads_comerciales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  consentimiento_datos boolean NOT NULL CHECK (consentimiento_datos = true),
  consentimiento_timestamp timestamptz NOT NULL DEFAULT now()
);
SQL
  cat supabase/migrations/20261014171000_leads_consentimiento_pendiente.sql
  cat <<'SQL'
DO $$
DECLARE
  v_datos boolean;
  v_ts timestamptz;
BEGIN
  INSERT INTO public.leads_comerciales DEFAULT VALUES
    RETURNING consentimiento_datos, consentimiento_timestamp INTO v_datos, v_ts;
  IF v_datos IS NOT NULL OR v_ts IS NOT NULL THEN
    RAISE EXCEPTION 'pending consent % %', v_datos, v_ts;
  END IF;
  INSERT INTO public.leads_comerciales (consentimiento_datos) VALUES (false)
    RETURNING consentimiento_datos, consentimiento_timestamp INTO v_datos, v_ts;
  IF v_datos IS DISTINCT FROM false OR v_ts IS NOT NULL THEN
    RAISE EXCEPTION 'declined consent';
  END IF;
  INSERT INTO public.leads_comerciales (consentimiento_datos) VALUES (true)
    RETURNING consentimiento_datos, consentimiento_timestamp INTO v_datos, v_ts;
  IF v_datos IS NOT TRUE OR v_ts IS NULL THEN
    RAISE EXCEPTION 'accepted consent';
  END IF;
END $$;
ROLLBACK;
SQL
} | docker exec -i "$container" psql -U supabase_admin -d postgres -v ON_ERROR_STOP=1 >/dev/null
echo 'Lead consent SQL fixture passed (isolated PostgreSQL).'
