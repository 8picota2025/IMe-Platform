# Landings Enriquecidas de Producto (Piloto) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** enrich 5 real product records (Biolight M12, Belmont Criticool, Natus Ten20, SLE6000, Penlon Prima 460) with real specs, applications, persuasive benefit copy, a non-fabricated value block, downloadable PDF, and improved Product schema — rendered automatically in ES/EN by the existing `ProductoLanding.astro` template.

**Architecture:** no new pages, no schema migration. Extend the `Producto` type and its two mappers (`mapProducto` for mock JSON, `mapProductoSupabase` for prod) with `aplicaciones`, `beneficios`, `valor`, `marca`; add two new sections to `ProductoLanding.astro` (Beneficios clave, Bloque de valor) plus reuse the existing gallery/specs sections; fill the 5 product JSON records with real content sourced from their PDF fichas; sync to Supabase via a small Node script (write-only in this plan, run against prod only after PR approval).

**Tech Stack:** Astro 6 (TypeScript strict), Vitest, Supabase (`@supabase/supabase-js`), PyMuPDF (already installed, `python3 -c "import fitz"`) for PDF page rendering used during content verification.

## Global Constraints

- Cero datos inventados: specs, aplicaciones, beneficios y el bloque de valor deben ser trazables al PDF ficha o a la `descripcion_larga_es` ya existente y aprobada — nunca cifras o certificaciones nuevas sin fuente.
- El "bloque de valor" NO lleva comillas de cita ni firma de una persona — es una frase de valor sin atribuir (regla dura de `AGENTS.md`: cero testimonios inventados).
- Sin `ALTER TABLE` en Supabase: `aplicaciones_es/en` ya existen como columnas; `beneficios`/`valor` van dentro de `atributos` JSONB (columna ya existente) del lado de Supabase. Del lado de `mock-productos.json` van como campos planos `beneficios_es/en` y `valor_es/en` (ese archivo ya usa campos planos como `marca`/`tags` que no están en `schema.sql`, así que esto sigue su convención real).
- Trabajar en `/home/shoky/cursor/IMe-Platform`, rama `feature/landings-producto-piloto`.
- `npm run validate` (lint + check + test + build) debe pasar antes de cada commit.
- PR obligatorio antes de merge a `main`; el `UPDATE` contra Supabase producción se ejecuta solo tras aprobación del PR (Task 12 deja el script listo pero no lo ejecuta contra producción).
- Design tokens existentes de `globals.css` (`var(--t900)`, `var(--radius-lg)`, `var(--border)`, `var(--shadow-sm)`, `var(--space-lg)`, etc.) — nada del CSS de las maquetas de `FTP/landings-nuevas`.
- Conventional commits: `feat|fix|chore|docs|refactor|test|perf|style(scope): mensaje`.

---

## Referencia: los 5 productos piloto

| Slug                                                           | Marca    | PDF origen (en `/home/shoky/FTP/pdf producto/`)                       |
| -------------------------------------------------------------- | -------- | --------------------------------------------------------------------- |
| `eq-monitor-de-paciente-m12-biolight`                          | Biolight | `ficha-monitor-de-paciente-m12-biolight.pdf`                          |
| `eq-sistema-de-hipotermia-criticool-belmont`                   | Belmont  | `ficha-sistema-de-hipotermia-criticool-belmont.pdf`                   |
| `eq-ten-20-pasta-conductiva-8onz-ref-si1067-natus`             | Natus    | `ficha-ten-20-pasta-conductiva-8onz-ref-si1067-natus.pdf`             |
| `eq-ventilador-neonatal-pedriatrico-convencional-ref-6000-sle` | SLE      | `ficha-ventilador-neonatal-pedriatrico-convencional-ref-6000-sle.pdf` |
| `eq-maquina-de-anestesia-prima-ref-460-penlon`                 | Penlon   | `ficha-maquina-de-anestesia-prima-ref-460-penlon.pdf`                 |

Los 5 ya tienen `imagen_principal` y `galeria` reales en `src/data/mock-productos.json` (verificado: los archivos existen en `public/assets/importados/equitronic/img/`) y ya tienen `descripcion_larga_es` real y específica (no genérica). Lo que falta y este plan completa: `especificaciones`, `aplicaciones_es/en`, `beneficios_es/en`, `valor_es/en`, `descripcion_larga_en`, `ficha_pdf`, y el `marca` reflejado en el JSON-LD.

---

### Task 1: Crear rama de trabajo

**Files:** ninguno (solo git)

- [ ] **Step 1: Verificar árbol limpio y crear rama**

```bash
cd /home/shoky/cursor/IMe-Platform
git status -s
git checkout -b feature/landings-producto-piloto
```

Expected: `Switched to a new branch 'feature/landings-producto-piloto'`. Si `git status -s` muestra cambios sin commitear que no sean tuyos de esta sesión, detente y pregunta antes de continuar.

- [ ] **Step 2: Confirmar que arranca sobre el commit correcto**

```bash
git log -1 --oneline
```

Expected: `c516181 docs: spec de diseño para piloto de landings enriquecidas de producto` (o el commit más reciente de `main` en ese momento).

---

### Task 2: Extender el tipo `Producto` y sus mappers con `aplicaciones`, `beneficios`, `valor`, `marca`

**Files:**

- Modify: `src/lib/datos.ts:93-118` (`mapProductoSupabase`), `src/lib/datos.ts:143-168` (`interface Producto`), `src/lib/datos.ts:223-248` (`mapProducto`)
- Test: `src/lib/datos.test.ts` (nuevo)

**Interfaces:**

- Produces: `Producto.aplicaciones: string[]`, `Producto.beneficios: string[]`, `Producto.valor: string | null`, `Producto.marca: string | null` — consumidos por `ProductoLanding.astro` (Task 4) y `buildProductJsonLd` (Task 3).

- [ ] **Step 1: Escribir el test que falla**

Crear `src/lib/datos.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import { getProductoBySlug } from './datos';

describe('mapProducto — campos enriquecidos de landing', () => {
  it('resuelve aplicaciones, beneficios y valor en español', async () => {
    const producto = await getProductoBySlug(
      'eq-ten-20-pasta-conductiva-8onz-ref-si1067-natus',
      'es'
    );
    expect(producto).not.toBeNull();
    expect(producto!.aplicaciones).toContain(
      'Estudios de electroencefalografía (EEG)'
    );
    expect(producto!.beneficios.length).toBeGreaterThan(0);
    expect(producto!.valor).toContain('neuromonitoreo');
    expect(producto!.marca).toBe('Natus');
  });

  it('resuelve aplicaciones, beneficios y valor en inglés', async () => {
    const producto = await getProductoBySlug(
      'eq-ten-20-pasta-conductiva-8onz-ref-si1067-natus',
      'en'
    );
    expect(producto).not.toBeNull();
    expect(producto!.aplicaciones).toContain(
      'Electroencephalography (EEG) studies'
    );
    expect(producto!.valor).toContain('neuromonitoring');
  });

  it('devuelve arreglos vacios y null cuando el producto no tiene estos campos', async () => {
    const producto = await getProductoBySlug(
      'monitor-multiparametrico-uci-avanzado',
      'es'
    );
    expect(producto).not.toBeNull();
    expect(producto!.aplicaciones).toEqual([]);
    expect(producto!.beneficios).toEqual([]);
    expect(producto!.valor).toBeNull();
  });
});
```

