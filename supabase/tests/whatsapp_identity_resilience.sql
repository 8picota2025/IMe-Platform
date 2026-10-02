-- Execute on an isolated migrated database with psql -v ON_ERROR_STOP=1.
BEGIN;
DO $$ DECLARE result jsonb; token uuid; n integer; t timestamptz; BEGIN
  IF (SELECT count(*) FROM whatsapp_contact_exclusions) <> 11 THEN RAISE EXCEPTION 'exclusion seed'; END IF;
  result := ingest_whatsapp_event('{"wamid":"fixture.text","sender_id":"573001112233","sender_type":"phone","phone":"573001112233","kind":"text","body":"Hola","raw":{"fixture":true}}');
  IF result->>'status' <> 'pending_agent' THEN RAISE EXCEPTION 'text ingest'; END IF;
  result := ingest_whatsapp_event('{"wamid":"fixture.audio","sender_id":"CO.TestBsuid42","sender_type":"bsuid","bsuid":"CO.TestBsuid42","phone":"573001112233","username":"test.university","profile_name":"Institución de prueba","kind":"audio","body":"[audio]","raw":{"audio":{"id":"fixture"}}}');
  IF result->>'from_wa' <> '573001112233' THEN RAISE EXCEPTION 'stable compatibility route'; END IF;
  IF (SELECT bsuid FROM whatsapp_contact_routes WHERE sender_id = '573001112233') <> 'CO.TestBsuid42' THEN RAISE EXCEPTION 'latest usable identifier'; END IF;
  result := ingest_whatsapp_event('{"wamid":"fixture.audio","sender_id":"CO.TestBsuid42","sender_type":"bsuid","kind":"audio","body":"[audio]"}');
  IF result->>'status' <> 'duplicate' OR (SELECT count(*) FROM whatsapp_inbound_events WHERE wamid = 'fixture.audio') <> 1 THEN RAISE EXCEPTION 'duplicate'; END IF;
  result := ingest_whatsapp_event('{"wamid":"fixture.echo","sender_id":"CO.TestBsuid42","sender_type":"bsuid","bsuid":"CO.TestBsuid42","kind":"echo","body":"[image]","echo_action":"pause"}');
  IF whatsapp_dispatch_drop_reason('573001112233') <> 'paused' THEN RAISE EXCEPTION 'automatic takeover'; END IF;
  IF (SELECT reason FROM whatsapp_contact_pauses WHERE wa_id = '573001112233') <> 'human_takeover' THEN RAISE EXCEPTION 'pause reason'; END IF;
  IF EXISTS(SELECT 1 FROM claim_whatsapp_agent_batch('573001112233',0,30)) THEN RAISE EXCEPTION 'paused claim'; END IF;
  result := ingest_whatsapp_event('{"wamid":"fixture.resume","sender_id":"CO.TestBsuid42","sender_type":"bsuid","bsuid":"CO.TestBsuid42","kind":"echo","body":"#activa","echo_action":"resume"}');
  IF whatsapp_dispatch_drop_reason('573001112233') IS NOT NULL THEN RAISE EXCEPTION 'resume'; END IF;
  result := ingest_whatsapp_event('{"wamid":"fixture.excluded","sender_id":"573156425021","sender_type":"phone","phone":"573156425021","kind":"text","body":"Hola"}');
  IF result->>'status' <> 'ignored' OR whatsapp_dispatch_drop_reason('573156425021') <> 'excluded' THEN RAISE EXCEPTION 'excluded'; END IF;
  IF EXISTS(SELECT 1 FROM claim_whatsapp_agent_batch('573156425021',0,30)) THEN RAISE EXCEPTION 'excluded claim'; END IF;
  IF whatsapp_dispatch_drop_reason('120363123@g.us') <> 'group' THEN RAISE EXCEPTION 'group'; END IF;
  result := ingest_whatsapp_event('{"wamid":"fixture.bot","sender_id":"CO.Bot123","sender_type":"bsuid","bsuid":"CO.Bot123","kind":"text","body":"Bot","drop_reason":"bot"}');
  IF result->>'status' <> 'ignored' THEN RAISE EXCEPTION 'bot'; END IF;
  -- No HTTP calls: test atomic claims, three failures, and unique alert creation.
  FOR n IN 1..4 LOOP
    SELECT out_claim_token INTO token FROM claim_whatsapp_agent_batch('573001112233',0,30) LIMIT 1;
    IF token IS NULL THEN RAISE EXCEPTION 'missing claim %', n; END IF;
    IF EXISTS(SELECT 1 FROM claim_whatsapp_agent_batch('573001112233',0,30)) THEN RAISE EXCEPTION 'double claim'; END IF;
    PERFORM fail_whatsapp_batch(token,'fixture_failure',true);
  END LOOP;
  IF (SELECT retry_count FROM whatsapp_inbound_events WHERE wamid = 'fixture.audio') <> 4 THEN RAISE EXCEPTION 'retry count'; END IF;
  IF (SELECT count(*) FROM whatsapp_alerts WHERE reason = 'consecutive_failures') <> 1 THEN RAISE EXCEPTION 'one alert per turn'; END IF;
  -- A successful wake without a completed reply must count as a failure after expiry.
  SELECT out_claim_token INTO token FROM claim_whatsapp_agent_batch('573001112233',0,30) LIMIT 1;
  UPDATE whatsapp_inbound_events SET agent_claimed_at = now() - interval '4 minutes' WHERE agent_claim_token = token;
  PERFORM maintain_whatsapp_pipeline();
  PERFORM maintain_whatsapp_pipeline();
  IF (SELECT retry_count FROM whatsapp_inbound_events WHERE wamid = 'fixture.audio') <> 5 THEN RAISE EXCEPTION 'expiry counted once'; END IF;
  -- Duplicate API echo must not pause a contact.
  INSERT INTO whatsapp_outbound_messages(to_wa,body,kind,wamid) VALUES('573001112233','Respuesta','reply','fixture.api.echo');
  result := ingest_whatsapp_event('{"wamid":"fixture.api.echo","sender_id":"CO.TestBsuid42","sender_type":"bsuid","bsuid":"CO.TestBsuid42","kind":"echo","body":"Respuesta"}');
  IF whatsapp_dispatch_drop_reason('573001112233') IS NOT NULL THEN RAISE EXCEPTION 'API echo takeover'; END IF;
  UPDATE whatsapp_inbound_events SET updated_at = '2026-01-01' WHERE wamid = 'fixture.text';
  UPDATE whatsapp_inbound_events SET status = 'replied' WHERE wamid = 'fixture.text';
  SELECT updated_at INTO t FROM whatsapp_inbound_events WHERE wamid = 'fixture.text';
  IF t <> now() THEN RAISE EXCEPTION 'updated_at trigger'; END IF;
  UPDATE whatsapp_inbound_events SET created_at = now() - interval '25 hours' WHERE wamid = 'fixture.audio';
  PERFORM maintain_whatsapp_pipeline();
  IF (SELECT status FROM whatsapp_inbound_events WHERE wamid = 'fixture.audio') <> 'stale' THEN RAISE EXCEPTION 'stale'; END IF;
  IF NOT EXISTS(SELECT 1 FROM whatsapp_drop_log WHERE wamid = 'fixture.audio' AND drop_reason = 'stale') THEN RAISE EXCEPTION 'stale audit'; END IF;
  IF has_table_privilege('anon','whatsapp_contact_routes','SELECT') OR has_function_privilege('anon','ingest_whatsapp_event(jsonb)','EXECUTE') THEN RAISE EXCEPTION 'permissions'; END IF;
END $$;
ROLLBACK;
