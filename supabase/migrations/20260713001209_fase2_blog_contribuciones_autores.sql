create table if not exists public.articulos_propuestos (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  resumen text,
  cuerpo_md text not null,
  autor_nombre text not null,
  autor_email text not null,
  autor_tipo text not null check (autor_tipo in ('cliente', 'fabricante')),
  autor_empresa text,
  autor_nit text,
  estado text not null default 'pendiente' check (estado in ('pendiente', 'aprobado', 'rechazado')),
  motivo_rechazo text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists articulos_propuestos_estado_created_at_idx
  on public.articulos_propuestos (estado, created_at desc);

drop trigger if exists set_articulos_propuestos_updated_at on public.articulos_propuestos;
create trigger set_articulos_propuestos_updated_at
  before update on public.articulos_propuestos
  for each row execute function trigger_set_updated_at();

alter table public.articulos_propuestos enable row level security;

alter table public.articulos
  add column if not exists autor_tipo text not null default 'ime'
    check (autor_tipo in ('ime', 'cliente', 'fabricante')),
  add column if not exists autor_nombre text,
  add column if not exists autor_empresa text,
  add column if not exists autor_bio_corta text;

update public.articulos
set autor_nombre = coalesce(autor_nombre, 'I-ME International Medical Enterprise'),
    autor_tipo = coalesce(autor_tipo, 'ime')
where autor_nombre is null
   or autor_tipo is null;
