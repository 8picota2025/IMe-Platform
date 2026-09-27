/**
 * Carga el CSV interno de proveedores.
 * Las celdas vacías y los campos ya llenos no se pisan.
 * Los contactos extraídos de notas quedan en el reporte, no se guardan.
 *
 * Lo ejecuta el operador una vez, con el service role.
 * Escribe en proveedores, proveedor_contactos y proveedor_interacciones.
 */
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import {
  mapCanvaCsvRow,
  matchExistingProveedor,
  parseCsv,
  prepareProveedorImportRow,
  type ContactSuggestion,
} from '../src/lib/proveedor-import.ts';

const CSV_PATH =
  process.env.PROVEEDORES_CSV ?? '/home/shoky/0 IME/proveedores list/proveedores-canva.csv';
const DRY_RUN = process.env.DRY_RUN === '1';
const url = process.env.PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error('Faltan PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY.');
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });

type Existing = {
  id: string;
  slug: string;
  nombre: string;
  sitio_web: string;
  contacto_email: string;
  razon_social: string | null;
  pais: string | null;
  contacto_whatsapp: string | null;
  notas: string | null;
  lifecycle_status: string | null;
  lineas_equipos: string | null;
  estado_invima: string | null;
  invima_titular: string | null;
  distribuidor_local: string | null;
  activo: boolean;
};

const FILL_KEYS = [
  'razon_social',
  'pais',
  'sitio_web',
  'contacto_email',
  'contacto_whatsapp',
  'lineas_equipos',
  'estado_invima',
  'invima_titular',
  'distribuidor_local',
] as const;

function blank(value: unknown): boolean {
  return value == null || String(value).trim() === '';
}

function shortLabel(value: string | null): string | null {
  if (!value) return null;
  const clean = value.replace(/\s+/g, ' ').trim();
  if (!clean || clean.length > 40 || clean.split(' ').length > 4) return null;
  return clean;
}