- [ ] **Step 2: Ejecutar el test y verificar que falla**

Run: `npx vitest run src/lib/datos.test.ts`
Expected: FAIL — `producto!.aplicaciones` es `undefined`, no `[]` (la propiedad no existe todavía en `Producto`), y probablemente error de tipos TypeScript en el propio archivo de test (`Property 'aplicaciones' does not exist on type 'Producto'`).

- [ ] **Step 3: Añadir los campos a la interfaz `Producto`**

En `src/lib/datos.ts`, dentro de `export interface Producto { ... }` (línea ~143), añadir después de `especificaciones: unknown[];`:

```typescript
  especificaciones: unknown[];
  aplicaciones: string[];
  beneficios: string[];
  valor: string | null;
  marca: string | null;
```

- [ ] **Step 4: Resolver los campos en `mapProductoSupabase`**

En `src/lib/datos.ts`, dentro de `mapProductoSupabase` (línea ~93), después de `especificaciones: raw.especificaciones ?? [],` añadir:

```typescript
    especificaciones: raw.especificaciones ?? [],
    aplicaciones:
      (locale === 'en' ? raw.aplicaciones_en : raw.aplicaciones_es) ?? [],
    beneficios:
      (locale === 'en' ? raw.atributos?.beneficios_en : raw.atributos?.beneficios_es) ?? [],
    valor: (locale === 'en' ? raw.atributos?.valor_en : raw.atributos?.valor_es) ?? null,
    marca: raw.marca ?? null,
```

- [ ] **Step 5: Resolver los campos en `mapProducto` (mock)**

En `src/lib/datos.ts`, dentro de `mapProducto` (línea ~223), después de `especificaciones: raw.especificaciones,` añadir (usando el mismo patrón de cast que ya usa el archivo para `stock`/`disponible`, porque no todos los 121 productos del mock tienen estos campos):

```typescript
    especificaciones: raw.especificaciones,
    aplicaciones:
      (locale === 'en'
        ? (raw as { aplicaciones_en?: string[] }).aplicaciones_en
        : (raw as { aplicaciones_es?: string[] }).aplicaciones_es) ?? [],
    beneficios:
      (locale === 'en'
        ? (raw as { beneficios_en?: string[] }).beneficios_en
        : (raw as { beneficios_es?: string[] }).beneficios_es) ?? [],
    valor:
      (locale === 'en'
        ? (raw as { valor_en?: string }).valor_en
        : (raw as { valor_es?: string }).valor_es) ?? null,
    marca: (raw as { marca?: string }).marca ?? null,
```

- [ ] **Step 6: Ejecutar el test y verificar que pasa**

Run: `npx vitest run src/lib/datos.test.ts`
Expected: FAIL todavía en las 2 primeras pruebas (contenido real aún no está en `mock-productos.json` — eso lo completan las Tasks 6-10) pero la prueba 3 (`monitor-multiparametrico-uci-avanzado`, sin estos campos) debe pasar, y no debe haber más errores de TypeScript sobre propiedades inexistentes.

- [ ] **Step 7: Verificar tipos con `astro check`**

Run: `npm run check`
Expected: sin errores de tipo nuevos.

- [ ] **Step 8: Commit**

```bash
git add src/lib/datos.ts src/lib/datos.test.ts
git commit -m "feat(datos): agregar aplicaciones, beneficios, valor y marca a Producto"
```

---

### Task 3: Reflejar la marca real en el JSON-LD `Product` (mejora SEO)

**Files:**

- Modify: `src/lib/seo.ts:246-286` (`buildProductJsonLd`)
- Modify: `src/pages/es/productos/[slug].astro:44` , `src/pages/en/products/[slug].astro:44`

**Interfaces:**

- Consumes: `Producto.marca` (Task 2)
- Produces: `buildProductJsonLd(producto, locale, categoria?, marca?)` — el 4º parámetro es nuevo y opcional, no rompe otros llamadores.

- [ ] **Step 1: Actualizar la firma y el cuerpo de `buildProductJsonLd`**

En `src/lib/seo.ts`, reemplazar:

```typescript
export function buildProductJsonLd(
  producto: {
    nombre: string;
    descripcion_corta: string;
    imagen_principal: string | null;
    slug: string;
  },
  locale: Locale,
  categoria?: string
): Record<string, unknown> {
```

por:

```typescript
export function buildProductJsonLd(
  producto: {
    nombre: string;
    descripcion_corta: string;
    imagen_principal: string | null;
    slug: string;
  },
  locale: Locale,
  categoria?: string,
  marca?: string | null
): Record<string, unknown> {
```

Y reemplazar el bloque `brand`:

```typescript
    brand: {
      '@type': 'Brand',
      name: 'I-ME International Medical Enterprise',
    },
```

por:

```typescript
    brand: {
      '@type': 'Brand',
      name: marca && marca.trim().length > 0 ? marca : 'I-ME International Medical Enterprise',
    },
```

(El `seller` sigue siendo siempre I-ME — no se toca — porque I-ME es quien vende, no el fabricante.)

- [ ] **Step 2: Pasar `producto.marca` desde ambas páginas de producto**

En `src/pages/es/productos/[slug].astro`, reemplazar:

```typescript
  buildProductJsonLd(producto, locale, familia.nombre),
```

por:

```typescript
  buildProductJsonLd(producto, locale, familia.nombre, producto.marca),
```

Repetir el mismo cambio literal en `src/pages/en/products/[slug].astro`.

- [ ] **Step 3: Test de `buildProductJsonLd`**

Añadir a `src/lib/seo.ts` un test co-ubicado `src/lib/seo.test.ts` (crear si no existe; si ya existe, añadir el `describe`):

```typescript
import { describe, expect, it } from 'vitest';
import { buildProductJsonLd } from './seo';

describe('buildProductJsonLd', () => {
  const producto = {
    nombre: 'Monitor de Paciente Biolight M12',
    descripcion_corta: 'Monitor de paciente compacto.',
    imagen_principal:
      '/assets/importados/equitronic/img/monitor-de-paciente-m12-biolight-1.jpg',
    slug: 'eq-monitor-de-paciente-m12-biolight',
  };

  it('usa la marca del fabricante cuando esta presente', () => {
    const jsonLd = buildProductJsonLd(producto, 'es', 'Monitores', 'Biolight');
    expect((jsonLd.brand as { name: string }).name).toBe('Biolight');
  });

  it('cae a I-ME cuando no hay marca', () => {
    const jsonLd = buildProductJsonLd(producto, 'es', 'Monitores', null);
    expect((jsonLd.brand as { name: string }).name).toBe(
      'I-ME International Medical Enterprise'
    );
  });
});
```

- [ ] **Step 4: Ejecutar y verificar**

Run: `npx vitest run src/lib/seo.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/seo.ts src/lib/seo.test.ts src/pages/es/productos/\[slug\].astro src/pages/en/products/\[slug\].astro
git commit -m "feat(seo): usar marca real del fabricante en Product JSON-LD"
```

---

### Task 4: Añadir secciones "Beneficios clave", "Aplicaciones clínicas" y "Bloque de valor" a `ProductoLanding.astro`

**Files:**

- Modify: `src/components/ProductoLanding.astro:187-236` (insertar tras el hero) y `:344-364` (insertar antes de `Resenas`)
- Modify: `src/i18n/es.json` (bloque `producto`), `src/i18n/en.json` (bloque `producto`)

**Interfaces:**

