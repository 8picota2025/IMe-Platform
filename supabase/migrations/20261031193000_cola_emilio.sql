-- BORRADOR. No aplicar sin que Integrador lo despliegue.
-- Cola de correo. Solo el bot Correo (Emilio) la drena y envía.
begin;

create table if not exists public.cola_emilio (
  id uuid primary key default gen_random_uuid(),
  creado_at timestamptz not null default now(),
  solicitante text not null,
  origen text not null,
  destinatarios jsonb not null,
  asunto text not null,
  html text not null,
  referencia text,
  reply_to text,
  remitente text,
  adjuntos jsonb not null default '[]'::jsonb,
  estado text not null default 'pendiente'
    check (estado in ('pendiente', 'enviado', 'error')),
  error text
);

comment on table public.cola_emilio is
  'Solicitudes de correo. Ninguna funcion del repo envia: las encola aqui para Emilio.';

alter table public.cola_emilio enable row level security;
revoke all on table public.cola_emilio from public, anon, authenticated;
grant select, insert, update on table public.cola_emilio to service_role;

commit;
