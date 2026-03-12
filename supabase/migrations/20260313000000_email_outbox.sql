-- Email outbox: queue for async sending (replaces Prisma-managed table)
CREATE TYPE email_outbox_status AS ENUM ('queued', 'sending', 'sent', 'failed');

CREATE TABLE email_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text,
  "to" text NOT NULL,
  subject text NOT NULL,
  html text NOT NULL,
  text text,
  status email_outbox_status NOT NULL DEFAULT 'queued',
  attempts int NOT NULL DEFAULT 0,
  last_error text,
  provider_message_id text,
  send_after timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Atomically claim up to lim queued rows (FOR UPDATE SKIP LOCKED), mark as sending, return rows
CREATE OR REPLACE FUNCTION claim_email_outbox_batch(lim int)
RETURNS SETOF email_outbox
LANGUAGE sql
SECURITY DEFINER
AS $$
  WITH to_claim AS (
    SELECT id FROM email_outbox
    WHERE status = 'queued'
      AND send_after <= now()
      AND attempts < 5
    ORDER BY send_after ASC
    LIMIT lim
    FOR UPDATE SKIP LOCKED
  ),
  updated AS (
    UPDATE email_outbox e
    SET status = 'sending', updated_at = now()
    FROM to_claim t
    WHERE e.id = t.id
    RETURNING e.*
  )
  SELECT * FROM updated;
$$;

-- Mark one row as failed: increment attempts, set last_error; requeue with backoff or set failed
CREATE OR REPLACE FUNCTION mark_email_outbox_failed(p_id uuid, p_error text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  cur_attempts int;
  next_attempts int;
  is_final boolean;
  backoff_minutes int[] := ARRAY[1, 5, 15, 60, 360];
  send_after_new timestamptz;
  idx int;
BEGIN
  SELECT attempts INTO cur_attempts FROM email_outbox WHERE id = p_id;
  IF NOT FOUND THEN
    RETURN;
  END IF;
  next_attempts := cur_attempts + 1;
  is_final := next_attempts >= 5;
  idx := LEAST(cur_attempts, 4) + 1;
  send_after_new := now() + (backoff_minutes[idx] * interval '1 minute');

  UPDATE email_outbox
  SET
    attempts = next_attempts,
    last_error = p_error,
    status = CASE WHEN is_final THEN 'failed'::email_outbox_status ELSE 'queued'::email_outbox_status END,
    send_after = CASE WHEN is_final THEN send_after ELSE send_after_new END,
    updated_at = now()
  WHERE id = p_id;
END;
$$;
