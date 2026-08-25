/** Centro local de lectura de exportaciones CSV de Google Search Console. */
import { isCommercialAdmin } from '../lib/comercial-cms';
import { escapeHtml, isSupabaseConfigured, supabase } from '../comercial/shared';
import { getCurrentSession, initAuthFlow, renderLoginPanel, signOut } from '../comercial/auth';

type DatasetKind = 'coverage' | 'queries' | 'pages' | 'unknown';
interface CsvDataset {
  kind: DatasetKind;
  name: string;
  headers: string[];
  rows: string[][];
}
interface Priority {
  level: 'Crítica' | 'Alta' | 'Media';
  label: string;
  detail: string;
  count: number;
}

const root = (() => {
  const node = document.getElementById('mkt-app');
  if (!node) throw new Error('mkt-app root missing');
  return node;
})();
let datasets: CsvDataset[] = [];
let viewer = { email: '', role: '' };

setupServiceWorker();
void boot();

function setupServiceWorker(): void {
  if (!('serviceWorker' in navigator) || import.meta.env.DEV) return;
  void navigator.serviceWorker.register('/mkt-sw.js', { scope: '/mkt/' }).catch(() => undefined);
}

async function boot(): Promise<void> {
  if (!isSupabaseConfigured() || !supabase) return renderMissingConfig();
  await initAuthFlow({
    onRecovery: () => renderLogin(),
    onSessionReady: () => void authenticate(),
  });
}

function renderLogin(): void {
  renderLoginPanel(root, '', () => void authenticate());
  root.querySelector('h1')?.replaceChildren('Centro de marketing');
  const intro = root.querySelector('.comercial-auth__brand p');
  if (intro) intro.textContent = 'Acceso restringido para administradores de I-ME.';
  const help = root.querySelector('.comercial-help');
  if (help) help.textContent = 'Solo usuarios activos con rol admin u owner.';
}

async function authenticate(): Promise<void> {
  const session = await getCurrentSession();
  if (!session || !supabase) return renderLogin();
  const { data, error } = await supabase
    .from('admin_profiles')
    .select('rol,activo')
    .eq('user_id', session.user.id)
    .maybeSingle();
  const profile = data as { rol?: string; activo?: boolean } | null;
  // Deny by default: missing profile or missing `activo: true` has no access.
  if (error || !isCommercialAdmin(profile?.rol, profile?.activo === true)) {
    await signOut();
    renderLogin();
    const alert = document.createElement('p');
    alert.className = 'mkt-login-error';
    alert.setAttribute('role', 'alert');
    alert.textContent = 'Tu cuenta no tiene acceso activo al centro de marketing.';
    root.querySelector('.comercial-auth__panel')?.append(alert);
    return;
  }
  viewer = { email: session.user.email ?? '', role: profile?.rol ?? '' };
  renderApp();
}

function renderMissingConfig(): void {
  root.innerHTML = `<section class="comercial-auth"><div class="comercial-auth__panel"><h1>Configuración pendiente</h1><p>Configura credenciales públicas de Supabase para autenticar este portal.</p></div></section>`;
}

function renderApp(): void {
  const priorities = makePriorities(datasets);
  root.innerHTML = `
    <div class="mkt-shell">
      <a class="comercial-skip-link" href="#mkt-main">Saltar al contenido</a>
      <header class="mkt-header"><div><span class="mkt-brand">I·ME</span><h1>Centro de marketing</h1><p>Diagnóstico local de Search Console</p></div><div class="mkt-user"><span>${escapeHtml(viewer.email)} · ${escapeHtml(viewer.role)}</span><button type="button" class="comercial-button comercial-button--ghost" data-logout>Salir</button></div></header>
      <main id="mkt-main" class="mkt-main" tabindex="-1">
        <section class="mkt-privacy" aria-labelledby="privacy-title"><h2 id="privacy-title">Datos bajo tu control</h2><p>Los CSV se leen solo en este navegador. No se envían a I-ME, Supabase ni servicios externos; se eliminan al recargar o salir.</p></section>
        <section class="mkt-import" aria-labelledby="import-title"><div><h2 id="import-title">Importar exportaciones</h2><p>Acepta CSV o ZIP de Cobertura/Indexación, Consultas y Páginas de Google Search Console. Puedes elegir varios archivos.</p></div><label class="mkt-upload"><span>Seleccionar CSV o ZIP</span><input type="file" accept=".csv,.zip,text/csv,application/zip" multiple data-csv-input /><small>Procesados solo en este navegador</small></label><p class="mkt-import-status" role="status" aria-live="polite">${datasets.length ? `${datasets.length} archivo(s) cargado(s).` : 'Aún no has cargado archivos.'}</p></section>
        ${datasets.length ? dashboardHtml(priorities) : emptyHtml()}
      </main>
    </div>`;
  root.querySelector('[data-logout]')?.addEventListener('click', () => void logout());
  root.querySelector<HTMLInputElement>('[data-csv-input]')?.addEventListener('change', onFiles);
  root.querySelector('[data-clear]')?.addEventListener('click', () => {
    datasets = [];
    renderApp();
  });
}

