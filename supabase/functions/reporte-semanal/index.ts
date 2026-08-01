/**
 * Reporte semanal ejecutivo I-ME.
 * Ventana: lunes 00:00 → domingo 23:59 America/Bogota.
 * Auth: Bearer SUPABASE_SERVICE_ROLE_KEY o x-reporte-semanal-secret.
 * Cron: GitHub Actions (lunes 04:59 UTC = domingo 23:59 Bogota).
 */

import { handleCors, getCorsHeaders } from '../_shared/cors.ts';
import { badRequest, unauthorized, internalError } from '../_shared/errors.ts';
import { getServerSupabase } from '../_shared/supabase-server.ts';
import { escapeHtml } from '../_shared/email.ts';

const FN_NAME = 'reporte-semanal';
const DEFAULT_TO = 'root@i-me.com.co,info@i-me.com.co,jfm8ime@gmail.com';

interface DayBucket {
  date: string;
  label: string;
  visitas: number;
  sesiones: number;
  cotizaciones: number;
  pedidos_validados: number;
  importe_validados: number;
}

function authorized(req: Request): boolean {
  const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')?.trim() ?? '';
  const secret = Deno.env.get('REPORTE_SEMANAL_SECRET')?.trim() ?? '';
  const auth = req.headers.get('Authorization') ?? '';
  const bearer = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  const headerSecret = req.headers.get('x-reporte-semanal-secret') ?? '';
  if (service && bearer && bearer === service) return true;
  if (secret && (headerSecret === secret || bearer === secret)) return true;
  return false;
}

function recipients(): string[] {
  return (Deno.env.get('REPORTE_SEMANAL_TO') ?? DEFAULT_TO)
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
}

/** YYYY-MM-DD in America/Bogota */
function bogotaDateStr(d: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Bogota',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

function bogotaWeekday(d: Date): number {
  // 0=Sun..6=Sat in Bogota
  const wd = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Bogota',
    weekday: 'short',
  }).format(d);
  const map: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  return map[wd] ?? 0;
}

/** Instant for YYYY-MM-DD HH:MM:SS in America/Bogota → UTC ISO */
function bogotaLocalToUtcIso(dateStr: string, time: string): string {
  // Bogota = UTC-5 year-round
  const [y, m, d] = dateStr.split('-').map(Number);
  const [hh, mm, ss] = time.split(':').map(Number);
  const utcMs = Date.UTC(y!, m! - 1, d!, (hh ?? 0) + 5, mm ?? 0, ss ?? 0, 0);
  return new Date(utcMs).toISOString();
}

function addDaysYmd(ymd: string, days: number): string {
  const [y, m, d] = ymd.split('-').map(Number);
  const dt = new Date(Date.UTC(y!, m! - 1, d!));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

function weekWindow(now = new Date()): {
  startIso: string;
  endIso: string;
  startYmd: string;
  endYmd: string;
  days: string[];
  label: string;
} {
  const endYmd = bogotaDateStr(now);
  const dow = bogotaWeekday(now); // 0 Sunday
  const daysSinceMonday = dow === 0 ? 6 : dow - 1;
  const startYmd = addDaysYmd(endYmd, -daysSinceMonday);
  const days: string[] = [];
  for (let i = 0; i < 7; i++) days.push(addDaysYmd(startYmd, i));
  return {
    startYmd,
    endYmd,
    startIso: bogotaLocalToUtcIso(startYmd, '00:00:00'),
    endIso: bogotaLocalToUtcIso(endYmd, '23:59:59'),
    days,
    label: `${startYmd} → ${endYmd}`,
  };
}

function money(n: number, moneda = 'COP'): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: moneda,
    maximumFractionDigits: moneda === 'COP' ? 0 : 2,
  }).format(n);
}

function pct(n: number): string {
  if (!Number.isFinite(n)) return '—';
  const sign = n > 0 ? '+' : '';
  return `${sign}${n.toFixed(1)}%`;
}

function deltaPct(curr: number, prev: number): number {
  if (prev === 0) return curr === 0 ? 0 : 100;
  return ((curr - prev) / prev) * 100;
}

function quickChartUrl(config: Record<string, unknown>, w = 640, h = 280): string {
  const encoded = encodeURIComponent(JSON.stringify(config));
  return `https://quickchart.io/chart?c=${encoded}&format=png&width=${w}&height=${h}&backgroundColor=white`;
}

