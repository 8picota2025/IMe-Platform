# Brief — Landings de producto pendientes (04-11-2026)

Repo: 8picota2025/IMe-Platform (base: origin/main @ dfa3d4f). Plantilla: docs/superpowers/specs/2026-07-06-landings-producto-piloto-design.md (pipeline de contenido, bloques "Beneficios clave" y "Bloque de valor", `atributos.beneficios_es/en`, `ficha_pdf`, SEO/AEO vía `buildProductoSeo` + `src/data/producto-seo-copy.ts`).

## 1. Lista de candidatos (verificada 04-11 21:45 COT)

| Candidato           | ¿Existe?                                                                                                     | Fuentes en 000PROVEEDORES                                                                                                                                                                                                                                                                            | Decisión                                                                                                                                                  |
| ------------------- | ------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| KEENON KLEENBOT C30 | No (no está en mock-productos.json ni en sitemaps de prod)                                                   | /home/shoky/000PROVEEDORES/KEENON/IME-Q-2026-000054_Con_Datasheets_C30_C40.pdf (cotización con datasheets: usar SOLO las páginas de datasheet, NUNCA precios); CE: KEENON/CE_UN38.3_MSDS_C30_C40/KLEENBOT C30 CE DOC.pdf; presentación: KEENON/catalogos/EN-KEENON Robotics Company Presentation.pdf | **CREAR**                                                                                                                                                 |
| KEENON KLEENBOT C40 | No                                                                                                           | Mismo PDF de datasheets; CE: KLEENBOT C40 CE DOC.pdf                                                                                                                                                                                                                                                 | **CREAR**                                                                                                                                                 |
| C40 Charging Pile   | No                                                                                                           | Sin ficha propia (solo citado en cotización xlsx)                                                                                                                                                                                                                                                    | **CREAR** como accesorio solo si el datasheet del C40 lo describe; si no, añadir como sección/accesorio dentro de la landing C40 y anotarlo como faltante |
| C40 ADP             | No                                                                                                           | Sin ficha                                                                                                                                                                                                                                                                                            | Igual que Charging Pile                                                                                                                                   |
| C40 WS              | No                                                                                                           | Sin ficha                                                                                                                                                                                                                                                                                            | Igual que Charging Pile                                                                                                                                   |
| PadBot T2           | **Sí** — /es/productos/padbot-t2-robot-educativo-social-ref-padbot-t2-padbot/ (200)                          | —                                                                                                                                                                                                                                                                                                    | Descartar                                                                                                                                                 |
| PadBot C3           | **Sí** — /es/productos/c3-robot-limpieza-autonoma-ref-c3-cleaning-robot/ (200), copy en producto-seo-copy.ts | —                                                                                                                                                                                                                                                                                                    | Descartar                                                                                                                                                 |
| docs/seo/backlog.md | Todas las fases P0/P1 "done"; solo quedan tareas ops (PSI, GSC, GMB)                                         | —                                                                                                                                                                                                                                                                                                    | Sin landings                                                                                                                                              |
| Biotronitech        | No aparece en repo ni en 000PROVEEDORES                                                                      | —                                                                                                                                                                                                                                                                                                    | **Pendiente de Arquitecto Comercial**                                                                                                                     |

**Imágenes:** no hay fotos de producto de C30/C40 en KEENON/ (solo picture.png sin identificar). Extraer imágenes embebidas del PDF de datasheets (pdfimages) y de la presentación; si no hay suficientes, dejar la galería con lo que haya y reportarlo. No usar stock.

## 2. Requisitos de cada landing

- Ficha de producto real (`src/data/mock-productos.json` + migración Supabase en `supabase/migrations/` para la tabla `productos`, sin ALTER TABLE) renderizada por `ProductoLanding.astro`, ES y EN, familia de robótica existente (ver `src/data/robotica-ingenieria.ts`).
- **Ficha técnica descargable**: PDF solo con las páginas de datasheet (sin precios ni datos de cotización) en `public/assets/productos/importados/<slug>/ficha-tecnica.pdf`, con `ficha_pdf`. Si no se puede separar sin precios, NO publicar PDF y reportarlo.
- **Formulario de cotización** (el existente del sitio) y CTA "Precio bajo cotización". **Ningún precio.**
- Diseño con Stitch y SEO al nivel de las mejores fichas actuales (title/description/h1/intro en producto-seo-copy.ts, JSON-LD Product, FAQ, párrafo citable AEO, keywords ES/EN).
- Contenido SOLO de las fichas del proveedor. Nada inventado (cifras, testimonios, reseñas).
- Sin promesas clínicas; robots sin mención a telemedicina ni telepresencia.
- Nada de Equitronic, Northern ni Monnal.
- Teléfono único: +57 313 724 7353.
- No inventar registros INVIMA (CE sí, citando el documento real).
- No prometer recursos ni PDFs que no existan.
- Vídeos: solo huecos para incrustar desde YouTube (placeholder sin URL inventada).
- Entrega: rama `feat/landings-pendientes-2026-11`, PR (no draft). **Sin merge, sin deploy, sin lanzar workflows.**

## 3. Corrección public/.htaccess (301 de Northern)

Hoy 28 reglas mandan a `/es/familias/ventiladores/` y `/en/families/ventiladores/`. Familias verificadas (200 en prod): `/es/familias/anestesia/`, `/en/families/anestesia/`, `/es/familias/monitores/`, `/en/families/monitores/`.

- **Anestesia** → atlas-n3, atlas-n5, atlas-n7, maquina-de-anestesia-atlas-n3/-n5/-n7 (y cualquier `maquina-de-anestesia-*` de Northern).
- **Monitores** → acuarius, aquarius-lite, gemini, pisces, taurus, venus, virgo, monitor-multiparametro-_, monitor-modular-multiparametro-virgo, monitor-fetal-y-materno-fm-9000, fm-9000, oximetro-aquarius-lite (`monitor-_`, `oximetro-\*`).
- **Ventiladores** (sin cambio) → crius-v6, ventilador-mecanico-crius-v6, ventilador-mecanico-crius-v6-northern.
- No tocar las reglas de fm-9000-plus, am-6000-plus, pm-\* (van a fichas Advanced). Revisar también la regla agrupada `productos/(...)` que apunta a ventiladores. Añadir/ajustar test si existe uno de redirects.

## 4. Faltantes a reportar

- Fotos de producto C30/C40.
- Fichas de C40 Charging Pile, ADP y WS.
- Datasheet C30/C40 limpio (sin precios) como PDF independiente.
- Biotronitech: pendiente de Arquitecto Comercial.
