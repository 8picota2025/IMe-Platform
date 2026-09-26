/**
 * Esquema de las landings en el CMS (Fase 3B): campos editables (texto y fotos, nunca diseño
 * ni rutas), validación y mezcla con el código. Módulo puro: lo usan la build
 * (`landings-cms.ts`), el editor del admin y el script del seed.
 */
import type { CampaignLandingContent } from '../data/comercial-landings';

export type TipoLanding = 'campana' | 'fabricante' | 'ciudad' | 'familia';

/** Campos que sólo cambian por PR: identidad, rutas, productos y enlaces internos (SEO). */
export const CAMPOS_BLOQUEADOS = [
  'id',
  'familia_slug',
  'tipo_slug',
  'path',
  'pathEn',
  'productSlugs',
  'catalogFilter',
  'hubPath',
] as const;

export type TipoCampo = 'texto' | 'parrafo' | 'imagen' | 'numero' | 'lista' | 'pares' | 'objeto';

export interface SubcampoEditable {
  clave: string;
  etiqueta: string;
  /** No editable en el admin (códigos que recibe el CRM, enlaces internos). */
  fijo?: boolean;
  /** Lista de textos, un elemento por línea. */
  lista?: boolean;
}

export interface CampoEditable {
  clave: string;
  etiqueta: string;
  tipo: TipoCampo;
  obligatorio: boolean;
  /** Para `pares` (lista de objetos) y `objeto`. */
  subcampos?: SubcampoEditable[];
  ayuda?: string;
}

const texto = (
  clave: string,
  etiqueta: string,
  obligatorio = true,
  ayuda?: string
): CampoEditable => ({ clave, etiqueta, tipo: 'texto', obligatorio, ...(ayuda ? { ayuda } : {}) });
const parrafo = (clave: string, etiqueta: string, obligatorio = true): CampoEditable => ({
  clave,
  etiqueta,
  tipo: 'parrafo',
  obligatorio,
});
const lista = (clave: string, etiqueta: string): CampoEditable => ({
  clave,
  etiqueta,
  tipo: 'lista',
  obligatorio: true,
  ayuda: 'Un elemento por línea.',
});

/** Campos editables de una landing de campaña o fabricante, en el orden de la página. */
export const CAMPOS_CAMPANA: CampoEditable[] = [
  texto('tag', 'Etiqueta (miga de pan y antetítulo)'),
  texto('title', 'Título SEO (<title>)', true, 'Unos 60 caracteres.'),
  parrafo('description', 'Meta descripción'),
  texto('h1', 'Titular (H1)'),
  parrafo('lead', 'Entradilla'),
  { clave: 'heroImage', etiqueta: 'Foto principal', tipo: 'imagen', obligatorio: true },
  texto('heroImageAlt', 'Texto alternativo de la foto'),
  {
    clave: 'heroImageWidth',
    etiqueta: 'Ancho de la foto (px)',
    tipo: 'numero',
    obligatorio: false,
  },
  {
    clave: 'heroImageHeight',
    etiqueta: 'Alto de la foto (px)',
    tipo: 'numero',
    obligatorio: false,
  },
  texto('primaryCta', 'Botón principal'),
  texto('secondaryCta', 'Botón WhatsApp'),
  texto('tertiaryCta', 'Enlace al catálogo'),
  texto('problemTitle', 'Problema: título'),
  parrafo('problemBody', 'Problema: texto'),
  texto('solutionsTitle', 'Soluciones: título'),
  {
    clave: 'solutions',
    etiqueta: 'Soluciones',
    tipo: 'pares',
    obligatorio: true,
    subcampos: [
      { clave: 'pain', etiqueta: 'Situación' },
      { clave: 'help', etiqueta: 'Cómo ayudamos' },
    ],
  },
  lista('audienceYes', 'Para quién es'),
  lista('audienceNo', 'Para quién no es'),
  {
    clave: 'situations',
    etiqueta: 'Momentos del proyecto',
    tipo: 'pares',
    obligatorio: true,
    subcampos: [
      { clave: 'title', etiqueta: 'Título' },
      { clave: 'body', etiqueta: 'Texto' },
    ],
  },
  texto('productsTitle', 'Productos: título'),
  parrafo('productsNote', 'Productos: nota'),
  texto('scopeTitle', 'Alcance: título'),
  lista('scope', 'Alcance'),
  texto('requirementsTitle', 'Requisitos: título'),
  lista('requirements', 'Requisitos'),
  parrafo('financingNote', 'Nota de financiación'),
  parrafo('evidenceNote', 'Qué podemos decir y qué no'),
  texto('processTitle', 'Proceso: título'),
  lista('processSteps', 'Pasos del proceso'),
  parrafo('formIntro', 'Texto sobre el formulario'),
  {
    clave: 'projectOptions',
    etiqueta: 'Opciones del formulario',
    tipo: 'pares',
    obligatorio: true,
    subcampos: [
      { clave: 'value', etiqueta: 'Código (lo recibe el CRM)', fijo: true },
      { clave: 'label', etiqueta: 'Texto visible' },
    ],
  },
  {
    clave: 'faqs',
    etiqueta: 'Preguntas frecuentes',
    tipo: 'pares',
    obligatorio: true,
    subcampos: [
      { clave: 'q', etiqueta: 'Pregunta' },
      { clave: 'a', etiqueta: 'Respuesta' },
    ],
  },
  {
    clave: 'leadMagnet',
    etiqueta: 'Herramienta destacada',
    tipo: 'objeto',
    obligatorio: false,
    subcampos: [
      { clave: 'label', etiqueta: 'Antetítulo' },
      { clave: 'title', etiqueta: 'Título' },
      { clave: 'body', etiqueta: 'Texto' },
      { clave: 'href', etiqueta: 'Enlace', fijo: true },
      { clave: 'cta', etiqueta: 'Botón' },
    ],
  },
  {
    clave: 'relatedGuides',
    etiqueta: 'Guías relacionadas',
    tipo: 'pares',
    obligatorio: false,
    subcampos: [
      { clave: 'title', etiqueta: 'Título' },
      { clave: 'href', etiqueta: 'Enlace', fijo: true },
    ],
  },
  // Sólo landings de fabricante (tanda 2).
  texto('hubLabel', 'Miga de pan: sección', false),
  texto('brandName', 'Marca', false),
  texto('brandProfileTitle', 'Perfil de marca: título', false),
  parrafo('brandProfileBody', 'Perfil de marca: texto', false),
  texto('typologiesTitle', 'Tipologías: título', false),
  parrafo('typologiesIntro', 'Tipologías: introducción', false),
  {
    clave: 'typologies',
    etiqueta: 'Tipologías',
    tipo: 'pares',
    obligatorio: false,
    subcampos: [
      { clave: 'name', etiqueta: 'Nombre' },
      { clave: 'body', etiqueta: 'Texto' },
      { clave: 'problems', etiqueta: 'Problemas (uno por línea)', lista: true },
    ],
  },
];

