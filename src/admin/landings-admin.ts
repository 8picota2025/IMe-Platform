/**
 * Admin → «Landings» (Fase 3B, `docs/growth-engine/fase3b-plan.md`).
 *
 * Lista todas las landings del sitio y edita el texto y las fotos de las que ya están en el CMS
 * (tanda 1: campaña). El diseño, las rutas, los productos y los códigos que recibe el CRM no se
 * editan aquí. Flujo: guardar borrador → publicar (nueva versión + rebuild) → historial.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
// Sólo el índice (nombres y rutas): cargar el copy completo rompía el presupuesto de JS.
import { LANDINGS_INDICE, type EntradaIndiceLanding } from '../data/landings-indice';
import {
  CAMPOS_CAMPANA,
  camposPara,
  validarCopyLanding,
  type TipoLandingCampana,
  type CampoEditable,
  type CopyCampana,
} from '../lib/landings-cms-schema';

export interface LandingsAdminCtx {
  supabase: SupabaseClient;
  escapeHtml: (value: string) => string;
  toast: (message: string) => void;
  triggerRebuild: () => Promise<void>;
  uploadFile: (button: HTMLButtonElement, form: HTMLFormElement) => Promise<void>;
  rerender: () => Promise<void>;
}

type Locale = 'es' | 'en';

interface FilaCms {
  id: string;
  tipo: TipoLandingCampana;
  clave: string;
  version: number;
  publicado_at: string;
  contenido_es: CopyCampana;
  contenido_en: CopyCampana;
}

interface Borrador {
  landing_id: string;
  contenido_es: CopyCampana;
  contenido_en: CopyCampana;
  updated_at: string;
}

const SITIO = 'https://i-me.com.co';
const fecha = (iso: string) =>
  iso ? new Date(iso).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' }) : '—';

function parametros(): URLSearchParams {
  return new URLSearchParams(location.hash.split('?')[1] ?? '');
}

async function filasCms(ctx: LandingsAdminCtx): Promise<{
  filas: Map<string, FilaCms>;
  borradores: Map<string, Borrador>;
  error?: string;
}> {
  const [filasRes, borradoresRes] = await Promise.all([
    ctx.supabase
      .from('landings')
      .select('id, tipo, clave, version, publicado_at, contenido_es, contenido_en')
      .in('tipo', ['campana', 'fabricante']),
    ctx.supabase
      .from('landings_borradores')
      .select('landing_id, contenido_es, contenido_en, updated_at'),
  ]);
  const error = filasRes.error?.message ?? borradoresRes.error?.message;
  // Clave `tipo:clave`: las claves sólo son únicas dentro de cada tipo.
  const filas = new Map(((filasRes.data ?? []) as FilaCms[]).map(f => [`${f.tipo}:${f.clave}`, f]));
  const borradores = new Map(
    ((borradoresRes.data ?? []) as Borrador[]).map(b => [b.landing_id, b])
  );
  return { filas, borradores, ...(error ? { error } : {}) };
}

// ── Lista ────────────────────────────────────────────────────────────────

function filaLista(
  ctx: LandingsAdminCtx,
  nombre: string,
  ruta: string,
  estado: string,
  accion: string
): string {
  const e = ctx.escapeHtml;
  return `<tr><td>${e(nombre)}</td><td><a href="${e(SITIO + ruta)}" target="_blank" rel="noopener noreferrer">${e(ruta)}</a></td><td>${estado}</td><td>${accion}</td></tr>`;
}

function tablaLista(filas: string[]): string {
  return `<div class="admin-table-wrap"><table class="admin-table"><thead><tr><th>Landing</th><th>URL</th><th>Estado</th><th></th></tr></thead><tbody>${filas.join('')}</tbody></table></div>`;
}

async function listaView(ctx: LandingsAdminCtx): Promise<string> {
  const e = ctx.escapeHtml;
  const { filas, borradores, error } = await filasCms(ctx);
  const porTipo = (tipo: EntradaIndiceLanding['tipo']) =>
    LANDINGS_INDICE.filter(l => l.tipo === tipo);
  const pendiente = (tanda: number) =>
    `<span class="admin-help">En código · se podrá editar tras la tanda ${tanda}</span>`;
  const editables = (tipo: TipoLandingCampana, tanda: number) =>
    porTipo(tipo).map(landing => {
      const fila = filas.get(`${tipo}:${landing.clave}`);
      const borrador = fila ? borradores.get(fila.id) : undefined;
      const estado = !fila
        ? pendiente(tanda)
        : `CMS · v${fila.version} · ${e(fecha(fila.publicado_at))}${borrador ? ' · <strong>borrador sin publicar</strong>' : ''}`;
      const accion = fila
        ? `<a class="admin-button admin-button--ghost" href="#/landings?tipo=${tipo}&id=${encodeURIComponent(landing.clave)}">Editar</a>`
        : '';
      return filaLista(ctx, landing.nombre, landing.path, estado, accion);
    });
  const campana = editables('campana', 1);
  const fabricantes = editables('fabricante', 2);
  const ciudades = porTipo('ciudad').map(l => filaLista(ctx, l.nombre, l.path, pendiente(3), ''));
  const familias = porTipo('familia').map(l => filaLista(ctx, l.nombre, l.path, pendiente(3), ''));
  const aviso = error
    ? `<div class="admin-alert">No se pudo leer la tabla de landings (${e(error)}). ¿Está aplicada la migración 20260926200000?</div>`
    : '';
  return `
    ${aviso}
    <section class="admin-panel">
      <div class="admin-panel__head"><h2>Landings de campaña (${campana.length})</h2></div>
      <p class="admin-help" style="padding:0 16px">Texto y fotos editables. El diseño, las URL, los productos y los códigos del formulario no se cambian aquí.</p>
      ${tablaLista(campana)}
    </section>
    <section class="admin-panel">
      <div class="admin-panel__head"><h2>Landings de fabricante (${fabricantes.length})</h2></div>
      ${tablaLista(fabricantes)}
    </section>
    <section class="admin-panel">
      <div class="admin-panel__head"><h2>Landings de ciudad (${ciudades.length})</h2></div>
      ${tablaLista(ciudades)}
    </section>
    <section class="admin-panel">
      <div class="admin-panel__head"><h2>Textos SEO de familia (${familias.length})</h2></div>
      ${tablaLista(familias)}
    </section>`;
}

// ── Editor ───────────────────────────────────────────────────────────────

function nombreCampo(...partes: Array<string | number>): string {
  return `c.${partes.join('.')}`;
}

function campoHtml(ctx: LandingsAdminCtx, campo: CampoEditable, valor: unknown): string {
  const e = ctx.escapeHtml;
  const ayuda = campo.ayuda ? `<span class="admin-help">${e(campo.ayuda)}</span>` : '';
  const etiqueta = `${e(campo.etiqueta)}${campo.obligatorio ? ' *' : ''}`;
  switch (campo.tipo) {
    case 'texto':
      return `<label class="admin-field">${etiqueta}<input name="${nombreCampo(campo.clave)}" type="text" value="${e(String(valor ?? ''))}" />${ayuda}</label>`;
    case 'parrafo':
      return `<label class="admin-field">${etiqueta}<textarea name="${nombreCampo(campo.clave)}" rows="3">${e(String(valor ?? ''))}</textarea>${ayuda}</label>`;
    case 'numero':
      return `<label class="admin-field">${etiqueta}<input name="${nombreCampo(campo.clave)}" type="number" min="1" step="1" value="${e(valor == null ? '' : String(valor))}" readonly /><span class="admin-help">Se calcula al guardar una foto nueva.</span></label>`;
    case 'imagen': {
      const src = String(valor ?? '');
      return `<div class="admin-upload-box">
          <div class="admin-upload-box__info">
            <div class="admin-help">${etiqueta}</div>
            <input type="text" name="${nombreCampo(campo.clave)}" value="${e(src)}" />
            <div class="admin-preview-box" data-image-preview>${src ? `<img src="${e(src)}" alt="Vista previa" style="max-width:100%; max-height:150px; border-radius:8px;" />` : ''}</div>
          </div>
          <button class="admin-button admin-button--ghost" data-upload="articulos" data-target="${nombreCampo(campo.clave)}" type="button">Subir foto</button>
        </div>`;
    }
    case 'lista': {
      const items = Array.isArray(valor) ? (valor as string[]) : [];
      return `<label class="admin-field">${etiqueta}<textarea name="${nombreCampo(campo.clave)}" rows="${Math.max(3, items.length + 1)}" data-lista>${e(items.join('\n'))}</textarea>${ayuda}</label>`;
    }
    case 'pares':
    case 'objeto': {
      const items = campo.tipo === 'objeto' ? [valor] : Array.isArray(valor) ? valor : [];
      const bloques = items
        .map((item, i) => {
          const obj = (item ?? {}) as Record<string, unknown>;
          const partes = campo.tipo === 'objeto' ? [campo.clave] : [campo.clave, i];
          const subcampos = (campo.subcampos ?? [])
            .map(sub => {
              const v = obj[sub.clave];
              const nombre = nombreCampo(...partes, sub.clave);
              if (sub.fijo) {
                return `<label class="admin-field">${e(sub.etiqueta)}<input type="text" value="${e(String(v ?? ''))}" disabled /><input type="hidden" name="${nombre}" value="${e(String(v ?? ''))}" /></label>`;
              }
              if (sub.lista) {
                const lineas = Array.isArray(v) ? (v as string[]).join('\n') : '';
                return `<label class="admin-field">${e(sub.etiqueta)}<textarea name="${nombre}" rows="3" data-lista>${e(lineas)}</textarea></label>`;
              }
              const largo = String(v ?? '').length > 70;
              return largo
                ? `<label class="admin-field">${e(sub.etiqueta)}<textarea name="${nombre}" rows="3">${e(String(v ?? ''))}</textarea></label>`
                : `<label class="admin-field">${e(sub.etiqueta)}<input type="text" name="${nombre}" value="${e(String(v ?? ''))}" /></label>`;
            })
            .join('');
          const titulo = campo.tipo === 'objeto' ? '' : `<legend>${i + 1}</legend>`;
          return `<fieldset class="admin-landing-item">${titulo}${subcampos}</fieldset>`;
        })
        .join('');
      return `<div class="admin-field"><strong>${etiqueta}</strong>${bloques}</div>`;
    }
  }
}

/** Lee el formulario sobre una copia del contenido de partida (sólo cambia lo editable). */
function leerFormulario(form: HTMLFormElement, partida: CopyCampana): CopyCampana {
  const copy = structuredClone(partida);
  const campos = new Map(CAMPOS_CAMPANA.map(c => [c.clave, c]));
  form.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('[name^="c."]').forEach(el => {
    const ruta = el.name.slice(2).split('.');
    const campo = campos.get(ruta[0]!);
    if (!campo) return;
    let valor: unknown = el.hasAttribute('data-lista')
      ? el.value
          .split('\n')
          .map(s => s.trim())
          .filter(Boolean)
      : el.value.trim();
    if (campo.tipo === 'numero') valor = el.value ? Number(el.value) : undefined;
    let destino = copy as Record<string, unknown>;
    for (let i = 0; i < ruta.length - 1; i++) {
      const paso = ruta[i]!;
      const siguiente = (destino as Record<string, unknown>)[paso];
      if (!siguiente || typeof siguiente !== 'object') return;
      destino = siguiente as Record<string, unknown>;
    }
    const ultima = ruta[ruta.length - 1]!;
    if (valor === undefined || valor === '') delete destino[ultima];
    else destino[ultima] = valor;
  });
  return copy;
}

