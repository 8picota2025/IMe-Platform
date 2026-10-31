import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const PRODUCCION = 'nnfbucwiasuggyfoyydo';

export function destinoE2EPermitido(url: string): void {
  if (!url.trim()) throw new Error('Falta PANEL_E2E_SUPABASE_URL');
  if (url.includes(PRODUCCION)) throw new Error('E2E contra produccion prohibido');
}

function leer(ruta: string): string {
  return readFileSync(ruta, 'utf8');
}

describe('migracion del panel', () => {
  const up = leer('supabase/migrations/20261031183000_panel_vivo.sql');
  const down = leer('supabase/rollbacks/20261031183000_panel_vivo.down.sql');

  it('panel_eventos no concede UPDATE ni DELETE y solo lo lee un admin', () => {
    expect(up).toMatch(/before update on public\.panel_eventos/);
    expect(up).toMatch(/before delete on public\.panel_eventos/);
    expect(up).toMatch(/revoke update, delete on table public\.panel_eventos/i);
    expect(up).not.toMatch(/grant update on table public\.panel_eventos/i);
    expect(up).not.toMatch(/grant delete on table public\.panel_eventos/i);
    expect(up).toMatch(/panel_eventos_select_admin/);
    expect(up).toMatch(/ap\.rol in \('admin', 'owner'\)/);
    expect(up).not.toMatch(/for update[\s\S]{0,80}panel_eventos/i);
    expect(up).not.toMatch(/for delete[\s\S]{0,80}panel_eventos/i);
  });

  it('el rollback existe y no borra cotizaciones', () => {
    expect(down).toMatch(/drop table if exists public\.panel_eventos/i);
    expect(down).toMatch(/drop table if exists public\.panel_tareas/i);
    expect(down).toMatch(/drop view if exists public\.v_panel_tarjetas/i);
    expect(down).not.toMatch(/drop table if exists public\.solicitudes_cotizacion/i);
    expect(down).toMatch(/drop table public\.solicitudes_cotizacion/);
  });

  it('publica realtime de tareas, eventos y cotizaciones', () => {
    expect(up).toMatch(/add table public\.panel_tareas/);
    expect(up).toMatch(/add table public\.panel_eventos/);
    expect(up).toMatch(/add table public\.solicitudes_cotizacion/);
  });
});

describe('cliente del panel', () => {
  it('no incluye la llave de servicio', () => {
    for (const ruta of [
      'src/admin/panel-vivo.ts',
      'src/pages/admin/panel.astro',
      'src/lib/panel-reglas.ts',
    ]) {
      const texto = leer(ruta);
      expect(texto).not.toMatch(/SERVICE_ROLE/);
      expect(texto).not.toMatch(/sb_secret_/);
      expect(texto).not.toMatch(/eyJ[A-Za-z0-9_-]{20,}/);
    }
    const edge = leer('supabase/functions/panel-accion/index.ts');
    expect(edge).toContain('getServerSupabase');
    expect(edge).toContain("rpc('aprobar_cotizacion_envio'");
    expect(edge).not.toMatch(/eyJ[A-Za-z0-9_-]{20,}/);
    expect(edge).not.toMatch(/enviar-cotizacion/);
  });
});

describe('panel-accion e2e', () => {
  it('rechaza el proyecto de produccion', () => {
    expect(() => destinoE2EPermitido(`https://${PRODUCCION}.supabase.co`)).toThrow(/prohibido/);
    expect(() => destinoE2EPermitido('https://preview-ref.supabase.co')).not.toThrow();
  });

  it.skipIf(process.env.PANEL_E2E !== '1')(
    'llama panel-accion en una rama preview y comprueba el segundo clic',
    async () => {
      const url = process.env.PANEL_E2E_SUPABASE_URL ?? '';
      destinoE2EPermitido(url);
      const anon = process.env.PANEL_E2E_ANON_KEY ?? '';
      const jwt = process.env.PANEL_E2E_JWT ?? '';
      const cotizacionId = process.env.PANEL_E2E_COTIZACION_ID ?? '';
      if (!anon || !jwt || !cotizacionId) {
        throw new Error('Faltan PANEL_E2E_ANON_KEY, PANEL_E2E_JWT o PANEL_E2E_COTIZACION_ID');
      }
      const { createClient } = await import('@supabase/supabase-js');
      const client = createClient(url, anon, {
        global: { headers: { Authorization: `Bearer ${jwt}` } },
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const cuerpo = {
        accion: 'aprobar',
        origen: 'cotizacion',
        id: cotizacionId,
        aprobacion_tipo: 'ok_shoky',
        ref: 'e2e-preview',
        confirmado: true,
      };
      const primera = await client.functions.invoke('panel-accion', { body: cuerpo });
      const segunda = await client.functions.invoke('panel-accion', { body: cuerpo });
      expect(primera.error).toBeNull();
      expect(segunda.error).toBeNull();
      expect((segunda.data as { idempotente?: boolean }).idempotente).toBe(true);
      const { data, error } = await client
        .from('solicitudes_cotizacion')
        .select('aprobado_por, aprobado_at')
        .eq('id', cotizacionId)
        .single();
      expect(error).toBeNull();
      expect(data?.aprobado_por).toBeTruthy();
      expect(data?.aprobado_at).toBeTruthy();
      const auditoria = await client
        .from('panel_eventos')
        .select('actor, ts, accion, resultado')
        .eq('tarjeta_id', cotizacionId)
        .order('ts', { ascending: false })
        .limit(3);
      expect(auditoria.error).toBeNull();
      expect(auditoria.data?.length).toBeGreaterThan(0);
      expect(auditoria.data?.[0]?.accion).toBe('aprobar');
      expect(auditoria.data?.[0]?.actor).toBeTruthy();
      expect(auditoria.data?.[0]?.ts).toBeTruthy();
    }
  );
});
