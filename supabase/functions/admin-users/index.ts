import { handleCors, getCorsHeaders } from '../_shared/cors.ts';
import { badRequest, errorResponse, internalError, unauthorized } from '../_shared/errors.ts';
import { getServerSupabase } from '../_shared/supabase-server.ts';

type AdminRole = 'owner' | 'admin' | 'catalogo' | 'ventas' | 'operaciones' | 'lectura';

interface AdminUsersRequest {
  action?: 'list' | 'upsert';
  email?: string;
  rol?: AdminRole;
  activo?: boolean;
  password?: string;
  sendInvite?: boolean;
}

interface Row {
  [key: string]: unknown;
}

const VALID_ROLES = new Set<AdminRole>([
  'owner',
  'admin',
  'catalogo',
  'ventas',
  'operaciones',
  'lectura',
]);

Deno.serve(async req => {
  const origin = req.headers.get('origin');
  const corsRes = handleCors(req);
  if (corsRes) return corsRes;
  if (req.method !== 'POST') return badRequest('Metodo no soportado', origin);

  const authHeader = req.headers.get('authorization') ?? '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!token) return unauthorized(origin);

  const supabase = getServerSupabase();

  try {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(token);
    if (userError || !user) return unauthorized(origin);

    const allowed = await canManageUsers(supabase, user.id);
    if (!allowed) {
      return errorResponse(
        {
          code: 'FORBIDDEN',
          message: 'Tu usuario no tiene permiso para gestionar accesos CMS.',
        },
        403,
        origin
      );
    }

    const body = (await req.json().catch(() => ({}))) as AdminUsersRequest;
    if (body.action === 'list') return jsonResponse(await listAdminUsers(supabase), origin);
    if (body.action !== 'upsert') return badRequest('Accion no soportada', origin);

    const email = normalizeEmail(body.email);
    const rol = body.rol ?? 'lectura';
    const activo = body.activo !== false;
    const password = typeof body.password === 'string' ? body.password.trim() : '';
    const sendInvite = body.sendInvite !== false && !password;

    if (!email) return badRequest('Email requerido', origin);
    if (!VALID_ROLES.has(rol)) return badRequest('Rol invalido', origin);
    if (password && password.length < 8)
      return badRequest('La contrasena debe tener minimo 8 caracteres', origin);

    const authUser = await ensureAuthUser(supabase, {
      email,
      password: password || null,
      sendInvite,
      rol,
      redirectTo: new URL('/admin', origin ?? 'https://i-me.com.co').toString(),
    });

    const { error: profileError } = await supabase.from('admin_profiles').upsert(
      {
        user_id: authUser.id,
        email,
        rol,
        activo,
      },
      { onConflict: 'user_id' }
    );
    if (profileError) throw profileError;

    return jsonResponse(
      {
        ok: true,
        user: {
          id: authUser.id,
          email,
          rol,
          activo,
          invited: sendInvite && !password,
        },
      },
      origin
    );
  } catch (err) {
    return internalError(err instanceof Error ? err.message : 'admin-users error', origin);
  }
});

async function canManageUsers(supabase: ReturnType<typeof getServerSupabase>, userId: string) {
  const { data, error } = await supabase
    .from('admin_profiles')
    .select('rol, activo')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  const profile = data as Row | null;
  return profile?.activo === true && (profile.rol === 'owner' || profile.rol === 'admin');
}

async function listAdminUsers(supabase: ReturnType<typeof getServerSupabase>) {
  const [{ data: profiles, error: profilesError }, authUsers] = await Promise.all([
    supabase
      .from('admin_profiles')
      .select('user_id, email, rol, activo, created_at, updated_at')
      .order('email'),
    listAllAuthUsers(supabase),
  ]);
  if (profilesError) throw profilesError;

  const authById = new Map(authUsers.map(user => [user.id, user]));
  return {
    users: ((profiles ?? []) as Row[]).map(profile => {
      const userId = String(profile.user_id ?? '');
      const auth = authById.get(userId);
      return {
        user_id: userId,
        email: String(profile.email ?? auth?.email ?? ''),
        rol: profile.rol,
        activo: profile.activo,
        created_at: profile.created_at,
        updated_at: profile.updated_at,
        auth_email: auth?.email ?? null,
        confirmed_at: auth?.confirmed_at ?? null,
        last_sign_in_at: auth?.last_sign_in_at ?? null,
        synced: Boolean(auth),
      };
    }),
  };
}

async function ensureAuthUser(
  supabase: ReturnType<typeof getServerSupabase>,
  params: {
    email: string;
    password: string | null;
    sendInvite: boolean;
    rol: AdminRole;
    redirectTo: string;
  }
) {
  const existing = await findUserByEmail(supabase, params.email);
  if (existing) {
    const { data, error } = await supabase.auth.admin.updateUserById(existing.id, {
      app_metadata: { ...(existing.app_metadata ?? {}), cms_role: params.rol },
      ...(params.password ? { password: params.password } : {}),
    });
    if (error) throw error;
    return data.user ?? existing;
  }

  if (params.password) {
    const { data, error } = await supabase.auth.admin.createUser({
      email: params.email,
      password: params.password,
      email_confirm: true,
      app_metadata: { cms_role: params.rol },
    });
    if (error) throw error;
    if (!data.user) throw new Error('Supabase Auth no devolvio usuario creado');
    return data.user;
  }

  if (params.sendInvite) {
    const { data, error } = await supabase.auth.admin.inviteUserByEmail(params.email, {
      redirectTo: params.redirectTo,
      data: {},
    });
    if (error) throw error;
    if (!data.user) throw new Error('Supabase Auth no devolvio usuario invitado');
    await supabase.auth.admin.updateUserById(data.user.id, {
      app_metadata: { cms_role: params.rol },
    });
    return data.user;
  }

  throw new Error('Debe enviarse una contrasena o activar invitacion por email');
}

async function findUserByEmail(supabase: ReturnType<typeof getServerSupabase>, email: string) {
  const users = await listAllAuthUsers(supabase);
  return users.find(user => normalizeEmail(user.email) === email) ?? null;
}

async function listAllAuthUsers(supabase: ReturnType<typeof getServerSupabase>) {
  const users = [];
  let page = 1;
  const perPage = 1000;
  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    users.push(...(data.users ?? []));
    if ((data.users ?? []).length < perPage) break;
    page += 1;
  }
  return users;
}

function normalizeEmail(email: unknown): string {
  return String(email ?? '')
    .trim()
    .toLowerCase();
}

function jsonResponse(data: unknown, origin: string | null): Response {
  return new Response(JSON.stringify(data), {
    headers: { 'Content-Type': 'application/json', ...getCorsHeaders(origin) },
  });
}
