# Design System: I-ME Product Detail (PDP)

## 1. Visual Theme & Atmosphere

A calm clinical commerce surface for Colombian B2B medical buyers — hospital procurement, biomedical engineers, and clinical leads. Gallery-airy density with restrained asymmetry: product media dominates the left plane; identity and commercial action sit on the right without nested card soup. Atmosphere is clean medical equipment catalog, not SaaS dashboard and not consumer fashion PDP. Soft off-white canvas (`#F7F9FB`), deep teal ink (`#0F4C5C`), single lime accent (`#7ED957`) for primary purchase actions only. Variance 4 · Motion 3 · Density 5.

## 2. Color Palette & Roles

- **Canvas Mist** (#F7F9FB) — Page and PDP top background
- **Pure Surface** (#FFFFFF) — Gallery frame, quote sticky panel
- **Teal 900** (#0F4C5C) — Brand ink, H1, primary outline CTAs, nav CTA
- **Teal 700** (#1A5F6E) — Active tabs, focus rings, secondary emphasis
- **Body Ink** (#1D3A47) — Primary body text
- **Muted Steel** (#456070) — Descriptions, meta labels
- **Whisper Border** (rgba(15,76,92,0.1)) — 1px structural lines
- **Lime Action** (#7ED957) — Single accent: primary buy / add-to-quote CTA only
- **Lime Pale** (rgba(126,217,87,0.12)) — Availability chip background
- **Banned:** purple/indigo neon, cyan wash backgrounds (#ECFEFF), pure black (#000), gradient text, glassmorphism

## 3. Typography Rules

- **Display / H1:** Sora — weight 800, track-tight (−0.02em), clamp(1.65rem, 2.8vw, 2.45rem), Teal 900
- **UI / Meta:** Sora or Inter — uppercase 0.78rem, letter-spacing 0.04em, Muted Steel (category + SKU)
- **Body:** Inter — 1rem, line-height 1.6, max 52–65ch
- **Price:** Sora 800, clamp(1.85rem, 3vw, 2.5rem), Teal 900 — never lime
- **Banned:** decorative serifs; emoji as icons

## 4. Component Stylings

- **Primary CTA (commerce):** Lime Action fill, Teal 900 text, height ≥48px, radius 14px, tactile translateY(1px) on active. Label: "Añadir a la cesta".
- **Secondary CTA (commerce):** Teal 900 fill, white text — "Comprar ahora".
- **Primary CTA (quote):** Lime Action — "Añadir a cotización".
- **Secondary CTA (quote):** Teal 900 fill — "Solicitar cotización ahora".
- **Gallery:** White square frame, 1px Whisper Border, radius 16px, object-fit contain, soft inset padding. Thumbs 72×72 with Teal 700 current ring. No floating badges on product photography unless real stock/cert data exists.
- **Purchase column (commerce):** Transparent — no card chrome. Price → qty → CTAs → micro-trust links in a vertical rhythm of 12–16px.
- **Quote panel:** Single elevated white surface, 1px border, radius 16px, padding 1.25–1.5rem, sticky at ≥1200px. Contains status, "Precio bajo cotización" (never invent a number), qty, dual CTAs, legal microcopy. One card only — never nest cards inside.
- **Trust signals:** Dot + text inline, not pill clusters. Availability may use one Lime Pale chip next to price.
- **Tabs:** Underline active (Teal 700). Horizontal scroll on mobile. No pill tabs.
- **Assist aside:** Ghost text + outline buttons — never compete with buy/quote CTAs.
- **IMEIA:** Closed by default on all breakpoints.
- **Empty product image:** Branded soft mist panel with centered product initials monogram (Teal 100 fill), never a blank white void.

## 5. Layout Principles

- **Commerce desktop (≥900px):** 2-col ~52% gallery | ~48% identity+purchase. Max width 1440px, padding clamp(24px, 3vw, 48px).
- **Quote desktop (≥1200px):** 3-col gallery | identity | sticky quote panel. Mid widths collapse quote under identity (2-col).
- **Mobile:** meta → H1 → gallery → purchase/quote → highlights → tabs. Touch targets ≥44px.
- No teal full-bleed hero. No 3 equal feature cards. No centered marketing hero overlay.
- First viewport budget: brand nav + breadcrumb + product media + title + short desc + price-or-quote action. No promo strips, no fake stats.

## 6. Motion & Interaction

Spring-light: opacity + translateY(8–12px) on section enter, 280–360ms, cubic-bezier(0.16, 1, 0.3, 1). Thumb switch: 150ms crossfade. CTA hover: opacity/brightness only — no layout-shifting scale. Respect `prefers-reduced-motion`. No perpetual bounce, no scroll-to-explore chevrons.

## 7. Anti-Patterns (Banned)

- No pure black, neon glow, purple gradients
- No glassmorphism / frosted panels
- No pill soup or badge clusters on hero media
- No inventing stock counts, shipping times, certifications, or prices in quote mode
- No teal hero band returning
- No emoji icons
- No "Elevate / Seamless / Unleash" copy
- No broken Unsplash placeholders — use real product images or branded empty state
