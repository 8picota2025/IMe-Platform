# Taxonomía: autoasignar tipos, eliminar familia/tipo, y campos obligatorios — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a bulk "autoasignar tipos por familia" action, delete buttons for familias/tipos (blocked while dependents exist), a new "Productos sin familia" panel, and mandatory familia+tipo validation on product save — all inside the existing admin SPA (`src/admin/admin-app.ts`).

**Architecture:** Extract the new business logic as pure, dependency-free functions in a new sibling module `src/admin/taxonomia-logic.ts` (unit-testable with vitest, no DOM/Supabase). `admin-app.ts` keeps doing what it already does: fetch rows via `selectRows`/`selectRowsWhere`, call the pure functions to decide what to do, then perform the actual `supabase.from(...).insert/update/delete` calls and DOM rendering — same pattern as every other feature already in that file.

**Tech Stack:** TypeScript, Astro (client-side admin SPA bundle), Supabase JS client, vitest.

**Spec:** `docs/superpowers/specs/2026-07-02-taxonomia-familia-tipo-design.md`

---

## Task 1: Pure logic module — autoasignar tipos por familia

**Files:**

- Create: `src/admin/taxonomia-logic.ts`
- Test: `src/admin/taxonomia-logic.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/admin/taxonomia-logic.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import { planificarAutoasignacionTipos } from './taxonomia-logic';

const familias = [
  {
    id: 'fam-1',
    slug: 'mobiliario',
    nombre_es: 'Mobiliario Hospitalario',
    nombre_en: 'Hospital Furniture',
  },
  {
    id: 'fam-2',
    slug: 'monitores',
    nombre_es: 'Monitores de Signos Vitales',
    nombre_en: null,
  },
];

describe('planificarAutoasignacionTipos', () => {
  it('devuelve plan vacio si no hay productos pendientes', () => {
    const productos = [
      { id: 'p1', familia_id: 'fam-1', tipo_id: 'tipo-existente' },
    ];
    const tipos = [
      { id: 'tipo-existente', familia_id: 'fam-1', nombre_es: 'Camillas' },
    ];
    const plan = planificarAutoasignacionTipos(productos, tipos, familias);
    expect(plan.actualizacionesDirectas).toEqual([]);
    expect(plan.tiposACrear).toEqual([]);
  });

  it('ignora productos sin familia_id', () => {
    const productos = [{ id: 'p1', familia_id: null, tipo_id: null }];
    const plan = planificarAutoasignacionTipos(productos, [], familias);
    expect(plan.actualizacionesDirectas).toEqual([]);
    expect(plan.tiposACrear).toEqual([]);
  });

  it('ignora productos con familia_id huerfano (sin familia real)', () => {
    const productos = [
      { id: 'p1', familia_id: 'fam-inexistente', tipo_id: null },
    ];
    const plan = planificarAutoasignacionTipos(productos, [], familias);
    expect(plan.actualizacionesDirectas).toEqual([]);
    expect(plan.tiposACrear).toEqual([]);
  });

  it('usa el tipo existente cuyo nombre_es coincide con el de la familia', () => {
    const productos = [
      { id: 'p1', familia_id: 'fam-1', tipo_id: null },
      { id: 'p2', familia_id: 'fam-1', tipo_id: null },
    ];
    const tipos = [
      {
        id: 'tipo-generico',
        familia_id: 'fam-1',
        nombre_es: 'Mobiliario Hospitalario',
      },
      { id: 'tipo-otro', familia_id: 'fam-1', nombre_es: 'Camillas' },
    ];
    const plan = planificarAutoasignacionTipos(productos, tipos, familias);
    expect(plan.tiposACrear).toEqual([]);
    expect(plan.actualizacionesDirectas).toEqual([
      { tipoId: 'tipo-generico', productoIds: ['p1', 'p2'] },
    ]);
  });

  it('crea un tipo nuevo con los datos de la familia si no existe uno homonimo', () => {
    const productos = [{ id: 'p1', familia_id: 'fam-2', tipo_id: null }];
    const plan = planificarAutoasignacionTipos(productos, [], familias);
    expect(plan.actualizacionesDirectas).toEqual([]);
    expect(plan.tiposACrear).toEqual([
      {
        familiaId: 'fam-2',
        productoIds: ['p1'],
        tipo: {
          familia_id: 'fam-2',
          slug: 'monitores',
          nombre_es: 'Monitores de Signos Vitales',
          nombre_en: null,
          orden: 0,
          activo: true,
        },
      },
    ]);
  });

  it('agrupa varios productos pendientes de familias distintas en entradas separadas', () => {
    const productos = [
      { id: 'p1', familia_id: 'fam-1', tipo_id: null },
      { id: 'p2', familia_id: 'fam-2', tipo_id: null },
    ];
    const plan = planificarAutoasignacionTipos(productos, [], familias);
    expect(plan.tiposACrear).toHaveLength(2);
    expect(plan.tiposACrear.map(t => t.familiaId).sort()).toEqual([
      'fam-1',
      'fam-2',
    ]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/admin/taxonomia-logic.test.ts`
