create table if not exists public.analytics_eventos (
  id bigint generated always as identity primary key,
  ts timestamptz not null default now(),
  event_name text not null check (char_length(event_name) between 2 and 80),
  session_id text not null check (char_length(session_id) between 8 and 80),
  page_path text,
  page_title text,
  referrer text,
  locale text,
  device_type text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_content text,
  utm_term text,
  duration_seconds integer check (duration_seconds is null or duration_seconds >= 0),
  scroll_depth integer check (scroll_depth is null or scroll_depth between 0 and 100),
  value numeric,
  item_count integer check (item_count is null or item_count >= 0),
  product_slug text,
  search_term text,
  properties jsonb not null default '{}'
);

create index if not exists analytics_eventos_ts_idx
  on public.analytics_eventos (ts desc);
create index if not exists analytics_eventos_event_ts_idx
  on public.analytics_eventos (event_name, ts desc);
create index if not exists analytics_eventos_page_ts_idx
  on public.analytics_eventos (page_path, ts desc);
create index if not exists analytics_eventos_session_ts_idx
  on public.analytics_eventos (session_id, ts desc);

alter table public.analytics_eventos enable row level security;

drop policy if exists "analytics_eventos_admin_select" on public.analytics_eventos;
create policy "analytics_eventos_admin_select"
  on public.analytics_eventos for select
  to authenticated
  using (is_admin(ARRAY['ventas', 'lectura']));

grant select on public.analytics_eventos to authenticated;
