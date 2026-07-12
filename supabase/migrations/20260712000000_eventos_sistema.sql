create table if not exists public.eventos_sistema (
  id bigint generated always as identity primary key,
  ts timestamptz not null default now(),
  fn text not null,              -- nombre de la edge function
  nivel text not null check (nivel in ('debug','info','warn','error')),
  evento text not null,          -- ej: 'pago_confirmado', 'webhook_firma_invalida'
  request_id text,
  duracion_ms integer,
  detalle jsonb                  -- SIN PII: ids sí, emails/teléfonos no
);
create index if not exists eventos_sistema_ts_idx on public.eventos_sistema (ts desc);
create index if not exists eventos_sistema_fn_nivel_idx on public.eventos_sistema (fn, nivel, ts desc);
alter table public.eventos_sistema enable row level security;
-- Sin policies: solo service_role (edge functions) puede leer/escribir. El cliente JAMÁS.
