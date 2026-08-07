# I-ME Meta Social Publishing — Design Specification

**Date:** 2026-08-07  
**Status:** Design approved by user; implementation not started  
**Scope:** I-ME-owned Facebook, Instagram Professional, Threads, and WhatsApp assets only

## 1. Goals and constraints

Build an in-platform social publishing workflow for I-ME that supports:

- Facebook Page `IME Biomed`.
- Instagram Professional `@imebiomed`.
- A new Threads account, with `@imebiomed` as the preferred handle.
- WhatsApp Business number `+57 313 724 7353`, without disrupting its current integration.
- Draft-first publishing with explicit administrator approval.
- Any I-ME administrator may approve.
- Channel-specific copy and media validation.
- Independent per-channel publication and retry behavior.
- Immediate publication or scheduling after approval.
- Colombia timezone (`America/Bogota`) in the UI; UTC persisted internally.
- Existing media-library assets and new uploads.

The system must never store credentials in the repository, browser-visible data, or ordinary logs. It must not publish automatically without an approval record.

## 2. Selected architecture

Use a native integration inside the existing Astro I-ME platform and backoffice. Do not introduce an external social-publishing vendor or a separate microservice for the first version.

Components:

- **Social content:** the parent draft, campaign metadata, selected media, and channel-specific copy.
- **Channel delivery:** one independently tracked delivery for Facebook, Instagram, Threads, or WhatsApp. Stores status, schedule, remote ID, attempts, and sanitized error data.
- **Review and audit:** append-only history of creation, edits, submission, approval, rejection, scheduling, cancellation, publication, and retry. Rejection requires a reason. Editing approved content invalidates approval and returns it to draft.
- **Meta connections:** authorized account records and permission metadata. Access tokens are encrypted at rest and are not returned to the client.
- **Publisher worker:** authenticated scheduled process that claims approved, due deliveries and publishes each channel independently.
- **Webhook endpoint:** `https://i-me.com.co/api/meta/webhook`, with GET verification and signed POST event handling.
- **Admin UI:** an entry point in the existing backoffice and a specialized social review/inbox surface.

## 3. Workflow and state model

Parent content lifecycle:

```text
draft -> in_review -> approved -> scheduled -> publishing -> published
```

Alternative states:

- `rejected` — approval denied; rejection reason required.
- `failed` — channel-specific permanent or exhausted failure.
- `cancelled` — delivery intentionally cancelled.

Each channel delivery has its own lifecycle. A single parent can have Facebook `published`, Instagram `failed`, Threads `scheduled`, and WhatsApp `not_applicable` without rolling back successful channels.

Flow:

1. An administrator creates a draft or derives one from an I-ME product, article, or campaign.
2. They select existing media or upload new media.
3. They write and validate channel-specific copy.
4. They submit the content for review.
5. Any administrator approves or rejects it. Rejection requires a reason.
6. After approval, an administrator chooses **publish now** or a future time in Colombia.
7. The worker validates authorization, assets, limits, and channel requirements for each delivery.
8. Each delivery publishes independently and records its remote identifier and result.
9. Success and actionable failures notify administrators; one channel's failure does not block other channels.
10. Editing approved or scheduled content invalidates its approval and returns it to `draft`.

## 4. Administrative experience

### Existing backoffice

Add a **Contenidos sociales** entry point to the current admin surface. It supports:

- Draft creation and editing.
- Deriving content from products, articles, and campaigns.
- Media-library selection and new uploads.
- Channel selection.
- Separate copy fields for Facebook, Instagram, Threads, and WhatsApp.
- Per-channel previews.
- Validation for media format, size, alt text, public HTTPS media URL, and channel limitations.
- Submit-for-review action.

### Specialized social inbox

Provide operational views with:

- Filters by status, channel, author, date, and campaign.
- Per-channel preview before approval.
- Approve, reject, publish now, schedule, cancel, and channel-only retry actions.
- Full content and delivery history.
- Connection/token-expiry indicators.
- Meta permission, format, and rate-limit errors with corrective guidance.

