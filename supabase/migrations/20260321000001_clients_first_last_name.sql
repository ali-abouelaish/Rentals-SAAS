-- Split clients.full_name into first_name + last_name
-- full_name becomes a GENERATED ALWAYS AS column so all existing queries continue to work

ALTER TABLE public.clients
  ADD COLUMN first_name text NOT NULL DEFAULT '',
  ADD COLUMN last_name  text NOT NULL DEFAULT '';

-- Populate from existing full_name data
UPDATE public.clients
SET
  first_name = TRIM(split_part(TRIM(full_name), ' ', 1)),
  last_name  = TRIM(
    CASE
      WHEN position(' ' IN TRIM(full_name)) > 0
      THEN substring(TRIM(full_name) FROM position(' ' IN TRIM(full_name)) + 1)
      ELSE ''
    END
  );

-- Remove defaults now that data is populated
ALTER TABLE public.clients
  ALTER COLUMN first_name DROP DEFAULT,
  ALTER COLUMN last_name  DROP DEFAULT;

-- Drop the original column
ALTER TABLE public.clients DROP COLUMN full_name;

-- Re-add as stored generated column so existing SELECT full_name queries keep working
ALTER TABLE public.clients
  ADD COLUMN full_name text GENERATED ALWAYS AS (
    CASE
      WHEN last_name = '' THEN first_name
      ELSE first_name || ' ' || last_name
    END
  ) STORED;

-- Update the existing full_name index to cover the new columns
DROP INDEX IF EXISTS public.idx_clients_full_name;
CREATE INDEX idx_clients_first_name ON public.clients (first_name);
CREATE INDEX idx_clients_last_name  ON public.clients (last_name);
