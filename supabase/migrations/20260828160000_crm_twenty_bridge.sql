-- Puente CRM warehouse ↔ Twenty (IDs + owner comercial).

ALTER TABLE crm_accounts
  ADD COLUMN IF NOT EXISTS twenty_company_id TEXT;

ALTER TABLE crm_contacts
  ADD COLUMN IF NOT EXISTS twenty_person_id TEXT;

ALTER TABLE crm_opportunities
  ADD COLUMN IF NOT EXISTS twenty_opportunity_id TEXT,
  ADD COLUMN IF NOT EXISTS twenty_person_id TEXT,
  ADD COLUMN IF NOT EXISTS twenty_company_id TEXT,
  ADD COLUMN IF NOT EXISTS twenty_owner_id TEXT;

ALTER TABLE admin_profiles
  ADD COLUMN IF NOT EXISTS twenty_member_id TEXT;

CREATE INDEX IF NOT EXISTS idx_crm_opportunities_twenty_opp
  ON crm_opportunities (twenty_opportunity_id)
  WHERE twenty_opportunity_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_crm_contacts_twenty_person
  ON crm_contacts (twenty_person_id)
  WHERE twenty_person_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_crm_accounts_twenty_company
  ON crm_accounts (twenty_company_id)
  WHERE twenty_company_id IS NOT NULL;
