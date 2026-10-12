# Script de enriquecimiento con Hermes — solo uso local

`scripts/enrich-product-locale-fields-hermes.mjs` es una herramienta **manual y local** para
rellenar campos de producto por locale usando la API OpenAI-compatible del perfil Hermes
`biomedsvc` (VPS srv1715444, `127.0.0.1:8001`, modelo `imeia`).

- **No** forma parte de ninguna Edge Function, del chat web IMEIA ni de WhatsApp.
- **No** se ejecuta en CI y sus variables **no** van a GitHub Secrets ni a Supabase.
- Desde 2026-10 Hermes ya no expone la API 8001 de forma permanente (servicio
  `imeia-hermes` retirado). Para usar el script, levántala temporalmente en el VPS:

  ```bash
  hermes -p biomedsvc gateway run   # expone 127.0.0.1:8001 según profiles/biomedsvc/.env
  ```

- Variables (en tu shell local, nunca en git):
  - `PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
  - `IMEIA_API_URL` (por defecto `http://127.0.0.1:8001`), `IMEIA_API_KEY`
    (si falta, se lee de `~/.hermes/profiles/biomedsvc/.env`), `IMEIA_MODEL` (por defecto `imeia`)
- Ejecuta primero con `--dry-run`. No inventes precios, stock ni registros INVIMA: revisa la salida.
