import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Image,
} from "@react-pdf/renderer";
import { formatGBP, formatDate } from "@/lib/utils/formatters";
import type { AgencyBranding } from "@/lib/email/branding";
import type { OwnerStatement, OwnerTransaction } from "../domain/types";
import { TRANSACTION_TYPE_LABELS } from "../domain/types";
import { summariseTransactions } from "../domain/derive";

type OwnerStatementPdfProps = {
  statement: OwnerStatement;
  owner: { name: string; email: string | null; phone: string | null; address?: string | null } | null;
  lines: OwnerTransaction[];
  propertyNames: Record<string, string>;
  agencyName: string;
  branding: AgencyBranding;
  /** Live-branding secondary colour, used for the accent rule. Optional. */
  secondaryColor?: string | null;
  periodLabel: string;
};

/** pence → "£1,234.56" */
function gbp(pence: number): string {
  return formatGBP(pence / 100);
}

/** A hex colour or a safe fallback (react-pdf throws on invalid colours). */
function safeColor(value: string | null | undefined, fallback: string): string {
  return typeof value === "string" && /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(value.trim())
    ? value.trim()
    : fallback;
}

const styles = StyleSheet.create({
  page: {
    paddingTop: 36,
    paddingBottom: 44,
    paddingHorizontal: 32,
    fontSize: 10,
    fontFamily: "Helvetica",
    color: "#333",
    backgroundColor: "#ffffff",
    lineHeight: 1.35,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 24,
  },
  agencyBlock: { flexGrow: 1, marginRight: 18 },
  agencyLogo: { maxWidth: 150, maxHeight: 56, marginBottom: 8, objectFit: "contain" },
  agencyName: { fontSize: 14, fontWeight: 700, marginBottom: 4 },
  agencyContact: { fontSize: 8, color: "#666", marginTop: 1 },
  /** Full-width rule in the brand colour, directly under the letterhead. */
  brandRule: { height: 3, borderRadius: 2, marginBottom: 18 },
  titleBlock: { width: 210, alignItems: "flex-end" },
  title: { fontSize: 18, fontWeight: 700, letterSpacing: 1, marginBottom: 6 },
  periodText: { fontSize: 10, fontWeight: 700, marginBottom: 4 },
  metaText: { fontSize: 9, color: "#555" },

  ownerRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 20 },
  card: {
    borderWidth: 1,
    borderColor: "#e3e3e3",
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 12,
    flex: 1,
  },
  sectionTitle: {
    fontSize: 9,
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 8,
    color: "#2c2c2c",
  },
  line: { fontSize: 9, marginVertical: 2 },

  summaryTable: {
    borderWidth: 1,
    borderColor: "#e2e2e2",
    borderRadius: 8,
    overflow: "hidden",
    marginBottom: 22,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
    fontSize: 10,
  },
  summaryLabel: { color: "#444" },
  summaryStrong: { fontWeight: 700, color: "#111" },
  summaryFinal: { color: "#ffffff", fontWeight: 700 },

  groupTitle: {
    fontSize: 10,
    fontWeight: 700,
    marginTop: 10,
    marginBottom: 6,
    color: "#2c2c2c",
  },
  table: {
    borderWidth: 1,
    borderColor: "#e2e2e2",
    borderRadius: 6,
    overflow: "hidden",
    marginBottom: 12,
  },
  tableHeader: { flexDirection: "row", color: "#ffffff", paddingVertical: 8, paddingHorizontal: 10 },
  th: { fontSize: 8, fontWeight: 700 },
  tr: {
    flexDirection: "row",
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#f2f2f2",
  },
  trAlt: { backgroundColor: "#fafafa" },
  colDate: { width: "18%", fontSize: 8 },
  colDesc: { width: "44%", fontSize: 8 },
  colType: { width: "20%", fontSize: 8 },
  colAmt: { width: "18%", fontSize: 8, textAlign: "right" },

  footer: {
    position: "absolute",
    bottom: 24,
    left: 32,
    right: 32,
    textAlign: "center",
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#e2e2e2",
    color: "#999",
    fontSize: 8,
    lineHeight: 1.4,
  },
});

