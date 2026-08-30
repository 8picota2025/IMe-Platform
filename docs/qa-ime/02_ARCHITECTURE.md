# Arquitectura encontrada

```mermaid
flowchart TD
 U[Usuario] --> A[Hostinger: Astro estático]
 A --> C[Catálogo / CMS público / formularios]
 C --> S[Supabase Data API + Auth + Storage]
 S --> E[Edge Functions]
 E --> P[Wompi / Stripe]
 E --> M[Mailer / CRM Twenty / DIAN / LLM / Voyage]
 G[GitHub Actions] --> A
 G --> E
 G --> S
```

Astro genera HTML estático con rutas ES/EN, producto, familia, fabricante,
ciudad, conocimiento y legal. Escrituras sensibles pasan por Edge Functions con
`service_role`; frontend usa claves públicas. Integraciones externas están
configuradas por variables y no fueron invocadas durante esta auditoría.

Punto crítico: build es estático; datos de CMS/Supabase deben estar disponibles o
la estrategia fallback puede producir contenido no actualizado.
