# I-ME MCP — Client guide for external AI agents (v1)

Public, read-mostly MCP surface of the I-ME catalog (B2B medical equipment, Colombia).
Role: **client**. No administrative, content-editing, user, backup, configuration or
metrics tool exists on this server: they are not part of its code bundle.

## Endpoint

|                   |                                                                                     |
| ----------------- | ----------------------------------------------------------------------------------- |
| URL               | `https://nnfbucwiasuggyfoyydo.supabase.co/functions/v1/mcp-cliente`                 |
| Transport         | MCP Streamable HTTP, **stateless** (one JSON-RPC message per `POST`, JSON response) |
| Protocol versions | `2025-11-25`, `2025-06-18`, `2025-03-26`                                            |
| Required headers  | `Content-Type: application/json`, `Accept: application/json, text/event-stream`     |
| Optional header   | `Authorization: Bearer <client_token>` (alternative to the `client_token` argument) |
| Health            | `GET …/mcp-cliente/health`                                                          |

Server-side agents only. Requests carrying an `Origin` header (browsers) get `403`;
there is no CORS. Batches (JSON arrays) are rejected. Max body 64 KB.

Generic MCP client config:

```json
{
  "mcpServers": {
    "ime-cliente": {
      "url": "https://nnfbucwiasuggyfoyydo.supabase.co/functions/v1/mcp-cliente"
    }
  }
}
```

## Flow

1. Browse freely: `v1_client_list_catalog`, `v1_client_search_catalog`.
2. Before a datasheet, quote or contact request, ask the **human** for their details and
   their consent, then call `v1_client_register_client`. Store the returned
   `client_token` (valid 30 days) as a secret.
3. Pass `client_token` on every protected call. Without it, protected tools answer
   `status: 401`, `code: "UNAUTHORIZED"`, `next_step: "v1_client_register_client"`.

## Tools

All inputs reject unknown fields (`additionalProperties: false`). Every result is JSON
in `content[0].text` (also `structuredContent`) with `ok: true|false`. Full JSON
schemas are returned by `tools/list` (`inputSchema`, `outputSchema`, `annotations`).

| Tool                          | Auth  | Purpose                                                                                                                                             |
| ----------------------------- | ----- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `v1_client_list_catalog`      | —     | Paginated active catalog. `family?` slug, `limit` 1-50 (20), `offset` 0-5000, `locale` `es`/`en`                                                    |
| `v1_client_search_catalog`    | —     | Full-text search. `query` 2-120 chars, `limit` 1-25 (10), `locale`                                                                                  |
| `v1_client_register_client`   | —     | `name`, `email`, `company`, `phone`, `country?` (ISO-2), `agent_name?`, `data_processing_consent: true` → `client_id`, `client_token`, `expires_at` |
| `v1_client_get_product_sheet` | token | `slug` → private signed PDF link `sheet_url` (expires in **10 min**)                                                                                |
| `v1_client_request_quote`     | token | `idempotency_key`, `items[{slug, quantity 1-9999}]` (1-50), `message?` ≤2000, `city?`, `locale` → `request_id`                                      |
| `v1_client_request_contact`   | token | `idempotency_key`, `message` 10-2000, `product_slug?`, `city?`, `locale` → `request_id`                                                             |

Product object (catalog tools): `slug`, `sku`, `name`, `summary`, `family`,
`purchase_mode` (`online_purchase` · `quote_required` · `personalized_attention`),
`public_price_cop` (public web price, COP, VAT included; `null` = quote required),
`availability` (`in_stock` · `out_of_stock` · `on_backorder` · `unavailable`), `url`,
`image_url`, `has_product_sheet`.

Quotes and contacts are always linked to the **registered** contact: name, email,
company and phone cannot be overridden per request. I-ME sales are notified
internally; I-ME does not email the address automatically.

### Examples (synthetic data)