async function main(): Promise<void> {
  const rows = parseCsv(readFileSync(CSV_PATH, 'utf8'));
  const { data, error } = await supabase
    .from('proveedores')
    .select(
      'id,slug,nombre,sitio_web,contacto_email,razon_social,pais,contacto_whatsapp,notas,lifecycle_status,lineas_equipos,estado_invima,invima_titular,distribuidor_local,activo'
    )
    .limit(1000);
  if (error) throw new Error(error.message);
  const existing = (data ?? []) as Existing[];

  const report = {
    dryRun: DRY_RUN,
    filas: rows.length,
    creados: [] as string[],
    actualizados: [] as string[],
    sinCambios: [] as string[],
    rechazados: [] as string[],
    contactos: 0,
    seguimientos: 0,
    pendientesDeConfirmar: [] as Array<{
      slug: string;
      titular: string | null;
      distribuidor: string | null;
      extras: string[];
    }>,
  };

  for (const [index, row] of rows.entries()) {
    const mapped = mapCanvaCsvRow(row);
    const titular = shortLabel(mapped.invimaTitularSugerido);
    const distribuidor = shortLabel(mapped.distribuidorLocalSugerido);
    const prepared = prepareProveedorImportRow(
      {
        ...mapped.proveedor,
        invima_titular: titular,
        distribuidor_local: distribuidor,
      },
      index + 2
    );
    if (!prepared.ok) {
      report.rechazados.push(
        `fila ${index + 2}: ${prepared.errors.map(item => item.message).join(' ')}`
      );
      continue;
    }
    const payload = prepared.payload;
    const match = matchExistingProveedor(
      {
        nombre: String(payload.nombre ?? ''),
        sitio_web: String(payload.sitio_web ?? ''),
        contacto_email: String(payload.contacto_email ?? ''),
        slug: String(payload.slug ?? ''),
      },
      existing.map(item => ({
        ...item,
        sitio_web: item.sitio_web ?? '',
        contacto_email: item.contacto_email ?? '',
      }))
    );

    const extras = mapped.contactosSugeridos.map(contact =>
      [contact.nombre, contact.email, contact.whatsapp].filter(Boolean).join(' · ')
    );
    if (titular || distribuidor || extras.length) {
      report.pendientesDeConfirmar.push({
        slug: match?.slug ?? String(payload.slug ?? ''),
        titular,
        distribuidor,
        extras,
      });
    }

    if (!match) {
      const insert = {
        ...payload,
        slug: String(payload.slug),
        activo: false,
        dropship_enabled: false,
      };
      if (!DRY_RUN) {
        const { data: created, error: insertError } = await supabase
          .from('proveedores')
          .insert(insert)
          .select(
            'id,slug,nombre,sitio_web,contacto_email,razon_social,pais,contacto_whatsapp,notas,lifecycle_status,lineas_equipos,estado_invima,invima_titular,distribuidor_local,activo'
          )
          .single();
        if (insertError) {
          report.rechazados.push(`${insert.slug}: ${insertError.message}`);
          continue;
        }
        existing.push(created as Existing);
        if (await saveContact(String(created.id), mapped.contactoPrincipal)) report.contactos += 1;
        if (
          mapped.interaccion &&
          (await saveInteraction(
            String(created.id),
            mapped.interaccion.tipo,
            mapped.interaccion.resumen
          ))
        ) {
          report.seguimientos += 1;
        }
      } else {
        if (mapped.contactoPrincipal) report.contactos += 1;
        if (mapped.interaccion) report.seguimientos += 1;
      }
      report.creados.push(String(insert.slug));
      continue;
    }

    const patch: Record<string, unknown> = {};
    for (const key of FILL_KEYS) {
      const incoming = payload[key];
      if (blank(incoming) || !blank(match[key])) continue;
      patch[key] = incoming;
    }
    if (
      (match.lifecycle_status ?? 'prospect') === 'prospect' &&
      payload.lifecycle_status === 'contactado'
    ) {
      patch.lifecycle_status = 'contactado';
    }
    if (blank(match.notas) && !blank(payload.notas)) patch.notas = payload.notas;

    if (Object.keys(patch).length) {
      if (!DRY_RUN) {
        const { error: updateError } = await supabase
          .from('proveedores')
          .update(patch)
          .eq('id', match.id);
        if (updateError) {
          report.rechazados.push(`${match.slug}: ${updateError.message}`);
          continue;
        }
        Object.assign(match, patch);
      }
      report.actualizados.push(match.slug);
    } else {
      report.sinCambios.push(match.slug);
    }

    if (!DRY_RUN) {
      if (await saveContact(match.id, mapped.contactoPrincipal)) report.contactos += 1;
      if (
        mapped.interaccion &&
        (await saveInteraction(match.id, mapped.interaccion.tipo, mapped.interaccion.resumen))
      ) {
        report.seguimientos += 1;
      }
    }
  }

  console.log(JSON.stringify(report, null, 2));
}

async function saveContact(
  proveedorId: string,
  contact: ContactSuggestion | null
): Promise<boolean> {
  if (!contact || (!contact.email && !contact.telefono && !contact.whatsapp)) return false;
  const { data, error } = await supabase
    .from('proveedor_contactos')
    .select('id')
    .eq('proveedor_id', proveedorId)
    .eq('tipo', 'comercial')
    .eq('es_principal', true)
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (data) return false;
  const { error: insertError } = await supabase.from('proveedor_contactos').insert({
    proveedor_id: proveedorId,
    tipo: 'comercial',
    nombre: contact.nombre,
    cargo: contact.cargo,
    email: contact.email,
    telefono: contact.telefono,
    whatsapp: contact.whatsapp,
    es_principal: true,
    verification_status: 'pendiente',
    source_note: contact.source_note,
  });
  if (insertError) throw new Error(insertError.message);
  return true;
}

async function saveInteraction(
  proveedorId: string,
  tipo: string,
  resumen: string
): Promise<boolean> {
  if (!resumen) return false;
  const { data, error } = await supabase
    .from('proveedor_interacciones')
    .select('id')
    .eq('proveedor_id', proveedorId)
    .eq('resumen', resumen)
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (data) return false;
  const now = new Date().toISOString();
  const { error: insertError } = await supabase.from('proveedor_interacciones').insert({
    proveedor_id: proveedorId,
    fecha: now,
    tipo,
    resumen,
  });
  if (insertError) throw new Error(insertError.message);
  const { error: touchError } = await supabase
    .from('proveedores')
    .update({ ultimo_contacto_at: now })
    .eq('id', proveedorId);
  if (touchError) throw new Error(touchError.message);
  return true;
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : 'import error');
  process.exit(1);
});
