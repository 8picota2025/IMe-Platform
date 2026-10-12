# PDP Page Overrides — I-ME

> **PROJECT:** I-ME
> **Page Type:** Product Detail (commerce | quote)
> Overrides `design-system/i-me/MASTER.md`

---

## Design read

Medical equipment e-commerce PDP for B2B / clinical buyers.
Language: clinical precision + commercial clarity.
Dials: `DESIGN_VARIANCE=3` · `MOTION_INTENSITY=2` · `VISUAL_DENSITY=7`

## Brand lock

- Keep existing I-ME tokens (`--t900`, `--green`, Sora + Inter).
- Do not adopt MASTER cyan background (`#ECFEFF`) or Figtree/Noto.
- Surfaces: `#F7F9FB` page, white gallery, transparent purchase column (no nested card soup).

## Layout

| Mode          | Desktop                                   | Mobile                                                    |
| ------------- | ----------------------------------------- | --------------------------------------------------------- |
| commerce      | ~52% gallery \| ~48% identity+purchase    | stack: meta → H1 → gallery → purchase → highlights → tabs |
| quote ≥1200px | gallery \| identity \| sticky quote panel | stack: meta → H1 → gallery → quote panel → tabs           |

Container max: **1440px**. Spacing rhythm: 4/8/12/16/24/32/48.

## Hierarchy

Category/SKU → H1 → short desc → trust signals (not pills) → **price / precio bajo cotización** → qty → primary CTA → secondary CTA → trust microcopy.

## Components

- Gallery: `object-fit: contain`, stable ratio, thumb `aria-current`, lightbox from main image only.
- Highlights: max 4, icon + short phrase under gallery.
- Assist aside: secondary (ghost buttons). Never compete with buy/quote CTAs.
- Tabs: only with content; horizontal scroll on mobile; underline active.
- IMEIA: **CLOSED** by default on all breakpoints.
- Sticky mobile: commerce `$precio | Añadir`; quote `Solicitar cotización ahora`.

## Anti-patterns

No glassmorphism, gradient overload, pill soup, nested cards, emoji icons, decorative motion, inventing stock/certifications/shipping claims.
