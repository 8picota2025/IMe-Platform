import { getSupabaseClient, isSupabaseConfigured } from '../lib/supabase';
import {
  COLUMNAS,
  agruparTarjetas,
  alertasDeTarjeta,
  puedeAprobar,
  type TarjetaPanel,
} from '../lib/panel-reglas';

const root = document.getElementById('panel-app');
if (!root) throw new Error('panel-app root missing');
const app = root;

const supabase = getSupabaseClient();
let cargando = false;
let pendiente = false;
let canal: { unsubscribe: () => Promise<unknown> } | null = null;

function escapeHtml(valor: string): string {
  return valor.replace(/[&<>"']/g, caracter => {
    const mapa: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    };
    return mapa[caracter] ?? caracter;
  });
}

function texto(valor: unknown): string | null {
  if (valor == null) return null;
  const plano = String(valor).trim();
  return plano || null;
}

function comoTarjeta(fila: Record<string, unknown>): TarjetaPanel {
  const total = fila.total == null || fila.total === '' ? null : Number(fila.total);
  return {
    id: String(fila.id ?? ''),
    origen: String(fila.origen ?? ''),
    tipo: String(fila.tipo ?? ''),
    titulo: String(fila.titulo ?? ''),
    ref: texto(fila.ref),
    columna: String(fila.columna ?? ''),
    estado: texto(fila.estado),
    total: total != null && Number.isFinite(total) ? total : null,
    moneda: texto(fila.moneda),
    aprobado_por: texto(fila.aprobado_por),
    aprobado_at: texto(fila.aprobado_at),
    aprobacion_tipo: texto(fila.aprobacion_tipo),
    validez_hasta: texto(fila.validez_hasta),
    send_error: texto(fila.send_error),
    notas_internas: texto(fila.notas_internas),
    empresa: texto(fila.empresa),
    bot_dueno: texto(fila.bot_dueno),
    updated_at: texto(fila.updated_at),
  };
}

function dinero(tarjeta: TarjetaPanel): string {
  if (tarjeta.total == null) return 'Sin total';
  const monto = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 2 }).format(tarjeta.total);
  return tarjeta.moneda ? `${monto} ${tarjeta.moneda}` : monto;
}

function pintarEstado(mensaje: string, esError = false): void {
  const zona = app.querySelector<HTMLElement>('[data-estado]');
  if (!zona) return;
  zona.textContent = mensaje;
  zona.dataset.tono = esError ? 'error' : 'ok';
}

function htmlTarjeta(tarjeta: TarjetaPanel): string {
  const alertas = alertasDeTarjeta(tarjeta);
  const aprobar = puedeAprobar(tarjeta)
    ? `<button class="admin-button" type="button" data-aprobar="${escapeHtml(tarjeta.id)}" data-origen="${escapeHtml(tarjeta.origen)}">Aprobar</button>`
    : '';
  const notaTwenty =
    tarjeta.origen === 'twenty'
      ? '<p class="panel-nota">Solo lectura. Lo actualiza el bot CRM.</p>'
      : '';
  return `
    <article class="panel-card" data-id="${escapeHtml(tarjeta.id)}">
      <h3>${escapeHtml(tarjeta.titulo)}</h3>
      <p>${escapeHtml(tarjeta.empresa || tarjeta.bot_dueno || tarjeta.tipo)}</p>
      <p>${escapeHtml(dinero(tarjeta))}</p>
      <p>Estado: ${escapeHtml(tarjeta.estado || 'sin estado')}</p>
      <p>Validez: ${escapeHtml(tarjeta.validez_hasta || 'sin fecha')}</p>
      <p>Aprobacion: ${escapeHtml(tarjeta.aprobado_por || 'PENDIENTE')}</p>
      ${alertas.map(alerta => `<p class="panel-alert">${escapeHtml(alerta)}</p>`).join('')}
      ${notaTwenty}
      ${aprobar}
    </article>`;
}

function pintarTablero(tarjetas: TarjetaPanel[]): void {
  const grupos = agruparTarjetas(tarjetas);
  const columnas = COLUMNAS.map(columna => {
    const lista = grupos[columna.id];
    const cuerpo = lista.length
      ? lista.map(htmlTarjeta).join('')
      : '<p class="panel-vacio">Sin tarjetas</p>';
    return `
      <section class="panel-column" aria-labelledby="col-${columna.id}">
        <h2 id="col-${columna.id}">${escapeHtml(columna.titulo)} <span>${lista.length}</span></h2>
        ${cuerpo}
      </section>`;
  }).join('');
  const tablero = app.querySelector('[data-tablero]');
  if (tablero) tablero.innerHTML = columnas;
  app.querySelectorAll<HTMLButtonElement>('[data-aprobar]').forEach(boton => {
    boton.addEventListener('click', () => {
      const id = boton.dataset.aprobar ?? '';
      const origen = boton.dataset.origen ?? '';
      const tarjeta = tarjetas.find(item => item.id === id && item.origen === origen);
      if (tarjeta) abrirModal(tarjeta, boton);
    });
  });
}