function dayLabel(ymd: string): string {
  const [y, m, d] = ymd.split('-').map(Number);
  const dt = new Date(Date.UTC(y!, m! - 1, d!, 12));
  return new Intl.DateTimeFormat('es-CO', {
    timeZone: 'UTC',
    weekday: 'short',
    day: '2-digit',
    month: 'short',
  }).format(dt);
}

function kpiCard(title: string, value: string, delta: string, hint: string): string {
  const color = delta.startsWith('+') ? '#0a7a3e' : delta.startsWith('-') ? '#b42318' : '#475467';
  return `
    <td style="width:33%;padding:8px;vertical-align:top">
      <div style="border:1px solid #e4e7ec;border-radius:8px;padding:14px 16px;background:#fff">
        <div style="font-size:12px;color:#667085;text-transform:uppercase;letter-spacing:.04em">${title}</div>
        <div style="font-size:26px;font-weight:700;color:#101828;margin:6px 0">${value}</div>
        <div style="font-size:13px;color:${color};font-weight:600">${delta} vs sem. ant.</div>
        <div style="font-size:12px;color:#98a2b3;margin-top:4px">${hint}</div>
      </div>
    </td>`;
}

Deno.serve(async req => {
  const origin = req.headers.get('origin');
  const cors = handleCors(req);
  if (cors) return cors;
  if (req.method !== 'POST') return badRequest('POST only', origin);
  if (!authorized(req)) return unauthorized(origin);

  const body = (await req.json().catch(() => ({}))) as { dry_run?: boolean; as_of?: string };
  const asOf = body.as_of ? new Date(body.as_of) : new Date();
  if (Number.isNaN(asOf.getTime())) return badRequest('as_of invalido', origin);

  const week = weekWindow(asOf);
  const prevStartYmd = addDaysYmd(week.startYmd, -7);
  const prevEndYmd = addDaysYmd(week.endYmd, -7);
  const prevStartIso = bogotaLocalToUtcIso(prevStartYmd, '00:00:00');
  const prevEndIso = bogotaLocalToUtcIso(prevEndYmd, '23:59:59');

  const supabase = getServerSupabase();

  try {
    const [
      analyticsCurr,
      analyticsPrev,
      cotCurr,
      cotPrev,
      pedWide,
      pedPendVal,
      pedRech,
      cotEnviadas,
    ] = await Promise.all([
      supabase
        .from('analytics_eventos')
        .select('event_name, session_id, page_path, ts, product_slug')
        .gte('ts', week.startIso)
        .lte('ts', week.endIso)
        .limit(50000),
      supabase
        .from('analytics_eventos')
        .select('event_name, session_id, ts')
        .gte('ts', prevStartIso)
        .lte('ts', prevEndIso)
        .limit(50000),
      supabase
        .from('solicitudes_cotizacion')
        .select('id, created_at, estado, precio_total_ofertado, total_estimado, moneda')
        .gte('created_at', week.startIso)
        .lte('created_at', week.endIso)
        .limit(10000),
      supabase
        .from('solicitudes_cotizacion')
        .select('id, created_at, precio_total_ofertado, total_estimado')
        .gte('created_at', prevStartIso)
        .lte('created_at', prevEndIso)
        .limit(10000),
      supabase
        .from('pedidos')
        .select('id, created_at, estado, total, moneda, pago_validado_at, proveedor_pago')
        .or(
          `pago_validado_at.gte.${prevStartIso},and(estado.eq.pagado,created_at.gte.${prevStartIso})`
        )
        .limit(10000),
      supabase
        .from('pedidos')
        .select('id', { count: 'exact', head: true })
        .eq('estado', 'pendiente_validacion'),
      supabase
        .from('pedidos')
        .select('id', { count: 'exact', head: true })
        .eq('estado', 'rechazado')
        .gte('created_at', week.startIso)
        .lte('created_at', week.endIso),
      supabase
        .from('solicitudes_cotizacion')
        .select('id', { count: 'exact', head: true })
        .eq('estado', 'enviada')
        .gte('oferta_enviada_at', week.startIso)
        .lte('oferta_enviada_at', week.endIso),
    ]);

    for (const r of [analyticsCurr, analyticsPrev, cotCurr, cotPrev, pedWide]) {
      if (r.error) return internalError(r.error.message, origin);
    }

    type ARow = {
      event_name: string;
      session_id: string;
      page_path?: string | null;
      ts: string;
      product_slug?: string | null;
    };
    type CRow = {
      id: string;
      created_at: string;
      estado?: string | null;
      precio_total_ofertado?: number | string | null;
      total_estimado?: number | string | null;
      moneda?: string | null;
    };
    type PRow = {
      id: string;
      created_at: string;
      estado: string;
      total: number | string | null;
      moneda?: string | null;
      pago_validado_at?: string | null;
      proveedor_pago?: string | null;
    };

    const aCurr = (analyticsCurr.data ?? []) as ARow[];
    const aPrev = (analyticsPrev.data ?? []) as ARow[];
    const cCurr = (cotCurr.data ?? []) as CRow[];
    const cPrev = (cotPrev.data ?? []) as CRow[];

    const inWindow = (iso: string, start: string, end: string) => iso >= start && iso <= end;
    const validatedAt = (p: PRow): string | null => {
      if (p.pago_validado_at) return p.pago_validado_at;
      if (p.estado === 'pagado') return p.created_at;
      return null;
    };
    const pedAll = (pedWide.data ?? []) as PRow[];
    const pCurr = pedAll.filter(p => {
      const when = validatedAt(p);
      return when ? inWindow(when, week.startIso, week.endIso) : false;
    });
    const pPrev = pedAll.filter(p => {
      const when = validatedAt(p);
      return when ? inWindow(when, prevStartIso, prevEndIso) : false;
    });

    const pageViews = aCurr.filter(e => e.event_name === 'page_view');
    const pageViewsPrev = aPrev.filter(e => e.event_name === 'page_view');
    const sessions = new Set(pageViews.map(e => e.session_id));
    const sessionsPrev = new Set(pageViewsPrev.map(e => e.session_id));

    const whatsapp = aCurr.filter(e => e.event_name === 'whatsapp_click').length;
    const tel = aCurr.filter(e => e.event_name === 'tel_click').length;
    const search = aCurr.filter(e => e.event_name === 'search').length;
    const productViews = aCurr.filter(e => e.event_name === 'product_view').length;
    const addToCart = aCurr.filter(e => e.event_name === 'add_to_cart').length;
    const beginCheckout = aCurr.filter(e => e.event_name === 'begin_checkout').length;

    const cotCount = cCurr.length;
    const cotCountPrev = cPrev.length;
    const cotImporte = cCurr.reduce(
      (acc, r) => acc + Number(r.precio_total_ofertado ?? r.total_estimado ?? 0),
      0
    );
    const cotImportePrev = cPrev.reduce(
      (acc, r) => acc + Number(r.precio_total_ofertado ?? r.total_estimado ?? 0),
      0
    );

    const pedCount = pCurr.length;
    const pedCountPrev = pPrev.length;
    const pedImporte = pCurr.reduce((acc, r) => acc + Number(r.total ?? 0), 0);
    const pedImportePrev = pPrev.reduce((acc, r) => acc + Number(r.total ?? 0), 0);

    const buckets: DayBucket[] = week.days.map(date => ({
      date,
      label: dayLabel(date),
      visitas: 0,
      sesiones: 0,
      cotizaciones: 0,
      pedidos_validados: 0,
      importe_validados: 0,
    }));
    const byDate = new Map(buckets.map(b => [b.date, b]));
    const sessionsByDay = new Map<string, Set<string>>();

    for (const e of pageViews) {
      const d = bogotaDateStr(new Date(e.ts));
      const b = byDate.get(d);
      if (!b) continue;
      b.visitas += 1;
      if (!sessionsByDay.has(d)) sessionsByDay.set(d, new Set());
      sessionsByDay.get(d)!.add(e.session_id);
    }
    for (const [d, set] of sessionsByDay) {
      const b = byDate.get(d);
      if (b) b.sesiones = set.size;
    }
    for (const c of cCurr) {
      const d = bogotaDateStr(new Date(c.created_at));
      const b = byDate.get(d);
      if (b) b.cotizaciones += 1;
    }
    for (const p of pCurr) {
      const when = p.pago_validado_at || p.created_at;
      const d = bogotaDateStr(new Date(when));
      const b = byDate.get(d);
      if (!b) continue;
      b.pedidos_validados += 1;
      b.importe_validados += Number(p.total ?? 0);
    }

    const pageCounts = new Map<string, number>();
    for (const e of pageViews) {
      const path = (e.page_path || '/').split('?')[0] || '/';
      pageCounts.set(path, (pageCounts.get(path) ?? 0) + 1);
    }
    const topPages = [...pageCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);

    const productCounts = new Map<string, number>();
    for (const e of aCurr.filter(x => x.event_name === 'product_view' && x.product_slug)) {
      const slug = e.product_slug!;
      productCounts.set(slug, (productCounts.get(slug) ?? 0) + 1);
    }
    const topProducts = [...productCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);

    const visitasChart = quickChartUrl({
      type: 'bar',
      data: {
        labels: buckets.map(b => b.label),
        datasets: [
          {
            label: 'Visitas (page_view)',
            data: buckets.map(b => b.visitas),
            backgroundColor: '#0b3d4a',
          },
          {
            label: 'Sesiones',
            data: buckets.map(b => b.sesiones),
            backgroundColor: '#2a9d8f',
          },
        ],
      },
      options: {
        plugins: {
          title: { display: true, text: 'Trafico diario' },
          legend: { position: 'bottom' },
        },
        scales: { y: { beginAtZero: true } },
      },
    });

    const funnelChart = quickChartUrl({
      type: 'bar',
      data: {
        labels: [
          'Sesiones',
          'Vistas producto',
          'Add to cart',
          'Checkout',
          'Cotizaciones',
          'Pedidos validados',
        ],
        datasets: [
          {
            label: 'Embudo',
            data: [sessions.size, productViews, addToCart, beginCheckout, cotCount, pedCount],
            backgroundColor: ['#94a3b8', '#64748b', '#0ea5e9', '#f59e0b', '#8b5cf6', '#0a7a3e'],
          },
        ],
      },
      options: {
        indexAxis: 'y',
        plugins: { title: { display: true, text: 'Embudo semanal' }, legend: { display: false } },
        scales: { x: { beginAtZero: true } },
      },
    });

    const revenueChart = quickChartUrl({
      type: 'line',
      data: {
        labels: buckets.map(b => b.label),
        datasets: [
          {
            label: 'Importe pedidos validados (COP)',
            data: buckets.map(b => Math.round(b.importe_validados)),
            borderColor: '#0a7a3e',
            backgroundColor: 'rgba(10,122,62,0.15)',
            fill: true,
            tension: 0.3,
          },
          {
            label: 'Cotizaciones (#)',
            data: buckets.map(b => b.cotizaciones),
            borderColor: '#8b5cf6',
            backgroundColor: 'rgba(139,92,246,0.1)',
            fill: false,
            yAxisID: 'y1',
            tension: 0.3,
          },
        ],
      },
      options: {
        plugins: {
          title: { display: true, text: 'Ingresos validados y cotizaciones' },
          legend: { position: 'bottom' },
        },
        scales: {
          y: { beginAtZero: true, position: 'left' },
          y1: { beginAtZero: true, position: 'right', grid: { drawOnChartArea: false } },
        },
      },
    });

    const convSesCot = sessions.size ? (cotCount / sessions.size) * 100 : 0;
    const convCotPed = cotCount ? (pedCount / cotCount) * 100 : 0;
    const ticketPromedio = pedCount ? pedImporte / pedCount : 0;

    const topPagesHtml = topPages.length
      ? topPages
          .map(
            ([path, n], i) =>
              `<tr><td style="padding:6px 8px;border-bottom:1px solid #eee">${i + 1}. ${escapeHtml(path)}</td><td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:right">${n}</td></tr>`
          )
          .join('')
      : '<tr><td colspan="2" style="padding:8px;color:#98a2b3">Sin page_views esta semana</td></tr>';

    const topProductsHtml = topProducts.length
      ? topProducts
          .map(
            ([slug, n], i) =>
              `<tr><td style="padding:6px 8px;border-bottom:1px solid #eee">${i + 1}. ${escapeHtml(slug)}</td><td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:right">${n}</td></tr>`
          )
          .join('')
      : '<tr><td colspan="2" style="padding:8px;color:#98a2b3">Sin product_view esta semana</td></tr>';

    const html = `
<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8"><title>Reporte semanal I-ME</title></head>
<body style="margin:0;padding:0;background:#f2f4f7;font-family:Arial,Helvetica,sans-serif;color:#101828">
  <div style="max-width:720px;margin:0 auto;padding:24px 12px">
    <div style="background:#0b3d4a;color:#fff;border-radius:12px 12px 0 0;padding:22px 24px">
      <div style="font-size:13px;opacity:.85">I-ME · Cuadro de resultados</div>
      <h1 style="margin:6px 0 0;font-size:24px">Reporte semanal</h1>
      <div style="margin-top:8px;font-size:14px;opacity:.9">${escapeHtml(week.label)} (America/Bogota)</div>
    </div>
    <div style="background:#fff;padding:20px 16px;border:1px solid #e4e7ec;border-top:0">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse">
        <tr>
          ${kpiCard('Visitas', String(pageViews.length), pct(deltaPct(pageViews.length, pageViewsPrev.length)), `${sessions.size} sesiones (${pct(deltaPct(sessions.size, sessionsPrev.size))} vs ant.)`)}
          ${kpiCard('Cotizaciones', String(cotCount), pct(deltaPct(cotCount, cotCountPrev)), money(cotImporte) + ' ofertados/est.')}
          ${kpiCard('Pedidos validados', String(pedCount), pct(deltaPct(pedCount, pedCountPrev)), money(pedImporte))}
        </tr>
      </table>

      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;margin-top:8px">
        <tr>
          ${kpiCard('Ticket promedio', money(ticketPromedio), pct(deltaPct(ticketPromedio, pedCountPrev ? pedImportePrev / pedCountPrev : 0)), 'sobre pedidos validados')}
          ${kpiCard('Conv. sesion→cotiz.', `${convSesCot.toFixed(1)}%`, '—', 'cotizaciones / sesiones')}
          ${kpiCard('Conv. cotiz.→pedido', `${convCotPed.toFixed(1)}%`, '—', 'validados / cotizaciones')}
        </tr>
      </table>

      <h2 style="font-size:16px;margin:24px 8px 8px">Trafico</h2>
      <img src="${visitasChart}" alt="Grafica trafico diario" width="640" style="max-width:100%;height:auto;border:1px solid #e4e7ec;border-radius:8px" />

      <h2 style="font-size:16px;margin:24px 8px 8px">Embudo</h2>
      <img src="${funnelChart}" alt="Grafica embudo" width="640" style="max-width:100%;height:auto;border:1px solid #e4e7ec;border-radius:8px" />

      <h2 style="font-size:16px;margin:24px 8px 8px">Ingresos y cotizaciones</h2>
      <img src="${revenueChart}" alt="Grafica ingresos" width="640" style="max-width:100%;height:auto;border:1px solid #e4e7ec;border-radius:8px" />

      <h2 style="font-size:16px;margin:24px 8px 8px">Otros indicadores</h2>
      <table width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;font-size:14px">
        <tr><td style="padding:8px;border-bottom:1px solid #eee">WhatsApp clicks</td><td style="padding:8px;border-bottom:1px solid #eee;text-align:right">${whatsapp}</td></tr>
        <tr><td style="padding:8px;border-bottom:1px solid #eee">Tel clicks</td><td style="padding:8px;border-bottom:1px solid #eee;text-align:right">${tel}</td></tr>
        <tr><td style="padding:8px;border-bottom:1px solid #eee">Busquedas</td><td style="padding:8px;border-bottom:1px solid #eee;text-align:right">${search}</td></tr>
        <tr><td style="padding:8px;border-bottom:1px solid #eee">Cotizaciones enviadas (oferta formal)</td><td style="padding:8px;border-bottom:1px solid #eee;text-align:right">${cotEnviadas.count ?? 0}</td></tr>
        <tr><td style="padding:8px;border-bottom:1px solid #eee">Pedidos pendientes de validar transferencia</td><td style="padding:8px;border-bottom:1px solid #eee;text-align:right">${pedPendVal.count ?? 0}</td></tr>
        <tr><td style="padding:8px;border-bottom:1px solid #eee">Pedidos rechazados (semana)</td><td style="padding:8px;border-bottom:1px solid #eee;text-align:right">${pedRech.count ?? 0}</td></tr>
        <tr><td style="padding:8px;border-bottom:1px solid #eee">Importe cotizaciones (ofertado/estimado)</td><td style="padding:8px;border-bottom:1px solid #eee;text-align:right">${escapeHtml(money(cotImporte))} <span style="color:#667085">(${pct(deltaPct(cotImporte, cotImportePrev))})</span></td></tr>
        <tr><td style="padding:8px">Importe pedidos validados</td><td style="padding:8px;text-align:right"><strong>${escapeHtml(money(pedImporte))}</strong> <span style="color:#667085">(${pct(deltaPct(pedImporte, pedImportePrev))})</span></td></tr>
      </table>

      <table width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;margin-top:20px">
        <tr>
          <td style="width:50%;vertical-align:top;padding-right:8px">
            <h3 style="font-size:14px;margin:0 0 8px">Top paginas</h3>
            <table width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;font-size:13px;border:1px solid #e4e7ec;border-radius:8px">${topPagesHtml}</table>
          </td>
          <td style="width:50%;vertical-align:top;padding-left:8px">
            <h3 style="font-size:14px;margin:0 0 8px">Top productos</h3>
            <table width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;font-size:13px;border:1px solid #e4e7ec;border-radius:8px">${topProductsHtml}</table>
          </td>
        </tr>
      </table>

      <p style="font-size:12px;color:#98a2b3;margin:24px 8px 0">
        Generado automaticamente por <code>${FN_NAME}</code>. Semana ant.: ${escapeHtml(prevStartYmd)} → ${escapeHtml(prevEndYmd)}.
        Pedidos validados = estado pagado / pago_validado_at en la ventana. Cotizaciones = solicitudes creadas en la ventana.
      </p>
    </div>
  </div>
</body>
</html>`;

    const summary = {
      periodo: week.label,
      visitas: pageViews.length,
      sesiones: sessions.size,
      cotizaciones: cotCount,
      importe_cotizaciones: cotImporte,
      pedidos_validados: pedCount,
      importe_pedidos_validados: pedImporte,
      ticket_promedio: ticketPromedio,
      pendientes_validacion: pedPendVal.count ?? 0,
      rechazados_semana: pedRech.count ?? 0,
      cotizaciones_enviadas: cotEnviadas.count ?? 0,
    };

    if (body.dry_run) {
      return new Response(
        JSON.stringify({ ok: true, dry_run: true, summary, html_bytes: html.length }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json', ...getCorsHeaders(origin) },
        }
      );
    }

    const to = recipients();
    const subject = `I-ME reporte semanal ${week.startYmd} → ${week.endYmd} · ${money(pedImporte)} validados`;
    const apiKey = Deno.env.get('MAILER_API_KEY') || Deno.env.get('RESEND_API_KEY');
    if (!apiKey) return internalError('MAILER_API_KEY missing', origin);
    const from = Deno.env.get('MAILER_FROM') ?? 'pedidos@i-me.com.co';
    const results: Record<string, string> = {};

    for (const dest of to) {
      let status: 'enviado' | 'fallido' = 'enviado';
      let errorTxt: string | null = null;
      try {
        const res = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ from, to: dest, subject, html }),
        });
        if (!res.ok) {
          status = 'fallido';
          errorTxt = `HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`;
        }
      } catch (err) {
        status = 'fallido';
        errorTxt = err instanceof Error ? err.message : 'error desconocido';
      }
      results[dest] = status === 'enviado' ? 'sent' : (errorTxt ?? 'failed');
      try {
        await supabase.from('email_log').insert({
          destinatario: dest,
          plantilla: 'reporte_semanal_interno',
          referencia: `reporte-semanal:${week.endYmd}`,
          status,
          error: errorTxt,
        });
      } catch {
        /* best-effort */
      }
    }

    const allOk = Object.values(results).every(v => v === 'sent');
    return new Response(JSON.stringify({ ok: allOk, summary, results }), {
      status: allOk ? 200 : 207,
      headers: { 'Content-Type': 'application/json', ...getCorsHeaders(origin) },
    });
  } catch (err) {
    console.error(FN_NAME, err);
    return internalError(err instanceof Error ? err.message : 'reporte failed', origin);
  }
});