- Consumes: `Producto.aplicaciones`, `Producto.beneficios`, `Producto.valor` (Task 2)

- [ ] **Step 1: Añadir claves de traducción**

En `src/i18n/es.json`, dentro del objeto `"producto": { ... }`, añadir (después de `"ficha_atencion_desc"`):

```json
    "beneficios_titulo": "Beneficios clave",
    "aplicaciones_titulo": "Aplicaciones clínicas",
    "valor_titulo": "Por qué lo eligen las instituciones",
```

En `src/i18n/en.json`, en el mismo bloque `"producto"`:

```json
    "beneficios_titulo": "Key benefits",
    "aplicaciones_titulo": "Clinical applications",
    "valor_titulo": "Why institutions choose it",
```

- [ ] **Step 2: Insertar la sección "Beneficios clave" tras el hero**

En `src/components/ProductoLanding.astro`, inmediatamente después del cierre `</section>` del hero (línea ~236, antes del comentario `<!-- Galería -->`), insertar:

```astro
<!-- Beneficios clave -->{
  producto.beneficios.length > 0 && (
    <section class="section container" aria-labelledby="beneficios-heading">
      <h2 id="beneficios-heading" class="section-subtitle">
        {t(locale, 'producto.beneficios_titulo')}
      </h2>
      <ul class="beneficios__grid" role="list">
        {producto.beneficios.map(beneficio => (
          <li class="beneficios__card">{beneficio}</li>
        ))}
      </ul>
    </section>
  )
}
```

- [ ] **Step 3: Insertar la sección "Aplicaciones clínicas" después de especificaciones**

Inmediatamente después del cierre `</section>` del bloque de especificaciones (línea ~306, antes del comentario `<!-- Relacionados -->`), insertar:

```astro
<!-- Aplicaciones clínicas -->{
  producto.aplicaciones.length > 0 && (
    <section
      class="section section-alt container"
      aria-labelledby="aplicaciones-heading"
    >
      <h2 id="aplicaciones-heading" class="section-subtitle">
        {t(locale, 'producto.aplicaciones_titulo')}
      </h2>
      <ul class="aplicaciones__grid" role="list">
        {producto.aplicaciones.map(item => (
          <li class="aplicaciones__item">{item}</li>
        ))}
      </ul>
    </section>
  )
}
```

- [ ] **Step 4: Insertar el "Bloque de valor" antes de las reseñas**

Inmediatamente antes de `<Resenas productoId={producto.id} ...` (línea ~364), insertar:

```astro
<!-- Bloque de valor (no es un testimonio atribuido a una persona) -->{
  producto.valor && (
    <section class="section container" aria-labelledby="valor-heading">
      <div class="valor-card">
        <h2 id="valor-heading" class="section-subtitle">
          {t(locale, 'producto.valor_titulo')}
        </h2>
        <p class="valor-card__texto">{producto.valor}</p>
      </div>
    </section>
  )
}
```

- [ ] **Step 5: Añadir el CSS de las 3 secciones**

En el bloque `<style>` de `ProductoLanding.astro`, al final (antes del cierre `</style>`), añadir:

```css
.beneficios__grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: var(--space-md);
  list-style: none;
  margin: 0;
  padding: 0;
}
.beneficios__card {
  background: var(--white);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: 1.1rem 1.25rem;
  font-size: 0.92rem;
  line-height: 1.55;
  color: var(--text-mid);
  box-shadow: var(--shadow-sm);
}
.aplicaciones__grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 0.85rem;
  list-style: none;
  margin: 0;
  padding: 0;
}
.aplicaciones__item {
  background: var(--white);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 0.85rem 1rem;
  font-size: 0.9rem;
  color: var(--ink);
}
.valor-card {
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.9), rgba(247, 249, 251, 0.9)),
    var(--white);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: 1.5rem 1.75rem;
  box-shadow: var(--shadow-sm);
}
.valor-card__texto {
  font-size: 1.02rem;
  line-height: 1.65;
  color: var(--text);
  margin: 0;
}
```

- [ ] **Step 6: Verificar tipos y build**

Run: `npm run check && npm run build`
Expected: sin errores. El build genera páginas estáticas para los 121 productos existentes sin romperse (los que no tienen `beneficios`/`aplicaciones`/`valor` simplemente no muestran esas secciones, por las guardas `.length > 0` / truthy).

- [ ] **Step 7: Commit**

```bash
git add src/components/ProductoLanding.astro src/i18n/es.json src/i18n/en.json
git commit -m "feat(producto): agregar secciones de beneficios, aplicaciones y valor a ProductoLanding"
```

---

### Task 5: Copiar los 5 PDFs de ficha técnica a `public/`

**Files:**

- Create: `public/assets/importados/equitronic/pdf/eq-monitor-de-paciente-m12-biolight.pdf`
- Create: `public/assets/importados/equitronic/pdf/eq-sistema-de-hipotermia-criticool-belmont.pdf`
- Create: `public/assets/importados/equitronic/pdf/eq-ten-20-pasta-conductiva-8onz-ref-si1067-natus.pdf`
- Create: `public/assets/importados/equitronic/pdf/eq-ventilador-neonatal-pedriatrico-convencional-ref-6000-sle.pdf`
- Create: `public/assets/importados/equitronic/pdf/eq-maquina-de-anestesia-prima-ref-460-penlon.pdf`

- [ ] **Step 1: Copiar los archivos con el nombre de slug**

```bash
cd /home/shoky/cursor/IMe-Platform
SRC="/home/shoky/FTP/pdf producto"
DEST="public/assets/importados/equitronic/pdf"
cp "$SRC/ficha-monitor-de-paciente-m12-biolight.pdf" "$DEST/eq-monitor-de-paciente-m12-biolight.pdf"
cp "$SRC/ficha-sistema-de-hipotermia-criticool-belmont.pdf" "$DEST/eq-sistema-de-hipotermia-criticool-belmont.pdf"
cp "$SRC/ficha-ten-20-pasta-conductiva-8onz-ref-si1067-natus.pdf" "$DEST/eq-ten-20-pasta-conductiva-8onz-ref-si1067-natus.pdf"
cp "$SRC/ficha-ventilador-neonatal-pedriatrico-convencional-ref-6000-sle.pdf" "$DEST/eq-ventilador-neonatal-pedriatrico-convencional-ref-6000-sle.pdf"
cp "$SRC/ficha-maquina-de-anestesia-prima-ref-460-penlon.pdf" "$DEST/eq-maquina-de-anestesia-prima-ref-460-penlon.pdf"
ls -la "$DEST" | grep -E "m12-biolight|criticool-belmont|ten-20-pasta|ventilador-neonatal-pedriatrico-convencional|anestesia-prima"
```

Expected: los 5 archivos listados con tamaño > 0.

- [ ] **Step 2: Verificar que el PDF de Biolight M12 es el mismo que se leyó durante el diseño (es una imagen escaneada, no tiene capa de texto)**

```bash
python3 -c "
import fitz
doc = fitz.open('$DEST/eq-monitor-de-paciente-m12-biolight.pdf'.replace('\$DEST','public/assets/importados/equitronic/pdf'))
print('pages:', len(doc))
"
```

Expected: `pages: 2` (confirma que es el archivo correcto, 2 páginas, consistente con el análisis hecho en el diseño).

- [ ] **Step 3: Commit**

