// The works order document — the instruction an agency issues to a contractor,
// and the thing the contractor signs to accept it.
//
// Follows the house PDF style set by OwnerStatementPdf: agency letterhead, a
// brand-coloured rule, cards for the parties, a costed table, and a footer.
//
// The signature block is positioned ABSOLUTELY, at coordinates exported from
// worksOrderFields.ts. That is deliberate: e-signature fields are placed by
// coordinate, so the box the contractor sees and the field BoldSign overlays on
// it have to come from the same numbers. Laying it out in the normal flow would
// let the two drift apart every time the document above it changed length.

import {
  Document,
  Image,
  Page,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";

import type { AgencyBranding } from "@/lib/email/branding";
import { formatDate, formatGBP } from "@/lib/utils/formatters";

import {
  JOB_CATEGORY_LABELS,
  JOB_PRIORITY_LABELS,
  type MaintenanceCost,
  type MaintenanceJob,
  type MaintenanceSupplier,
} from "../domain/types";
import {
  captionBottom,
  DATE_BOX_LEFT,
  SIGNATURE_BLOCK,
  WORKS_ORDER_PAGE,
} from "../domain/worksOrderFields";

export type WorksOrderPdfProps = {
  job: MaintenanceJob;
  supplier: MaintenanceSupplier | null;
  costs: MaintenanceCost[];
  propertyName: string;
  propertyAddress: string | null;
  unitLabel: string | null;
  agencyName: string;
  branding: AgencyBranding;
  secondaryColor?: string | null;
  /** Free-text terms shown above the signature block. */
  terms?: string | null;
};

/** pence → "£1,234.56" */
function gbp(pence: number): string {
  return formatGBP(pence / 100);
}

/** react-pdf throws on a malformed colour, so anything odd falls back. */
function safeColor(value: string | null | undefined, fallback: string): string {
  return typeof value === "string" && /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(value.trim())
    ? value.trim()
    : fallback;
}

const DEFAULT_TERMS =
  "By signing, the contractor accepts this works order and agrees to carry out the work described " +
  "above at the costs stated. Any additional work or cost must be agreed in writing with the " +
  "agency before it is carried out. Invoices must quote the works order reference.";

const styles = StyleSheet.create({
  page: {
    paddingTop: 36,
    // Space is reserved at the foot of the page so flowing content can never
    // run underneath the absolutely-positioned signature block.
    paddingBottom: SIGNATURE_BLOCK.reservedBottomSpace,
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
  brandRule: { height: 3, borderRadius: 2, marginBottom: 18 },
  titleBlock: { width: 210, alignItems: "flex-end" },
  title: { fontSize: 18, fontWeight: 700, letterSpacing: 1, marginBottom: 6 },
  reference: { fontSize: 11, fontWeight: 700, marginBottom: 4 },
  metaText: { fontSize: 9, color: "#555" },

  partyRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 20 },
  card: {
    borderWidth: 1,
    borderColor: "#e3e3e3",
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 12,
    flex: 1,
  },
  cardSpacer: { width: 12 },
  sectionTitle: {
    fontSize: 9,
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 8,
    color: "#2c2c2c",
  },
  line: { fontSize: 9, marginVertical: 2 },
  muted: { fontSize: 9, color: "#777", marginVertical: 2 },

  detailGrid: { flexDirection: "row", flexWrap: "wrap", marginBottom: 6 },
  detailCell: { width: "33.33%", marginBottom: 10 },
  detailLabel: {
    fontSize: 7.5,
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    color: "#888",
    marginBottom: 2,
  },
  detailValue: { fontSize: 10 },

  description: {
    borderWidth: 1,
    borderColor: "#e3e3e3",
    borderRadius: 8,
    padding: 12,
    marginBottom: 20,
  },
  descriptionText: { fontSize: 10, lineHeight: 1.5 },

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
  colDesc: { width: "52%", fontSize: 8 },
  colAmt: { width: "30%", fontSize: 8, textAlign: "right" },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  totalLabel: { fontSize: 10, fontWeight: 700, color: "#ffffff" },
  totalValue: { fontSize: 11, fontWeight: 700, color: "#ffffff" },

  terms: { fontSize: 8, color: "#666", lineHeight: 1.5, marginBottom: 8 },

  // ── Signature block ──────────────────────────────────────────────
  // Each BOX is positioned absolutely from the page bottom, using the exact
  // numbers worksOrderSignatureFields() converts into BoldSign coordinates.
  // Wrapping box + caption in one positioned container would make `bottom`
  // refer to the caption instead, putting the field below the box it fills.
  signatureBox: {
    position: "absolute",
    left: SIGNATURE_BLOCK.left,
    bottom: SIGNATURE_BLOCK.bottom,
    width: SIGNATURE_BLOCK.signature.width,
    height: SIGNATURE_BLOCK.signature.height,
    borderWidth: 1,
    borderColor: "#c9c9c9",
    borderStyle: "dashed",
    borderRadius: 4,
  },
  dateBox: {
    position: "absolute",
    left: DATE_BOX_LEFT,
    bottom: SIGNATURE_BLOCK.bottom,
    width: SIGNATURE_BLOCK.dateSigned.width,
    height: SIGNATURE_BLOCK.dateSigned.height,
    borderWidth: 1,
    borderColor: "#c9c9c9",
    borderStyle: "dashed",
    borderRadius: 4,
  },
  // Captions sit ABOVE their boxes, matching the app's label-above-field rule
  // and keeping the box's own `bottom` unambiguous.
  signatureCaption: {
    position: "absolute",
    left: SIGNATURE_BLOCK.left,
    bottom: captionBottom(SIGNATURE_BLOCK.signature.height),
    width: SIGNATURE_BLOCK.signature.width,
    fontSize: 7.5,
    color: "#888",
  },
  dateCaption: {
    position: "absolute",
    left: DATE_BOX_LEFT,
    bottom: captionBottom(SIGNATURE_BLOCK.dateSigned.height),
    width: SIGNATURE_BLOCK.dateSigned.width,
    fontSize: 7.5,
    color: "#888",
  },

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

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailCell}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

export function WorksOrderPdf({
  job,
  supplier,
  costs,
  propertyName,
  propertyAddress,
  unitLabel,
  agencyName,
  branding,
  secondaryColor,
  terms,
}: WorksOrderPdfProps) {
  const primary = safeColor(branding.primary_color, "#0F172A");
  const accent = safeColor(secondaryColor ?? branding.accent_color, primary);

  const total = costs.reduce((sum, cost) => sum + cost.amount, 0) || job.total_cost;
  const issuedAt = formatDate(new Date());

  return (
    <Document
      title={`Works order ${job.reference}`}
      author={agencyName}
      subject={job.title}
    >
      <Page size="A4" style={styles.page}>
        {/* ── Letterhead ─────────────────────────────────────────── */}
        <View style={styles.headerRow}>
          <View style={styles.agencyBlock}>
            {branding.logo_url ? (
              // eslint-disable-next-line jsx-a11y/alt-text -- react-pdf Image takes no alt
              <Image style={styles.agencyLogo} src={branding.logo_url} />
            ) : null}
            <Text style={[styles.agencyName, { color: primary }]}>{agencyName}</Text>
            {branding.reply_to_email ? (
              <Text style={styles.agencyContact}>{branding.reply_to_email}</Text>
            ) : null}
          </View>

          <View style={styles.titleBlock}>
            <Text style={[styles.title, { color: primary }]}>WORKS ORDER</Text>
            <Text style={styles.reference}>{job.reference}</Text>
            <Text style={styles.metaText}>Issued {issuedAt}</Text>
            <Text style={styles.metaText}>
              {JOB_PRIORITY_LABELS[job.priority]} priority
            </Text>
          </View>
        </View>
        <View style={[styles.brandRule, { backgroundColor: accent }]} />

        {/* ── Parties ────────────────────────────────────────────── */}
        <View style={styles.partyRow}>
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Contractor</Text>
            {supplier ? (
              <>
                <Text style={styles.line}>{supplier.name}</Text>
                {supplier.contact_name ? (
                  <Text style={styles.line}>{supplier.contact_name}</Text>
                ) : null}
                {supplier.email ? <Text style={styles.line}>{supplier.email}</Text> : null}
                {supplier.phone ? <Text style={styles.line}>{supplier.phone}</Text> : null}
              </>
            ) : (
              <Text style={styles.muted}>No contractor assigned</Text>
            )}
          </View>

          <View style={styles.cardSpacer} />

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Location</Text>
            <Text style={styles.line}>{propertyName}</Text>
            {unitLabel ? <Text style={styles.line}>{unitLabel}</Text> : null}
            {propertyAddress ? <Text style={styles.line}>{propertyAddress}</Text> : null}
          </View>
        </View>

        {/* ── Work details ───────────────────────────────────────── */}
        <Text style={styles.sectionTitle}>Work required</Text>
        <View style={styles.detailGrid}>
          <Detail label="Trade" value={JOB_CATEGORY_LABELS[job.category]} />
          <Detail label="Priority" value={JOB_PRIORITY_LABELS[job.priority]} />
          <Detail
            label="Scheduled"
            value={job.scheduled_date ? formatDate(job.scheduled_date) : "To be arranged"}
          />
        </View>

        <View style={styles.description}>
          <Text style={[styles.descriptionText, { fontWeight: 700 }]}>{job.title}</Text>
          {job.description ? (
            <Text style={[styles.descriptionText, { marginTop: 6 }]}>{job.description}</Text>
          ) : null}
        </View>

        {/* ── Costs ──────────────────────────────────────────────── */}
        <Text style={styles.sectionTitle}>Agreed costs</Text>
        {costs.length > 0 ? (
          <View style={styles.table}>
            <View style={[styles.tableHeader, { backgroundColor: primary }]}>
              <Text style={[styles.th, styles.colDate]}>Date</Text>
              <Text style={[styles.th, styles.colDesc]}>Description</Text>
              <Text style={[styles.th, styles.colAmt]}>Amount</Text>
            </View>
            {costs.map((cost, index) => (
              <View
                key={cost.id}
                style={index % 2 === 1 ? [styles.tr, styles.trAlt] : styles.tr}
              >
                <Text style={styles.colDate}>{formatDate(cost.date_incurred)}</Text>
                <Text style={styles.colDesc}>{cost.description}</Text>
                <Text style={styles.colAmt}>{gbp(cost.amount)}</Text>
              </View>
            ))}
            <View style={[styles.totalRow, { backgroundColor: primary }]}>
              <Text style={styles.totalLabel}>Total</Text>
              <Text style={styles.totalValue}>{gbp(total)}</Text>
            </View>
          </View>
        ) : (
          <View style={styles.description}>
            <Text style={styles.muted}>
              No costs agreed in advance. Submit a quote before starting work.
            </Text>
          </View>
        )}

        <Text style={styles.terms}>{terms?.trim() || DEFAULT_TERMS}</Text>

        {/* ── Signature block ────────────────────────────────────── */}
        {/* Geometry comes from worksOrderFields.ts so the drawn boxes and the
            BoldSign fields overlaid on them cannot drift apart. */}
        <Text style={styles.signatureCaption}>
          Signed for and on behalf of {supplier?.name ?? "the contractor"}
        </Text>
        <View style={styles.signatureBox} />
        <Text style={styles.dateCaption}>Date signed</Text>
        <View style={styles.dateBox} />

        <Text
          style={styles.footer}
          fixed
          render={({ pageNumber, totalPages }) =>
            `${agencyName} · Works order ${job.reference} · Page ${pageNumber} of ${totalPages}`
          }
        />
      </Page>
    </Document>
  );
}

export { WORKS_ORDER_PAGE };