function emptyHtml(): string {
  return `<section class="mkt-empty"><h2>Listo para analizar</h2><p>Exporta informes desde Search Console y súbelos aquí. Prioridad recomendada: Indexación de páginas, Rendimiento por páginas y Rendimiento por consultas.</p><ul><li><strong>Cobertura:</strong> errores, URLs excluidas y motivos.</li><li><strong>Páginas:</strong> clics, impresiones, CTR y posición por URL.</li><li><strong>Consultas:</strong> demanda orgánica y oportunidades de CTR.</li></ul></section>`;
}

function dashboardHtml(priorities: Priority[]): string {
  const cards = datasets
    .map(
      data =>
        `<article class="mkt-card"><h2>${escapeHtml(datasetLabel(data.kind))}</h2><strong>${data.rows.length.toLocaleString('es-CO')}</strong><span>filas · ${escapeHtml(data.name)}</span></article>`
    )
    .join('');
  return `<section class="mkt-cards" aria-label="Resumen de archivos">${cards}</section>
    <section class="mkt-section" aria-labelledby="priorities-title"><div class="mkt-section-head"><h2 id="priorities-title">Prioridades detectadas</h2><button type="button" class="comercial-button comercial-button--ghost" data-clear>Quitar datos</button></div>${priorityHtml(priorities)}</section>
    ${coverageHtml()}${performanceHtml('pages')}${performanceHtml('queries')}`;
}

function priorityHtml(items: Priority[]): string {
  if (!items.length)
    return `<p class="mkt-muted">Sin señales de riesgo detectables con estas columnas. Revisa detalles y confirma en Search Console.</p>`;
  return `<ol class="mkt-priorities">${items.map(item => `<li class="mkt-priority mkt-priority--${item.level.toLowerCase()}"><span>${item.level}</span><div><strong>${escapeHtml(item.label)}</strong><p>${escapeHtml(item.detail)}</p></div><b>${item.count.toLocaleString('es-CO')}</b></li>`).join('')}</ol>`;
}

function coverageHtml(): string {
  const data = datasets.find(item => item.kind === 'coverage');
  if (!data) return '';
  const rows = data.rows.slice(0, 100);
  const hasUrls = data.headers.some(header => /url|pagina|page/.test(header));
  const headings = hasUrls
    ? ['Estado / motivo', 'URL']
    : ['Motivo', 'Fuente', 'Validación', 'Páginas'];
  const values = hasUrls
    ? rows.map(row => [
        pick(row, data.headers, ['estado', 'status', 'motivo', 'reason']),
        pick(row, data.headers, ['url', 'página', 'page']),
      ])
    : rows.map(row => [
        pick(row, data.headers, ['motivo', 'reason']),
        pick(row, data.headers, ['fuente', 'source']),
        pick(row, data.headers, ['validacion', 'validation']),
        pick(row, data.headers, ['paginas', 'pages']),
      ]);
  const notice = hasUrls
    ? ''
    : '<p class="mkt-notice">Este exportado es agregado: no contiene evidencia por URL. Usa el informe de páginas para investigar cada motivo.</p>';
  return `${notice}${tableSection('Cobertura e indexación', headings, values, data.rows.length)}`;
}

function performanceHtml(kind: 'pages' | 'queries'): string {
  const data = datasets.find(item => item.kind === kind);
  if (!data) return '';
  const first = kind === 'pages' ? ['url', 'página', 'page'] : ['consulta', 'query', 'queries'];
  return tableSection(
    kind === 'pages' ? 'Rendimiento por página' : 'Rendimiento por consulta',
    [kind === 'pages' ? 'Página' : 'Consulta', 'Clics', 'Impresiones', 'CTR', 'Posición'],
    data.rows
      .slice(0, 100)
      .map(row => [
        pick(row, data.headers, first),
        pick(row, data.headers, ['clics', 'clicks']),
        pick(row, data.headers, ['impresiones', 'impressions']),
        pick(row, data.headers, ['ctr']),
        pick(row, data.headers, ['posición', 'position']),
      ]),
    data.rows.length
  );
}

