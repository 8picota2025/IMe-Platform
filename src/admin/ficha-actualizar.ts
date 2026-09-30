/**
 * Ficha nueva de un producto que ya existe: detectar la coincidencia y calcular qué cambia.
 *
 * Lógica pura (sin DOM ni Supabase) para que la ingesta de PDF actualice el producto existente
 * en vez de crear un duplicado `slug-2`. Nunca toca precio, stock, publicación, fiscal ni orden:
 * la ficha solo aporta contenido (textos, especificaciones, aplicaciones, atributos y PDF).
 */

export type FichaRow = Record<string, unknown>;

export interface CandidatoExistente {
  id: string;
  slug: string;
  nombre_es: string;
  sku?: string | null;
}

/** `seleccion`: el usuario eligió el producto (desde su ficha), sin depender de la detección. */
export type MotivoCoincidencia = 'slug' | 'sku' | 'nombre' | 'seleccion';

export interface Coincidencia {
  producto: CandidatoExistente;
  motivo: MotivoCoincidencia;
}

export interface CambioFicha {
  campo: string;
  etiqueta: string;
  antes: string;
  despues: string;
  /** Valor que se escribe en `productos.<campo>` si el cambio se aplica. */
  valor: unknown;
}

type TipoCampo = 'texto' | 'lista' | 'especificaciones' | 'atributos';

interface CampoFicha {
  campo: string;
  etiqueta: string;
  tipo: TipoCampo;
  /** Solo rellena el campo si el producto existente lo tiene vacío. */
  soloSiVacio?: boolean;
}

/** Únicos campos que una ficha puede modificar. Todo lo demás (precio, stock, activo…) queda intacto. */
export const CAMPOS_FICHA: CampoFicha[] = [
  { campo: 'nombre_es', etiqueta: 'Nombre ES', tipo: 'texto' },
  { campo: 'nombre_en', etiqueta: 'Nombre EN', tipo: 'texto' },
  { campo: 'descripcion_corta_es', etiqueta: 'Descripción corta ES', tipo: 'texto' },
  { campo: 'descripcion_corta_en', etiqueta: 'Descripción corta EN', tipo: 'texto' },
  { campo: 'descripcion_larga_es', etiqueta: 'Descripción larga ES', tipo: 'texto' },
  { campo: 'descripcion_larga_en', etiqueta: 'Descripción larga EN', tipo: 'texto' },
  { campo: 'especificaciones', etiqueta: 'Especificaciones', tipo: 'especificaciones' },
  { campo: 'aplicaciones_es', etiqueta: 'Aplicaciones ES', tipo: 'lista' },
  { campo: 'aplicaciones_en', etiqueta: 'Aplicaciones EN', tipo: 'lista' },
  { campo: 'atributos', etiqueta: 'Atributos (beneficios, SEO, marca)', tipo: 'atributos' },
  { campo: 'ficha_pdf', etiqueta: 'Ficha PDF', tipo: 'texto' },
  { campo: 'imagen_principal', etiqueta: 'Imagen principal', tipo: 'texto', soloSiVacio: true },
  { campo: 'familia_id', etiqueta: 'Familia', tipo: 'texto', soloSiVacio: true },
  { campo: 'tipo_id', etiqueta: 'Tipo', tipo: 'texto', soloSiVacio: true },
];

const PREVIEW_MAX = 240;

export function normalizarClave(value: unknown): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Busca el producto que la ficha nueva ya tiene en el catálogo: slug, SKU y luego nombre. */
export function buscarCoincidencia(
  nuevo: { slug?: unknown; nombre_es?: unknown; sku?: unknown },
  catalogo: CandidatoExistente[]
): Coincidencia | null {
  const slug = String(nuevo.slug ?? '')
    .trim()
    .toLowerCase();
  if (slug) {
    const porSlug = catalogo.find(p => p.slug.toLowerCase() === slug);
    if (porSlug) return { producto: porSlug, motivo: 'slug' };
  }
  const sku = normalizarClave(nuevo.sku);
  if (sku) {
    const porSku = catalogo.find(p => normalizarClave(p.sku) === sku);
    if (porSku) return { producto: porSku, motivo: 'sku' };
  }
  const nombre = normalizarClave(nuevo.nombre_es);
  if (nombre) {
    const porNombre = catalogo.find(p => normalizarClave(p.nombre_es) === nombre);
    if (porNombre) return { producto: porNombre, motivo: 'nombre' };
  }
  return null;
}

function texto(value: unknown): string {
  return typeof value === 'string' ? value.trim() : value == null ? '' : String(value).trim();
}

function lista(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map(texto).filter(Boolean);
}

interface Especificacion {
  clave: string;
  valor: string;
  grupo: string;
}