```bash
git add public/assets/importados/equitronic/pdf/
git commit -m "chore(assets): agregar fichas tecnicas PDF de los 5 productos piloto"
```

---

### Task 6: Contenido del producto 1 — Monitor Biolight M12

**Files:**

- Modify: `src/data/mock-productos.json` (entrada con `"slug": "eq-monitor-de-paciente-m12-biolight"`)

- [ ] **Step 1: Localizar y reemplazar la entrada completa**

Buscar en `src/data/mock-productos.json` el objeto cuyo `"slug"` es `"eq-monitor-de-paciente-m12-biolight"`. Su `descripcion_larga_en` actual es `""`, `especificaciones` es `[]`, `ficha_pdf` es `null`. Reemplazar únicamente estos 4 campos y añadir 5 campos nuevos, dejando el resto de la entrada intacta:

```json
  "descripcion_larga_en": "The Biolight M12 Patient Monitor combines reliable technology, ergonomic design and clinical precision in a compact footprint, ideal for hospitals, clinics and emergency departments.\nIts 12.1-inch touchscreen delivers a clear, organized view of vital parameters, helping clinical staff act quickly and effectively.\nDesigned for adult, pediatric and neonatal patients, the M12 accurately measures ECG, SpO₂, respiratory rate, non-invasive blood pressure (NIBP) and temperature, with the option to expand its capabilities with IBP, CO₂ and cardiac output (C.O.).\nIt features a sealed internal ventilator that minimizes the risk of cross-contamination, along with built-in clinical assessment tools such as EWS, GCS and OxyCRG that support the monitoring of critical conditions.\nThanks to its long-lasting internal battery, intuitive interface and compact, rugged build, the M12 delivers continuous performance, mobility and patient safety in any clinical setting.",
  "especificaciones": [
    { "clave": "Pantalla", "valor": "Táctil de 12.1\", resolución 1280×800 px", "grupo": "Pantalla y diseño" },
    { "clave": "Parámetros estándar", "valor": "ECG (3/5/6 derivaciones), SpO₂, frecuencia de pulso, NIBP, temperatura", "grupo": "Parámetros monitoreados" },
    { "clave": "Parámetros ampliables", "valor": "IBP, CO₂ y gasto cardíaco (C.O.) como módulos opcionales", "grupo": "Parámetros monitoreados" },
    { "clave": "Frecuencia respiratoria por pletismografía (RRP)", "valor": "Deriva la frecuencia respiratoria de la onda de SpO₂ mediante algoritmo propio de Biolight", "grupo": "Tecnología clínica" },
    { "clave": "Herramientas de evaluación clínica", "valor": "EWS (Early Warning Score), GCS (Escala de Coma de Glasgow) y OxyCRG integrados", "grupo": "Tecnología clínica" },
    { "clave": "Ventilador interno", "valor": "Sellado, para minimizar riesgo de contaminación cruzada entre pacientes", "grupo": "Bioseguridad" },
    { "clave": "Batería", "valor": "Li-ion recargable de 2.5 Ah", "grupo": "Autonomía" },
    { "clave": "Accesorios opcionales", "valor": "Impresora térmica, soporte rodante, montaje en pared", "grupo": "Accesorios" }
  ],
  "aplicaciones_es": [
    "Salas de observación y urgencias",
    "Unidades de cuidado intensivo (UCI) adulto, pediátrico y neonatal",
    "Recuperación post-anestésica (PACU)",
    "Monitoreo pre y postoperatorio",
    "Transporte intrahospitalario de pacientes"
  ],
  "aplicaciones_en": [
    "Observation and emergency rooms",
    "Adult, pediatric and neonatal intensive care units (ICU)",
    "Post-anesthesia care unit (PACU)",
    "Pre- and post-operative monitoring",
    "In-hospital patient transport"
  ],
  "beneficios_es": [
    "Visualiza con claridad hasta 7 parámetros a la vez en una pantalla táctil de 12.1″, para decisiones clínicas más rápidas.",
    "La frecuencia respiratoria por pletismografía (RRP) te da un dato vital más sin sensores ni insumos adicionales.",
    "El ventilador interno sellado reduce el riesgo de contaminación cruzada entre pacientes, cuidando la bioseguridad de tu servicio.",
    "Evalúa el estado del paciente de un vistazo con EWS, GCS y OxyCRG integrados, sin depender de calculadoras externas.",
    "Adapta el equipo a adultos, pediátricos y neonatos, y amplíalo con IBP, CO₂ o gasto cardíaco cuando tu servicio lo necesite."
  ],
  "beneficios_en": [
    "Clearly view up to 7 parameters at once on a 12.1″ touchscreen, for faster clinical decisions.",
    "Respiration rate from plethysmography (RRP) gives you one more vital sign with no extra sensors or consumables.",
    "The sealed internal ventilator reduces the risk of cross-contamination between patients, protecting your unit's biosafety.",
    "Assess patient status at a glance with built-in EWS, GCS and OxyCRG, with no need for external calculators.",
    "Adapt the monitor to adults, pediatric and neonatal patients, and expand it with IBP, CO₂ or cardiac output as your service grows."
  ],
  "valor_es": "Un monitor pensado para servicios que necesitan moverse rápido: de la sala de observación a la UCI, sin perder precisión ni continuidad en el registro del paciente.",
  "valor_en": "A monitor built for services that need to move fast — from the observation room to the ICU — without losing accuracy or continuity in patient records.",
  "ficha_pdf": "/assets/importados/equitronic/pdf/eq-monitor-de-paciente-m12-biolight.pdf",
```

- [ ] **Step 2: Validar que el JSON sigue siendo válido**

```bash
python3 -c "import json; json.load(open('src/data/mock-productos.json')); print('OK')"
```

Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add src/data/mock-productos.json
git commit -m "content(producto): enriquecer ficha del monitor Biolight M12"
```

---

### Task 7: Contenido del producto 2 — Sistema de Hipotermia Criticool Belmont

**Files:**

- Modify: `src/data/mock-productos.json` (entrada con `"slug": "eq-sistema-de-hipotermia-criticool-belmont"`)

- [ ] **Step 1: Verificar el nombre real de la envoltura de un solo uso antes de escribir las especificaciones**

La `descripcion_larga_es` ya existente en el mock llama a la envoltura **"ThermoWrap™"**, pero la ficha oficial de Belmont (`ficha-sistema-de-hipotermia-criticool-belmont.pdf`) la llama **"CureWrap™"**. Antes de escribir el contenido nuevo, abrir el PDF y confirmar cuál nombre corresponde exactamente a esta referencia:

```bash
python3 -c "
import fitz
doc = fitz.open('/home/shoky/FTP/pdf producto/ficha-sistema-de-hipotermia-criticool-belmont.pdf')
for page in doc:
    print(page.get_text()[:200])