Search:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "v1_client_search_catalog",
    "arguments": { "query": "silla de ruedas", "limit": 3 }
  }
}
```

```json
{
  "ok": true,
  "query": "silla de ruedas",
  "products": [
    {
      "slug": "example-wheelchair",
      "sku": null,
      "name": "Silla de ruedas ejemplo",
      "summary": "…",
      "family": "movilidad",
      "purchase_mode": "quote_required",
      "public_price_cop": null,
      "availability": "in_stock",
      "url": "https://i-me.com.co/es/productos/example-wheelchair/",
      "image_url": "https://i-me.com.co/assets/productos/example.webp",
      "has_product_sheet": true
    }
  ]
}
```

List:

```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/call",
  "params": {
    "name": "v1_client_list_catalog",
    "arguments": { "limit": 20, "offset": 0, "locale": "en" }
  }
}
```

```json
{ "ok": true, "products": ["…"], "total": 626, "next_offset": 20 }
```

Register:

```json
{
  "jsonrpc": "2.0",
  "id": 3,
  "method": "tools/call",
  "params": {
    "name": "v1_client_register_client",
    "arguments": {
      "name": "Ana Example",
      "email": "ana@example.com",
      "company": "Example Clinic SAS",
      "phone": "+57 300 000 0000",
      "country": "CO",
      "agent_name": "ProcurementBot",
      "data_processing_consent": true
    }
  }
}
```

```json
{
  "ok": true,
  "client_id": "7c1e…",
  "client_token": "imec_…(43 chars)",
  "expires_at": "2026-12-28T12:00:00.000Z",
  "usage": "…"
}
```

Datasheet without registration → 401:

```json
{
  "jsonrpc": "2.0",
  "id": 4,
  "method": "tools/call",
  "params": {
    "name": "v1_client_get_product_sheet",
    "arguments": { "slug": "example-wheelchair" }
  }
}
```

```json
{
  "ok": false,
  "status": 401,
  "code": "UNAUTHORIZED",
  "error": "Client identification required. Call v1_client_register_client first and pass the returned client_token.",
  "next_step": "v1_client_register_client"
}
```

Datasheet with token:

```json
{
  "jsonrpc": "2.0",
  "id": 5,
  "method": "tools/call",
  "params": {
    "name": "v1_client_get_product_sheet",
    "arguments": { "client_token": "imec_…", "slug": "example-wheelchair" }
  }
}
```

```json
{
  "ok": true,
  "slug": "example-wheelchair",
  "name": "Silla de ruedas ejemplo",
  "sheet_url": "https://…/storage/v1/object/sign/fichas-clientes/…",
  "expires_at": "…",
  "content_type": "application/pdf",
  "note": "…"
}
```

Quote:

```json
{
  "jsonrpc": "2.0",
  "id": 6,
  "method": "tools/call",
  "params": {
    "name": "v1_client_request_quote",
    "arguments": {
      "client_token": "imec_…",
      "idempotency_key": "5b0f7a52-8c1d-4e0e-9a51-0d6c2b1f9e11",
      "items": [{ "slug": "example-wheelchair", "quantity": 4 }],
      "message": "Delivery to Medellín",
      "city": "Medellín"
    }
  }
}
```

```json
{
  "ok": true,
  "request_id": "0d4b…",
  "type": "quote",
  "status": "received",
  "sales_notified": true,
  "message": "Quote request registered. …"
}
```

Contact:

```json
{
  "jsonrpc": "2.0",
  "id": 7,
  "method": "tools/call",
  "params": {
    "name": "v1_client_request_contact",
    "arguments": {
      "client_token": "imec_…",
      "idempotency_key": "c2a9d1f0-3b7e-4d55-8f02-6a1e9b7c4d22",
      "message": "We would like a product demo next week.",
      "product_slug": "example-wheelchair"
    }
  }
}
```

```json
{
  "ok": true,
  "request_id": "9e7a…",
  "type": "contact",
  "status": "received",
  "sales_notified": true,
  "message": "Contact request registered. …"
}
```

## Idempotency

`idempotency_key` is required on quote and contact requests: 16-128 chars
`[A-Za-z0-9_-]` (a UUID is fine), scoped per client and tool.

- Same key + same arguments → the original result again, with `idempotent_replay: true`.
- Same key + different arguments → `409 IDEMPOTENCY_CONFLICT`.
- Request still running → `409 IDEMPOTENCY_IN_PROGRESS`; retry after a few seconds.
- A request that fails validation (e.g. unknown slug) releases the key.

## Rate limits

| Scope                       | Per 60 s | Per day |
| --------------------------- | -------- | ------- |
| All traffic per IP          | 60       | 3000    |
| Registrations per IP        | 3        | 20      |
| Calls per client token      | 30       | 600     |
| Datasheets per token        | 10       | 150     |
| Quotes + contacts per token | 5        | 40      |

IP limit → HTTP `429` + `Retry-After: 60`. Tool limits → tool result
`status: 429`, `code: "RATE_LIMITED"`.

## Errors

| `code`                            | `status` | Meaning / action                                       |
| --------------------------------- | -------- | ------------------------------------------------------ |
| `UNAUTHORIZED`                    | 401      | Missing, unknown, expired or revoked token → register  |
| `INVALID_ARGUMENT`                | 400      | See `field` and `error`; fix input, do not retry as-is |
| `NOT_FOUND`                       | 404      | Unknown product slug                                   |
| `SHEET_UNAVAILABLE`               | 404      | No datasheet; use `v1_client_request_contact`          |
| `IDEMPOTENCY_CONFLICT`            | 409      | Key reused with different arguments                    |
| `IDEMPOTENCY_IN_PROGRESS`         | 409      | Retry shortly                                          |
| `RATE_LIMITED`                    | 429      | Wait 60 s                                              |
| JSON-RPC `-32602 Unknown tool`    | —        | The tool does not exist on this server                 |
| `Error interno de la herramienta` | —        | Server error; retry later (writes are idempotent)      |

## Rules for agents

- **Consent**: `data_processing_consent: true` only after the human explicitly accepts the
  I-ME personal data policy (Colombia, Ley 1581 de 2012).
- **Never invent** client data, products, specifications or prices.
- Prices are only binding in a formal quote issued by I-ME sales. `public_price_cop`
  is informational.
- No clinical diagnosis or medical advice is provided or implied.
- Signed datasheet links expire in 10 minutes and must not be republished.
- Treat the `client_token` as a secret: it identifies the human client.

## Rollback (operators)

1. **Disable the surface (immediate, reversible):** redeploy the previous commit, or
   `supabase functions delete mcp-cliente --project-ref nnfbucwiasuggyfoyydo`.
   The operator server `mcp-comercio` is independent and unaffected.
2. **Revoke every client token:**
   `update public.mcp_clientes set revocado_at = now(), revocado_motivo = 'rollback' where revocado_at is null;`
3. **Full DB rollback — DESTRUCTIVE, owner approval required.** Back up first. Quote and
   contact rows already in `solicitudes_cotizacion` (`origen = 'mcp_cliente'`) are kept.

   ```sql
   drop table if exists public.mcp_cliente_descargas, public.mcp_cliente_idempotencia,
     public.mcp_cliente_auditoria, public.mcp_clientes;
   drop function if exists public.consume_mcp_cliente_rate_limit(text[], integer, integer);
   -- Empty the private bucket from the Storage dashboard, then:
   delete from storage.buckets where id = 'fichas-clientes';
   delete from public.asesor_rate_limit where identificador like 'mcpc:%';
   ```