function tableSection(title: string, headings: string[], rows: string[][], total: number): string {
  return `<section class="mkt-section"><h2>${escapeHtml(title)}</h2><p class="mkt-muted">Muestra ${rows.length} de ${total.toLocaleString('es-CO')} filas. Los valores se muestran como datos, sin ejecutar contenido del archivo.</p><div class="mkt-table-wrap"><table><thead><tr>${headings.map(item => `<th scope="col">${escapeHtml(item)}</th>`).join('')}</tr></thead><tbody>${rows.map(row => `<tr>${row.map(value => `<td>${escapeHtml(value || '—')}</td>`).join('')}</tr>`).join('')}</tbody></table></div></section>`;
}

async function onFiles(event: Event): Promise<void> {
  const files = Array.from((event.currentTarget as HTMLInputElement).files ?? []);
  if (!files.length) return;
  const parsed = await Promise.all(files.map(readDataset));
  datasets = [...datasets, ...parsed.flat().filter((item): item is CsvDataset => item !== null)];
  renderApp();
}

async function readDataset(file: File): Promise<Array<CsvDataset | null>> {
  if (file.size > 15 * 1024 * 1024) return [] as Array<CsvDataset | null>;
  const entries = file.name.toLowerCase().endsWith('.zip')
    ? await readZipCsvEntries(file)
    : [{ name: file.name, text: await file.text() }];
  return entries.map(entry => datasetFromText(entry.name, entry.text));
}

function datasetFromText(name: string, text: string): CsvDataset | null {
  const records = parseCsv(text);
  if (records.length < 2) return null;
  const headers = records[0]?.map(normalize) ?? [];
  return {
    kind: detectKind(name, headers),
    name,
    headers,
    rows: records.slice(1).filter(row => row.some(cell => cell.trim())),
  };
}