"
```

Si el PDF confirma "CureWrap™", usar ese nombre en las especificaciones nuevas de abajo (no se modifica la `descripcion_larga_es` ya aprobada en esta tarea — eso queda anotado como seguimiento, no se sobrescribe contenido existente sin confirmarlo con el fabricante/proveedor). Si el ejecutor no puede confirmar con certeza cuál nombre aplica a esta referencia comercial exacta, usar el término genérico "envoltura de un solo uso" en las especificaciones nuevas (evita introducir un nombre de marca incorrecto) y dejarlo anotado en el mensaje de commit.

- [ ] **Step 2: Reemplazar los 4 campos vacíos y añadir los 5 nuevos**

```json
  "descripcion_larga_en": "CritiCool is a device designed to provide non-invasive, servo-controlled hypothermia therapy for adult, pediatric and neonatal patients. The system is made up of two elements: the CritiCool control console and the single-use body wrap. Hypothermia therapy is used in critical situations such as cardiac arrest, stroke or traumatic injury, to help minimize neurological damage and improve the chances of recovery.\nCritiCool allows precise control of body temperature, adjusting to each patient's specific needs. Its easy-to-use design and adaptability to different ages and clinical conditions make it an essential tool for managing hypothermia therapy in critical care settings.",
  "especificaciones": [
    { "clave": "Función", "valor": "Sistema de gestión de temperatura corporal por control servo, con lectura de temperatura central del paciente y ajuste automático", "grupo": "Función principal" },
    { "clave": "Componentes", "valor": "Consola de control CritiCool + envoltura de un solo uso que rodea al paciente para maximizar la superficie de contacto", "grupo": "Función principal" },
    { "clave": "Modos de terapia", "valor": "Enfriamiento rápido (Cool), gestión de temperatura objetivo (Temperature Management) y recalentamiento controlado (Rewarming), incluido modo pediátrico/neonatal", "grupo": "Modos de terapia" },
    { "clave": "Pantalla", "valor": "Pantalla táctil a color de fácil manejo, con monitoreo gráfico en tiempo real de la temperatura", "grupo": "Interfaz" },
    { "clave": "Registro de datos", "valor": "Registro histórico de temperatura para trazabilidad clínica", "grupo": "Interfaz" },
    { "clave": "Envoltura de un solo uso", "valor": "Disponible en distintos tamaños y diseños para adaptarse a la anatomía del paciente, incluida versión pediátrica", "grupo": "Accesorios" }
  ],
  "aplicaciones_es": [
    "Manejo de temperatura post paro cardíaco",
    "Soporte neurológico en accidente cerebrovascular (ACV)",
    "Control de temperatura en lesiones traumáticas críticas",
    "Cuidado intensivo adulto, pediátrico y neonatal"
  ],
  "aplicaciones_en": [
    "Post-cardiac arrest temperature management",
    "Neurological support after stroke",
    "Temperature control in critical traumatic injury",
    "Adult, pediatric and neonatal intensive care"
  ],
  "beneficios_es": [
    "Controla la temperatura corporal del paciente con precisión servo-controlada, ajustando el enfriamiento o recalentamiento de forma automática.",
    "Ayuda a minimizar el daño neurológico en las horas críticas tras un paro cardíaco o un ACV, cuando cada grado cuenta.",
    "Pantalla táctil e interfaz simple que agiliza la puesta en marcha del protocolo de hipotermia terapéutica.",
    "Se adapta a pacientes adultos, pediátricos y neonatales con envolturas de distintos tamaños."
  ],
  "beneficios_en": [
    "Controls body temperature with servo-controlled precision, automatically adjusting cooling or rewarming.",
    "Helps minimize neurological damage in the critical hours after cardiac arrest or stroke, when every degree matters.",
    "Touchscreen and simple interface that speeds up starting the therapeutic hypothermia protocol.",
    "Adapts to adult, pediatric and neonatal patients with wraps in different sizes."
  ],
  "valor_es": "Un aliado en los momentos donde el manejo preciso de la temperatura define el pronóstico neurológico del paciente.",
  "valor_en": "A critical ally in the moments where precise temperature management shapes a patient's neurological outcome.",
  "ficha_pdf": "/assets/importados/equitronic/pdf/eq-sistema-de-hipotermia-criticool-belmont.pdf",
```

- [ ] **Step 3: Validar JSON**

```bash
python3 -c "import json; json.load(open('src/data/mock-productos.json')); print('OK')"
```

- [ ] **Step 4: Commit**

```bash
git add src/data/mock-productos.json
git commit -m "content(producto): enriquecer ficha del sistema de hipotermia Criticool Belmont"
```

---

### Task 8: Contenido del producto 3 — Ten20 Pasta Conductiva Natus

**Files:**

- Modify: `src/data/mock-productos.json` (entrada con `"slug": "eq-ten-20-pasta-conductiva-8onz-ref-si1067-natus"`)

- [ ] **Step 1: Reemplazar/ampliar los campos (nota: se amplía `descripcion_larga_es`, no se reemplaza — se conserva la frase original como primera oración)**

```json
  "descripcion_larga_es": "El Ten 20 o pasta conductiva, constituye un complemento imprescindible para garantizar la adhesión de los electrodos y la conductividad de las ondas eléctricas cerebrales. Ten20® (Natus) está indicada para procedimientos de neuromonitoreo con electrodos neurodiagnósticos no gelificados, como estudios de EEG, potenciales evocados, polisomnografía (PSG) y test de latencias múltiples del sueño (MSLT). Se presenta en envase de 8 onzas (referencia SI1067) y se aplica sobre la piel previamente preparada, fijando el electrodo tipo copa y asegurando una señal estable durante todo el registro.",
  "descripcion_larga_en": "Ten 20 Conductive Paste is an essential accessory to ensure electrode adhesion and reliable conductivity of brain electrical signals. Ten20® (Natus) is indicated for neuromonitoring procedures using non-gelled neurodiagnostic electrodes, such as EEG studies, evoked potential testing, polysomnography (PSG) and the Multiple Sleep Latency Test (MSLT). It comes in an 8-ounce container (reference SI1067) and is applied to prepared skin, holding the cup electrode in place and ensuring a stable signal throughout the recording.",
  "especificaciones": [
    { "clave": "Presentación", "valor": "Envase de 8 oz, referencia SI1067", "grupo": "Presentación" },
    { "clave": "Composición", "valor": "Polioxietileno 20 Cetil Éter, agua, glicerina, carbonato de calcio, 1,2-propanodiol, cloruro de potasio, Gelwhite® (montmorillonita), cloruro de sodio, polioxietileno 20 sorbitol, metilparabeno, propilparabeno", "grupo": "Composición" },
    { "clave": "Indicaciones", "valor": "Procedimientos de neuromonitoreo con electrodos neurodiagnósticos no gelificados: EEG, potenciales evocados, polisomnografía (PSG) y test de latencias múltiples del sueño (MSLT)", "grupo": "Uso clínico" },
    { "clave": "Modo de aplicación", "valor": "Se aplica en el electrodo tipo copa tras preparar la piel (abrasión con producto como Nuprep®); su adherencia fija el electrodo y aporta conductividad", "grupo": "Uso clínico" },
    { "clave": "Precauciones", "valor": "Uso tópico solo en piel intacta; evitar contacto con ojos; vigilar el sitio del electrodo ante enrojecimiento o irritación", "grupo": "Seguridad" }
  ],
  "aplicaciones_es": [
    "Estudios de electroencefalografía (EEG)",
    "Potenciales evocados",
    "Polisomnografía (PSG)",
    "Test de latencias múltiples del sueño (MSLT)"
  ],
  "aplicaciones_en": [
    "Electroencephalography (EEG) studies",
    "Evoked potential testing",
    "Polysomnography (PSG)",
    "Multiple Sleep Latency Test (MSLT)"
  ],
  "beneficios_es": [
    "Fija el electrodo y conduce la señal en un solo paso, agilizando la preparación del estudio de EEG.",
    "Formulado para procedimientos de neuromonitoreo exigentes: EEG, potenciales evocados, PSG y MSLT.",
    "Su perfil de ingredientes está pensado para uso tópico controlado, con indicaciones claras de seguridad para el paciente."
  ],
  "beneficios_en": [
    "Fixes the electrode and conducts the signal in a single step, speeding up EEG study preparation.",
    "Formulated for demanding neuromonitoring procedures: EEG, evoked potentials, PSG and MSLT.",
    "Its ingredient profile is designed for controlled topical use, with clear patient safety guidance."
  ],
  "valor_es": "Un insumo de confianza en cada estudio de neuromonitoreo, donde la calidad de la señal no da margen de error.",
  "valor_en": "A trusted consumable for every neuromonitoring study, where signal quality leaves no room for error.",
  "ficha_pdf": "/assets/importados/equitronic/pdf/eq-ten-20-pasta-conductiva-8onz-ref-si1067-natus.pdf",
