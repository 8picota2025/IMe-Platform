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

  -- rate_limited se reencola: el siguiente lote lo responde.
  result := ingest_whatsapp_event('{"wamid":"fixture.rate","sender_id":"573009990011","sender_type":"phone","phone":"573009990011","kind":"text","body":"sigo aqui","drop_reason":"rate_limited"}');
  IF result->>'status' <> 'pending_agent' THEN RAISE EXCEPTION 'rate_limited requeue'; END IF;
  IF (SELECT status FROM whatsapp_inbound_events WHERE wamid = 'fixture.rate') <> 'pending_agent' THEN RAISE EXCEPTION 'rate_limited status'; END IF;
  IF NOT EXISTS(SELECT 1 FROM whatsapp_drop_log WHERE wamid = 'fixture.rate' AND drop_reason = 'rate_limited') THEN RAISE EXCEPTION 'rate_limited audit'; END IF;
  IF NOT EXISTS(SELECT 1 FROM claim_whatsapp_agent_batch('573009990011',0,30)) THEN RAISE EXCEPTION 'rate_limited claim'; END IF;

  -- #continua reanuda aunque el caller haya mandado pause. El texto no queda como envío.
  result := ingest_whatsapp_event('{"wamid":"fixture.pausa.cmd","sender_id":"573009990022","sender_type":"phone","phone":"573009990022","kind":"echo","body":"#pausa","echo_action":"pause","owner_echo":true}');
  IF whatsapp_dispatch_drop_reason('573009990022') <> 'paused' THEN RAISE EXCEPTION 'command pause'; END IF;
  IF (SELECT body FROM whatsapp_outbound_messages WHERE wamid = 'fixture.pausa.cmd') = '#pausa' THEN RAISE EXCEPTION 'command forwarded'; END IF;
  IF (SELECT body FROM whatsapp_outbound_messages WHERE wamid = 'fixture.pausa.cmd') <> '[toma-humana]' THEN RAISE EXCEPTION 'command placeholder'; END IF;
  result := ingest_whatsapp_event('{"wamid":"fixture.continua","sender_id":"573009990022","sender_type":"phone","phone":"573009990022","kind":"echo","body":"#continua ya","echo_action":"pause","owner_echo":true}');
  IF whatsapp_dispatch_drop_reason('573009990022') IS NOT NULL THEN RAISE EXCEPTION 'continua resume'; END IF;

  -- Plantilla Meta: se anota kind=template y no pausa.
  result := ingest_whatsapp_event('{"wamid":"fixture.template","sender_id":"573009990033","sender_type":"phone","phone":"573009990033","kind":"echo","body":"[template]","template_name":"aviso_cotizacion_pendiente","owner_echo":true}');
  IF whatsapp_dispatch_drop_reason('573009990033') IS NOT NULL THEN RAISE EXCEPTION 'template pause'; END IF;
  IF (SELECT kind FROM whatsapp_outbound_messages WHERE wamid = 'fixture.template') <> 'template' THEN RAISE EXCEPTION 'template kind'; END IF;
  IF (SELECT body FROM whatsapp_outbound_messages WHERE wamid = 'fixture.template') <> 'aviso_cotizacion_pendiente' THEN RAISE EXCEPTION 'template name'; END IF;

  -- Escritura alarga el silencio, con tope de 2 minutos.
  result := ingest_whatsapp_event('{"wamid":"fixture.typing","sender_id":"573009990044","sender_type":"phone","phone":"573009990044","kind":"text","body":"empiezo"}');
  UPDATE whatsapp_inbound_events SET created_at = now() - interval '40 seconds' WHERE wamid = 'fixture.typing';
  PERFORM note_whatsapp_typing('573009990044', true);
  IF EXISTS(SELECT 1 FROM claim_whatsapp_agent_batch('573009990044',30,30)) THEN RAISE EXCEPTION 'typing holds claim'; END IF;
  UPDATE whatsapp_inbound_events SET created_at = now() - interval '3 minutes' WHERE wamid = 'fixture.typing';
  IF NOT EXISTS(SELECT 1 FROM claim_whatsapp_agent_batch('573009990044',30,30)) THEN RAISE EXCEPTION 'typing cap'; END IF;

  -- Silencio por defecto: 26 s no alcanza, 31 s sí.
  result := ingest_whatsapp_event('{"wamid":"fixture.quiet","sender_id":"573009990055","sender_type":"phone","phone":"573009990055","kind":"text","body":"espera"}');
  UPDATE whatsapp_inbound_events SET created_at = now() - interval '26 seconds' WHERE wamid = 'fixture.quiet';
  IF EXISTS(SELECT 1 FROM claim_whatsapp_agent_batch('573009990055', NULL, 30)) THEN RAISE EXCEPTION 'quiet 26s'; END IF;
  UPDATE whatsapp_inbound_events SET created_at = now() - interval '31 seconds' WHERE wamid = 'fixture.quiet';
  IF NOT EXISTS(SELECT 1 FROM claim_whatsapp_agent_batch('573009990055', NULL, 30)) THEN RAISE EXCEPTION 'quiet 31s'; END IF;

  -- Eco que no es del dueño, en un chat ya pausado, deja bandera para el watcher.
  result := ingest_whatsapp_event('{"wamid":"fixture.owner.pause","sender_id":"573009990066","sender_type":"phone","phone":"573009990066","kind":"echo","body":"lo veo yo","echo_action":"pause","owner_echo":true}');
  IF EXISTS(SELECT 1 FROM whatsapp_watcher_flags WHERE wa_id = '573009990066') THEN RAISE EXCEPTION 'owner echo flagged'; END IF;
  result := ingest_whatsapp_event('{"wamid":"fixture.external","sender_id":"573009990066","sender_type":"phone","phone":"573009990066","kind":"echo","body":"otro canal","echo_action":"pause","owner_echo":false}');
  IF NOT EXISTS(SELECT 1 FROM whatsapp_watcher_flags WHERE wa_id = '573009990066' AND wamid = 'fixture.external' AND reason = 'paused_unmatched_outbound') THEN RAISE EXCEPTION 'watcher flag'; END IF;
END $$;
ROLLBACK;
