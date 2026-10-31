-- Base minima para probar el alcance sobre Postgres 16, sin la base real.
-- Supabase ya trae estos roles y el esquema extensions; aqui se fabrican.

create schema if not exists extensions;
create schema if not exists auth;

create or replace function auth.role()
returns text
language sql
stable
as $$
  select nullif(current_setting('request.jwt.claim.role', true), '');
$$;

do $$ begin
  create role anon nologin noinherit;
exception when duplicate_object then null;
end $$;
do $$ begin
  create role authenticated nologin noinherit;
exception when duplicate_object then null;
end $$;
do $$ begin
  create role service_role nologin noinherit;
exception when duplicate_object then null;
end $$;

grant usage on schema public to anon, authenticated, service_role;

create table if not exists public.whatsapp_inbound_events (
  id uuid primary key default gen_random_uuid(),
  status text,
  agent_claimed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_error text
);

create table if not exists public.asesor_agent_turns (
  id uuid primary key default gen_random_uuid(),
  status text,
  mensaje text,
  historial jsonb,
  locale text,
  navigation_context jsonb,
  session_id text,
  conversation_id text,
  reply_texto text,
  error text,
  agent_claimed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.fail_whatsapp_batch(p_id uuid, p_error text, p_retry boolean)
returns void
language plpgsql
as $$ begin
  return;
end $$;

create extension if not exists vector;

create table if not exists public.productos (
  id uuid primary key default gen_random_uuid(),
  sku text,
  nombre_es text,
  descripcion_corta_es text,
  descripcion_larga_es text,
  aplicaciones_es text[],
  especificaciones jsonb,
  activo boolean not null default true,
  updated_at timestamptz not null default now()
);

create or replace function public.producto_fuente_hash(p public.productos)
returns text
language sql
immutable
as $$
  select md5(concat_ws('|', p.nombre_es, p.sku, p.descripcion_corta_es, p.descripcion_larga_es,
    array_to_string(p.aplicaciones_es, ';'), p.especificaciones::text, 'v1'));
$$;

create table if not exists public.producto_chunks (
  id bigserial primary key,
  producto_id uuid,
  sku text,
  orden integer,
  nivel text,
  contenido text,
  tokens_aprox integer,
  fuente_hash text,
  modelo text,
  embedding vector(1024)
);

create table if not exists public.rag_embed_config (
  id integer primary key,
  url text not null,
  token text not null,
  activo boolean not null default true,
  timeout_ms integer not null default 1500,
  actualizado_at timestamptz not null default now()
);