```

- [ ] **Step 2: Validar JSON**

```bash
python3 -c "import json; json.load(open('src/data/mock-productos.json')); print('OK')"
```

- [ ] **Step 3: Commit**

```bash
git add src/data/mock-productos.json
git commit -m "content(producto): enriquecer ficha de la pasta conductiva Ten20 Natus"
```

---

### Task 9: Contenido del producto 4 — Ventilador Neonatal Pediátrico SLE6000

**Files:**

- Modify: `src/data/mock-productos.json` (entrada con `"slug": "eq-ventilador-neonatal-pedriatrico-convencional-ref-6000-sle"`)

- [ ] **Step 1: Verificar la variante exacta (SLE6000N vs SLE6000C) antes de publicar**

La ficha `ficha-ventilador-neonatal-pedriatrico-convencional-ref-6000-sle.pdf` describe 3 variantes (SLE6000N, SLE6000C, SLE6000H). Este producto del catálogo es la versión "convencional" (sin alta frecuencia — esa es una entrada de catálogo distinta). Confirmar contra el PDF o la ficha del proveedor cuál letra de variante (N o C) corresponde exactamente a esta referencia antes de añadir esa letra a cualquier copy futuro. El contenido de este task es válido para ambas variantes porque no menciona la letra específica.

- [ ] **Step 2: Reemplazar/ampliar los campos**

```json
  "descripcion_larga_en": "The SLE6000 conventional ventilator is a fourth-generation oscillatory device with fast-response bidirectional valve technology, delivering powerful, effective and reliable performance. Designed for patients from 300 grams to 30 kilograms, its square pressure waveform allows tidal volumes to be delivered at lower pressures.\nIt offers invasive and non-invasive ventilation, real-time pulmonary monitoring and high-flow oxygen therapy with automatic leak compensation. Its advanced technology and quiet operation make it ideal for respiratory support in neonatal and pediatric patients.\nThe integrated OxyGenie® automated FiO₂ control helps keep SpO₂ within the physician-defined therapeutic range across ventilation modes, while built-in SpO₂ and CO₂ monitoring gives clinicians a continuous view of the outcome of the selected respiratory support settings. An RS232 output allows integration with hospital information systems (HIS).",
  "especificaciones": [
    { "clave": "Tecnología de válvulas", "valor": "Válvulas de rápido movimiento bidireccional, oscilatorio de cuarta generación", "grupo": "Tecnología" },
    { "clave": "Rango de paciente", "valor": "Desde 300 gramos hasta 30 kilogramos", "grupo": "Rango de uso" },
    { "clave": "Modos de ventilación", "valor": "Ventilación invasiva y no invasiva, con onda de presión cuadrada para menores presiones en volúmenes corrientes", "grupo": "Modos de ventilación" },
    { "clave": "Control de oxígeno", "valor": "Integración OxyGenie® con control automático de FiO₂ para mantener la SpO₂ en el rango terapéutico definido", "grupo": "Tecnología" },
    { "clave": "Monitoreo integrado", "valor": "SpO₂ y CO₂ en el mismo equipo, con evaluación continua del resultado del soporte ventilatorio", "grupo": "Monitoreo" },
    { "clave": "Pantalla", "valor": "Pantalla táctil capacitiva de alta visibilidad, con modos de onda, tendencias y valores respiratorios", "grupo": "Interfaz" },
    { "clave": "Alto flujo", "valor": "Terapia de oxígeno de alto flujo con compensación automática ante fugas", "grupo": "Modos de ventilación" },
    { "clave": "Conectividad", "valor": "Salida RS232 para integración con sistemas de información hospitalaria (HIS)", "grupo": "Conectividad" },
    { "clave": "Operación", "valor": "Funcionamiento silencioso, diseñado para continuidad entre UCIN, cuidados intermedios y step-down", "grupo": "Diseño" }
  ],
  "aplicaciones_es": [
    "Unidad de cuidados intensivos neonatales (UCIN)",
    "Soporte respiratorio pediátrico",
    "Cuidados intermedios y step-down neonatal",
    "Terapia de oxígeno de alto flujo neonatal/pediátrica"
  ],
  "aplicaciones_en": [
    "Neonatal intensive care unit (NICU)",
    "Pediatric respiratory support",
    "Neonatal step-down and intermediate care",
    "Neonatal/pediatric high-flow oxygen therapy"
  ],
  "beneficios_es": [
    "Soporta pacientes desde 300 gramos hasta 30 kilogramos con la misma plataforma, de la UCIN al cuidado intermedio.",
    "El control automático de FiO₂ (OxyGenie®) ayuda a mantener la SpO₂ en rango objetivo sin ajustes manuales constantes.",
    "Monitorea SpO₂ y CO₂ en el mismo equipo, dándote una lectura continua del efecto real del soporte ventilatorio.",
    "Funcionamiento silencioso y pantalla táctil de alta visibilidad, pensados para turnos largos en UCIN.",
    "Salida RS232 para integrarlo con el sistema de información de tu hospital (HIS)."
  ],
  "beneficios_en": [
    "Supports patients from 300 grams to 30 kilograms on the same platform, from the NICU to intermediate care.",
    "Automated FiO₂ control (OxyGenie®) helps keep SpO₂ within target range without constant manual adjustment.",
    "Monitors SpO₂ and CO₂ on the same device, giving you a continuous read on the real effect of respiratory support.",
    "Quiet operation and a high-visibility touchscreen, built for long NICU shifts.",
    "RS232 output to integrate with your hospital's information system (HIS)."
  ],
  "valor_es": "Un ventilador pensado para acompañar al neonato desde el momento más crítico hasta el alta, sin cambiar de plataforma.",
  "valor_en": "A ventilator designed to support the newborn from the most critical moment through to discharge, without changing platforms.",
  "ficha_pdf": "/assets/importados/equitronic/pdf/eq-ventilador-neonatal-pedriatrico-convencional-ref-6000-sle.pdf",
