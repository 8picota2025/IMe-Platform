# I-ME Meta Social Publishing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a secure, administrator-approved social publishing workflow for I-ME-owned Facebook and Instagram accounts, with foundations and feature flags for Threads and the existing WhatsApp Business integration.

**Architecture:** Keep Astro as the static administrator client and place every privileged operation in Supabase Edge Functions. Postgres holds drafts, independent channel deliveries, connection metadata, and append-only audit records protected by RLS; secrets/tokens remain server-only. A scheduled Edge Function claims due channel deliveries idempotently, while a signature-verified webhook receives Meta events.

**Tech Stack:** Astro 6 static site, TypeScript strict mode, Supabase Postgres/Auth/Storage/RLS/Edge Functions (Deno), Vitest, Meta Graph API, Meta OAuth, Hostinger static hosting.

## Global Constraints

- Support only I-ME-owned assets: Facebook Page `IME Biomed`, Instagram Professional `@imebiomed`, future Threads `@imebiomed`, and WhatsApp `+57 313 724 7353`.
- Do not add React, framer-motion, Three.js, or a third-party social publishing vendor.
- `service_role`, App Secret, OAuth tokens, verify tokens, encryption material, and private keys must exist only in Supabase Edge Functions or the deployment secret manager; never in `src/`, `dist/`, Git, browser-visible data, or ordinary logs.
- Publication requires an explicit approval recorded by an authenticated I-ME administrator; editing an approved or scheduled content item returns it to `draft`.
- Any `owner` or `admin` may approve; all actions must be auditable.
- Deliveries publish independently by channel; one failure must not cancel or duplicate other channels.
- Use `America/Bogota` for input/display and persist scheduled instants as `timestamptz` UTC.
- Validate Meta webhooks with `X-Hub-Signature-256`, use idempotency keys, sanitize errors, and deduplicate events.
- WhatsApp first phase is discovery-only: do not migrate the number, replace existing tokens, or alter subscriptions.
- Run `npm run validate` before each commit as required by `CLAUDE.md`.

---

## File structure

| Path                                                       | Responsibility                                                                                                                                                                            |
| ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `supabase/migrations/20260807000000_social_publishing.sql` | Tables, enums, indexes, RLS policies, append-only audit trigger, RPCs for state changes and delivery claiming.                                                                            |
| `supabase/functions/_shared/social-publishing.ts`          | Shared strict types, state transitions, safe-error normalization, HMAC verification, idempotency utilities.                                                                               |
| `supabase/functions/_shared/social-publishing.test.ts`     | Unit tests for pure social-publishing helpers.                                                                                                                                            |
| `supabase/functions/social-content/index.ts`               | Authenticated CRUD and review/action API for admin client.                                                                                                                                |
| `supabase/functions/meta-oauth/index.ts`                   | Server-side OAuth start/callback and connection status; token persistence only on server.                                                                                                 |
| `supabase/functions/meta-publish/index.ts`                 | Scheduled/manual delivery claim, validation, Meta adapter dispatch, retry classification.                                                                                                 |
| `supabase/functions/meta-webhook/index.ts`                 | Meta GET challenge and signed POST receiver; event persistence/deduplication.                                                                                                             |
| `supabase/functions/whatsapp-discovery/index.ts`           | Read-only discovery of existing WABA/app configuration after explicit admin request.                                                                                                      |
| `src/admin/social-publishing-types.ts`                     | Browser-safe DTOs and rendering helpers; never token-bearing types.                                                                                                                       |
| `src/admin/social-publishing.ts`                           | Focused social-content editor/inbox DOM rendering and Edge Function calls.                                                                                                                |
| `src/admin/social-publishing.test.ts`                      | UI helper and payload-shape tests.                                                                                                                                                        |
| `src/admin/admin-app.ts`                                   | Add `social` view and navigation integration only.                                                                                                                                        |
| `src/admin/admin.css`                                      | Scoped classes for social editor, per-channel previews, statuses, and audit timeline.                                                                                                     |
| `src/pages/api/meta/webhook.ts`                            | Not created: Astro output is static. Configure Meta webhook URL to the deployed Supabase Edge Function URL, not `i-me.com.co/api/*`, unless a future dynamic proxy is deliberately added. |
| `.env.example`                                             | Document variable names only, with empty/example non-secret values.                                                                                                                       |
| `docs/meta-social-publishing-operations.md`                | Operational runbook: Meta setup, secret entry, review evidence, cron, incident/revocation procedures.                                                                                     |