function abrirModal(tarjeta: TarjetaPanel, disparador: HTMLButtonElement): void {
  const previa = app.querySelector('[data-dialog]');
  previa?.remove();
  const alertas = alertasDeTarjeta(tarjeta);
  const esCotizacion = tarjeta.origen === 'cotizacion';
  const dialog = document.createElement('dialog');
  dialog.className = 'panel-dialog';
  dialog.dataset.dialog = '1';
  dialog.innerHTML = `
    <form class="admin-form" data-confirmar>
      <h2>Confirmar aprobacion</h2>
      <p>Aprobar solo marca la cotizacion o encola la tarea. No envia correo, mensaje ni Telegram. El envio, si corresponde, lo hace despues Correo o IMEia dentro de la ventana 19:30–08:00 COT.</p>
      <p><strong>${escapeHtml(tarjeta.titulo)}</strong> · ${escapeHtml(dinero(tarjeta))}</p>
      <p>Validez: ${escapeHtml(tarjeta.validez_hasta || 'sin fecha')}</p>
      ${alertas.length ? `<p class="panel-alert">Alertas: ${escapeHtml(alertas.join(', '))}</p>` : '<p>Sin alertas de envio.</p>'}
      ${
        esCotizacion
          ? `<label class="admin-field">Tipo
              <select name="aprobacion_tipo" required>
                <option value="ok_shoky">OK Shoky</option>
                <option value="validacion_costeo_margen">Validacion de costeo y margen</option>
              </select>
            </label>
            <label class="admin-field">Referencia del OK
              <input name="ref" required autocomplete="off" />
            </label>
            <label class="admin-field">Margen validado (%)
              <input name="margen" inputmode="decimal" autocomplete="off" />
            </label>`
          : `<p>Se encola al bot ${escapeHtml(tarjeta.bot_dueno || 'sin dueno')}.</p>`
      }
      <div class="panel-acciones">
        <button class="admin-button admin-button--ghost" type="button" data-cerrar>Cancelar</button>
        <button class="admin-button" type="submit">Confirmar</button>
      </div>
    </form>`;
  app.append(dialog);
  const cerrar = () => {
    dialog.close();
    dialog.remove();
    disparador.focus();
  };
  dialog.querySelector('[data-cerrar]')?.addEventListener('click', cerrar);
  dialog.addEventListener('close', () => dialog.remove());
  dialog.querySelector('form')?.addEventListener('submit', event => {
    event.preventDefault();
    const form = event.currentTarget;
    if (!(form instanceof HTMLFormElement)) return;
    const data = new FormData(form);
    void enviar(tarjeta, data, form, cerrar);
  });
  if (typeof dialog.showModal === 'function') dialog.showModal();
  else dialog.setAttribute('open', '');
  dialog.querySelector<HTMLElement>('input, select, button')?.focus();
}

async function enviar(
  tarjeta: TarjetaPanel,
  data: FormData,
  form: HTMLFormElement,
  cerrar: () => void
): Promise<void> {
  if (!supabase) return;
  const boton = form.querySelector<HTMLButtonElement>('[type="submit"]');
  if (boton) {
    boton.disabled = true;
    boton.setAttribute('aria-busy', 'true');
  }
  const origen = tarjeta.origen === 'cotizacion' ? 'cotizacion' : 'tarea';
  const margenCrudo = String(data.get('margen') ?? '').trim();
  const cuerpo: Record<string, unknown> = {
    accion: 'aprobar',
    origen,
    id: tarjeta.id,
    ref: String(data.get('ref') ?? tarjeta.ref ?? '').trim(),
    confirmado: true,
  };
  if (origen === 'cotizacion') {
    cuerpo.aprobacion_tipo = String(data.get('aprobacion_tipo') ?? '');
    if (cuerpo.aprobacion_tipo === 'validacion_costeo_margen') {
      cuerpo.margen = Number(margenCrudo.replace(',', '.'));
    }
  }
  const { data: respuesta, error } = await supabase.functions.invoke('panel-accion', {
    body: cuerpo,
  });
  if (error) {
    let mensaje = error.message;
    const contexto = (error as { context?: Response }).context;
    if (contexto && typeof contexto.clone === 'function') {
      const payload = (await contexto
        .clone()
        .json()
        .catch(() => null)) as { error?: { message?: string } } | null;
      if (payload?.error?.message) mensaje = payload.error.message;
    }
    pintarEstado(mensaje, true);
    if (boton) {
      boton.disabled = false;
      boton.removeAttribute('aria-busy');
    }
    return;
  }
  const idempotente = Boolean((respuesta as { idempotente?: boolean } | null)?.idempotente);
  pintarEstado(
    idempotente ? 'Ya estaba aprobada. No se repitio la accion.' : 'Aprobacion registrada.'
  );
  cerrar();
  await cargar();
}