/** Lee ZIP local con CSV deflate/store. Sin red ni librerías adicionales. */
async function readZipCsvEntries(file: File): Promise<Array<{ name: string; text: string }>> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let eocd = -1;
  for (let pos = bytes.length - 22; pos >= Math.max(0, bytes.length - 65_557); pos -= 1) {
    if (view.getUint32(pos, true) === 0x06054b50) {
      eocd = pos;
      break;
    }
  }
  if (eocd < 0 || !('DecompressionStream' in window)) return [];
  const count = view.getUint16(eocd + 10, true);
  let cursor = view.getUint32(eocd + 16, true);
  const entries: Array<{ name: string; text: string }> = [];
  for (let item = 0; item < count && cursor + 46 <= bytes.length; item += 1) {
    if (view.getUint32(cursor, true) !== 0x02014b50) break;
    const method = view.getUint16(cursor + 10, true);
    const compressed = view.getUint32(cursor + 20, true);
    const nameLength = view.getUint16(cursor + 28, true);
    const extraLength = view.getUint16(cursor + 30, true);
    const commentLength = view.getUint16(cursor + 32, true);
    const offset = view.getUint32(cursor + 42, true);
    const name = new TextDecoder().decode(bytes.slice(cursor + 46, cursor + 46 + nameLength));
    if (
      /\.csv$/i.test(name) &&
      offset + 30 <= bytes.length &&
      view.getUint32(offset, true) === 0x04034b50
    ) {
      const localName = view.getUint16(offset + 26, true);
      const localExtra = view.getUint16(offset + 28, true);
      const start = offset + 30 + localName + localExtra;
      const data = bytes.slice(start, start + compressed);
      let content: Uint8Array | null = null;
      if (method === 0) content = data;
      if (method === 8) {
        // `deflate-raw` is valid for ZIP but omitted by some lib.dom versions.
        const ZipDecompressionStream = DecompressionStream as unknown as new (
          format: string
        ) => DecompressionStream;
        const stream = new Blob([data])
          .stream()
          .pipeThrough(new ZipDecompressionStream('deflate-raw'));
        content = new Uint8Array(await new Response(stream).arrayBuffer());
      }
      if (content) entries.push({ name, text: new TextDecoder().decode(content) });
    }
    cursor += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

function parseCsv(input: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  const delimiter = guessDelimiter(input);
  for (let index = 0; index < input.length; index += 1) {
    const char = input[index] ?? '';
    const next = input[index + 1] ?? '';
    if (char === '"' && quoted && next === '"') {
      cell += '"';
      index += 1;
    } else if (char === '"') quoted = !quoted;
    else if (char === delimiter && !quoted) {
      row.push(cell.trim());
      cell = '';
    } else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && next === '\n') index += 1;
      row.push(cell.trim());
      rows.push(row);
      row = [];
      cell = '';
    } else cell += char;
  }
  if (cell || row.length) {
    row.push(cell.trim());
    rows.push(row);
  }
  return rows;
}
function guessDelimiter(input: string): string {
  const first = input.split(/\r?\n/, 1)[0] ?? '';
  return (first.match(/;/g)?.length ?? 0) > (first.match(/,/g)?.length ?? 0) ? ';' : ',';
}
function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}
function detectKind(name: string, headers: string[]): DatasetKind {
  const all = `${normalize(name)} ${headers.join(' ')}`;
  if (/(cobertura|indexaci|coverage|estado|motivo)/.test(all)) return 'coverage';
  if (/(consulta|query|queries)/.test(all)) return 'queries';
  if (/(pagina|page|url)/.test(all) && /(clic|click|impres|impression)/.test(all)) return 'pages';
  return 'unknown';
}
function datasetLabel(kind: DatasetKind): string {
  return (
    {
      coverage: 'Cobertura',
      queries: 'Consultas',
      pages: 'Páginas',
      unknown: 'CSV sin clasificar',
    } as Record<DatasetKind, string>
  )[kind];
}
function pick(row: string[], headers: string[], terms: string[]): string {
  const index = headers.findIndex(header => terms.some(term => header.includes(normalize(term))));
  return index < 0 ? '' : (row[index] ?? '');
}
function makePriorities(items: CsvDataset[]): Priority[] {
  const coverage = items.find(item => item.kind === 'coverage');
  const priorities: Priority[] = [];
  if (coverage) {
    const countFor = (pattern: RegExp) =>
      coverage.rows.reduce((total, row) => {
        const reason = pick(row, coverage.headers, ['estado', 'status', 'motivo', 'reason']);
        if (!pattern.test(normalize(reason))) return total;
        const pages = pick(row, coverage.headers, ['paginas', 'pages']);
        return total + (pages ? numberValue(pages) : 1);
      }, 0);
    const errors = countFor(/error|404|5\d\d|bloquead/);
    const excluded = countFor(/excluid|no indexad|duplicad|canon/);
    const redirects = countFor(/redirec/);
    if (errors)
      priorities.push({
        level: 'Crítica',
        label: 'Errores o bloqueos de rastreo',
        detail: 'Corrige respuesta, redirección o acceso antes de solicitar nueva indexación.',
        count: errors,
      });
    if (excluded)
      priorities.push({
        level: 'Alta',
        label: 'URLs excluidas o duplicadas',
        detail: 'Confirma canonical, noindex, enlaces internos y presencia en sitemap.',
        count: excluded,
      });
    if (redirects)
      priorities.push({
        level: 'Media',
        label: 'Redirecciones detectadas',
        detail:
          'Comprueba que cada URL antigua llegue en un salto a su canonical y no aparezca en el sitemap.',
        count: redirects,
      });
  }
  for (const item of items.filter(
    dataset => dataset.kind === 'pages' || dataset.kind === 'queries'
  )) {
    const lowCtr = item.rows.filter(row => {
      const clicks = numberValue(pick(row, item.headers, ['clics', 'clicks']));
      const impressions = numberValue(pick(row, item.headers, ['impresiones', 'impressions']));
      const ctr = numberValue(pick(row, item.headers, ['ctr']));
      return impressions >= 100 && clicks >= 0 && ctr < 0.02;
    }).length;
    if (lowCtr)
      priorities.push({
        level: 'Media',
        label: `Oportunidades de CTR en ${datasetLabel(item.kind).toLowerCase()}`,
        detail: 'Revisa intención, título y descripción; valida antes de cambiar contenido.',
        count: lowCtr,
      });
  }
  return priorities;
}
function numberValue(value: string): number {
  const normalized = value
    .replace(/[%\s]/g, '')
    .replace(/\.(?=\d{3}(?:\D|$))/g, '')
    .replace(',', '.');
  const result = Number(normalized);
  return Number.isFinite(result) ? (value.includes('%') ? result / 100 : result) : 0;
}
async function logout(): Promise<void> {
  datasets = [];
  await signOut();
  renderLogin();
}