## Task 1: Establish schema, RLS, audit log, and state-transition contract

**Files:**

- Create: `supabase/migrations/20260807000000_social_publishing.sql`
- Create: `supabase/functions/_shared/social-publishing.ts`
- Create: `supabase/functions/_shared/social-publishing.test.ts`

**Interfaces:**

- Produces `SocialChannel`, `SocialContentStatus`, `SocialDeliveryStatus`, `canTransitionContent()`, `canTransitionDelivery()`, `makeIdempotencyKey()`.
- Produces tables `social_contents`, `social_deliveries`, `social_media_assets`, `social_audit_events`, `meta_connections`, and `meta_webhook_events`.
- Later functions consume only the `social_*` tables and RPCs in this task.

- [ ] **Step 1: Write failing state-machine tests**

```ts
import { describe, expect, it } from 'vitest';
import {
  canTransitionContent,
  canTransitionDelivery,
  makeIdempotencyKey,
} from './social-publishing.ts';

describe('social publishing transitions', () => {
  it('requires review before approval', () => {
    expect(canTransitionContent('draft', 'approved')).toBe(false);
    expect(canTransitionContent('in_review', 'approved')).toBe(true);
  });

  it('allows a failed delivery to retry without changing other channels', () => {
    expect(canTransitionDelivery('failed', 'publishing')).toBe(true);
    expect(canTransitionDelivery('published', 'publishing')).toBe(false);
  });

  it('creates a stable channel-scoped idempotency key', () => {
    expect(makeIdempotencyKey('content-1', 'instagram', 2)).toBe(
      'content-1:instagram:2'
    );
  });
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `npx vitest run supabase/functions/_shared/social-publishing.test.ts`

Expected: FAIL because `social-publishing.ts` does not exist.

- [ ] **Step 3: Implement pure types and transition helpers**

```ts
export const SOCIAL_CHANNELS = [
  'facebook',
  'instagram',
  'threads',
  'whatsapp',
] as const;
export type SocialChannel = (typeof SOCIAL_CHANNELS)[number];
export type SocialContentStatus =
  | 'draft'
  | 'in_review'
  | 'approved'
  | 'rejected'
  | 'cancelled';
export type SocialDeliveryStatus =
  | 'not_applicable'
  | 'scheduled'
  | 'publishing'
  | 'published'
  | 'failed'
  | 'cancelled';

const CONTENT_TRANSITIONS: Record<
  SocialContentStatus,
  readonly SocialContentStatus[]
> = {
  draft: ['in_review', 'cancelled'],
  in_review: ['approved', 'rejected', 'draft', 'cancelled'],
  approved: ['draft', 'cancelled'],
  rejected: ['draft', 'cancelled'],
  cancelled: [],
};

const DELIVERY_TRANSITIONS: Record<
  SocialDeliveryStatus,
  readonly SocialDeliveryStatus[]
> = {
  not_applicable: [],
  scheduled: ['publishing', 'cancelled'],
  publishing: ['published', 'failed', 'scheduled'],
  published: [],
  failed: ['publishing', 'cancelled'],
  cancelled: [],
};

export function canTransitionContent(
  from: SocialContentStatus,
  to: SocialContentStatus
): boolean {
  return CONTENT_TRANSITIONS[from].includes(to);
}

export function canTransitionDelivery(
  from: SocialDeliveryStatus,
  to: SocialDeliveryStatus
): boolean {
  return DELIVERY_TRANSITIONS[from].includes(to);
}

