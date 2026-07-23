/**
 * Autenticación del SPA comercial: login, logout, recuperación de
 * contraseña y expiración de sesión por inactividad. Reutiliza los mismos
 * patrones de `src/admin/admin-app.ts` (líneas ~190-500) sobre
 * `supabase.auth.signInWithPassword` / `resetPasswordForEmail` /
 * `exchangeCodeForSession`.
 */
import type { Session } from '@supabase/supabase-js';
import { supabase, escapeHtml, toast } from './shared';

const IDLE_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutos
const IDLE_CHECK_INTERVAL_MS = 30 * 1000;
const IDLE_ACTIVITY_EVENTS: Array<keyof DocumentEventMap> = [
  'mousemove',
  'mousedown',
  'keydown',
  'touchstart',
  'scroll',
  'click',
];

export type RecoveryParams = {
  code: string | null;
  searchType: string | null;
  hashType: string | null;
  hasAccessToken: boolean;
};

function recoveryParams(): RecoveryParams {
  const search = new URLSearchParams(location.search);
  const hash = new URLSearchParams(location.hash.substring(1));
  return {
    code: search.get('code'),
    searchType: search.get('type'),
    hashType: hash.get('type'),
    hasAccessToken: hash.has('access_token'),
  };
}

export function isRecoveryFlow(): boolean {
  const params = recoveryParams();
  return Boolean(
    params.code ||
    params.searchType === 'recovery' ||
    params.hashType === 'recovery' ||
    params.hasAccessToken
  );
}

function authRedirectUrl(): string {
  return new URL(location.pathname, window.location.origin).toString();
}

export interface AuthFlowCallbacks {
  /** Se invoca con la sesión activa (o null) una vez resueltos los flujos especiales. */
  onSessionReady: (session: Session | null) => void | Promise<void>;
  /** Se invoca cuando llega un enlace de recuperación de contraseña. */
  onRecovery: () => void;
}

let recoveryHandled = false;

/**
 * Resuelve el arranque de autenticación: detecta enlaces de recuperación
 * (código PKCE o hash implícito), y en caso contrario resuelve la sesión
 * normal. Debe llamarse una sola vez al iniciar la app.
 */