```

- [ ] **Step 3: Validar JSON**

```bash
python3 -c "import json; json.load(open('src/data/mock-productos.json')); print('OK')"
```

- [ ] **Step 4: Commit**

```bash
git add src/data/mock-productos.json
git commit -m "content(producto): enriquecer ficha del ventilador neonatal SLE6000"
```

---

### Task 10: Contenido del producto 5 — Máquina de Anestesia Prima Ref 460 Penlon

**Files:**

- Modify: `src/data/mock-productos.json` (entrada con `"slug": "eq-maquina-de-anestesia-prima-ref-460-penlon"`)

- [ ] **Step 1: Reemplazar/ampliar los campos**

```json
  "descripcion_larga_en": "The Penlon Prima 460 anesthesia machine integrates a wide range of ventilation modes, a large intuitive display, patient profile configuration and digital fresh gas flow display. This allows anesthesia delivery to be tailored to the specialist's needs, case criticality and patient type — adult, pediatric or neonatal.\nIts compact, heated breathing system enables low-flow delivery of anesthetic agents, reducing gas and anesthetic consumption. Designed and manufactured in the UK, the Prima 460 features a fully integrated AV-S ventilator and A200SP absorber, a Selectatec®-compatible backbar with interlock, HIS connectivity and six ventilation modes, and complies with ISO 80601-2-13 and RoHS.",
  "especificaciones": [
    { "clave": "Origen", "valor": "Diseñada y fabricada en el Reino Unido por Penlon", "grupo": "Fabricación" },
    { "clave": "Ventilador integrado", "valor": "AV-S, multifunción, para perfiles de paciente adulto y pediátrico, con tres modos avanzados de soporte espontáneo", "grupo": "Ventilación" },
    { "clave": "Modos de ventilación", "valor": "Seis modos de ventilación disponibles", "grupo": "Ventilación" },
    { "clave": "Absorbedor", "valor": "A200SP totalmente integrado con el ventilador", "grupo": "Ventilación" },
    { "clave": "Fluómetro", "valor": "Opciones de visualización de flujo electrónico y fluómetro convencional", "grupo": "Suministro de gases" },
    { "clave": "Backbar", "valor": "Compatible Selectatec®, con interlock en configuración de tres estaciones; hasta 4 cilindros", "grupo": "Suministro de gases" },
    { "clave": "Ergonomía", "valor": "Estante superior con montaje GCX™ para monitor de paciente, espacio de trabajo iluminado con superficie de escritura extraíble, cajones de gran capacidad", "grupo": "Ergonomía" },
    { "clave": "Conectividad", "valor": "Conectividad HIS para integración hospitalaria", "grupo": "Conectividad" },
    { "clave": "Normativa", "valor": "Cumple con la norma ISO 80601-2-13 y la directiva RoHS", "grupo": "Normativa" }
  ],
  "aplicaciones_es": [
    "Quirófano de cirugía general",
    "Anestesia en pacientes adultos, pediátricos y neonatales",
    "Servicios con alta rotación de quirófano que requieren configuración flexible"
  ],
  "aplicaciones_en": [
    "General surgery operating room",
    "Anesthesia for adult, pediatric and neonatal patients",
    "High-turnover surgical services requiring flexible configuration"
  ],
  "beneficios_es": [
    "Diseñada y fabricada en el Reino Unido, con ventilador (AV-S) y absorbedor (A200SP) totalmente integrados de fábrica.",
    "Seis modos de ventilación y perfiles de paciente adulto/pediátrico te permiten individualizar cada anestesia inhalada.",
    "El sistema respiratorio calefaccionado a bajos flujos reduce el consumo de gases y anestésicos por procedimiento.",
    "Estante GCX™ para tu monitor de paciente y espacio de trabajo iluminado, pensados para el flujo real de un quirófano.",
    "Cumple ISO 80601-2-13 y RoHS, con conectividad HIS para integrarse a tu hospital."
  ],
  "beneficios_en": [
    "Designed and manufactured in the UK, with a fully factory-integrated AV-S ventilator and A200SP absorber.",
    "Six ventilation modes and adult/pediatric patient profiles let you tailor every inhaled anesthetic delivery.",
    "The low-flow heated breathing system reduces gas and anesthetic consumption per procedure.",
    "GCX™ shelf for your patient monitor and an illuminated workspace, built for the real pace of an operating room.",
    "Complies with ISO 80601-2-13 and RoHS, with HIS connectivity to integrate with your hospital."
  ],
  "valor_es": "Un sistema de anestesia pensado para quirófanos con alta rotación, donde la configuración flexible y el bajo consumo de gases marcan la diferencia turno tras turno.",
  "valor_en": "An anesthesia system built for high-turnover operating rooms, where flexible configuration and low gas consumption make a difference shift after shift.",
  "ficha_pdf": "/assets/importados/equitronic/pdf/eq-maquina-de-anestesia-prima-ref-460-penlon.pdf",
```

- [ ] **Step 2: Validar JSON**

```bash
python3 -c "import json; json.load(open('src/data/mock-productos.json')); print('OK')"
```

- [ ] **Step 3: Commit**

```bash
git add src/data/mock-productos.json
git commit -m "content(producto): enriquecer ficha de la maquina de anestesia Penlon Prima 460"
```

---

### Task 11: Verificación completa (tests, build, visual)

**Files:** ninguno nuevo

- [ ] **Step 1: Ejecutar el test suite completo**

Run: `npx vitest run`
Expected: PASS, incluyendo las 3 pruebas de `datos.test.ts` (ahora las 2 primeras deben pasar porque el contenido real ya existe) y las 2 de `seo.test.ts`.

- [ ] **Step 2: Ejecutar validación completa del proyecto**

Run: `npm run validate`
Expected: PASS (lint + check + test + build sin errores).

- [ ] **Step 3: Levantar el dev server**

```bash
npm run dev &
sleep 3
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:44334/es/productos/eq-monitor-de-paciente-m12-biolight/
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:44334/en/products/eq-monitor-de-paciente-m12-biolight/
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:44334/es/productos/eq-sistema-de-hipotermia-criticool-belmont/
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:44334/es/productos/eq-ten-20-pasta-conductiva-8onz-ref-si1067-natus/
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:44334/es/productos/eq-ventilador-neonatal-pedriatrico-convencional-ref-6000-sle/
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:44334/es/productos/eq-maquina-de-anestesia-prima-ref-460-penlon/
curl -s http://localhost:44334/es/productos/eq-monitor-de-paciente-m12-biolight/ | grep -o 'ficha-tecnica\|Beneficios clave\|Aplicaciones clínicas' | sort -u
```

Expected: todos los `curl` de página devuelven `200`; el último comando confirma que el HTML renderizado contiene el enlace de descarga del PDF y los títulos de las secciones nuevas.

- [ ] **Step 4: Revisión visual con el navegador (Claude in Chrome o Playwright)**

Abrir `http://localhost:44334/es/productos/eq-monitor-de-paciente-m12-biolight/` y `http://localhost:44334/en/products/eq-monitor-de-paciente-m12-biolight/` en el navegador. Confirmar visualmente: foto real del producto en el hero (no placeholder), sección "Beneficios clave" con 5 tarjetas, sección "Especificaciones" con las 8 filas nuevas, sección "Aplicaciones clínicas", bloque de valor sin comillas ni firma de persona, botón "Descargar ficha técnica (PDF)" funcional. Repetir para al menos 1 producto más de los otros 4 (recomendado: Ten20, por ser el más distinto en tipo — consumible vs. equipo).

- [ ] **Step 5: Detener el dev server**

```bash
kill %1 2>/dev/null || true
```

- [ ] **Step 6: Commit si hubo ajustes**

Si la revisión visual (Step 4) revela un ajuste necesario (p. ej. un salto de línea raro, un dato mal escapado), corregirlo aquí y commitear:

```bash
git add -A
git commit -m "fix(producto): ajustes visuales tras verificacion del piloto"
```

Si no hay ajustes, omitir este paso (no crear un commit vacío).

---