export function makeIdempotencyKey(
  contentId: string,
  channel: SocialChannel,
  attempt: number
): string {
  return `${contentId}:${channel}:${attempt}`;
}
```

- [ ] **Step 4: Create migration with administrator-only RLS and audit triggers**

Implement these explicit invariants in `20260807000000_social_publishing.sql`:

```sql
create type public.social_channel as enum ('facebook', 'instagram', 'threads', 'whatsapp');
create type public.social_content_status as enum ('draft', 'in_review', 'approved', 'rejected', 'cancelled');
create type public.social_delivery_status as enum ('not_applicable', 'scheduled', 'publishing', 'published', 'failed', 'cancelled');

create table public.social_contents (
  id uuid primary key default gen_random_uuid(),
  status public.social_content_status not null default 'draft',
  campaign_name text,
  created_by uuid not null references auth.users(id),
  approved_by uuid references auth.users(id),
  approved_at timestamptz,
  rejection_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint social_content_rejection_reason check (status <> 'rejected' or length(trim(coalesce(rejection_reason, ''))) > 0)
);

create table public.social_deliveries (
  id uuid primary key default gen_random_uuid(),
  content_id uuid not null references public.social_contents(id) on delete cascade,
  channel public.social_channel not null,
  status public.social_delivery_status not null default 'scheduled',
  copy_text text not null,
  alt_text text,
  scheduled_for timestamptz,
  attempt_count integer not null default 0 check (attempt_count >= 0),
  idempotency_key text unique,
  remote_post_id text,
  safe_error jsonb,
  published_at timestamptz,
  unique (content_id, channel)
);
```

Add the media, connection, webhook-event, and audit tables; indexes for due deliveries and event IDs; `updated_at` handling; RLS that grants select/insert/update only to authenticated `owner`/`admin` roles according to the existing `usuarios` role pattern; and a `security definer` RPC that atomically claims only `scheduled` due deliveries. Audit tables must reject update/delete to non-service roles. Do not use client-controlled actor IDs in audit rows; derive `auth.uid()` in SQL.

- [ ] **Step 5: Run tests and apply migration locally**

Run: `npx vitest run supabase/functions/_shared/social-publishing.test.ts && supabase db reset`

Expected: tests PASS and local migration succeeds.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20260807000000_social_publishing.sql supabase/functions/_shared/social-publishing.ts supabase/functions/_shared/social-publishing.test.ts
git commit -m "feat(social): add publishing state and audit schema"
```

## Task 2: Implement authenticated content CRUD, review, approval, and scheduling API

**Files:**

- Create: `supabase/functions/social-content/index.ts`
- Modify: `supabase/functions/_shared/social-publishing.ts`
- Test: `supabase/functions/_shared/social-publishing.test.ts`

**Interfaces:**

- Consumes `canTransitionContent`, `makeIdempotencyKey`, `social_contents`, and `social_deliveries` from Task 1.
- Produces `POST /functions/v1/social-content` actions: `create`, `save_draft`, `submit_review`, `approve`, `reject`, `schedule`, `cancel_delivery`, `retry_delivery`.
- Returns sanitized content/delivery DTOs only; tokens and raw provider responses are excluded.

- [ ] **Step 1: Write failing request validation tests**

```ts
import { describe, expect, it } from 'vitest';
import { parseSocialAction } from './social-publishing.ts';

describe('parseSocialAction', () => {
  it('rejects approval without authenticated actor context', () => {
    expect(() =>
      parseSocialAction({ action: 'approve', contentId: 'x' })
    ).toThrow('actor required');
  });

  it('requires a rejection reason', () => {
    expect(() =>
      parseSocialAction({
        action: 'reject',
        contentId: 'x',
        rejectionReason: ' ',
      })
    ).toThrow('rejection reason required');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run supabase/functions/_shared/social-publishing.test.ts`

Expected: FAIL because `parseSocialAction` is missing.

- [ ] **Step 3: Implement strict parser and Edge Function authorization**

Add a `parseSocialAction(input: unknown)` helper that accepts only known actions and validates channels, copy, an IANA timezone of exactly `America/Bogota` for schedule inputs, nonempty rejection reasons, and ISO schedule timestamps. In `social-content/index.ts`, use existing shared admin auth helpers to obtain the JWT actor and reject non-`owner`/`admin` users with HTTP 403. Call transactional SQL/RPCs; do not perform multi-step client-side state changes.