export async function initAuthFlow(callbacks: AuthFlowCallbacks): Promise<void> {
  if (!supabase) {
    await callbacks.onSessionReady(null);
    return;
  }

  supabase.auth.onAuthStateChange(event => {
    if (event === 'PASSWORD_RECOVERY') {
      recoveryHandled = true;
      history.replaceState(null, '', location.pathname);
      callbacks.onRecovery();
    }
  });

  const params = recoveryParams();
  if (!isRecoveryFlow()) {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    await callbacks.onSessionReady(session);
    return;
  }

  // Limpia solo la sesión local antes de canjear el enlace de recuperación,
  // así el enlace siempre resuelve en la sesión de recuperación esperada.
  await supabase.auth.signOut({ scope: 'local' });

  if (params.code) {
    const { error } = await supabase.auth.exchangeCodeForSession(params.code);
    history.replaceState(null, '', location.pathname);
    if (error) {
      toast(error.message, 'error');
      await callbacks.onSessionReady(null);
      return;
    }
    recoveryHandled = true;
    callbacks.onRecovery();
    return;
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (session) {
    history.replaceState(null, '', location.pathname);
    recoveryHandled = true;
    callbacks.onRecovery();
    return;
  }
  await callbacks.onSessionReady(session);
}

export function wasRecoveryHandled(): boolean {
  return recoveryHandled;
}

export function clearRecoveryFlag(): void {
  recoveryHandled = false;
}

export async function getCurrentSession(): Promise<Session | null> {
  if (!supabase) return null;
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session;
}

export async function signOut(): Promise<void> {
  await supabase?.auth.signOut();
}

/* ------------------------------------------------------------------ */
/* Renderizado de pantallas de acceso                                 */
/* ------------------------------------------------------------------ */

export function renderLoginPanel(
  app: HTMLElement,
  prefillEmail = '',
  onSuccess?: () => void
): void {
  app.innerHTML = `
    <section class="comercial-auth">
      <form class="comercial-auth__panel comercial-form" data-login novalidate>
        <div class="comercial-auth__brand">
          <span class="comercial-auth__mark" aria-hidden="true">I·ME</span>
          <h1>Portal Comercial</h1>
          <p>Catálogo biomédico para el equipo de ventas de I-ME.</p>
        </div>
        <label class="comercial-field">
          <span>Email</span>
          <input name="email" type="email" autocomplete="email" required value="${escapeHtml(prefillEmail)}" />
        </label>
        <label class="comercial-field">
          <span>Contraseña</span>
          <input name="password" type="password" autocomplete="current-password" required />
        </label>
        <button class="comercial-button comercial-button--primary" type="submit">Entrar</button>
        <button class="comercial-button comercial-button--link" type="button" data-show-reset>
          ¿Olvidaste tu contraseña?
        </button>
        <p class="comercial-help">Acceso exclusivo para el equipo comercial. Solicita tu cuenta al administrador.</p>
      </form>
    </section>`;

  const form = app.querySelector<HTMLFormElement>('[data-login]');
  form?.addEventListener('submit', async event => {
    event.preventDefault();
    if (!supabase) {
      toast('Supabase no configurado.', 'error');
      return;
    }
    const submitBtn = form.querySelector<HTMLButtonElement>('button[type="submit"]');
    const data = new FormData(form);
    const email = String(data.get('email') ?? '').trim();
    const password = String(data.get('password') ?? '');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Entrando…';
    }
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Entrar';
    }
    if (error) {
      const raw = error.message || '';
      const friendly = /failed to fetch|networkerror|load failed|fetch/i.test(raw)
        ? 'No se pudo conectar con Supabase. Prueba ventana de incógnito o Ctrl+Shift+R (service worker/caché).'
        : raw;
      toast(friendly, 'error');
      return;
    }
    clearRecoveryFlag();
    onSuccess?.();
  });

  app.querySelector('[data-show-reset]')?.addEventListener('click', () => {
    const emailInput = form?.querySelector<HTMLInputElement>('input[name="email"]');
    renderPasswordReset(app, emailInput?.value ?? '');
  });
}

export function renderPasswordReset(app: HTMLElement, prefillEmail = ''): void {
  app.innerHTML = `
    <section class="comercial-auth">
      <form class="comercial-auth__panel comercial-form" data-reset-form novalidate>
        <div class="comercial-auth__brand">
          <h1>Restablecer contraseña</h1>
          <p>Escribe tu email y te enviaremos un enlace para restablecerla.</p>
        </div>
        <label class="comercial-field">
          <span>Email</span>
          <input name="email" type="email" autocomplete="email" required value="${escapeHtml(prefillEmail)}" />
        </label>
        <button class="comercial-button comercial-button--primary" type="submit" data-reset-btn>Enviar enlace</button>
        <button class="comercial-button comercial-button--link" type="button" data-back-login>Volver al acceso</button>
      </form>
    </section>`;

  const form = app.querySelector<HTMLFormElement>('[data-reset-form]');
  const btn = form?.querySelector<HTMLButtonElement>('[data-reset-btn]');
  form?.addEventListener('submit', async event => {
    event.preventDefault();
    if (!supabase) return;
    const email = String(new FormData(form).get('email') ?? '').trim();
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Enviando…';
    }
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: authRedirectUrl(),
    });
    if (error) {
      toast(error.message, 'error');
      if (btn) {
        btn.disabled = false;
        btn.textContent = 'Enviar enlace';
      }
      return;
    }
    app.innerHTML = `
      <section class="comercial-auth">
        <div class="comercial-auth__panel comercial-form">
          <h1>Enlace enviado</h1>
          <p>Si <strong>${escapeHtml(email)}</strong> tiene una cuenta comercial, recibirá el enlace para restablecer su contraseña. Revisa también la carpeta de spam.</p>
          <button class="comercial-button comercial-button--link" type="button" data-back-login>Volver al acceso</button>
        </div>
      </section>`;
    app
      .querySelector('[data-back-login]')
      ?.addEventListener('click', () => renderLoginPanel(app, email));
  });
  app
    .querySelector('[data-back-login]')
    ?.addEventListener('click', () => renderLoginPanel(app, prefillEmail));
}

