-- Corrige el teléfono de Jungho Lee. El +57 se antepuso a un móvil de Corea.
-- Solo estas dos filas:
--   crm_contacts 40bd33bc-b2f0-4093-b82f-05e279536667
--   clientes con id aaef9981… y teléfono +57821092702720
-- twenty_company_id no existe en crm_contacts; se escribe solo si la columna está.
-- Reejecutar no reescribe un valor que ya coincide (IS DISTINCT FROM).

DO $jungho$
DECLARE
  contact_id constant uuid := '40bd33bc-b2f0-4093-b82f-05e279536667';
  person_id constant text := 'c7ad7e9f-5ecf-4640-97b2-3116eebc3116';
  company_id constant text := '5b668545-bf8a-4733-b13f-7a127b5ac0ea';
  new_phone constant text := '+821092702720';
  old_phone constant text := '+57821092702720';
  sets text[] := ARRAY[]::text[];
  preds text[] := ARRAY[]::text[];
  updated integer;
  contact_phone text;
  contact_person text;
  contact_company text;
  client_id text;
  client_phone text;
  client_person text;
  client_company text;
  client_rows integer;
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'crm_contacts'
      AND column_name = 'telefono_e164'
  ) THEN
    sets := sets || format('telefono_e164 = %L', new_phone);
    preds := preds || format('telefono_e164 IS DISTINCT FROM %L', new_phone);
  ELSE
    RAISE EXCEPTION 'crm_contacts.telefono_e164 no existe';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'crm_contacts'
      AND column_name = 'twenty_person_id'
  ) THEN
    sets := sets || format('twenty_person_id = %L', person_id);
    preds := preds || format('twenty_person_id IS DISTINCT FROM %L', person_id);
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'crm_contacts'
      AND column_name = 'twenty_company_id'
  ) THEN
    sets := sets || format('twenty_company_id = %L', company_id);
    preds := preds || format('twenty_company_id IS DISTINCT FROM %L', company_id);
  END IF;

  EXECUTE format(
    'WITH updated AS ('
    || 'UPDATE public.crm_contacts SET %s '
    || 'WHERE id = %L AND (%s) '
    || 'RETURNING id) '
    || 'SELECT count(*)::int FROM updated',
    array_to_string(sets, ', '),
    contact_id,
    array_to_string(preds, ' OR ')
  ) INTO updated;

  IF updated > 1 THEN
    RAISE EXCEPTION 'crm_contacts actualizados: %', updated;
  END IF;

  sets := ARRAY[]::text[];
  preds := ARRAY[]::text[];

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'clientes'
      AND column_name = 'telefono'
  ) THEN
    RAISE EXCEPTION 'clientes.telefono no existe';
  END IF;

  sets := sets || format('telefono = %L', new_phone);
  preds := preds || format('telefono IS DISTINCT FROM %L', new_phone);

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'clientes'
      AND column_name = 'twenty_person_id'
  ) THEN
    sets := sets || format('twenty_person_id = %L', person_id);
    preds := preds || format('twenty_person_id IS DISTINCT FROM %L', person_id);
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'clientes'
      AND column_name = 'twenty_company_id'
  ) THEN
    sets := sets || format('twenty_company_id = %L', company_id);
    preds := preds || format('twenty_company_id IS DISTINCT FROM %L', company_id);
  END IF;

  EXECUTE format(
    'WITH updated AS ('
    || 'UPDATE public.clientes SET %s '
    || 'WHERE id::text LIKE %L AND telefono = %L AND (%s) '
    || 'RETURNING id) '
    || 'SELECT count(*)::int FROM updated',
    array_to_string(sets, ', '),
    'aaef9981%',
    old_phone,
    array_to_string(preds, ' OR ')
  ) INTO updated;

  IF updated > 1 THEN
    RAISE EXCEPTION 'clientes actualizados: %', updated;
  END IF;

  SELECT telefono_e164, twenty_person_id
  INTO contact_phone, contact_person
  FROM public.crm_contacts
  WHERE id = contact_id;

  IF contact_phone IS DISTINCT FROM new_phone THEN
    RAISE EXCEPTION 'crm_contacts.telefono_e164 quedó %', contact_phone;
  END IF;
  IF contact_person IS DISTINCT FROM person_id THEN
    RAISE EXCEPTION 'crm_contacts.twenty_person_id quedó %', contact_person;
  END IF;

  contact_company := 'column_absent';
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'crm_contacts'
      AND column_name = 'twenty_company_id'
  ) THEN
    EXECUTE format(
      'SELECT twenty_company_id FROM public.crm_contacts WHERE id = %L',
      contact_id
    ) INTO contact_company;
    IF contact_company IS DISTINCT FROM company_id THEN
      RAISE EXCEPTION 'crm_contacts.twenty_company_id quedó %', contact_company;
    END IF;
  END IF;

  SELECT count(*)::int
  INTO client_rows
  FROM public.clientes
  WHERE id::text LIKE 'aaef9981%'
    AND telefono = new_phone;

  IF client_rows IS DISTINCT FROM 1 THEN
    RAISE EXCEPTION 'clientes con aaef9981 y %: %', new_phone, client_rows;
  END IF;

  SELECT id::text, telefono, twenty_person_id, twenty_company_id
  INTO client_id, client_phone, client_person, client_company
  FROM public.clientes
  WHERE id::text LIKE 'aaef9981%'
    AND telefono = new_phone;

  IF client_phone IS DISTINCT FROM new_phone
    OR client_person IS DISTINCT FROM person_id
    OR client_company IS DISTINCT FROM company_id
  THEN
    RAISE EXCEPTION
      'clientes quedó id=% phone=% person=% company=%',
      client_id, client_phone, client_person, client_company;
  END IF;

  RAISE NOTICE
    'jungho_verify contact_id=% contact_phone=% contact_person=% contact_company=% client_id=% client_phone=% client_person=% client_company=%',
    contact_id, contact_phone, contact_person, contact_company,
    client_id, client_phone, client_person, client_company;
END
$jungho$;