The `approve` path must set `approved_by` and `approved_at` server-side. `save_draft` must reset approval fields and convert nonterminal deliveries back to unscheduled draft state. `schedule` must require an approved parent and assign channel-specific due times. `retry_delivery` must create the next idempotency key and only target one `failed` delivery.

- [ ] **Step 4: Run function/unit tests**

Run: `npx vitest run supabase/functions/_shared/social-publishing.test.ts && supabase functions serve social-content --no-verify-jwt`

Expected: tests PASS; local function starts. Use a local authenticated request to verify 401 without JWT and 403 for a non-admin role.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/social-content/index.ts supabase/functions/_shared/social-publishing.ts supabase/functions/_shared/social-publishing.test.ts
git commit -m "feat(social): add draft review and schedule API"
```

## Task 3: Add social editor and specialist inbox to the existing admin UI

**Files:**

- Create: `src/admin/social-publishing-types.ts`
- Create: `src/admin/social-publishing.ts`
- Create: `src/admin/social-publishing.test.ts`
- Modify: `src/admin/admin-app.ts`
- Modify: `src/admin/admin.css`

**Interfaces:**

- Consumes `social-content` Edge Function API from Task 2.
- Produces `renderSocialPublishing(root, session)` and browser-safe DTOs `SocialContentDto`, `SocialDeliveryDto`.
- Adds `social` to the `View` union and navigation only for roles already allowed to access the admin marketing surface.

- [ ] **Step 1: Write failing UI helper tests**

```ts
import { describe, expect, it } from 'vitest';
import { formatBogotaDate, deliveryBadge } from './social-publishing.ts';

