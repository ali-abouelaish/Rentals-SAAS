// import_report.md writer — assembled from whichever stage artifacts exist.

function h(level, text) { return `${"#".repeat(level)} ${text}\n`; }
function code(v) { return v == null ? "—" : `\`${String(v).replace(/`/g, "'")}\``; }

function issueTable(issues) {
  if (!issues.length) return "_none_\n";
  const lines = ["| Sev | Category | Row | Tab | Detail |", "|---|---|---|---|---|"];
  for (const i of issues) {
    lines.push(`| ${i.severity} | ${i.category} | ${i.sheetRow ?? "—"} | ${i.tab ?? "—"} | ${String(i.message).replace(/\|/g, "\\|")} |`);
  }
  return lines.join("\n") + "\n";
}

export function buildReport({ parsed, graph, contracts, diff, applyResult, meta }) {
  const out = [];
  out.push(h(1, "Import report — AP Real Estate + Horizon Dreams"));
  out.push(`Generated: ${new Date().toISOString()}  `);
  out.push(`Source: ${code(parsed?.file)}  `);
  out.push(`Tenant: ${code(meta?.tenantId)} (${meta?.tenantName ?? "?"})  `);
  out.push(`Mode: **${applyResult?.committed ? "COMMITTED" : "dry run"}**  `);
  out.push(`import_ref migration applied: **${diff ? (diff.importRefReady ? "yes" : "NO — natural-key matching only; apply 20260612000001_import_ref_columns.sql")
    : "n/a"}**\n`);

  if (graph) {
    out.push(h(2, "Entity counts"));
    const c = graph.counts;
    out.push(`- properties: ${c.properties} (AP ${graph.properties.filter((p) => p.company === "ap").length}, Horizon ${graph.properties.filter((p) => p.company === "horizon").length})`);
    out.push(`- rooms: ${c.rooms}`);
    out.push(`- tenants: ${c.tenants}`);
    out.push(`- tenancies: ${c.tenancies} (needing tenant identity: ${c.tenanciesNeedingTenant})`);
    out.push(`- keybox codes: ${c.keys}; bank account blocks: ${c.bankDetails}`);
    out.push(`- issues: ${c.issues} (blocking: ${c.blocking})\n`);

    out.push(h(2, "Validation issues (every fix, warning and blocker)"));
    const bySev = { blocking: [], review: [], warning: [], info: [] };
    for (const i of graph.issues) (bySev[i.severity] ?? bySev.warning).push(i);
    for (const sev of ["blocking", "review", "warning", "info"]) {
      out.push(h(3, `${sev} (${bySev[sev].length})`));
      out.push(issueTable(bySev[sev]));
    }
  }

  if (contracts) {
    out.push(h(2, "Contract PDF extraction"));
    out.push(`Signed PDFs processed: ${contracts.results.length}\n`);
    if (contracts.results.length) {
      out.push("| Row | Tenancy | File | Downloaded | Start | End | Confidence | Tenant in PDF | Notes |");
      out.push("|---|---|---|---|---|---|---|---|---|");
      for (const r of contracts.results) {
        out.push(`| ${r.sheetRow} | ${r.label} | ${code(r.fileRef ?? r.driveFileId)} | ${r.downloaded ? "yes" : "NO"} | ${r.startDate ?? "—"} | ${r.endDate ?? "—"} | ${r.confidence} | ${r.tenantNameFound == null ? "—" : r.tenantNameFound ? "yes" : "NO"} | ${r.issues.join("; ") || "—"} |`);
      }
      out.push("");
    }
    out.push(h(3, `Manual entry list (${contracts.manualEntry.length}) — start dates / tenancies needing human input`));
    if (contracts.manualEntry.length) {
      out.push("| Row | Tenancy | Reason |");
      out.push("|---|---|---|");
      for (const m of contracts.manualEntry) out.push(`| ${m.sheetRow} | ${m.label} | ${m.reason} |`);
      out.push("");
    } else out.push("_none_\n");
  }

  if (diff) {
    out.push(h(2, "Diff vs current system state"));
    out.push("| Entity | create | update | conflicts reported | unchanged | system-only | review | manual |");
    out.push("|---|---|---|---|---|---|---|---|");
    for (const [k, s] of Object.entries(diff.summary)) {
      out.push(`| ${k} | ${s.creates} | ${s.updates} | ${s.conflictsReported} | ${s.unchanged} | ${s.systemOnly} | ${s.review} | ${s.manual ?? "—"} |`);
    }
    out.push("");

    out.push(h(3, "Field-level updates (auto-applicable: blank fills, canonical-map fixes)"));
    let any = false;
    for (const [entity, bucket] of Object.entries(diff.entities)) {
      for (const u of bucket.updates) {
        const fields = Object.entries(u.fields ?? {}).filter(([k]) => k !== "import_ref");
        if (!fields.length) continue;
        any = true;
        out.push(`- **${entity}** ${u.label ?? u.key} (${u.dbId})`);
        for (const [col, after] of fields) out.push(`  - ${col}: → ${code(after)}`);
      }
    }
    if (!any) out.push("_none_");
    out.push("");

    out.push(h(3, `Conflicts & review list (${diff.review.length}) — NOT applied`));
    if (diff.review.length) {
      out.push("| Entity | Item | Row | Field | System (before) | Sheet (after) | Reason |");
      out.push("|---|---|---|---|---|---|---|");
      for (const r of diff.review) {
        out.push(`| ${r.entityType} | ${r.label ?? r.key} | ${r.sheetRow ?? "—"} | ${r.field ?? "—"} | ${code(r.before)} | ${code(r.after)} | ${String(r.reason).replace(/\|/g, "\\|")} |`);
      }
      out.push("");
    } else out.push("_none_\n");

    out.push(h(3, "Creates"));
    for (const [entity, bucket] of Object.entries(diff.entities)) {
      if (!bucket.creates.length) continue;
      out.push(`- **${entity}** (${bucket.creates.length}): ${bucket.creates.map((c) => c.label ?? c.key).join("; ")}`);
    }
    out.push("");

    out.push(h(3, "System-only records (in database, not in sheet — never deleted)"));
    for (const [entity, bucket] of Object.entries(diff.entities)) {
      if (!bucket.systemOnly.length) continue;
      out.push(`<details><summary><b>${entity}</b> (${bucket.systemOnly.length})</summary>\n`);
      for (const s of bucket.systemOnly) out.push(`- ${s.label}`);
      out.push("\n</details>\n");
    }
  }

  if (parsed) {
    out.push(h(2, "Raw dump — Keybox Codes tab (for human review)"));
    out.push("| Row | Company | Address | Code |");
    out.push("|---|---|---|---|");
    for (const r of parsed.keybox.rows) out.push(`| ${r.sheetRow} | ${r.company} | ${r.address} | ${code(r.code)} |`);
    out.push("");
    out.push(h(2, "Raw dump — Agent Info tab (for human review)"));
    out.push("| Row | A | B | C |");
    out.push("|---|---|---|---|");
    for (const r of parsed.agentInfo.raw) out.push(`| ${r.sheetRow} | ${r.a ?? ""} | ${r.b ?? ""} | ${r.c ?? ""}${r.link ? ` (${r.link})` : ""} |`);
    out.push("");
  }

  if (applyResult) {
    out.push(h(2, "Apply"));
    out.push(applyResult.committed
      ? `Committed ${applyResult.applied}/${applyResult.planned} operations via ${applyResult.mode}.`
      : `Dry run — ${applyResult.planned} operations planned, nothing written.`);
    out.push("");
    for (const l of applyResult.log) out.push(`- [${l.level}] ${l.message}`);
    out.push("");
  }

  out.push(h(2, "Standing decisions & caveats"));
  out.push("- Deposit = one month's rent (= PCM) on every tenancy; under the 5-week TFA cap.");
  out.push("- Deposit scheme / protection refs unknown — left `none`/null (Harbor Ops mydeposits integration can protect later).");
  out.push("- Landlord/owner records unknown — left null.");
  out.push("- Rent due day, payment method, arrears: out of scope until the rent & cost tracker arrives (stage bolts on later).");
  out.push("- rent_payments rows are NOT created by this import (payments are file 2 scope).");
  out.push("- Nothing is ever deleted because it is absent from the sheet.");
  return out.join("\n") + "\n";
}