function especificaciones(value: unknown): Especificacion[] {
  if (!Array.isArray(value)) return [];
  const salida: Especificacion[] = [];
  for (const item of value) {
    if (!item || typeof item !== 'object') continue;
    const fila = item as Record<string, unknown>;
    const espec = { clave: texto(fila.clave), valor: texto(fila.valor), grupo: texto(fila.grupo) };
    if (espec.clave || espec.valor) salida.push(espec);
  }
  return salida;
}

function objeto(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function vacio(value: unknown): boolean {
  if (Array.isArray(value)) return value.length === 0;
  if (value && typeof value === 'object') return Object.keys(value).length === 0;
  return texto(value) === '';
}

function estable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(estable).join(',')}]`;
  if (value && typeof value === 'object') {
    const fila = value as Record<string, unknown>;
    return `{${Object.keys(fila)
      .sort()
      .map(k => `${JSON.stringify(k)}:${estable(fila[k])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value ?? null);
}

function recortar(value: string): string {
  return value.length > PREVIEW_MAX ? `${value.slice(0, PREVIEW_MAX)}…` : value;
}

function resumenEspecificaciones(specs: Especificacion[]): string {
  return recortar(specs.map(s => `${s.clave}: ${s.valor}`).join(' · '));
}

function resumenAtributos(attrs: Record<string, unknown>): string {
  return recortar(
    Object.entries(attrs)
      .map(([k, v]) => {
        const valor = Array.isArray(v)
          ? v.join(', ')
          : typeof v === 'object'
            ? JSON.stringify(v)
            : String(v);
        return `${k}: ${valor}`;
      })
      .join(' · ')
  );
}

/**
 * Compara el producto existente con lo que trae la ficha nueva. Solo propone campos donde la
 * ficha aporta un valor no vacío y distinto: una ficha incompleta nunca borra contenido.
 */
export function calcularCambiosFicha(existente: FichaRow, nuevo: FichaRow): CambioFicha[] {
  const cambios: CambioFicha[] = [];
  for (const def of CAMPOS_FICHA) {
    const valorNuevo = nuevo[def.campo];
    if (vacio(valorNuevo)) continue;
    const valorActual = existente[def.campo];
    if (def.soloSiVacio && !vacio(valorActual)) continue;

    if (def.tipo === 'texto') {
      const despues = texto(valorNuevo);
      const antes = texto(valorActual);
      if (despues !== antes) {
        cambios.push({
          campo: def.campo,
          etiqueta: def.etiqueta,
          antes: recortar(antes),
          despues: recortar(despues),
          valor: despues,
        });
      }
    } else if (def.tipo === 'lista') {
      const despues = lista(valorNuevo);
      const antes = lista(valorActual);
      if (despues.length > 0 && estable(despues) !== estable(antes)) {
        cambios.push({
          campo: def.campo,
          etiqueta: def.etiqueta,
          antes: recortar(antes.join(' · ')),
          despues: recortar(despues.join(' · ')),
          valor: despues,
        });
      }
    } else if (def.tipo === 'especificaciones') {
      const despues = especificaciones(valorNuevo);
      const antes = especificaciones(valorActual);
      if (despues.length > 0 && estable(despues) !== estable(antes)) {
        cambios.push({
          campo: def.campo,
          etiqueta: def.etiqueta,
          antes: resumenEspecificaciones(antes),
          despues: resumenEspecificaciones(despues),
          valor: despues,
        });
      }
    } else {
      // atributos: la ficha pisa sus claves, pero conserva las que no trae (distribuidor, etc.).
      const aportados = Object.fromEntries(
        Object.entries(objeto(valorNuevo)).filter(([, v]) => !vacio(v))
      );
      const antes = objeto(valorActual);
      const fusion = { ...antes, ...aportados };
      if (Object.keys(aportados).length > 0 && estable(fusion) !== estable(antes)) {
        const tocadas = Object.keys(aportados).filter(
          k => estable(aportados[k]) !== estable(antes[k])
        );
        cambios.push({
          campo: def.campo,
          etiqueta: def.etiqueta,
          antes: resumenAtributos(Object.fromEntries(tocadas.map(k => [k, antes[k] ?? '—']))),
          despues: resumenAtributos(Object.fromEntries(tocadas.map(k => [k, aportados[k]]))),
          valor: fusion,
        });
      }
    }
  }
  return cambios;
}

/** Update parcial para `productos`: solo los campos que el usuario dejó marcados. */
export function construirActualizacion(cambios: CambioFicha[], aplicar: Set<string>): FichaRow {
  const update: FichaRow = {};
  for (const cambio of cambios) {
    if (aplicar.has(cambio.campo)) update[cambio.campo] = cambio.valor;
  }
  return update;
}
