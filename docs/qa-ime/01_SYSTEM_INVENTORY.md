# Inventario del sistema

Fuente principal: `/home/shoky/cursor/ime-platform`. Discovery read-only.

- Astro 6 SSG, TypeScript estricto, Tailwind, GSAP/Lenis.
- 85 páginas Astro, 26 componentes, 76 módulos `src/lib`.
- 41 Edge Functions Supabase, 38 migraciones, capas compartidas para auth/RLS,
  CORS, rate limit, email, pagos, OCR, LLM, CRM, DIAN y telemetry.
- 36 archivos de tests detectados (Vitest y tests auxiliares).
- 40 scripts operativos: catálogo, imágenes, PDF/OCR, embeddings, SEO, canary y CRM.
- `.env` existe localmente; no se leyó su contenido. `.env.example` está versionado.
- No hay Dockerfile, Compose, unidad systemd ni nginx en repo.
- Hosting declarado: Hostinger estático por FTP. Backend: Supabase alojado.
- Cambios locales preexistentes: cinco archivos frontend modificados. No se tocaron.