export function renderNewPassword(app: HTMLElement, onDone: () => void): void {
  app.innerHTML = `
    <section class="comercial-auth">
      <form class="comercial-auth__panel comercial-form" data-new-password-form novalidate>
        <div class="comercial-auth__brand">
          <h1>Nueva contraseña</h1>
          <p>Elige una contraseña segura para tu cuenta comercial.</p>
        </div>
        <label class="comercial-field">
          <span>Nueva contraseña</span>
          <input name="password" type="password" autocomplete="new-password" required minlength="8" />
        </label>
        <label class="comercial-field">
          <span>Confirmar contraseña</span>
          <input name="confirm" type="password" autocomplete="new-password" required minlength="8" />
        </label>
        <button class="comercial-button comercial-button--primary" type="submit" data-save-btn>Guardar contraseña</button>
      </form>
    </section>`;

  const form = app.querySelector<HTMLFormElement>('[data-new-password-form]');
  const btn = form?.querySelector<HTMLButtonElement>('[data-save-btn]');
  form?.addEventListener('submit', async event => {
    event.preventDefault();
    if (!supabase) return;
    const data = new FormData(form);
    const password = String(data.get('password') ?? '');
    const confirm = String(data.get('confirm') ?? '');
    if (password !== confirm) {
      toast('Las contraseñas no coinciden', 'error');
      return;
    }
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Guardando…';
    }
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      toast(error.message, 'error');
      if (btn) {
        btn.disabled = false;
        btn.textContent = 'Guardar contraseña';
      }
      return;
    }
    clearRecoveryFlag();
    toast('Contraseña actualizada.', 'success');
    onDone();
  });
}

/* ------------------------------------------------------------------ */
/* Expiración de sesión por inactividad (15 min)                      */
/* ------------------------------------------------------------------ */

export interface IdleWatcher {
  stop: () => void;
}

/**
 * Cierra la sesión tras 15 minutos sin actividad del usuario (mouse,
 * teclado, scroll, touch) o al volver de una pestaña oculta si el tiempo
 * transcurrido supera el umbral (evita depender solo de setTimeout, que
 * puede pausarse en segundo plano).
 */
export function startIdleWatch(onIdleTimeout: () => void): IdleWatcher {
  let lastActivity = Date.now();
  let warned = false;

  const registerActivity = () => {
    lastActivity = Date.now();
    warned = false;
  };

  const checkIdle = () => {
    const elapsed = Date.now() - lastActivity;
    if (elapsed >= IDLE_TIMEOUT_MS) {
      onIdleTimeout();
      return;
    }
    if (!warned && elapsed >= IDLE_TIMEOUT_MS - 60_000) {
      warned = true;
      toast('Tu sesión se cerrará en 1 minuto por inactividad.', 'info');
    }
  };

  for (const evt of IDLE_ACTIVITY_EVENTS) {
    document.addEventListener(evt, registerActivity, { passive: true });
  }
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') checkIdle();
  });

  const interval = window.setInterval(checkIdle, IDLE_CHECK_INTERVAL_MS);

  return {
    stop: () => {
      window.clearInterval(interval);
      for (const evt of IDLE_ACTIVITY_EVENTS) {
        document.removeEventListener(evt, registerActivity);
      }
    },
  };
}
