#!/usr/bin/env node
/**
 * Canary crítico: flujo de solicitud de cotización (web + Edge).
 *
 * Comprueba tras cada deploy:
 * 1) Página /es/contacto con formulario + status + modal navbar
 * 2) Edge registrar-cotizacion → ok sin correo de éxito
 * 3) Edge registrar-lead-comercial (campaña proyectos) → ok + email interno
 * 4) Opcional: email_log (service role) confirma envíos recientes
 *
 * Uso:
 *   node scripts/canary-cotizacion.mjs
 *   npm run canary:cotizacion
 *
 * Env:
 *   PUBLIC_SUPABASE_URL / PUBLIC_SUPABASE_ANON_KEY (requeridos para API)
 *   CANARY_SMOKE_SECRET (opcional; aísla rate-limit)
 *   SUPABASE_SERVICE_ROLE_KEY (opcional; verifica email_log)
 *   CANARY_BASE_URL (default https://i-me.com.co)
 */

import { createHash, randomUUID } from 'node:crypto';

const BASE_URL = (process.env.CANARY_BASE_URL || 'https://i-me.com.co').replace(/\/$/, '');
const SUPABASE_URL = (
  process.env.PUBLIC_SUPABASE_URL ||
  process.env.SUPABASE_URL ||
  'https://nnfbucwiasuggyfoyydo.supabase.co'
).replace(/\/$/, '');
const ANON_KEY =
  process.env.PUBLIC_SUPABASE_ANON_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  '';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const CANARY_SECRET = process.env.CANARY_SMOKE_SECRET || '';
const UA = 'IME-Cotizacion-Canary/1.0 (+https://github.com/8picota2025/IMe-Platform)';

const failures = [];

function fail(msg) {
  failures.push(msg);
  console.error(`FAIL  ${msg}`);
}

function ok(msg) {
  console.log(`OK    ${msg}`);
}

async function fetchText(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': UA, Accept: 'text/html' },
    redirect: 'follow',
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
  return res.text();
}

