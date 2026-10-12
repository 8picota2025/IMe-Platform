---
name: I-ME Admin — Backoffice Design System
colors:
  canvas: '#F4F7F9'
  surface: '#FFFFFF'
  surface-sunken: '#EEF3F5'
  sidebar: '#0B2A33'
  sidebar-ink: '#D5E4E8'
  sidebar-muted: '#8FAAB2'
  ink: '#0B1B22'
  body: '#1D3A47'
  muted: '#456070'
  line: 'rgba(15,76,92,0.12)'
  line-strong: 'rgba(15,76,92,0.22)'
  primary: '#0F4C5C'
  primary-hover: '#1A5F6E'
  primary-tint: 'rgba(15,76,92,0.07)'
  ok: '#1F7A45'
  ok-tint: 'rgba(31,122,69,0.10)'
  warn: '#9A6500'
  warn-tint: 'rgba(154,101,0,0.10)'
  danger: '#B3261E'
  danger-tint: 'rgba(179,38,30,0.08)'
  info: '#2F6FB5'
  info-tint: 'rgba(47,111,181,0.09)'
typography:
  page-title:
    fontFamily: Sora
    fontSize: 1.5rem
    fontWeight: '700'
    lineHeight: '1.2'
    letterSpacing: -0.01em
  section-title:
    fontFamily: Sora
    fontSize: 1rem
    fontWeight: '700'
    lineHeight: '1.3'
  body:
    fontFamily: Geist
    fontSize: 0.875rem
    fontWeight: '400'
    lineHeight: '1.5'
  label:
    fontFamily: Geist
    fontSize: 0.75rem
    fontWeight: '600'
    lineHeight: '1.3'
    letterSpacing: 0.02em
  metric:
    fontFamily: Geist Mono
    fontSize: 1.625rem
    fontWeight: '600'
    lineHeight: '1.1'
  data:
    fontFamily: Geist Mono
    fontSize: 0.8125rem
    fontWeight: '500'
    lineHeight: '1.4'
rounded:
  sm: 4px
  DEFAULT: 6px
  lg: 10px
spacing:
  space-1: 4px
  space-2: 8px
  space-3: 12px
  space-4: 16px
  space-6: 24px
  space-8: 32px
  sidebar: 232px
  row: 40px
---

# Design System: I-ME Admin (Backoffice)

## 1. Visual Theme & Atmosphere

A calm, clinical operations cockpit for a Colombian B2B biomedical distributor. Operators
(sales, operations, content, owner) and an AI agent work here all day: triaging quotes,
moving CRM opportunities, fulfilling orders, curating product sheets. The interface must
feel like a precise instrument panel — quiet chrome, strong data, one obvious next action.

- **Density 7 — Cockpit Balanced.** Tables and boards show many rows without scrolling;
  whitespace separates groups, not individual items.
- **Variance 2 — Predictable.** Operators build muscle memory; the same region always holds
  the same thing (title + primary action top-right, filters above data, detail in a drawer).
- **Motion 2 — Static Restrained.** 120–160ms opacity/transform transitions for drawers,
  toasts and row hover. No decorative or perpetual animation in a work tool.

Same brand family as the storefront (deep teal ink, Sora headings) so the admin reads as the
back room of the same company, not a third-party SaaS.

## 2. Color Palette & Roles