async function cargar(): Promise<void> {
  if (!supabase) return;
  if (cargando) {
    pendiente = true;
    return;
  }
  cargando = true;
  const { data, error } = await supabase
    .from('v_panel_tarjetas')
    .select(
      'id, origen, tipo, titulo, ref, columna, estado, total, moneda, aprobado_por, aprobado_at, aprobacion_tipo, validez_hasta, send_error, notas_internas, empresa, bot_dueno, updated_at'
    )
    .order('total', { ascending: false, nullsFirst: false });
  cargando = false;
  if (error) {
    pintarEstado(error.message, true);
  } else {
    pintarTablero((data ?? []).map(fila => comoTarjeta(fila as Record<string, unknown>)));
  }
  if (pendiente) {
    pendiente = false;
    await cargar();
  }
}

function suscribir(): void {
  if (!supabase || canal) return;
  canal = supabase
    .channel('panel-vivo')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'panel_tareas' }, () => {
      void cargar();
    })
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'panel_eventos' }, () => {
      void cargar();
    })
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'solicitudes_cotizacion' },
      () => {
        void cargar();
      }
    )
    .subscribe();
}

function shell(cuerpo: string): void {
  app.innerHTML = `
    <section class="admin-shell panel-shell">
      <header class="admin-topbar">
        <div>
          <h1>Panel vivo</h1>
          <p class="admin-meta">Aprueba o encola. No envia al cliente ni al proveedor.</p>
        </div>
        <div class="admin-toolbar">
          <a class="admin-button admin-button--ghost" href="/admin/">Volver al admin</a>
          <button class="admin-button admin-button--ghost" type="button" data-salir>Salir</button>
        </div>
      </header>
      <p class="panel-estado" data-estado role="status"></p>
      ${cuerpo}
    </section>`;
  app.querySelector('[data-salir]')?.addEventListener('click', async () => {
    if (canal) {
      await canal.unsubscribe();
      canal = null;
    }
    await supabase?.auth.signOut();
    pintarLogin();
  });
}

async function sesionLista(): Promise<void> {
  if (!supabase) return;
  const { data: nivel, error: errorNivel } =
    await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (!errorNivel && nivel?.nextLevel === 'aal2' && nivel.currentLevel !== 'aal2') {
    shell(
      '<div class="admin-alert">Tu cuenta tiene segundo factor. Completa el desafio en /admin/ y vuelve a abrir el panel.</div>'
    );
    return;
  }
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    pintarLogin();
    return;
  }
  const { data: perfil } = await supabase
    .from('admin_profiles')
    .select('rol, activo')
    .eq('user_id', user.id)
    .maybeSingle();
  const rol = String((perfil as { rol?: string; activo?: boolean } | null)?.rol ?? '');
  const activo = Boolean((perfil as { activo?: boolean } | null)?.activo);
  if (!activo || (rol !== 'admin' && rol !== 'owner')) {
    shell(
      '<div class="admin-alert">Tu usuario no tiene rol admin u owner. El servidor responde 403 si intentas aprobar.</div>'
    );
    return;
  }
  shell('<div class="panel-board" data-tablero aria-live="polite"></div>');
  suscribir();
  await cargar();
}

function pintarLogin(mensaje = ''): void {
  app.innerHTML = `
    <section class="admin-login">
      <form class="admin-login__panel admin-form" data-login>
        <div>
          <h1>Panel vivo</h1>
          <p>Acceso de admin. Aprobar no envia correos ni mensajes.</p>
        </div>
        <label class="admin-field">Email
          <input name="email" type="email" autocomplete="username" required />
        </label>
        <label class="admin-field">Contrasena
          <input name="password" type="password" autocomplete="current-password" required />
        </label>
        <button class="admin-button" type="submit">Entrar</button>
        <p class="admin-help"><a href="/admin/">Recuperar contrasena en el admin</a></p>
        <p class="panel-estado" data-estado role="status">${escapeHtml(mensaje)}</p>
      </form>
    </section>`;
  const form = app.querySelector<HTMLFormElement>('[data-login]');
  form?.addEventListener('submit', async event => {
    event.preventDefault();
    if (!supabase || !form) return;
    const data = new FormData(form);
    const { error } = await supabase.auth.signInWithPassword({
      email: String(data.get('email') ?? ''),
      password: String(data.get('password') ?? ''),
    });
    if (error) {
      pintarEstado(error.message, true);
      return;
    }
    await sesionLista();
  });
}

async function boot(): Promise<void> {
  if (!isSupabaseConfigured() || !supabase) {
    app.innerHTML =
      '<div class="admin-alert">Configura PUBLIC_SUPABASE_URL y PUBLIC_SUPABASE_ANON_KEY. El panel no incluye la llave de servicio.</div>';
    return;
  }
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) {
    pintarLogin();
    return;
  }
  await sesionLista();
}

void boot();