export function OwnerStatementPdf({
  statement,
  owner,
  lines,
  propertyNames,
  agencyName,
  branding,
  secondaryColor,
  periodLabel,
}: OwnerStatementPdfProps) {
  const primary = safeColor(branding.primary_color, "#0F172A");
  // Secondary if the agency set one, else the accent — the rule under the
  // letterhead should never fall back to the same colour as the header text.
  const accent = safeColor(secondaryColor ?? branding.accent_color, primary);
  const generatedAt = new Date().toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  // Same roll-up the on-screen summary uses, so the two always agree:
  // closing = opening + net for the period − payments out ± adjustments.
  const totals = summariseTransactions(lines);

  // Group lines by property for the transaction detail.
  const groups = new Map<string, OwnerTransaction[]>();
  for (const l of lines) {
    const key = l.property_id ?? "__general__";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(l);
  }

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Letterhead: agency logo + name + contact details, then a brand rule. */}
        <View style={styles.headerRow}>
          <View style={styles.agencyBlock}>
            {branding.logo_url ? <Image src={branding.logo_url} style={styles.agencyLogo} /> : null}
            <Text style={[styles.agencyName, { color: primary }]}>{agencyName}</Text>
            {branding.footer_address ? (
              <Text style={styles.agencyContact}>{branding.footer_address}</Text>
            ) : null}
            {branding.reply_to_email ? (
              <Text style={styles.agencyContact}>{branding.reply_to_email}</Text>
            ) : null}
          </View>
          <View style={styles.titleBlock}>
            <Text style={[styles.title, { color: primary }]}>STATEMENT</Text>
            <Text style={styles.periodText}>{periodLabel}</Text>
            <Text style={styles.metaText}>
              {formatDate(statement.period_start)} – {formatDate(statement.period_end)}
            </Text>
          </View>
        </View>

        <View style={[styles.brandRule, { backgroundColor: accent }]} />

        <View style={styles.ownerRow}>
          <View style={[styles.card, { marginRight: 12 }]}>
            <Text style={styles.sectionTitle}>Landlord</Text>
            <Text style={[styles.line, { fontWeight: 700 }]}>{owner?.name ?? "Landlord"}</Text>
            {owner?.address ? <Text style={styles.line}>{owner.address}</Text> : null}
            {owner?.email ? <Text style={styles.line}>{owner.email}</Text> : null}
            {owner?.phone ? <Text style={styles.line}>{owner.phone}</Text> : null}
          </View>
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Statement</Text>
            <Text style={styles.line}>Status: {statement.status}</Text>
            <Text style={styles.line}>Generated: {formatDate(statement.generated_at)}</Text>
          </View>
        </View>

        <View style={styles.summaryTable}>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Opening balance</Text>
            <Text>{gbp(statement.opening_balance_pence)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Rent due</Text>
            <Text>{gbp(statement.total_rent_received_pence)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Management fee</Text>
            <Text>−{gbp(statement.total_management_fee_pence)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Works orders</Text>
            <Text>−{gbp(statement.total_works_pence)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Other deductions</Text>
            <Text>−{gbp(statement.total_other_pence)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryStrong}>Net for the period</Text>
            <Text style={styles.summaryStrong}>{gbp(statement.net_to_owner_pence)}</Text>
          </View>
          {totals.paidToOwner > 0 ? (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Paid to you this period</Text>
              <Text>−{gbp(totals.paidToOwner)}</Text>
            </View>
          ) : null}
          {totals.adjustments !== 0 ? (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Adjustments</Text>
              <Text>
                {totals.adjustments < 0 ? "−" : "+"}
                {gbp(Math.abs(totals.adjustments))}
              </Text>
            </View>
          ) : null}
          <View style={[styles.summaryRow, { backgroundColor: primary, borderBottomWidth: 0 }]}>
            <Text style={styles.summaryFinal}>Closing balance</Text>
            <Text style={styles.summaryFinal}>{gbp(statement.closing_balance_pence)}</Text>
          </View>
        </View>

        {lines.length > 0 ? (
          [...groups.entries()].map(([key, groupLines]) => (
            <View key={key} wrap={false}>
              <Text style={styles.groupTitle}>
                {key === "__general__" ? "General" : propertyNames[key] ?? "Property"}
              </Text>
              <View style={styles.table}>
                <View style={[styles.tableHeader, { backgroundColor: primary }]}>
                  <Text style={[styles.colDate, styles.th]}>Date</Text>
                  <Text style={[styles.colDesc, styles.th]}>Description</Text>
                  <Text style={[styles.colType, styles.th]}>Type</Text>
                  <Text style={[styles.colAmt, styles.th]}>Amount</Text>
                </View>
                {groupLines.map((l, i) => (
                  <View key={l.id} style={i % 2 === 1 ? [styles.tr, styles.trAlt] : styles.tr}>
                    <Text style={styles.colDate}>{formatDate(l.txn_date)}</Text>
                    <Text style={styles.colDesc}>{l.description ?? TRANSACTION_TYPE_LABELS[l.type]}</Text>
                    <Text style={styles.colType}>{TRANSACTION_TYPE_LABELS[l.type]}</Text>
                    <Text style={styles.colAmt}>
                      {l.direction === "out" ? "−" : "+"}
                      {gbp(l.amount_pence)}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          ))
        ) : (
          <Text style={styles.metaText}>No transactions recorded for this period.</Text>
        )}

        <View style={styles.footer} fixed>
          <Text style={{ color: primary, fontWeight: 700 }}>{agencyName}</Text>
          {branding.footer_address ? <Text>{branding.footer_address}</Text> : null}
          <Text>Generated on {generatedAt}</Text>
        </View>
      </Page>
    </Document>
  );
}
