/**
 * Auditoría + reparación best-effort del workspace Twenty I-ME.
 *
 *   set -a && source .env && set +a
 *   deno run --allow-env --allow-net supabase/scripts/audit-repair-twenty.ts
 *   deno run --allow-env --allow-net supabase/scripts/audit-repair-twenty.ts --apply
 */
import {
  TwentyClient,
  deriveLifecycleFromOpportunityStage,
  mergeAccountLifecycle,
  type TwentyAccountLifecycle,
} from '../functions/_shared/twenty-crm.ts';

const APPLY = Deno.args.includes('--apply');
const LIMIT = Number(Deno.env.get('TWENTY_AUDIT_LIMIT') ?? '100');

function config() {
  const baseUrl = Deno.env.get('TWENTY_BASE_URL')?.trim().replace(/\/+$/, '');
  const apiKey = Deno.env.get('TWENTY_API_KEY')?.trim();
  if (!baseUrl || !apiKey) {
    console.error('Faltan TWENTY_BASE_URL / TWENTY_API_KEY');
    Deno.exit(1);
  }
  return { baseUrl, apiKey };
}

async function fetchList<T>(collection: string, limit: number): Promise<T[]> {
  const { baseUrl, apiKey } = config();
  const res = await fetch(`${baseUrl}/rest/${collection}?limit=${limit}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!res.ok) throw new Error(`${collection}: HTTP ${res.status}`);
  const json = await res.json();
  const root = json as Record<string, unknown>;
  const nested = root.data as Record<string, unknown> | undefined;
  const list = (nested?.[collection] ?? root[collection] ?? []) as T[];
  return Array.isArray(list) ? list : [];
}

async function main() {
  const { baseUrl, apiKey } = config();
  const client = new TwentyClient({ baseUrl, apiKey });
  const defaultOwner = Deno.env.get('TWENTY_OWNER_ID')?.trim() ?? '';

  const [people, companies, opportunities] = await Promise.all([
    fetchList<{ id: string; companyId?: string | null }>('people', LIMIT),
    fetchList<{ id: string; accountOwnerId?: string | null }>('companies', LIMIT),
    fetchList<{ id: string; ownerId?: string | null; companyId?: string | null; stage?: string }>(
      'opportunities',
      LIMIT
    ),
  ]);

  const orphans = people.filter(p => !p.companyId);
  const oppsNoOwner = opportunities.filter(o => !o.ownerId);
  const companiesNoOwner = companies.filter(c => !c.accountOwnerId);

  console.log('--- Twenty audit ---');
  console.log(
    `people=${people.length} companies=${companies.length} opportunities=${opportunities.length}`
  );
  console.log(
    `orphan_people=${orphans.length} opps_sin_owner=${oppsNoOwner.length} companies_sin_owner=${companiesNoOwner.length}`
  );

  const lifecycleByCompany = new Map<string, TwentyAccountLifecycle>();
  for (const opp of opportunities) {
    if (!opp.companyId) continue;
    const next = deriveLifecycleFromOpportunityStage(String(opp.stage ?? 'NEW'));
    lifecycleByCompany.set(
      opp.companyId,
      mergeAccountLifecycle(lifecycleByCompany.get(opp.companyId), next)
    );
  }
  const lifecycleCounts = { LEAD: 0, PROSPECT: 0, CLIENT: 0 };
  for (const lc of lifecycleByCompany.values()) lifecycleCounts[lc] += 1;
  console.log('lifecycle_by_company:', lifecycleCounts);

  if (!APPLY) {
    console.log('\nDry-run. Re-ejecuta con --apply para reparar owner huérfanos y notas de ciclo.');
    return;
  }
  if (!defaultOwner) {
    console.error('--apply requiere TWENTY_OWNER_ID');
    Deno.exit(1);
  }

  let fixedOwners = 0;
  for (const opp of oppsNoOwner) {
    const res = await client.reassignCommercialLead({
      opportunityId: opp.id,
      newOwnerId: defaultOwner,
      companyId: opp.companyId ?? undefined,
      reason: 'audit-repair: owner ausente',
    });
    if (res.ok) fixedOwners += 1;
  }

  let lifecycleNotes = 0;
  for (const [companyId, lifecycle] of lifecycleByCompany) {
    const res = await client.syncCompanyLifecycleNote({
      companyId,
      lifecycle,
      source: 'audit-repair-twenty',
    });
    if (res.ok) lifecycleNotes += 1;
  }

  console.log(`\nReparado: owners=${fixedOwners} lifecycle_notes=${lifecycleNotes}`);
}

main().catch(err => {
  console.error(err);
  Deno.exit(1);
});
