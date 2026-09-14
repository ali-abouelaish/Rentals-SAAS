-- BoldSign e-signing, phase 2: allow 'boldsign' as a contract signing method.
--
-- property_contracts.signing_method was created in 20260327110000_phase2_schema
-- as an inline CHECK, so Postgres named it property_contracts_signing_method_check.
-- The existing values ('adobe_sign', 'docusign') were manual record-keeping for
-- documents signed outside Harbor Ops; 'boldsign' differs in that we set it
-- ourselves when a request is actually sent through the integration.

alter table public.property_contracts
  drop constraint if exists property_contracts_signing_method_check;

alter table public.property_contracts
  add constraint property_contracts_signing_method_check
  check (signing_method in (
    'email',
    'whatsapp',
    'adobe_sign',
    'docusign',
    'boldsign',
    'paper',
    'other'
  ));
