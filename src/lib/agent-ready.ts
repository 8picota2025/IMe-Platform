/**
 * Agent-ready helpers: 404 recovery copy, markdown exports, Accept negotiation.
 */

const SITE = 'https://i-me.com.co';

export interface NotFoundRecoveryLinks {
  sitemap: string;
  llms: string;
  catalogEs: string;
  catalogEn: string;
  contactEs: string;
  contactEn: string;
}

export const NOT_FOUND_RECOVERY_LINKS: NotFoundRecoveryLinks = {
  sitemap: `${SITE}/sitemap-index.xml`,
  llms: `${SITE}/llms.txt`,
  catalogEs: `${SITE}/es/catalogo/`,
  catalogEn: `${SITE}/en/catalog/`,
  contactEs: `${SITE}/es/contacto/`,
  contactEn: `${SITE}/en/contact/`,
};

/** Markdown body for HTTP 404 responses (acceptmarkdown / Is Agentic). */
export function buildNotFoundMarkdown(path = ''): string {
  const requested = path.trim() || '(unknown path)';
  const links = NOT_FOUND_RECOVERY_LINKS;
  return `# Page not found (404)

The URL \`${requested}\` does not exist on I-ME International Medical Enterprise.

## Where to look next

- Sitemap index: ${links.sitemap}
- Agent instructions: ${links.llms}
- Spanish catalog: ${links.catalogEs}
- English catalog: ${links.catalogEn}
- Contact (ES): ${links.contactEs}
- Contact (EN): ${links.contactEn}

## About I-ME

I-ME distributes certified biomedical equipment, technical support, and financing for hospitals and clinics in Colombia. Confirm specifications, availability, and pricing with I-ME before citing product details as commitments.
`;
}

/** Merge `Accept` into an existing Vary header (acceptmarkdown.com). */
export function appendVaryAccept(existing: string | null | undefined): string {
  if (!existing?.trim()) return 'Accept';
  const tokens = existing
    .split(',')
    .map(part => part.trim().toLowerCase())
    .filter(Boolean);
  if (tokens.includes('accept')) return existing;
  return `${existing}, Accept`;
}

/** True when the client prefers text/markdown over HTML (pragmatic; no q-value math). */
export function prefersMarkdown(acceptHeader: string | null | undefined): boolean {
  const accept = (acceptHeader ?? '').toLowerCase();
  if (!accept.includes('text/markdown')) return false;
  if (/text\/markdown\s*;\s*q\s*=\s*0(?:\.0+)?\b/.test(accept)) return false;
  return true;
}

export interface LegalMarkdownInput {
  heading: string;
  summary: string;
  updatedAt: string;
  sections: Array<{ title: string; paragraphs: string[] }>;
}

export function legalDocumentToMarkdown(doc: LegalMarkdownInput, canonicalUrl: string): string {
  const lines = [
    `# ${doc.heading}`,
    '',
    `> ${doc.summary}`,
    '',
    `Canonical: ${canonicalUrl}`,
    '',
    doc.updatedAt,
    '',
  ];
  for (const section of doc.sections) {
    lines.push(`## ${section.title}`, '');
    for (const paragraph of section.paragraphs) {
      lines.push(paragraph, '');
    }
  }
  return lines.join('\n').trimEnd() + '\n';
}

export interface ProductMarkdownInput {
  nombre: string;
  descripcion_corta: string;
  descripcion_larga?: string;
  sku?: string;
  marca?: string | null;
  familia?: string;
  canonicalUrl: string;
}

export function productToMarkdown(product: ProductMarkdownInput): string {
  const lines = [
    `# ${product.nombre}`,
    '',
    product.descripcion_corta,
    '',
    `Canonical: ${product.canonicalUrl}`,
  ];
  if (product.sku) lines.push(`SKU: ${product.sku}`);
  if (product.marca) lines.push(`Manufacturer: ${product.marca}`);
  if (product.familia) lines.push(`Category: ${product.familia}`);
  lines.push('');
  if (product.descripcion_larga) {
    lines.push('## Description', '', product.descripcion_larga.trim(), '');
  }
  lines.push(
    '## Note for agents',
    '',
    'Specifications, regulatory status, price, and availability must be confirmed with I-ME before presenting them as commitments.',
    ''
  );
  return lines.join('\n');
}