async function invokeFunction(name, body) {
  if (!ANON_KEY) throw new Error('PUBLIC_SUPABASE_ANON_KEY ausente');
  const headers = {
    Authorization: `Bearer ${ANON_KEY}`,
    apikey: ANON_KEY,
    'Content-Type': 'application/json',
    Origin: BASE_URL,
    'User-Agent': UA,
  };
  if (CANARY_SECRET) headers['x-ime-canary-secret'] = CANARY_SECRET;

  const res = await fetch(`${SUPABASE_URL}/functions/v1/${name}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* ignore */
  }
  return { status: res.status, json, text };
}

async function checkEmailLog(plantilla, destinatarioContains, sinceIso) {
  if (!SERVICE_KEY) {
    console.log('SKIP  email_log (sin SUPABASE_SERVICE_ROLE_KEY)');
    return;
  }
  const url = new URL(`${SUPABASE_URL}/rest/v1/email_log`);
  url.searchParams.set(
    'select',
    'destinatario,plantilla,status,error,created_at'
  );
  url.searchParams.set('plantilla', `eq.${plantilla}`);
  url.searchParams.set('created_at', `gte.${sinceIso}`);
  url.searchParams.set('order', 'created_at.desc');
  url.searchParams.set('limit', '20');

  const res = await fetch(url, {
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
    },
  });
  if (!res.ok) {
    fail(`email_log query ${plantilla}: HTTP ${res.status}`);
    return;
  }
  const rows = await res.json();
  const hit = rows.find(
    r =>
      r.status === 'enviado' &&
      String(r.destinatario || '').includes(destinatarioContains)
  );
  if (!hit) {
    fail(
      `email_log: sin envío ok de ${plantilla} a *${destinatarioContains}* desde ${sinceIso}`
    );
    return;
  }
  ok(`email_log ${plantilla} → ${hit.destinatario}`);
}

async function checkContactPage() {
  const html = await fetchText(`${BASE_URL}/es/contacto/`);
  const required = [
    ['id="contacto-form"', 'formulario contacto'],
    ['id="form-status"', 'banner estado'],
    ['id="form-submit-btn"', 'botón envío'],
    ['id="quote-request-modal"', 'modal Cotización navbar'],
    ['id="quote-request-form"', 'form lead comercial'],
  ];
  for (const [needle, label] of required) {
    if (!html.includes(needle)) fail(`/es/contacto/ sin ${label} (${needle})`);
    else ok(`/es/contacto/ tiene ${label}`);
  }
}

async function checkRegistrarCotizacion(stamp) {
  const email = `canary-cotizacion-${stamp}@ime-test.local`;
  const { status, json, text } = await invokeFunction('registrar-cotizacion', {
    locale: 'es',
    origen: 'canary_ci',
    nombre: 'Canary Cotizacion CI',
    email,
    telefono: '3000000000',
    mensaje: `Canary automático ${stamp}: verificar flujo crítico cotización.`,
    consentimiento_datos: true,
    productos: [],
  });

  if (status !== 200 || !json?.ok) {
    fail(`registrar-cotizacion HTTP ${status}: ${text.slice(0, 300)}`);
    return;
  }
  ok(`registrar-cotizacion ok (QA sin correo de éxito: ${email})`);
  if (json.emails?.alerta_fallo) {
    fail(`registrar-cotizacion alerta de fallo inesperada: ${JSON.stringify(json.emails)}`);
  }
}

async function checkRegistrarLead(stamp) {
  const email = `canary-lead-${stamp}@ime-test.local`;
  const sinceIso = new Date(Date.now() - 60_000).toISOString();
  const idem = createHash('sha256')
    .update(`canary-lead-${stamp}-${randomUUID()}`)
    .digest('hex')
    .slice(0, 40);

  const { status, json, text } = await invokeFunction('registrar-lead-comercial', {
    idempotencyKey: idem,
    campaign: 'proyectos',
    locale: 'es',
    nombre: 'Canary Lead CI',
    institucion: 'I-ME Canary Hospital',
    ciudad: 'Bogota',
    telefono: '3000000001',
    email,
    tipo_proyecto: 'cotizacion_producto',
    horizonte: '4-12',
    necesidad: `Canary automático ${stamp}: modal Cotización navbar.`,
    consentimiento: true,
    familia_slug: 'general',
  });

  if (![200, 201].includes(status) || !json?.ok || !json?.leadId) {
    fail(`registrar-lead-comercial HTTP ${status}: ${text.slice(0, 300)}`);
    return;
  }
  ok(`registrar-lead-comercial ok leadId=${json.leadId}`);

  if (json.emails && json.emails.interno !== true) {
    fail(`registrar-lead-comercial emails.interno=${JSON.stringify(json.emails)}`);
  } else if (json.emails?.interno) {
    ok('registrar-lead-comercial emails.interno=true');
  } else {
    fail('registrar-lead-comercial sin campo emails (deploy Edge desfasado?)');
  }

  await checkEmailLog('cotizacion_interna', 'i-me.com.co', sinceIso);
}

async function main() {
  console.log(`Canary cotización → ${BASE_URL}`);
  console.log(`Supabase → ${SUPABASE_URL}`);
  const stamp = Date.now().toString(36);

  try {
    await checkContactPage();
  } catch (err) {
    fail(`página contacto: ${err instanceof Error ? err.message : err}`);
  }

  try {
    await checkRegistrarCotizacion(stamp);
  } catch (err) {
    fail(`API cotizacion: ${err instanceof Error ? err.message : err}`);
  }

  try {
    await checkRegistrarLead(stamp);
  } catch (err) {
    fail(`API lead: ${err instanceof Error ? err.message : err}`);
  }

  if (failures.length) {
    console.error(`\nCanary FALLÓ (${failures.length}):`);
    for (const f of failures) console.error(` - ${f}`);
    process.exit(1);
  }
  console.log('\nCanary cotización OK — flujo crítico vivo.');
}

main();