### Task 12: Script de sincronización a Supabase (sin ejecutar contra producción todavía)

**Files:**

- Create: `scripts/sync-productos-supabase.mjs`

**Interfaces:**

- Consumes: `src/data/mock-productos.json` (los campos ya escritos en Tasks 6-10)
- Produces: script CLI reutilizable para futuros lotes (no solo el piloto) — `node scripts/sync-productos-supabase.mjs --slugs=<slug1>,<slug2> [--dry-run]`

- [ ] **Step 1: Crear el script**

```javascript
// scripts/sync-productos-supabase.mjs
// Sincroniza campos de contenido enriquecido (especificaciones, aplicaciones,
// beneficios, valor, ficha_pdf, descripcion_larga_en) desde
// src/data/mock-productos.json hacia la tabla `productos` de Supabase,
// para los slugs indicados. Solo escribe los campos de contenido — nunca
// precio, stock, disponibilidad ni campos comerciales.
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const url = process.env.PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  throw new Error('Faltan PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY');
}

const DRY_RUN = process.argv.includes('--dry-run');
const slugsArg = process.argv.find(a => a.startsWith('--slugs='));
if (!slugsArg) {
  throw new Error(
    'Uso: node scripts/sync-productos-supabase.mjs --slugs=slug1,slug2 [--dry-run]'
  );
}
const targetSlugs = new Set(slugsArg.replace('--slugs=', '').split(','));

const mockProductos = JSON.parse(
  readFileSync('src/data/mock-productos.json', 'utf8')
);
const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

let actualizados = 0;
for (const producto of mockProductos) {
  if (!targetSlugs.has(producto.slug)) continue;

  const payload = {
    especificaciones: producto.especificaciones ?? [],
    aplicaciones_es: producto.aplicaciones_es ?? [],
    aplicaciones_en: producto.aplicaciones_en ?? [],
    descripcion_larga_es: producto.descripcion_larga_es ?? '',
    descripcion_larga_en: producto.descripcion_larga_en ?? '',
    ficha_pdf: producto.ficha_pdf ?? null,
    atributos: {
      beneficios_es: producto.beneficios_es ?? [],
      beneficios_en: producto.beneficios_en ?? [],
      valor_es: producto.valor_es ?? null,
      valor_en: producto.valor_en ?? null,
    },
  };

  console.log(`${DRY_RUN ? '[dry-run] ' : ''}Actualizando ${producto.slug}...`);
  if (DRY_RUN) {
    console.log(JSON.stringify(payload, null, 2));
    actualizados += 1;
    continue;
  }

  const { error } = await supabase
    .from('productos')
    .update(payload)
    .eq('slug', producto.slug);
  if (error) {
    console.error(`Error actualizando ${producto.slug}:`, error.message);
    process.exitCode = 1;
    continue;
  }
  actualizados += 1;
}

console.log(
  `${actualizados} producto(s) ${DRY_RUN ? 'listos para actualizar' : 'actualizados'} de ${targetSlugs.size} solicitados.`
);
```

- [ ] **Step 2: Probar en modo `--dry-run` (no requiere credenciales de escritura, pero sí variables de entorno válidas de lectura; si no hay credenciales de Supabase disponibles en este entorno, este paso se puede posponer hasta tenerlas, dejando el script committeado)**

```bash
node scripts/sync-productos-supabase.mjs --slugs=eq-monitor-de-paciente-m12-biolight --dry-run
```

Expected: si hay credenciales configuradas, imprime el payload JSON del monitor M12 sin escribir nada (por el `createClient` no se usa en dry-run antes de llegar al `.update`, pero la validación de `url`/`key` al inicio del script sí requiere que existan las variables de entorno — si no están disponibles en esta sesión, dejar constancia en el mensaje de PR de que el dry-run queda pendiente para cuando se ejecute con acceso a las variables de entorno de Supabase).

- [ ] **Step 3: Commit**

```bash
git add scripts/sync-productos-supabase.mjs
git commit -m "chore(scripts): agregar sincronizador de contenido enriquecido de producto hacia Supabase"
```

- [ ] **Step 4: NO ejecutar sin `--dry-run` contra producción en esta tarea**

La ejecución real (`node scripts/sync-productos-supabase.mjs --slugs=eq-monitor-de-paciente-m12-biolight,eq-sistema-de-hipotermia-criticool-belmont,eq-ten-20-pasta-conductiva-8onz-ref-si1067-natus,eq-ventilador-neonatal-pedriatrico-convencional-ref-6000-sle,eq-maquina-de-anestesia-prima-ref-460-penlon`) queda pendiente hasta que el PR de la Task 13 esté aprobado, según el flujo de despliegue definido en el spec.

---

### Task 13: Abrir el Pull Request

**Files:** ninguno nuevo

- [ ] **Step 1: Push de la rama**

```bash
git push -u origin feature/landings-producto-piloto
```

- [ ] **Step 2: Crear el PR**

```bash
gh pr create --title "Landings enriquecidas de producto (piloto: 5 productos)" --body "$(cat <<'EOF'
## Resumen
- Enriquece 5 fichas de producto reales (Biolight M12, Belmont Criticool, Natus Ten20, SLE6000, Penlon Prima 460) con especificaciones, aplicaciones clinicas, beneficios en lenguaje persuasivo, un bloque de valor sin testimonios inventados, PDF descargable y marca real en el Product JSON-LD.
- Extiende ProductoLanding.astro con 3 secciones nuevas (Beneficios clave, Aplicaciones clinicas, Bloque de valor), reutilizando los design tokens existentes.
- Ningun dato inventado: todo el contenido nuevo esta sourced del PDF ficha de cada producto o de la descripcion_larga_es ya aprobada previamente.
- Incluye scripts/sync-productos-supabase.mjs para sincronizar estos campos a produccion tras aprobar este PR (no se ha ejecutado contra produccion todavia).

## Spec y plan
- docs/superpowers/specs/2026-07-06-landings-producto-piloto-design.md
- docs/superpowers/plans/2026-07-06-landings-producto-piloto.md

## Test plan
- [x] npx vitest run (datos.test.ts, seo.test.ts)
- [x] npm run validate
- [x] Verificacion visual ES/EN en dev server para los 5 productos
- [ ] Tras aprobar este PR: ejecutar scripts/sync-productos-supabase.mjs contra Supabase produccion para estos 5 slugs

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

Expected: PR creado, URL devuelta. **No hacer merge** — queda a la espera de revisión del usuario.

---

## Self-review

**Cobertura del spec:** contexto/objetivo (Tasks 6-10), no-migración de esquema (Task 2 usa `atributos` solo del lado Supabase, Task 12), cambios de plantilla (Task 4), flujo git/PR (Tasks 1, 13), verificación (Task 11), sincronización de datos (Task 12), SEO/marca real (Task 3). El "bloque de valor no atribuido" está cubierto en Task 4 (markup sin comillas de cita) y en el contenido real de cada producto (Tasks 6-10, campos `valor_es/en`).

**Placeholders:** ninguno — cada tarea de contenido (6-10) tiene el texto real y completo en español e inglés, no "TBD" ni "similar al anterior".

**Consistencia de tipos:** `Producto.aplicaciones/beneficios/valor/marca` (Task 2) se usan con los mismos nombres en `ProductoLanding.astro` (Task 4), `buildProductJsonLd` (Task 3) y los scripts de contenido (Tasks 6-10, 12).