export interface PageMarkdownInput {
  title: string;
  description: string;
  canonicalUrl: string;
  body?: string;
}

export function pageToMarkdown(page: PageMarkdownInput): string {
  const lines = [
    `# ${page.title}`,
    '',
    page.description,
    '',
    `Canonical: ${page.canonicalUrl}`,
    '',
  ];
  if (page.body?.trim()) {
    lines.push(page.body.trim(), '');
  }
  return lines.join('\n');
}

/** When-to-use block appended to llms.txt for AI agents. */
export function buildLlmsWhenToUseSection(): string {
  return `## When to use I-ME (agent guidance)

Use https://i-me.com.co when the user needs any of the following in Colombia:

- **Procurement research** — find biomedical equipment by category (monitors, ventilators, imaging, surgery, sterilization, etc.), compare model references, and read technical summaries before requesting a formal quote.
- **Institutional sales** — hospitals, clinics, and health networks buying certified devices with installation, training, warranty, and post-sale biomedical engineering support.
- **Regulatory context** — verify which products are documented on the public catalog; do not assume INVIMA/CE/FDA status without checking the product page and confirming with I-ME.
- **Financing and projects** — explore financing options and turnkey equipment projects for new services or facility upgrades.
- **Technical services** — preventive/corrective maintenance, calibration, and spare parts for equipment supplied by I-ME.

Do **not** use this site for:

- Clinical diagnosis, treatment decisions, or patient-specific medical advice.
- Real-time inventory, binding prices, or delivery dates (request a quotation via contact).
- Account, checkout, payment, or internal commercial tools (excluded from llms.txt and sitemap).

**How agents should interact**

1. Start from \`${SITE}/llms.txt\` or \`${SITE}/sitemap-index.xml\` for canonical URLs.
2. Request \`Accept: text/markdown\` on product and catalog pages for token-efficient reading.
3. Cite the specific public product or service URL; include "confirm with I-ME" for specs, price, and availability.
4. Route quote, financing, and support requests to ${NOT_FOUND_RECOVERY_LINKS.contactEs} (ES) or ${NOT_FOUND_RECOVERY_LINKS.contactEn} (EN).
`;
}

/** Apache/LiteSpeed snippet for markdown negotiation + 404 (acceptmarkdown Option A). */
export function buildAgentReadyHtaccessRules(): string {
  return `# --- Agent-ready: markdown negotiation + 404 (acceptmarkdown.com) ---
<IfModule mod_headers.c>
  <FilesMatch "\\.md$">
    Header set Content-Type "text/markdown; charset=utf-8"
  </FilesMatch>
  Header merge Vary Accept
</IfModule>

# Markdown for agents when a sibling .md exists (directory index layout).
RewriteCond %{HTTP:Accept} text/markdown [NC]
RewriteCond %{HTTP:Accept} !text/markdown\\s*;\\s*q\\s*=\\s*0 [NC]
RewriteCond %{DOCUMENT_ROOT}%{REQUEST_URI}index.md -f
RewriteRule ^(.+?)/?$ $1/index.md [L]

# Trust anchors: static pages at /about/, /privacy/, /contact/ (no redirect needed).

# Agent-friendly 404: markdown body when requested.
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteCond %{HTTP:Accept} text/markdown [NC]
RewriteCond %{HTTP:Accept} !text/markdown\\s*;\\s*q\\s*=\\s*0 [NC]
RewriteCond %{DOCUMENT_ROOT}/404.md -f
RewriteRule ^ /404.md [L]

ErrorDocument 404 /404.html
# --- End agent-ready ---
`;
}