describe('social inbox helpers', () => {
  it('renders scheduled time in Colombia', () => {
    expect(formatBogotaDate('2026-08-07T15:00:00.000Z')).toContain('10:00');
  });

  it('maps failed delivery to accessible badge data', () => {
    expect(deliveryBadge('failed')).toEqual({ label: 'Falló', tone: 'danger' });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/admin/social-publishing.test.ts`

Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement browser-safe UI module**

Create `social-publishing-types.ts` with no secret fields. Create `social-publishing.ts` with:

- content list filters for status, channel, author, date, campaign;
- a draft form with independent Facebook, Instagram, Threads, and WhatsApp copy fields;
- media-library selection plus file upload routed through existing authorized storage mechanisms;
- explicit alt-text field for image deliveries;
- preview cards labelled by channel;
- action buttons for submit, approve, reject (reason required), publish now, schedule, cancel, and retry only the selected failed delivery;
- a chronological audit timeline;
- accessible live status notices and disabled action buttons while requests are in progress.

The initial UI must feature-flag Threads and WhatsApp delivery actions until their connections are enabled, while still preserving their channel-specific draft copy.

- [ ] **Step 4: Integrate minimally with `admin-app.ts`**

Add `'social'` to `View`, place a `Contenidos sociales` link in the existing navigation, allow it to `owner`, `admin`, and the existing marketing-capable role set, and dispatch `renderSocialPublishing()` from `render()`. Do not move unrelated admin views or refactor the large existing file.

- [ ] **Step 5: Add scoped styles**

Add `.social-*` styles in `admin.css` for channel tabs, status badges, two-column editor/preview layout with a one-column responsive fallback, audit timeline, warning surface, and visible keyboard focus. Reuse existing admin CSS variables; do not hard-code new palette values.

- [ ] **Step 6: Run tests, type checks, and manual admin test**

Run: `npx vitest run src/admin/social-publishing.test.ts && npm run check && npm run lint`

Expected: PASS.

Run: `npm run dev:admin`, sign in with an admin, navigate to `#/social`, save a draft, submit it, reject it with a reason, and confirm the audit event appears. Do not connect Meta accounts yet.

- [ ] **Step 7: Commit**

```bash
git add src/admin/social-publishing-types.ts src/admin/social-publishing.ts src/admin/social-publishing.test.ts src/admin/admin-app.ts src/admin/admin.css
git commit -m "feat(admin): add social drafts and approval inbox"
```

## Task 4: Implement Meta connection metadata and OAuth exchange without client secrets

**Files:**

- Create: `supabase/functions/meta-oauth/index.ts`
- Modify: `supabase/functions/_shared/social-publishing.ts`
- Modify: `.env.example`
- Create: `docs/meta-social-publishing-operations.md`

**Interfaces:**

- Consumes `meta_connections` from Task 1 and authenticated admin helper from Task 2.
- Produces admin-only actions `start_facebook_instagram`, `oauth_callback`, `connection_status`, `disconnect`.
- `meta-publish` in Task 5 consumes a decrypted server-side connection record, never a browser token.

- [ ] **Step 1: Write failing OAuth-state tests**

```ts
import { describe, expect, it } from 'vitest';
import { createOAuthState, verifyOAuthState } from './social-publishing.ts';

describe('Meta OAuth state', () => {
  it('accepts a fresh bound state once', async () => {
    const state = await createOAuthState({
      actorId: 'actor-1',
      redirectPath: '/admin/#/social',
    });
    await expect(verifyOAuthState(state, 'actor-1')).resolves.toMatchObject({
      redirectPath: '/admin/#/social',
    });
    await expect(verifyOAuthState(state, 'actor-1')).rejects.toThrow(
      'state already used'
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run supabase/functions/_shared/social-publishing.test.ts`

Expected: FAIL because OAuth state helpers are missing.

- [ ] **Step 3: Implement server-only OAuth state and token persistence**

Store hashed one-time state with actor ID, redirect path allowlist, creation/expiry, and used timestamp in Postgres. The callback must verify state, exchange code server-side, identify the selected Page and linked Instagram Professional account, encrypt tokens using a server-only encryption key, and persist only connection metadata and encrypted ciphertext. Return a browser-safe status DTO.

Use `META_APP_ID`, `META_APP_SECRET`, `META_OAUTH_REDIRECT_URI`, `META_TOKEN_ENCRYPTION_KEY`, and `META_GRAPH_API_VERSION` through Edge Function secrets only. The app secret must never appear in redirect URLs, browser code, or function responses.

- [ ] **Step 4: Document required environment variable names without values**

Add only this style of entries to `.env.example`:

```dotenv
# Server-only Supabase Edge Function secrets; configure with `supabase secrets set`, never in this file.
# META_APP_ID=
# META_APP_SECRET=
# META_OAUTH_REDIRECT_URI=
# META_TOKEN_ENCRYPTION_KEY=
# META_WEBHOOK_VERIFY_TOKEN=
# META_GRAPH_API_VERSION=
```

In the operations guide, document the real redirect URL as the deployed `meta-oauth` Edge Function callback, not a static Astro path. Include procedures to configure secrets, add app roles for testing, select the Page `IME Biomed`, validate the linked `@imebiomed` account, revoke a compromised connection, and collect App Review screencast evidence.

- [ ] **Step 5: Run tests and verify secret hygiene**

Run: `npx vitest run supabase/functions/_shared/social-publishing.test.ts && git grep -nE 'META_APP_SECRET=.+|META_TOKEN_ENCRYPTION_KEY=.+' -- ':!docs' ':!.env.example'`

Expected: tests PASS; grep returns no secrets.

- [ ] **Step 6: Commit**

```bash
git add supabase/functions/meta-oauth/index.ts supabase/functions/_shared/social-publishing.ts .env.example docs/meta-social-publishing-operations.md
git commit -m "feat(meta): add secure account connection flow"
```

## Task 5: Publish Facebook and Instagram deliveries independently and idempotently

**Files:**

- Create: `supabase/functions/meta-publish/index.ts`
- Modify: `supabase/functions/_shared/social-publishing.ts`
- Test: `supabase/functions/_shared/social-publishing.test.ts`
- Modify: `docs/meta-social-publishing-operations.md`

**Interfaces:**

- Consumes claimed due delivery RPC from Task 1 and server-side connection access from Task 4.
- Produces a cron/manual authenticated `meta-publish` function that handles only `facebook` and `instagram` in this release.
- Returns `published`, `scheduled`, or `failed` using sanitized error codes; never returns provider tokens.

- [ ] **Step 1: Write failing error-classification tests**

```ts
import { describe, expect, it } from 'vitest';
import { classifyMetaFailure } from './social-publishing.ts';

describe('Meta error classification', () => {
  it('retries a temporary provider failure', () => {
    expect(
      classifyMetaFailure({ status: 503, code: 'service_unavailable' })
    ).toEqual({ retryable: true, delaySeconds: 300 });
  });

  it('does not retry expired authorization', () => {
    expect(
      classifyMetaFailure({ status: 400, code: 'OAuthException' })
    ).toEqual({ retryable: false, reason: 'authorization_required' });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run supabase/functions/_shared/social-publishing.test.ts`

Expected: FAIL because `classifyMetaFailure` is missing.

- [ ] **Step 3: Implement adapters and preflight validation**

Create narrow adapters:

```ts
export interface PublishResult {
  remotePostId: string;
  publishedAt: string;
}

export interface MetaChannelPublisher {
  publish(input: {
    deliveryId: string;
    idempotencyKey: string;
    copyText: string;
    mediaUrls: readonly string[];
    altText: string | null;
  }): Promise<PublishResult>;
}
```

Before calling Meta, verify:

- parent content is approved and delivery is due;
- connection exists and authorization is not expired;
- every Instagram media URL is public HTTPS;
- image/video type and count match the selected channel;
- a failed/previously published delivery is not accidentally duplicated;
- current channel is Facebook or Instagram; Threads and WhatsApp return a feature-disabled safe error.

Implement Facebook Page feed/photo/video publishing only for documented supported payloads and Instagram container creation/status polling/publish for supported image, carousel, and video forms. Store the remote ID and published time only after Meta confirms success. Treat HTTP 429/5xx/network timeouts as bounded retry candidates; treat permissions, Page Publishing Authorization, inaccessible media, and invalid payloads as actionable non-retry errors.

- [ ] **Step 4: Add controlled test mode and scheduler documentation**

Require a function-level `SOCIAL_PUBLISHING_ENABLED=true` secret before real publishing. With it absent, manual/cron calls must return a safe `publishing_disabled` result and leave deliveries scheduled. Document cron invocation with the Supabase scheduler/pg_cron or an authenticated external scheduler and require a test delivery from app-role assets before enabling production.

- [ ] **Step 5: Run tests and validate no cross-channel rollback**

Run: `npx vitest run supabase/functions/_shared/social-publishing.test.ts`

Expected: PASS.

In local/staging data, create two deliveries for one content item; mock Facebook success and Instagram inaccessible-media failure. Verify Facebook remains `published`, Instagram becomes `failed`, and two audit events exist.

- [ ] **Step 6: Commit**

```bash
git add supabase/functions/meta-publish/index.ts supabase/functions/_shared/social-publishing.ts supabase/functions/_shared/social-publishing.test.ts docs/meta-social-publishing-operations.md
git commit -m "feat(meta): publish Facebook and Instagram deliveries"
```

## Task 6: Receive Meta webhooks securely and connect operational feedback

**Files:**

- Create: `supabase/functions/meta-webhook/index.ts`
- Modify: `supabase/functions/_shared/social-publishing.ts`
- Test: `supabase/functions/_shared/social-publishing.test.ts`
- Modify: `docs/meta-social-publishing-operations.md`

**Interfaces:**

- Consumes `meta_webhook_events` and delivery audit tables from Task 1.
- Produces an unauthenticated external HTTP endpoint secured by Meta GET verify-token match and POST HMAC validation.
- Emits sanitized audit events for known relevant delivery/connection events.

- [ ] **Step 1: Write failing signature tests**

```ts
import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { verifyMetaSignature } from './social-publishing.ts';

describe('verifyMetaSignature', () => {
  it('accepts the expected sha256 HMAC', async () => {
    const body = '{"entry":[]}';
    const secret = 'test-secret';
    const header = `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`;
    await expect(verifyMetaSignature(body, header, secret)).resolves.toBe(true);
  });

  it('rejects missing or modified signatures', async () => {
    await expect(verifyMetaSignature('{}', '', 'test-secret')).resolves.toBe(
      false
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run supabase/functions/_shared/social-publishing.test.ts`

Expected: FAIL because `verifyMetaSignature` is missing.

- [ ] **Step 3: Implement GET challenge and signed POST receiver**

Implement GET handling that returns `hub.challenge` only when `hub.mode=subscribe` and `hub.verify_token` matches `META_WEBHOOK_VERIFY_TOKEN` with timing-safe comparison. For POST, read the raw body once, validate `X-Hub-Signature-256` with App Secret, reject invalid input with 401, derive a stable event fingerprint, insert it into `meta_webhook_events` using a unique constraint, and return 200 for duplicate valid events.

Persist only allowlisted event metadata and process it asynchronously/after acknowledgement. Do not trust fields from a webhook to change arbitrary delivery state; resolve known remote IDs against stored deliveries and write a sanitized audit update.

- [ ] **Step 4: Run tests and locally exercise both routes**

Run: `npx vitest run supabase/functions/_shared/social-publishing.test.ts`

Expected: PASS.

Run `supabase functions serve meta-webhook --no-verify-jwt` and verify: valid GET challenge returns 200 with exact challenge, invalid verify token returns 403, valid signed POST returns 200, duplicate signed POST returns 200 but creates one event, invalid signature returns 401.

- [ ] **Step 5: Document Meta configuration**

Add the deployed Edge Function URL to the operations guide, list required Page/Instagram webhook fields, and explain that the subscription must be set only after the endpoint passes the challenge. Do not call Meta subscription-management APIs until the user explicitly approves the live callback, fields, and verify-token deployment.

- [ ] **Step 6: Commit**

```bash
git add supabase/functions/meta-webhook/index.ts supabase/functions/_shared/social-publishing.ts supabase/functions/_shared/social-publishing.test.ts docs/meta-social-publishing-operations.md
git commit -m "feat(meta): verify and process publishing webhooks"
```

## Task 7: Prepare Threads and WhatsApp as gated, non-disruptive follow-on connections

**Files:**

- Create: `supabase/functions/whatsapp-discovery/index.ts`
- Modify: `supabase/functions/meta-oauth/index.ts`
- Modify: `supabase/functions/meta-publish/index.ts`
- Modify: `src/admin/social-publishing.ts`
- Modify: `docs/meta-social-publishing-operations.md`

**Interfaces:**

- Consumes secure connection infrastructure from Tasks 4–6.
- Produces read-only WhatsApp discovery status and disabled-until-authorized Threads controls.
- Does not enable real Threads/WhatsApp sending until separately approved Meta permissions and assets exist.

- [ ] **Step 1: Write failing feature-gate tests**

```ts
import { describe, expect, it } from 'vitest';
import { isChannelEnabled } from './social-publishing.ts';

describe('channel enablement', () => {
  it('keeps Threads disabled without a connected approved account', () => {
    expect(
      isChannelEnabled('threads', {
        threads: { connected: false, permissionGranted: false },
      })
    ).toBe(false);
  });

  it('keeps WhatsApp campaign sending disabled after discovery alone', () => {
    expect(
      isChannelEnabled('whatsapp', {
        whatsapp: { discovered: true, campaignEnabled: false },
      })
    ).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run supabase/functions/_shared/social-publishing.test.ts`

Expected: FAIL because `isChannelEnabled` is missing.

- [ ] **Step 3: Implement read-only WhatsApp discovery**

Create an admin-only function that reports only whether a WABA/phone-number configuration associated with `+57 313 724 7353` is discoverable from the authorized app context and which app/WABA identifiers are present. Return no token and perform no subscription, migration, number registration, or sending operation. If the current Meta app lacks access, return `not_authorized` with an operator action, not a guessed configuration.

- [ ] **Step 4: Implement gated Threads connection and UI states**

Add Threads OAuth only behind a `THREADS_PUBLISHING_ENABLED` server secret and a connection-status feature flag. The UI must explain that the account must be created manually with preferred `@imebiomed`, then Meta must grant `threads_basic` and `threads_content_publish`. Until all conditions are true, the channel remains draftable but cannot be approved for scheduling/publishing.

- [ ] **Step 5: Document consent and template prerequisites for WhatsApp**

The operational guide must require recorded marketing consent, template approval outside the 24-hour service window, opt-out handling, and a separate user-approved implementation before campaign sending. Internal alerts likewise require explicitly configured recipient administrator numbers.

- [ ] **Step 6: Run verification and commit**

Run: `npx vitest run supabase/functions/_shared/social-publishing.test.ts && npm run validate`

Expected: PASS.

```bash
git add supabase/functions/whatsapp-discovery/index.ts supabase/functions/meta-oauth/index.ts supabase/functions/meta-publish/index.ts src/admin/social-publishing.ts docs/meta-social-publishing-operations.md supabase/functions/_shared/social-publishing.ts supabase/functions/_shared/social-publishing.test.ts
git commit -m "feat(social): add gated Threads and WhatsApp readiness"
```

## Task 8: Deploy safely, validate with Meta test assets, and prepare App Review

**Files:**

- Modify: `docs/meta-social-publishing-operations.md`
- Modify: `README.md` (link to operator runbook only)

**Interfaces:**

- Consumes all deployed functions and UI from Tasks 1–7.
- Produces reproducible production-readiness evidence, no new product API.

- [ ] **Step 1: Document exact release checklist**

Add a checklist requiring: migration review and apply; deployment of `social-content`, `meta-oauth`, `meta-publish`, `meta-webhook`, and `whatsapp-discovery`; secret configuration via Supabase CLI/dashboard; admin-role test user; OAuth callback registration; webhook URL verification; scheduler secret; and rollback steps (disable `SOCIAL_PUBLISHING_ENABLED`, revoke Meta connection, cancel due deliveries).

- [ ] **Step 2: Run full repository validation**

Run: `npm run validate`

Expected: PASS. If it fails, stop and resolve the reported failure before deployment; do not claim release readiness.

- [ ] **Step 3: Execute staging acceptance test**

With app-role assets only:

1. Connect `IME Biomed` and linked `@imebiomed` through OAuth.
2. Create a media-backed draft with distinct Facebook and Instagram copy.
3. Submit and approve it with a different admin account if possible.
4. Publish Facebook now and schedule Instagram five minutes later.
5. Verify each remote post ID, audit actor, UTC persisted schedule, Colombia UI time, and webhook event.
6. Force one controlled invalid Instagram media URL and confirm Facebook is not rolled back and Instagram is safely failed.
7. Revoke the test connection and confirm future deliveries show `authorization_required` without retries.

- [ ] **Step 4: Prepare and submit Meta App Review manually**

Use the operation guide to request only the permissions proved by the deployed flow. Record a screencast showing login, account selection, draft/review/approval, channel-specific publication, and disconnect. Do not submit unrelated rejected privileges; do not switch Live Mode until Meta grants the necessary access and the controlled production test succeeds.

- [ ] **Step 5: Commit runbook updates**

```bash
git add docs/meta-social-publishing-operations.md README.md
git commit -m "docs(meta): add publishing release runbook"
```

## Plan self-review

- **Coverage:** Tasks 1–3 deliver schema/RLS/audit and both requested admin surfaces. Tasks 4–6 deliver server-only OAuth, independent Facebook/Instagram publication, secure webhooks, retries, and scheduled operation. Task 7 explicitly protects current WhatsApp operation and gates Threads until the account/permissions exist. Task 8 covers production validation and App Review.
- **Static-hosting correction:** The approved design named `https://i-me.com.co/api/meta/webhook`, but the repository is static Astro on Hostinger. This plan correctly places the executable callback at the Supabase Edge Function URL; a same-domain proxy would require separate infrastructure and is intentionally not introduced.
- **No placeholders:** All tasks define exact paths, interfaces, test cases, commands, and expected results. Meta asset IDs, tokens, permission approval, and account creation remain external operational prerequisites rather than invented values.
- **Consistency:** `social_contents` is the parent lifecycle; `social_deliveries` are channel-scoped and idempotent. All later tasks use the state names defined in Task 1.