- **Canvas** (#F4F7F9) — app background behind panels.
- **Surface** (#FFFFFF) — panels, tables, drawers, form sections.
- **Surface Sunken** (#EEF3F5) — table header row, CRM column body, read-only fields.
- **Sidebar Deep Teal** (#0B2A33) with **Sidebar Ink** (#D5E4E8) and **Sidebar Muted** (#8FAAB2)
  for group labels. Active item: white text on rgba(255,255,255,0.10) with a 3px white left
  bar. The sidebar is the only dark surface.
- **Ink** (#0B1B22) — page titles, key numbers. **Body** (#1D3A47) — default text.
  **Muted** (#456070) — metadata, helper text (AA on white and canvas).
- **Line** (rgba(15,76,92,0.12)) — 1px structure. **Line Strong** (0.22) — input borders.
- **Primary Teal** (#0F4C5C) — the single accent: primary buttons, links, focus ring,
  selected tab underline, active filters. Hover #1A5F6E.
- **Semantic states** are used only as small badges, left borders or tinted row backgrounds —
  never as large fills: OK #1F7A45, Warn #9A6500, Danger #B3261E, Info #2F6FB5, each with a
  ~10% tint for badge backgrounds.
- **Banned:** beige/cream backgrounds, background gradients, pure black, purple/neon, lime as
  a button fill in the admin (lime belongs to storefront purchase CTAs only).

## 3. Typography Rules

- **Page & section titles:** Sora 700, tight tracking. Page title 1.5rem; section 1rem.
- **UI & body:** Geist 400/500/600 at 0.875rem (14px) — dense but legible; labels 0.75rem 600.
- **Numbers:** Geist Mono with tabular figures for every money amount, count, date/time,
  SKU, order reference and percentage — in tables, KPI strip, CRM cards and drawers.
- **Banned:** serif body text (Georgia/Times), Inter, all-caps paragraphs, justified text.

## 4. Component Stylings

- **Shell:** fixed 232px dark-teal sidebar with grouped nav (Catálogo, Comercial, Operaciones,
  Contenido, Sistema) and a compact user/role footer with "Salir". Main area: sticky top bar
  with page title, breadcrumb for detail pages, global search (products, clients, orders,
  quotes by reference) and "Publicar cambios" as a secondary button with a pending-changes dot.
- **Buttons:** 36px height (44px touch on mobile), 6px radius. Primary = teal fill, white text.
  Secondary = white fill, Line Strong border, teal text. Ghost = text only. Danger = white fill,
  danger border and text; destructive confirmation happens in a modal that states the effect
  ("sale del tablero y de las estadísticas; se puede restaurar") and asks for a reason.
  Active state: translateY(1px). One primary button per region.
- **KPI strip:** a single row of 4–6 metrics separated by 1px vertical lines inside one panel —
  not individual cards. Label (muted, 0.75rem) above value (Geist Mono 1.625rem). Optional
  delta badge. Each metric links to its filtered list.
- **"Hoy" work queue:** first block on the dashboard. A prioritized list; each row = type badge
  (Presupuesto, Oportunidad, Pedido, Ficha, Carrito) + title + age + one inline action button.
  Empty state: short sentence confirming nothing is pending.
- **Tables:** 40px rows, sticky header on Surface Sunken, 1px row dividers, no zebra, row hover
  primary-tint, right-aligned mono numbers, status as badges, row actions revealed on hover and
  always available in a trailing overflow menu. Bulk-select column when actions exist.
  Pagination and result count in the footer.
- **Filters:** a single horizontal bar above data: search field, 2–4 selects, active-filter chips
  with clear-all. Filters persist in the URL hash.
- **CRM board:** horizontal columns per stage (Nuevo, Contactado, Cotizando, Negociación, Ganado,
  Perdido) on Surface Sunken, header with count and mono total value. Cards are compact read
  views: title, account · contact, mono value + probability, next-action date (warn colour when
  overdue), priority badge, Twenty sync dot. Clicking a card opens a **right drawer (480px)**
  with the full edit form, activity timeline, source link, email/WhatsApp, "Guardar y sync
  Twenty" (primary) and "Eliminar" (danger, bottom). Deleted opportunities live in a collapsed
  "Eliminadas" section with "Restaurar".
- **Detail pages (pedido, cotización, cliente, producto):** two columns — main content (sections
  as panels with section titles) and a 320px right rail with status, next step card
  ("Siguiente paso: Validar comprobante" + the button that does it), key facts, and the
  actions/audit log (actor, tool, time) including agent actions.
- **Forms:** label above input, helper below, error below in danger. Long forms split into
  titled sections with an in-page section index on the left; sticky bottom save bar showing
  unsaved-changes state. Inputs 36px, 6px radius, Line Strong border, teal focus ring 2px.
- **Badges:** 20px pill, tint background + semantic text colour, 0.75rem 600.
- **Drawers & modals:** Surface, 10px radius (modals), single soft shadow
  (0 12px 32px rgba(11,27,34,0.14)), scrim rgba(11,27,34,0.35).
- **Toasts:** bottom-right, ink background, white text, action link optional, auto-dismiss 4s.
- **Loading:** skeleton rows/cards matching final layout. No spinners in content areas.
- **Empty states:** one sentence explaining what fills this view + the primary action to do it.

## 5. Layout Principles

- CSS grid shell: `232px | 1fr`. Content max-width 1440px, 24px gutters.
- Page anatomy, always in this order: top bar (title + primary action) → filters → KPI strip
  (lists only when useful) → data (table/board) → secondary panels.
- Detail pages: `1fr | 320px` grid; rail collapses under content below 1200px.
- Below 960px the sidebar becomes an off-canvas menu; tables become stacked row cards;
  CRM board scrolls horizontally per column with snap. No horizontal page scroll.

## 6. Motion & Interaction

- Drawer slide-in 160ms ease-out (transform), modal fade/scale 140ms, row hover 80ms.
- Keyboard: `/` focuses global search, `Esc` closes drawer/modal, visible focus rings always.
- Respect `prefers-reduced-motion` (no transforms, instant state changes).

## 7. Anti-Patterns (Banned)

- No emojis in UI. No decorative icons without labels.
- No beige/cream canvases, no gradients, no glassmorphism, no pure black, no neon.
- No card-per-metric grids; no nested cards; no 3 equal feature cards.
- No full edit forms inside kanban cards — edit in the drawer.
- No serif body text; no Inter.
- No invented data in comps: use realistic Colombian B2B biomedical examples (clinic names like
  "Clínica del Norte", products like "Monitor de signos vitales", COP amounts).
- No AI copy clichés ("potencia", "sin fisuras", "next-gen").