function medidasImagen(src: string): Promise<{ width: number; height: number } | null> {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

async function editorView(
  ctx: LandingsAdminCtx,
  tipo: TipoLandingCampana,
  id: string,
  locale: Locale
): Promise<string> {
  const e = ctx.escapeHtml;
  const landing = LANDINGS_INDICE.find(l => l.tipo === tipo && l.clave === id);
  if (!landing) {
    return `<div class="admin-alert">La landing «${e(id)}» no existe.</div>`;
  }
  const { filas, borradores, error } = await filasCms(ctx);
  const fila = filas.get(`${tipo}:${id}`);
  if (error || !fila) {
    return `<div class="admin-alert">Esta landing aún no está en el CMS${error ? ` (${e(error)})` : ''}.</div>`;
  }
  const borrador = borradores.get(fila.id);
  const contenido = (borrador ?? fila)[`contenido_${locale}`];
  const visibles = camposPara(tipo).filter(c => c.obligatorio || contenido[c.clave] !== undefined);
  const { data: historial } = await ctx.supabase
    .from('landings_historial')
    .select('version, publicado_at')
    .eq('landing_id', fila.id)
    .order('version', { ascending: false })
    .limit(20);
  const filasHistorial = ((historial ?? []) as Array<{ version: number; publicado_at: string }>)
    .map(
      h =>
        `<tr><td>v${h.version}${h.version === fila.version ? ' (publicada)' : ''}</td><td>${e(fecha(h.publicado_at))}</td><td>${h.version === fila.version ? '' : `<button class="admin-button admin-button--ghost" type="button" data-landing-restaurar="${h.version}">Pasar a borrador</button>`}</td></tr>`
    )
    .join('');
  const otro: Locale = locale === 'es' ? 'en' : 'es';
  const ruta = locale === 'es' ? landing.path : landing.pathEn;
  return `
    <section class="admin-panel">
      <div class="admin-panel__head">
        <h2>${e(landing.nombre)} · ${locale.toUpperCase()}</h2>
        <div>
          <a class="admin-button admin-button--ghost" href="#/landings?tipo=${tipo}&id=${encodeURIComponent(id)}&lang=${otro}">Editar en ${otro.toUpperCase()}</a>
          <a class="admin-button admin-button--ghost" href="${e(SITIO + ruta)}" target="_blank" rel="noopener noreferrer">Ver publicada</a>
          <a class="admin-button admin-button--ghost" href="#/landings">Volver a la lista</a>
        </div>
      </div>
      <p class="admin-help" style="padding:0 16px">
        Publicada: v${fila.version} (${e(fecha(fila.publicado_at))}).
        ${borrador ? `<strong>Estás editando un borrador guardado el ${e(fecha(borrador.updated_at))}.</strong>` : 'Sin borrador: al guardar se crea uno; la web no cambia hasta publicar.'}
        El diseño, la URL (${e(ruta)}), los productos y los códigos del formulario no se editan aquí.
      </p>
      <form class="admin-form" data-landing-form data-landing-id="${e(fila.id)}" data-landing-clave="${e(id)}" data-landing-tipo="${tipo}" data-landing-locale="${locale}" style="padding:16px">
        ${visibles.map(c => campoHtml(ctx, c, contenido[c.clave])).join('')}
        <div data-landing-errores hidden></div>
        <div class="admin-form__actions">
          <button class="admin-button" type="submit">Guardar borrador</button>
          <button class="admin-button" type="button" data-landing-publicar ${borrador ? '' : 'disabled'}>Publicar</button>
          <button class="admin-button admin-button--ghost" type="button" data-landing-descartar ${borrador ? '' : 'disabled'}>Descartar borrador</button>
        </div>
      </form>
    </section>
    <section class="admin-panel">
      <div class="admin-panel__head"><h2>Historial</h2></div>
      <div class="admin-table-wrap"><table class="admin-table"><thead><tr><th>Versión</th><th>Publicada</th><th></th></tr></thead><tbody>${filasHistorial || '<tr><td colspan="3">Sin versiones.</td></tr>'}</tbody></table></div>
    </section>`;
}

export async function landingsView(ctx: LandingsAdminCtx): Promise<string> {
  const params = parametros();
  const id = params.get('id');
  const tipo: TipoLandingCampana = params.get('tipo') === 'fabricante' ? 'fabricante' : 'campana';
  const locale: Locale = params.get('lang') === 'en' ? 'en' : 'es';
  return id ? editorView(ctx, tipo, id, locale) : listaView(ctx);
}

export function bindLandings(ctx: LandingsAdminCtx): void {
  const form = document.querySelector<HTMLFormElement>('[data-landing-form]');
  if (!form) return;
  const landingId = form.dataset['landingId']!;
  const clave = form.dataset['landingClave'] ?? '';
  const tipo: TipoLandingCampana =
    form.dataset['landingTipo'] === 'fabricante' ? 'fabricante' : 'campana';
  const locale = form.dataset['landingLocale'] as Locale;
  const errores = form.querySelector<HTMLElement>('[data-landing-errores]');

  const mostrarErrores = (lista: string[]) => {
    if (!errores) return;
    errores.hidden = lista.length === 0;
    errores.innerHTML = lista.length
      ? `<div class="admin-alert"><strong>Revisa estos campos:</strong><ul>${lista.map(x => `<li>${ctx.escapeHtml(x)}</li>`).join('')}</ul></div>`
      : '';
  };

  form.querySelectorAll<HTMLButtonElement>('[data-upload]').forEach(button => {
    button.addEventListener('click', () => void ctx.uploadFile(button, form));
  });

  const contenidoActual = async (): Promise<{ es: CopyCampana; en: CopyCampana } | null> => {
    const [fila, borrador] = await Promise.all([
      ctx.supabase
        .from('landings')
        .select('contenido_es, contenido_en')
        .eq('id', landingId)
        .single(),
      ctx.supabase
        .from('landings_borradores')
        .select('contenido_es, contenido_en')
        .eq('landing_id', landingId)
        .maybeSingle(),
    ]);
    if (fila.error) {
      ctx.toast(fila.error.message);
      return null;
    }
    const base = (borrador.data ?? fila.data) as {
      contenido_es: CopyCampana;
      contenido_en: CopyCampana;
    };
    return { es: base.contenido_es, en: base.contenido_en };
  };

  form.addEventListener('submit', async event => {
    event.preventDefault();
    const actual = await contenidoActual();
    if (!actual) return;
    const editado = leerFormulario(form, actual[locale]);
    // Foto nueva: guardar sus medidas reales para que la página reserve bien el espacio.
    if (editado['heroImage'] !== actual[locale]['heroImage']) {
      const medidas = await medidasImagen(String(editado['heroImage']));
      if (!medidas) {
        mostrarErrores(['heroImage: no se pudo cargar la foto; revisa la URL']);
        return;
      }
      editado['heroImageWidth'] = medidas.width;
      editado['heroImageHeight'] = medidas.height;
    }
    const lista = validarCopyLanding(editado, tipo);
    mostrarErrores(lista);
    if (lista.length) return;
    const { data: sesion } = await ctx.supabase.auth.getUser();
    const { error } = await ctx.supabase.from('landings_borradores').upsert({
      landing_id: landingId,
      contenido_es: locale === 'es' ? editado : actual.es,
      contenido_en: locale === 'en' ? editado : actual.en,
      actualizado_por: sesion.user?.id ?? null,
      updated_at: new Date().toISOString(),
    });
    if (error) {
      ctx.toast(error.message);
      return;
    }
    ctx.toast('Borrador guardado. La web no cambia hasta publicar.');
    await ctx.rerender();
  });

  form.querySelector('[data-landing-publicar]')?.addEventListener('click', async () => {
    const actual = await contenidoActual();
    if (!actual) return;
    const lista = [
      ...validarCopyLanding(actual.es, tipo).map(x => `ES · ${x}`),
      ...validarCopyLanding(actual.en, tipo).map(x => `EN · ${x}`),
    ];
    mostrarErrores(lista);
    if (lista.length) return;
    const nombre = LANDINGS_INDICE.find(l => l.tipo === tipo && l.clave === clave)?.nombre ?? clave;
    if (!confirm(`¿Publicar «${nombre}»? Se reconstruye el sitio.`)) return;
    const { data, error } = await ctx.supabase.rpc('publicar_landing', { p_landing_id: landingId });
    if (error) {
      ctx.toast(error.message);
      return;
    }
    ctx.toast(`Publicada v${String(data)}. Reconstruyendo el sitio…`);
    await ctx.triggerRebuild();
    await ctx.rerender();
  });

  form.querySelector('[data-landing-descartar]')?.addEventListener('click', async () => {
    if (!confirm('¿Descartar el borrador? Se pierden los cambios sin publicar.')) return;
    const { error } = await ctx.supabase
      .from('landings_borradores')
      .delete()
      .eq('landing_id', landingId);
    if (error) {
      ctx.toast(error.message);
      return;
    }
    ctx.toast('Borrador descartado.');
    await ctx.rerender();
  });

  document.querySelectorAll<HTMLButtonElement>('[data-landing-restaurar]').forEach(button => {
    button.addEventListener('click', async () => {
      const version = Number(button.dataset['landingRestaurar']);
      const { error } = await ctx.supabase.rpc('restaurar_version_landing', {
        p_landing_id: landingId,
        p_version: version,
      });
      if (error) {
        ctx.toast(error.message);
        return;
      }
      ctx.toast(`Versión ${version} copiada al borrador. Revísala y publícala.`);
      await ctx.rerender();
    });
  });
}