export type CopyCampana = Record<string, unknown>;

const esTexto = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0;

/** Valida un copy de campaña. Devuelve los errores con la ruta del campo (vacío = válido). */
export function validarCopyCampana(copy: unknown): string[] {
  if (!copy || typeof copy !== 'object' || Array.isArray(copy)) {
    return ['el contenido no es un objeto'];
  }
  const errores: string[] = [];
  const obj = copy as Record<string, unknown>;
  const conocidos = new Set(CAMPOS_CAMPANA.map(c => c.clave));
  for (const clave of Object.keys(obj)) {
    if (!conocidos.has(clave)) errores.push(`${clave}: campo desconocido o no editable`);
  }
  for (const campo of CAMPOS_CAMPANA) {
    const v = obj[campo.clave];
    if (v === undefined || v === null) {
      if (campo.obligatorio) errores.push(`${campo.clave}: obligatorio`);
      continue;
    }
    switch (campo.tipo) {
      case 'texto':
      case 'parrafo':
      case 'imagen':
        if (!esTexto(v)) errores.push(`${campo.clave}: debe ser texto no vacío`);
        break;
      case 'numero':
        if (typeof v !== 'number' || !Number.isInteger(v) || v <= 0) {
          errores.push(`${campo.clave}: debe ser un entero positivo`);
        }
        break;
      case 'lista':
        if (!Array.isArray(v) || v.length === 0 || !v.every(esTexto)) {
          errores.push(`${campo.clave}: debe ser una lista de textos no vacía`);
        }
        break;
      case 'pares':
      case 'objeto': {
        const items: unknown[] = campo.tipo === 'objeto' ? [v] : Array.isArray(v) ? v : [];
        if (campo.tipo === 'pares' && (!Array.isArray(v) || v.length === 0)) {
          errores.push(`${campo.clave}: debe ser una lista no vacía`);
          break;
        }
        items.forEach((item, i) => {
          const ruta = campo.tipo === 'objeto' ? campo.clave : `${campo.clave}[${i}]`;
          if (!item || typeof item !== 'object' || Array.isArray(item)) {
            errores.push(`${ruta}: debe ser un objeto`);
            return;
          }
          for (const sub of campo.subcampos ?? []) {
            const sv = (item as Record<string, unknown>)[sub.clave];
            const ok = sub.lista ? Array.isArray(sv) && sv.every(esTexto) : esTexto(sv);
            if (!ok) errores.push(`${ruta}.${sub.clave}: obligatorio`);
          }
        });
        break;
      }
    }
  }
  return errores;
}

/** Copy editable de una landing del TypeScript: todo menos los campos bloqueados. */
export function copyEditableDesdeTs(content: CampaignLandingContent): CopyCampana {
  // Copia profunda: editar el copy nunca debe tocar el objeto compartido del código.
  const copy = structuredClone(content) as unknown as CopyCampana;
  for (const clave of CAMPOS_BLOQUEADOS) delete copy[clave];
  return copy;
}

/**
 * Mezcla una fila publicada con la landing del TypeScript: rutas, productos y demás campos
 * bloqueados salen siempre del código.
 */
export function mezclarLandingCampana(
  base: CampaignLandingContent,
  copy: CopyCampana
): CampaignLandingContent {
  const bloqueados: Record<string, unknown> = {};
  for (const clave of CAMPOS_BLOQUEADOS) {
    const valor = (base as unknown as Record<string, unknown>)[clave];
    if (valor !== undefined) bloqueados[clave] = valor;
  }
  return { ...copy, ...bloqueados } as unknown as CampaignLandingContent;
}
