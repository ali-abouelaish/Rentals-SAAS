// Stage 5: execute the diff's ordered operations. Runs ONLY with --commit.
//
// Transactionality: there is no Postgres connection string in .env.local, so
// writes go through supabase-js sequentially (NOT one transaction). If
// SUPABASE_DB_URL is added to .env.local later, ops run inside a single pg
// transaction with rollback on any error. Either way the pipeline is
// idempotent: reruns re-match via import_ref/natural keys and only write
// what is still missing, so a partial failure is repaired by rerunning.

import { readFileSync, existsSync } from "node:fs";

async function ensureAttachment(sb, op, log) {
  const a = op.attachment;
  if (!a) return;
  if (!a.localPath || !existsSync(a.localPath)) {
    log.push({ seq: op.seq, level: "warn", message: `attachment for ${op.label}: local PDF missing (${a.localPath ?? "no path"}) — ${a.urlColumn} left null` });
    return;
  }
  const file = readFileSync(a.localPath);
  const { error } = await sb.storage.from(a.bucket).upload(a.storagePath, file, { contentType: "application/pdf", upsert: true });
  if (error) {
    log.push({ seq: op.seq, level: "warn", message: `attachment upload failed for ${op.label}: ${error.message} — ${a.urlColumn} left null` });
    return;
  }
  const { data } = sb.storage.from(a.bucket).getPublicUrl(a.storagePath);
  op.values[a.urlColumn] = data.publicUrl;
  log.push({ seq: op.seq, level: "info", message: `uploaded ${a.fileRef ?? a.storagePath} -> ${data.publicUrl}` });
}

async function applyViaSupabase(sb, ops, log) {
  let done = 0;
  for (const op of ops) {
    await ensureAttachment(sb, op, log);
    if (op.kind === "insert") {
      const { error } = await sb.from(op.table).insert(op.values);
      if (error) throw new Error(`op ${op.seq} (${op.label}): insert ${op.table} failed: ${error.message}`);
    } else if (op.kind === "update") {
      const values = { ...op.values };
      if (["properties", "units", "pm_tenants", "property_contracts", "portfolio_bank_details"].includes(op.table)) {
        values.updated_at = new Date().toISOString(); // no DB trigger; app convention
      }
      const { error } = await sb.from(op.table).update(values).eq("id", op.id);
      if (error) throw new Error(`op ${op.seq} (${op.label}): update ${op.table} ${op.id} failed: ${error.message}`);
    } else {
      throw new Error(`unknown op kind ${op.kind}`);
    }
    done++;
    log.push({ seq: op.seq, level: "ok", message: op.label });
  }
  return done;
}

async function applyViaPg(sb, ops, log, dbUrl) {
  const { default: pg } = await import("pg");
  const client = new pg.Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
  await client.connect();
  try {
    // Storage uploads happen before the transaction (storage is not transactional anyway).
    for (const op of ops) await ensureAttachment(sb, op, log);

    await client.query("begin");
    for (const op of ops) {
      if (op.kind === "insert") {
        const cols = Object.keys(op.values);
        const params = cols.map((_, i) => `$${i + 1}`);
        await client.query(
          `insert into public.${op.table} (${cols.join(", ")}) values (${params.join(", ")})`,
          cols.map((c) => op.values[c]),
        );
      } else if (op.kind === "update") {
        const values = { ...op.values };
        if (["properties", "units", "pm_tenants", "property_contracts", "portfolio_bank_details"].includes(op.table)) {
          values.updated_at = new Date().toISOString();
        }
        const cols = Object.keys(values);
        const sets = cols.map((c, i) => `${c} = $${i + 1}`);
        await client.query(
          `update public.${op.table} set ${sets.join(", ")} where id = $${cols.length + 1}`,
          [...cols.map((c) => values[c]), op.id],
        );
      }
      log.push({ seq: op.seq, level: "ok", message: op.label });
    }
    await client.query("commit");
    return ops.length;
  } catch (e) {
    await client.query("rollback").catch(() => {});
    throw e;
  } finally {
    await client.end();
  }
}

export async function runApply(sb, diff, { commit = false } = {}) {
  const log = [];
  const ops = diff.ops;
  if (!commit) {
    return {
      committed: false,
      planned: ops.length,
      log: [{ level: "info", message: `dry run — ${ops.length} operations planned, nothing written. Re-run with --commit to apply.` }],
    };
  }
  const dbUrl = process.env.SUPABASE_DB_URL ?? process.env.DATABASE_URL ?? null;
  const mode = dbUrl ? "pg-transaction" : "supabase-js-sequential";
  if (!dbUrl) {
    log.push({ level: "warn", message: "no SUPABASE_DB_URL in env — applying via supabase-js sequentially (no single-transaction rollback). Reruns are idempotent and will repair a partial failure." });
  }
  const applied = dbUrl ? await applyViaPg(sb, ops, log, dbUrl) : await applyViaSupabase(sb, ops, log);
  return { committed: true, mode, planned: ops.length, applied, log };
}