## 5. Meta and WhatsApp connection plan

### Facebook and Instagram

Use the official Meta authorization flow. The connection wizard will:

1. Authenticate a user with Meta.
2. Identify and select the I-ME Page `IME Biomed`.
3. Detect the linked Instagram Professional account `@imebiomed`.
4. Persist only encrypted server-side credentials and permission metadata.
5. Confirm the account and Page linkage before enabling publishing.

Required access must be requested minimally and reviewed by Meta. Expected Facebook/Instagram capabilities include Page discovery/management and Instagram content publishing; video publishing permissions are requested only if required by the selected Facebook video use case. Instagram media must be available at a public HTTPS URL when Meta fetches it.

The current I-ME Meta app is in Development Mode and does not currently have the required publishing permissions live. Initial tests are restricted to app roles. Production requires resolving Meta review, completing the real user-facing authorization flow, and switching the app to Live Mode only after verification.

### Threads

Create the I-ME Threads account manually, trying `@imebiomed` first. Then connect it through the official Threads authorization flow and request `threads_basic` and `threads_content_publish`. The integration remains feature-flagged until Meta grants the permissions and the account is connected.

### WhatsApp

Treat WhatsApp as messaging, not a public feed. First identify which Meta app/WABA currently operates `+57 313 724 7353`. Do not migrate the number, alter subscriptions, or replace an existing token during the first implementation phase.

After the existing setup is identified:

- Send internal admin alerts for review requests, scheduled outcomes, failures, and expiring connections.
- Support outbound campaigns only for contacts with recorded consent.
- Use Meta-approved templates outside the 24-hour customer-service window.
- Keep campaign delivery independently tracked and auditable.

## 6. Security and reliability

- Store App Secret, verify token, access tokens, encryption keys, and OAuth credentials only in the deployment secret manager/Supabase secret facilities.
- Use one-time OAuth `state`; use PKCE where supported.
- Encrypt tokens at rest and track expiry/rotation metadata.
- Require authenticated administrator sessions for all management endpoints.
- Verify webhook signatures using `X-Hub-Signature-256`, validate timestamps/schema, and deduplicate event IDs before asynchronous processing.
- Use idempotency keys per delivery/channel to prevent duplicate publication after timeouts.
- Retry transient API/network errors with bounded exponential backoff.
- Do not auto-retry permanent errors such as missing permission, expired authorization, invalid media, Page Publishing Authorization, or rate limits requiring human action.
- Sanitize Meta responses before storing/logging; never log tokens or unnecessary personal data.
- Enforce CSRF protection and OAuth redirect validation.
- Record actor, action, timestamp, delivery, and sanitized outcome in the audit trail.

## 7. Verification plan

Before production:

1. Unit-test state transitions, administrator authorization, approval invalidation, scheduling timezone conversion, and idempotency.
2. Integration-test Meta adapters with I-ME admin/test assets.
3. E2E-test draft -> review -> approval -> publish-now and schedule flows.
4. Test signed webhook acceptance, invalid signatures, duplicate events, malformed payloads, and asynchronous processing.
5. Test isolated channel failures, token expiry, inaccessible media, invalid formats, and rate-limit responses.
6. Perform a manual security review of secrets, roles, logs, CSRF, OAuth state, redirects, and webhook verification.
7. Prepare Meta App Review descriptions and a real end-to-end screencast.
8. Run a controlled publication test before Live Mode.

## 8. Explicit non-goals for v1

- Publishing to third-party/client accounts.
- Automatic publication without administrator approval.
- Migrating or replacing the existing WhatsApp Business integration.
- Treating WhatsApp as a public social feed.
- Supporting arbitrary social networks through a generic plug-in system.

## 9. Open operational prerequisites

- Confirm the technical Facebook Page ID and Instagram Professional account ID via the authorized Meta flow.
- Create the Threads account and confirm the handle.
- Identify the existing WhatsApp Business Account/app/token arrangement.
- Confirm deployment secret-manager and scheduled-worker mechanism for the I-ME environment.
- Resolve Meta App Review status and publishing permission access before production enablement.