Expected: FAIL — `Cannot find module './taxonomia-logic'` (file doesn't exist yet).

- [ ] **Step 3: Write the implementation**

Create `src/admin/taxonomia-logic.ts`:

```typescript
export interface FamiliaRow {
  id: string;
  slug: string;
  nombre_es: string;
  nombre_en: string | null;
}

export interface TipoRow {
  id: string;
  familia_id: string;
  nombre_es: string;
}

export interface ProductoTaxonomiaRow {
  id: string;
  familia_id: string | null;
  tipo_id: string | null;
}

export interface TipoACrear {
  familia_id: string;
  slug: string;
  nombre_es: string;
  nombre_en: string | null;
  orden: number;
  activo: boolean;
}

export interface PlanAutoasignacion {
  actualizacionesDirectas: Array<{ tipoId: string; productoIds: string[] }>;
  tiposACrear: Array<{
    familiaId: string;
    tipo: TipoACrear;
    productoIds: string[];
  }>;
}

/**
 * Regla: cada producto sin tipo (pero con familia) se asigna al tipo de su
 * misma familia cuyo nombre_es sea identico al nombre_es de la familia. Si
 * no existe ese tipo todavia, se propone crearlo con los datos de la familia.
 */
export function planificarAutoasignacionTipos(
  productos: ProductoTaxonomiaRow[],
  tipos: TipoRow[],
  familias: FamiliaRow[]
): PlanAutoasignacion {
  const porFamilia = new Map<string, string[]>();
  for (const producto of productos) {
    if (producto.tipo_id || !producto.familia_id) continue;
    const lista = porFamilia.get(producto.familia_id) ?? [];
    lista.push(producto.id);
    porFamilia.set(producto.familia_id, lista);
  }

  const actualizacionesDirectas: PlanAutoasignacion['actualizacionesDirectas'] =
    [];
  const tiposACrear: PlanAutoasignacion['tiposACrear'] = [];

  for (const [familiaId, productoIds] of porFamilia) {
    const familia = familias.find(f => f.id === familiaId);
    if (!familia) continue;
    const tipoExistente = tipos.find(
      t => t.familia_id === familiaId && t.nombre_es === familia.nombre_es
    );
    if (tipoExistente) {
      actualizacionesDirectas.push({ tipoId: tipoExistente.id, productoIds });
    } else {
      tiposACrear.push({
        familiaId,
        productoIds,
        tipo: {
          familia_id: familiaId,
          slug: familia.slug,
          nombre_es: familia.nombre_es,
          nombre_en: familia.nombre_en,
          orden: 0,
          activo: true,
        },
      });
    }
  }

  return { actualizacionesDirectas, tiposACrear };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/admin/taxonomia-logic.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add src/admin/taxonomia-logic.ts src/admin/taxonomia-logic.test.ts
git commit -m "feat(admin): planificar autoasignacion de tipos por nombre de familia"
```

---

## Task 2: Pure logic — bloqueo de borrado de familia/tipo con dependientes

**Files:**

- Modify: `src/admin/taxonomia-logic.ts`
- Modify: `src/admin/taxonomia-logic.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `src/admin/taxonomia-logic.test.ts`:

```typescript
import {
  mensajeBloqueoEliminarFamilia,
  mensajeBloqueoEliminarTipo,
} from './taxonomia-logic';

describe('mensajeBloqueoEliminarFamilia', () => {
  it('devuelve null cuando no hay tipos ni productos asociados', () => {
    expect(mensajeBloqueoEliminarFamilia(0, 0)).toBeNull();
  });

  it('bloquea y explica cuantos tipos/productos hay cuando existen dependientes', () => {
    expect(mensajeBloqueoEliminarFamilia(3, 12)).toBe(
      'No se puede eliminar: tiene 3 tipos y 12 productos asociados. Reasigna primero.'
    );
  });

  it('bloquea aunque solo haya tipos y cero productos', () => {
    expect(mensajeBloqueoEliminarFamilia(1, 0)).toBe(
      'No se puede eliminar: tiene 1 tipos y 0 productos asociados. Reasigna primero.'
    );
  });
});

describe('mensajeBloqueoEliminarTipo', () => {
  it('devuelve null cuando no hay productos asociados', () => {
    expect(mensajeBloqueoEliminarTipo(0)).toBeNull();
  });

  it('bloquea y explica cuantos productos hay asociados', () => {
    expect(mensajeBloqueoEliminarTipo(5)).toBe(
      'No se puede eliminar: tiene 5 productos asociados. Reasigna primero.'
    );
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/admin/taxonomia-logic.test.ts`
Expected: FAIL — `mensajeBloqueoEliminarFamilia is not exported`

- [ ] **Step 3: Write the implementation**

Append to `src/admin/taxonomia-logic.ts`:

```typescript
export function mensajeBloqueoEliminarFamilia(
  tiposCount: number,
  productosCount: number
): string | null {
  if (tiposCount === 0 && productosCount === 0) return null;
  return `No se puede eliminar: tiene ${tiposCount} tipos y ${productosCount} productos asociados. Reasigna primero.`;
}

export function mensajeBloqueoEliminarTipo(
  productosCount: number
): string | null {
  if (productosCount === 0) return null;
  return `No se puede eliminar: tiene ${productosCount} productos asociados. Reasigna primero.`;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/admin/taxonomia-logic.test.ts`
Expected: PASS (11 tests)

- [ ] **Step 5: Commit**

```bash
git add src/admin/taxonomia-logic.ts src/admin/taxonomia-logic.test.ts
git commit -m "feat(admin): bloquear borrado de familia/tipo con dependientes"
```

---

## Task 3: Pure logic — familia y tipo obligatorios al guardar producto

**Files:**

- Modify: `src/admin/taxonomia-logic.ts`
- Modify: `src/admin/taxonomia-logic.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `src/admin/taxonomia-logic.test.ts`:

```typescript
import { validarFamiliaYTipoProducto } from './taxonomia-logic';

describe('validarFamiliaYTipoProducto', () => {
  it('devuelve null cuando familia_id y tipo_id son strings no vacios', () => {
    expect(
      validarFamiliaYTipoProducto({ familia_id: 'fam-1', tipo_id: 'tipo-1' })
    ).toBeNull();
  });

  it('bloquea cuando falta familia_id', () => {
    expect(
      validarFamiliaYTipoProducto({ familia_id: null, tipo_id: 'tipo-1' })
    ).toBe('Familia y tipo son obligatorios para guardar el producto.');
  });

  it('bloquea cuando falta tipo_id', () => {
    expect(
      validarFamiliaYTipoProducto({ familia_id: 'fam-1', tipo_id: null })
    ).toBe('Familia y tipo son obligatorios para guardar el producto.');
  });

  it('bloquea cuando ambos son string vacio', () => {
    expect(validarFamiliaYTipoProducto({ familia_id: '', tipo_id: '' })).toBe(
      'Familia y tipo son obligatorios para guardar el producto.'
    );
  });

  it('bloquea cuando faltan las claves por completo', () => {
    expect(validarFamiliaYTipoProducto({})).toBe(
      'Familia y tipo son obligatorios para guardar el producto.'
    );
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/admin/taxonomia-logic.test.ts`
Expected: FAIL — `validarFamiliaYTipoProducto is not exported`

- [ ] **Step 3: Write the implementation**

Append to `src/admin/taxonomia-logic.ts`:

```typescript
export function validarFamiliaYTipoProducto(payload: {
  familia_id?: unknown;
  tipo_id?: unknown;
}): string | null {
  const familiaId =
    typeof payload.familia_id === 'string' ? payload.familia_id : '';
  const tipoId = typeof payload.tipo_id === 'string' ? payload.tipo_id : '';
  if (!familiaId || !tipoId) {
    return 'Familia y tipo son obligatorios para guardar el producto.';
  }
  return null;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/admin/taxonomia-logic.test.ts`
Expected: PASS (16 tests)

- [ ] **Step 5: Commit**

```bash
git add src/admin/taxonomia-logic.ts src/admin/taxonomia-logic.test.ts
git commit -m "feat(admin): validar familia y tipo obligatorios al guardar producto"
```

---

## Task 4: Wire "Autoasignar tipos faltantes" button into the admin UI

**Files:**

- Modify: `src/admin/admin-app.ts:1` (imports)
- Modify: `src/admin/admin-app.ts:1076-1078` (button in `taxonomiaView`)
- Modify: `src/admin/admin-app.ts:2927-2955` (`bindTaxonomy`, add click handler)

- [ ] **Step 1: Add the import**

In `src/admin/admin-app.ts`, right after the existing imports at the top of the file:

```typescript
import { getSupabaseClient, isSupabaseConfigured } from '../lib/supabase';
import { renderMarkdown } from '../lib/markdown';
import * as XLSX from 'xlsx';
import {
  planificarAutoasignacionTipos,
  mensajeBloqueoEliminarFamilia,
  mensajeBloqueoEliminarTipo,
  validarFamiliaYTipoProducto,
  type FamiliaRow,
  type TipoRow,
  type ProductoTaxonomiaRow,
} from './taxonomia-logic';
```

(This single import statement covers Tasks 4, 5 and 7 — added once here so later tasks don't need to touch the import block again.)

- [ ] **Step 2: Add the button to `taxonomiaView`**

Find this block (current lines 1076-1078):

```typescript
    <section class="admin-panel admin-taxonomy-unassigned">
      <div class="admin-panel__head"><h2>Productos sin tipo asignado (${productosSinTipo.length})</h2></div>
      ${
```

Replace with:

```typescript
    <section class="admin-panel admin-taxonomy-unassigned">
      <div class="admin-panel__head">
        <h2>Productos sin tipo asignado (${productosSinTipo.length})</h2>
        <button class="admin-button" type="button" data-autoasignar-tipos>Autoasignar tipos faltantes</button>
      </div>
      ${
```

- [ ] **Step 3: Add the click handler in `bindTaxonomy`**

Find the end of `bindTaxonomy` (current lines 2927-2955):

```typescript
function bindTaxonomy() {
  app.querySelectorAll<HTMLFormElement>('[data-simple-form]').forEach(form => {
    form.addEventListener('submit', async event => {
      event.preventDefault();
      const tableName = form.dataset['table'];
      const fields = form.dataset['fields']?.split(',') ?? [];
      if (!tableName) return;
      const data = new FormData(form);
      const payload: Row = {};
      for (const fieldName of fields) {
        const element = form.elements.namedItem(fieldName);
        if (
          element instanceof HTMLInputElement &&
          element.type === 'checkbox'
        ) {
          payload[fieldName] = element.checked;
        } else if (fieldName === 'orden') {
          payload[fieldName] = numberOrZero(data.get(fieldName));
        } else {
          payload[fieldName] = emptyToNull(data.get(fieldName));
        }
      }
      const { error } = await supabase!.from(tableName).insert(payload);
      if (error) {
        toast(error.message);
        return;
      }
      toast('Registro creado');
      await render();
    });
  });
}
```

Replace with (adds the new handler after the existing `forEach` block, inside the same function):

```typescript
function bindTaxonomy() {
  app.querySelectorAll<HTMLFormElement>('[data-simple-form]').forEach(form => {
    form.addEventListener('submit', async event => {
      event.preventDefault();
      const tableName = form.dataset['table'];
      const fields = form.dataset['fields']?.split(',') ?? [];
      if (!tableName) return;
      const data = new FormData(form);
      const payload: Row = {};
      for (const fieldName of fields) {
        const element = form.elements.namedItem(fieldName);
        if (
          element instanceof HTMLInputElement &&
          element.type === 'checkbox'
        ) {
          payload[fieldName] = element.checked;
        } else if (fieldName === 'orden') {
          payload[fieldName] = numberOrZero(data.get(fieldName));
        } else {
          payload[fieldName] = emptyToNull(data.get(fieldName));
        }
      }
      const { error } = await supabase!.from(tableName).insert(payload);
      if (error) {
        toast(error.message);
        return;
      }
      toast('Registro creado');
      await render();
    });
  });

  app
    .querySelector<HTMLButtonElement>('[data-autoasignar-tipos]')
    ?.addEventListener('click', async () => {
      const [familiasRows, tiposRows, productosRows] = await Promise.all([
        selectRows('familias', 'id,slug,nombre_es,nombre_en', 'orden', 200),
        selectRows('tipos', 'id,familia_id,nombre_es', 'orden', 300),
        selectRows('productos', 'id,familia_id,tipo_id', 'nombre_es', 500),
      ]);
      const familias: FamiliaRow[] = familiasRows.map(f => ({
        id: text(f.id),
        slug: text(f.slug),
        nombre_es: text(f.nombre_es),
        nombre_en: emptyStringToNull(text(f.nombre_en)),
      }));
      const tipos: TipoRow[] = tiposRows.map(t => ({
        id: text(t.id),
        familia_id: text(t.familia_id),
        nombre_es: text(t.nombre_es),
      }));
      const productos: ProductoTaxonomiaRow[] = productosRows.map(p => ({
        id: text(p.id),
        familia_id: emptyStringToNull(text(p.familia_id)),
        tipo_id: emptyStringToNull(text(p.tipo_id)),
      }));
      const plan = planificarAutoasignacionTipos(productos, tipos, familias);
      if (
        plan.actualizacionesDirectas.length === 0 &&
        plan.tiposACrear.length === 0
      ) {
        toast('No hay productos pendientes.');
        return;
      }

      let productosActualizados = 0;
      let tiposCreados = 0;

      for (const entrada of plan.tiposACrear) {
        const { data, error } = await supabase!
          .from('tipos')
          .insert(entrada.tipo)
          .select('id')
          .single();
        if (error) {
          toast(error.message);
          await render();
          return;
        }
        tiposCreados += 1;
        const nuevoTipoId = text((data as Row).id);
        const { error: updateError } = await supabase!
          .from('productos')
          .update({ tipo_id: nuevoTipoId })
          .in('id', entrada.productoIds);
        if (updateError) {
          toast(updateError.message);
          await render();
          return;
        }
        productosActualizados += entrada.productoIds.length;
      }

      for (const entrada of plan.actualizacionesDirectas) {
        const { error } = await supabase!
          .from('productos')
          .update({ tipo_id: entrada.tipoId })
          .in('id', entrada.productoIds);
        if (error) {
          toast(error.message);
          await render();
          return;
        }
        productosActualizados += entrada.productoIds.length;
      }

      toast(
        `${productosActualizados} productos actualizados, ${tiposCreados} tipos creados.`
      );
      await render();
    });
}
```

- [ ] **Step 4: Typecheck**

Run: `npm run check`
Expected: no new TypeScript errors (this only adds code, doesn't touch existing types).

- [ ] **Step 5: Commit**

```bash
git add src/admin/admin-app.ts
git commit -m "feat(admin): boton autoasignar tipos faltantes por familia"
```

---

## Task 5: Delete buttons for familias and tipos (blocked while dependents exist)

**Files:**

- Modify: `src/admin/admin-app.ts` (`taxonomiaView` table columns)
- Modify: `src/admin/admin-app.ts` (`bindTaxonomy`, add two click handlers)

- [ ] **Step 1: Add "Acciones" column to the familias table**

In `taxonomiaView`, find:

```typescript
        ${table(
          ['Slug', 'Nombre', 'Estado'],
          familias.map(r => [text(r.slug), text(r.nombre_es), status(r.activo)])
        )}
```

Replace with:

```typescript
        ${table(
          ['Slug', 'Nombre', 'Estado', 'Acciones'],
          familias.map(r => [
            text(r.slug),
            text(r.nombre_es),
            status(r.activo),
            `<button class="admin-button admin-button--danger" type="button" data-delete-familia="${escapeHtml(text(r.id))}">Eliminar</button>`,
          ])
        )}
```

- [ ] **Step 2: Add "Acciones" column to the tipos table**

Find:

```typescript
        ${table(
          ['Slug', 'Nombre', 'Productos', 'Estado'],
          tipos.map(r => [
            text(r.slug),
            text(r.nombre_es),
            String(conteoPorTipo.get(text(r.id)) ?? 0),
            status(r.activo),
          ])
        )}
```

Replace with:

```typescript
        ${table(
          ['Slug', 'Nombre', 'Productos', 'Estado', 'Acciones'],
          tipos.map(r => [
            text(r.slug),
            text(r.nombre_es),
            String(conteoPorTipo.get(text(r.id)) ?? 0),
            status(r.activo),
            `<button class="admin-button admin-button--danger" type="button" data-delete-tipo="${escapeHtml(text(r.id))}">Eliminar</button>`,
          ])
        )}
```

- [ ] **Step 3: Add the two delete handlers in `bindTaxonomy`**

At the end of `bindTaxonomy` (right after the `[data-autoasignar-tipos]` handler added in Task 4, still inside the same function, before its closing `}`):

```typescript
app
  .querySelectorAll<HTMLButtonElement>('[data-delete-familia]')
  .forEach(button => {
    button.addEventListener('click', async () => {
      const id = button.dataset['deleteFamilia'];
      if (!id) return;
      const [tiposDependientes, productosDependientes] = await Promise.all([
        selectRowsWhere('tipos', 'id', 'orden', { familia_id: id }, 1000),
        selectRowsWhere(
          'productos',
          'id',
          'nombre_es',
          { familia_id: id },
          1000
        ),
      ]);
      const bloqueo = mensajeBloqueoEliminarFamilia(
        tiposDependientes.length,
        productosDependientes.length
      );
      if (bloqueo) {
        toast(bloqueo);
        return;
      }
      if (!confirm('Eliminar familia?')) return;
      const { error } = await supabase!.from('familias').delete().eq('id', id);
      if (error) toast(error.message);
      await render();
    });
  });

app
  .querySelectorAll<HTMLButtonElement>('[data-delete-tipo]')
  .forEach(button => {
    button.addEventListener('click', async () => {
      const id = button.dataset['deleteTipo'];
      if (!id) return;
      const productosDependientes = await selectRowsWhere(
        'productos',
        'id',
        'nombre_es',
        { tipo_id: id },
        1000
      );
      const bloqueo = mensajeBloqueoEliminarTipo(productosDependientes.length);
      if (bloqueo) {
        toast(bloqueo);
        return;
      }
      if (!confirm('Eliminar tipo?')) return;
      const { error } = await supabase!.from('tipos').delete().eq('id', id);
      if (error) toast(error.message);
      await render();
    });
  });
```

- [ ] **Step 4: Typecheck**

Run: `npm run check`
Expected: no new TypeScript errors.

- [ ] **Step 5: Commit**

```bash
git add src/admin/admin-app.ts
git commit -m "feat(admin): eliminar familia/tipo bloqueado si hay dependientes"
```

---

## Task 6: New "Productos sin familia" section

**Files:**

- Modify: `src/admin/admin-app.ts` (`taxonomiaView`)

- [ ] **Step 1: Track products missing familia_id**

Find (current lines 1024-1032):

```typescript
const productosSinTipo: Row[] = [];
for (const producto of productos) {
  const tipoId = text(producto.tipo_id);
  if (!tipoId) {
    productosSinTipo.push(producto);
    continue;
  }
  conteoPorTipo.set(tipoId, (conteoPorTipo.get(tipoId) ?? 0) + 1);
}
```

Replace with:

```typescript
const productosSinTipo: Row[] = [];
const productosSinFamilia: Row[] = [];
for (const producto of productos) {
  const tipoId = text(producto.tipo_id);
  if (!tipoId) {
    productosSinTipo.push(producto);
  } else {
    conteoPorTipo.set(tipoId, (conteoPorTipo.get(tipoId) ?? 0) + 1);
  }
  if (!text(producto.familia_id)) {
    productosSinFamilia.push(producto);
  }
}
```

- [ ] **Step 2: Render the new section**

The generic closing pattern (`.join('')` + `}` + `</section>`) repeats dozens of
times in this file, so anchor on the full, unique "sin tipo asignado" block
instead of just its tail. Find this entire block (current lines 1076-1101):

```typescript
    <section class="admin-panel admin-taxonomy-unassigned">
      <div class="admin-panel__head">
        <h2>Productos sin tipo asignado (${productosSinTipo.length})</h2>
        <button class="admin-button" type="button" data-autoasignar-tipos>Autoasignar tipos faltantes</button>
      </div>
      ${
        productosSinTipo.length === 0
          ? '<p class="admin-help admin-taxonomy-empty">Todos los productos tienen tipo asignado.</p>'
          : productosSinTipo
              .map(
                p => `
        <form class="admin-taxonomy-assign" data-reasignar-form>
          <input type="hidden" name="producto_id" value="${escapeHtml(text(p.id))}" />
          <div class="admin-taxonomy-product">
            <span>Producto</span>
            <strong>${escapeHtml(text(p.nombre_es))}</strong>
            <small>${escapeHtml(text(p.slug))}</small>
          </div>
          <div class="admin-taxonomy-assign__fields">
            ${select('familia_id', 'Familia', text(p.familia_id), familias, 'nombre_es', true)}
            ${select('tipo_id', 'Tipo', '', tiposParaSelect, 'nombre_es', true)}
          </div>
          <button class="admin-button" type="submit">Reasignar</button>
        </form>`
              )
              .join('')
      }
    </section>`;
}
```

(Note: this block already includes the `data-autoasignar-tipos` button from Task 4 —
this task runs after Task 4, so that button must already be present. If executing
Task 6 out of order, adjust the anchor to match whatever the block looks like at
that point.)

Replace with:

```typescript
    <section class="admin-panel admin-taxonomy-unassigned">
      <div class="admin-panel__head">
        <h2>Productos sin tipo asignado (${productosSinTipo.length})</h2>
        <button class="admin-button" type="button" data-autoasignar-tipos>Autoasignar tipos faltantes</button>
      </div>
      ${
        productosSinTipo.length === 0
          ? '<p class="admin-help admin-taxonomy-empty">Todos los productos tienen tipo asignado.</p>'
          : productosSinTipo
              .map(
                p => `
        <form class="admin-taxonomy-assign" data-reasignar-form>
          <input type="hidden" name="producto_id" value="${escapeHtml(text(p.id))}" />
          <div class="admin-taxonomy-product">
            <span>Producto</span>
            <strong>${escapeHtml(text(p.nombre_es))}</strong>
            <small>${escapeHtml(text(p.slug))}</small>
          </div>
          <div class="admin-taxonomy-assign__fields">
            ${select('familia_id', 'Familia', text(p.familia_id), familias, 'nombre_es', true)}
            ${select('tipo_id', 'Tipo', '', tiposParaSelect, 'nombre_es', true)}
          </div>
          <button class="admin-button" type="submit">Reasignar</button>
        </form>`
              )
              .join('')
      }
    </section>
    <section class="admin-panel admin-taxonomy-unassigned">
      <div class="admin-panel__head"><h2>Productos sin familia (${productosSinFamilia.length})</h2></div>
      ${
        productosSinFamilia.length === 0
          ? '<p class="admin-help admin-taxonomy-empty">Todos los productos tienen familia asignada.</p>'
          : productosSinFamilia
              .map(
                p => `
        <form class="admin-taxonomy-assign" data-reasignar-form>
          <input type="hidden" name="producto_id" value="${escapeHtml(text(p.id))}" />
          <div class="admin-taxonomy-product">
            <span>Producto</span>
            <strong>${escapeHtml(text(p.nombre_es))}</strong>
            <small>${escapeHtml(text(p.slug))}</small>
          </div>
          <div class="admin-taxonomy-assign__fields">
            ${select('familia_id', 'Familia', '', familias, 'nombre_es', true)}
            ${select('tipo_id', 'Tipo', text(p.tipo_id), tiposParaSelect, 'nombre_es', true)}
          </div>
          <button class="admin-button" type="submit">Reasignar</button>
        </form>`
              )
              .join('')
      }
    </section>`;
}
```

Note: this reuses the existing `data-reasignar-form` markup and the existing `bindReasignacion()` handler (lines 2906-2925) unchanged — no new JS binding needed, since that handler already updates both `familia_id` and `tipo_id` from whatever the form contains.

- [ ] **Step 3: Typecheck**

Run: `npm run check`
Expected: no new TypeScript errors.

- [ ] **Step 4: Commit**

```bash
git add src/admin/admin-app.ts
git commit -m "feat(admin): seccion productos sin familia asignada"
```

---

## Task 7: Require familia + tipo when saving a product (main form + inline row save)

**Files:**

- Modify: `src/admin/admin-app.ts` (`bindProductForm`, current lines 2870-2884)
- Modify: `src/admin/admin-app.ts` (`bindProductList`, current lines 2679-2699)

- [ ] **Step 1: Validate in the main product form submit handler**

Find (current lines 2870-2884):

```typescript
  form.addEventListener('submit', async event => {
    event.preventDefault();
    const payload = productPayload(form);
    const id = String(new FormData(form).get('id') ?? '');
    if (id) {
      const { error } = await supabase!.from('productos').update(payload).eq('id', id);
      if (error) {
        toast(error.message);
        return;
      }
      if (payload['activo']) await generarEmbeddingProducto(id);
      toast('Producto guardado');
      location.hash = '#/productos';
      return;
    }
```

Replace with:

```typescript
  form.addEventListener('submit', async event => {
    event.preventDefault();
    const payload = productPayload(form);
    const errorValidacion = validarFamiliaYTipoProducto(payload);
    if (errorValidacion) {
      toast(errorValidacion);
      return;
    }
    const id = String(new FormData(form).get('id') ?? '');
    if (id) {
      const { error } = await supabase!.from('productos').update(payload).eq('id', id);
      if (error) {
        toast(error.message);
        return;
      }
      if (payload['activo']) await generarEmbeddingProducto(id);
      toast('Producto guardado');
      location.hash = '#/productos';
      return;
    }
```

- [ ] **Step 2: Validate in the inline product-row save handler**

Find (current lines 2679-2699):

```typescript
function bindProductList() {
  app.querySelectorAll<HTMLButtonElement>('[data-product-row-save]').forEach(button => {
    button.addEventListener('click', async () => {
      const id = button.dataset['productRowSave'];
      if (!id) return;
      try {
        button.disabled = true;
        button.textContent = 'Guardando...';
        const payload = productInlinePayload(id);
        const { error } = await supabase!.from('productos').update(payload).eq('id', id);
        if (error) throw error;
        if (payload['activo']) await generarEmbeddingProducto(id);
        toast('Producto actualizado');
        await render();
      } catch (error) {
        toast(error instanceof Error ? error.message : 'No se pudo guardar el producto');
      } finally {
        button.disabled = false;
        button.textContent = 'Guardar';
      }
    });
  });
```

Replace with:

```typescript
function bindProductList() {
  app.querySelectorAll<HTMLButtonElement>('[data-product-row-save]').forEach(button => {
    button.addEventListener('click', async () => {
      const id = button.dataset['productRowSave'];
      if (!id) return;
      try {
        button.disabled = true;
        button.textContent = 'Guardando...';
        const payload = productInlinePayload(id);
        const errorValidacion = validarFamiliaYTipoProducto(payload);
        if (errorValidacion) {
          toast(errorValidacion);
          return;
        }
        const { error } = await supabase!.from('productos').update(payload).eq('id', id);
        if (error) throw error;
        if (payload['activo']) await generarEmbeddingProducto(id);
        toast('Producto actualizado');
        await render();
      } catch (error) {
        toast(error instanceof Error ? error.message : 'No se pudo guardar el producto');
      } finally {
        button.disabled = false;
        button.textContent = 'Guardar';
      }
    });
  });
```

- [ ] **Step 3: Confirm the PDF-ingestion path is untouched**

Run: `grep -n "activo: false" src/admin/admin-app.ts | head -5`
Expected: the ingestion creation code (separate function, not `bindProductForm`/`bindProductList`) still creates drafts with `activo: false` and no familia/tipo requirement — this task must NOT have touched that function. Confirm by checking `git diff src/admin/admin-app.ts` only shows the two hunks from Steps 1 and 2.

- [ ] **Step 4: Typecheck**

Run: `npm run check`
Expected: no new TypeScript errors.

- [ ] **Step 5: Commit**

```bash
git add src/admin/admin-app.ts
git commit -m "feat(admin): familia y tipo obligatorios al guardar producto"
```

---

## Task 8: Full validation pass and manual verification checklist

**Files:** none (verification only)

- [ ] **Step 1: Run the full validate pipeline**

Run: `npm run validate`
Expected: lint, typecheck, vitest (all `src/admin/taxonomia-logic.test.ts` tests plus the rest of the suite), and build all pass with no errors.

- [ ] **Step 2: Write the manual verification checklist**

Since there is no working Supabase admin login in this environment (the credentials tried in this session were rejected — "Invalid login credentials"), the following must be checked manually by the user once they have valid `/admin` access, before considering this feature done in production:

```markdown
## Checklist de verificacion manual (admin real)

- [ ] Entrar a /admin y abrir la vista "Taxonomia".
- [ ] Pulsar "Autoasignar tipos faltantes" con al menos un producto sin tipo:
      confirmar el toast con el conteo, y que el producto desaparece de
      "Productos sin tipo asignado".
- [ ] Pulsar "Autoasignar tipos faltantes" una segunda vez sin productos
      pendientes: confirmar el toast "No hay productos pendientes."
- [ ] Intentar eliminar una familia CON tipos/productos asociados: confirmar
      que se bloquea con el mensaje de conteo y nada se borra.
- [ ] Crear una familia de prueba sin tipos ni productos y eliminarla:
      confirmar que se borra tras el confirm().
- [ ] Repetir ambos casos (bloqueo y borrado exitoso) para un tipo.
- [ ] Abrir "Productos sin familia": si hay alguno, reasignar familia+tipo
      y confirmar que desaparece de ambas listas ("sin familia" y "sin tipo").
- [ ] Editar un producto existente y borrar la seleccion de tipo (dejar
      "Sin asignar"): confirmar que "Guardar" no persiste el cambio y
      muestra el toast "Familia y tipo son obligatorios...".
- [ ] Repetir la misma prueba desde el guardado inline en la lista de
      productos (boton "Guardar" por fila).
- [ ] Confirmar que la ingesta PDF sigue permitiendo crear un borrador
      (activo=false) con familia/tipo "Sin asignar", sin bloqueo.
```

- [ ] **Step 3: Final commit (if the checklist markdown above needs to live in the repo)**

If the user wants this checklist committed as a permanent QA doc rather than left in the plan:

```bash
git add docs/superpowers/plans/2026-07-02-taxonomia-familia-tipo.md
git commit -m "docs: checklist de verificacion manual para taxonomia admin"
```

(Skip this step if the checklist embedded in this plan file is considered sufficient.)
