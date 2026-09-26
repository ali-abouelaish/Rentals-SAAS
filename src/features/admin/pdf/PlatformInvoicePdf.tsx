import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from "@react-pdf/renderer";

import { formatPence } from "@/lib/utils/formatters";

/**
 * A platform invoice — Harbor Ops billing an agency.
 *
 * Deliberately NOT agency-branded, unlike `OwnerStatementPdf`. That document is
 * the agency writing to its landlord and carries the agency's logo; this one is
 * us writing to the agency. Putting their own branding on a bill from us would
 * read as their own invoice to themselves.
 *
 * House style is borrowed from the owner statement — same page geometry, type
 * scale and table treatment — so the two look like they came from the same
 * system without sharing an identity.
 */

export type PlatformInvoicePdfLine = {
  kind: "integration" | "envelopes" | "adjustment" | "usage";
  description: string;
  quantity: number;
  unitPricePence: number;
  amountPence: number;
};

export type PlatformInvoicePdfProps = {
  invoiceNumber: string | null;
  periodLabel: string;
  periodStart: string;
  periodEnd: string;
  issuedAt: string | null;
  status: "draft" | "issued" | "paid" | "void";
  billTo: {
    agencyName: string;
    billingName: string | null;
    billingEmail: string | null;
    billingAddress: string | null;
  };
  lines: PlatformInvoicePdfLine[];
  subtotalPence: number;
  vatRateBps: number;
  vatPence: number;
  totalPence: number;
  /** Bank details for payment, if configured. */
  paymentNote: string | null;
};

const BRAND = "#0F172A";
const ACCENT = "#3B82F6";

const KIND_LABEL: Record<PlatformInvoicePdfLine["kind"], string> = {
  integration: "Subscription",
  envelopes: "Envelopes",
  usage: "Usage",
  adjustment: "Adjustment",
};

function gbp(pence: number): string {
  return formatPence(pence);
}

function formatDay(value: string | null): string {
  if (!value) return "—";
  return new Date(value.length === 10 ? `${value}T00:00:00Z` : value).toLocaleDateString(
    "en-GB",
    { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }
  );
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
    marginBottom: 20,
  },
  issuerBlock: { flexGrow: 1, marginRight: 18 },
  issuerName: { fontSize: 15, fontWeight: 700, marginBottom: 4, color: BRAND },
  issuerLine: { fontSize: 8, color: "#666", marginTop: 1 },
  brandRule: { height: 3, borderRadius: 2, marginBottom: 18, backgroundColor: BRAND },

  titleBlock: { width: 210, alignItems: "flex-end" },
  title: { fontSize: 18, fontWeight: 700, letterSpacing: 1, marginBottom: 6 },
  metaRow: { flexDirection: "row", justifyContent: "flex-end", marginTop: 2 },
  metaLabel: { fontSize: 9, color: "#666", marginRight: 6 },
  metaValue: { fontSize: 9, fontWeight: 700 },

  draftBanner: {
    backgroundColor: "#FEF3C7",
    borderWidth: 1,
    borderColor: "#FCD34D",
    borderRadius: 4,
    padding: 8,
    marginBottom: 16,
  },
  draftText: { fontSize: 9, color: "#92400E" },

  billToCard: {
    borderWidth: 1,
    borderColor: "#e3e3e3",
    borderRadius: 4,
    padding: 10,
    marginBottom: 20,
    width: 260,
  },
  cardLabel: {
    fontSize: 7,
    color: "#888",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  billToName: { fontSize: 11, fontWeight: 700, marginBottom: 2 },
  billToLine: { fontSize: 9, color: "#555", marginTop: 1 },

  tableHead: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: BRAND,
    paddingBottom: 5,
    marginBottom: 2,
  },
  th: { fontSize: 8, fontWeight: 700, color: BRAND, letterSpacing: 0.5 },
  row: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
    paddingVertical: 6,
  },
  cell: { fontSize: 9 },
  colKind: { width: 78 },
  colDesc: { flexGrow: 1 },
  colQty: { width: 40, textAlign: "right" },
  colUnit: { width: 70, textAlign: "right" },
  colAmount: { width: 72, textAlign: "right" },

  totalsBlock: { marginTop: 14, alignItems: "flex-end" },
  totalsRow: { flexDirection: "row", justifyContent: "flex-end", paddingVertical: 3 },
  totalsLabel: { fontSize: 9, color: "#555", width: 120, textAlign: "right", marginRight: 12 },
  totalsValue: { fontSize: 9, width: 80, textAlign: "right" },
  grandRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    paddingTop: 7,
    marginTop: 4,
    borderTopWidth: 2,
    borderTopColor: BRAND,
  },
  grandLabel: {
    fontSize: 11,
    fontWeight: 700,
    width: 120,
    textAlign: "right",
    marginRight: 12,
  },
  grandValue: { fontSize: 11, fontWeight: 700, width: 80, textAlign: "right" },

  paidStamp: {
    marginTop: 16,
    alignSelf: "flex-start",
    borderWidth: 2,
    borderColor: "#059669",
    borderRadius: 4,
    paddingVertical: 4,
    paddingHorizontal: 12,
  },
  paidText: { fontSize: 12, fontWeight: 700, color: "#059669", letterSpacing: 2 },

  paymentCard: {
    marginTop: 24,
    borderWidth: 1,
    borderColor: "#e3e3e3",
    borderRadius: 4,
    padding: 10,
  },
  paymentText: { fontSize: 9, color: "#555", lineHeight: 1.5 },

  footer: {
    position: "absolute",
    bottom: 22,
    left: 32,
    right: 32,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  footerText: { fontSize: 7, color: "#999" },

  empty: { fontSize: 9, color: "#888", paddingVertical: 10 },
});

export function PlatformInvoicePdf(props: PlatformInvoicePdfProps) {
  const {
    invoiceNumber,
    periodLabel,
    periodStart,
    periodEnd,
    issuedAt,
    status,
    billTo,
    lines,
    subtotalPence,
    vatRateBps,
    vatPence,
    totalPence,
    paymentNote,
  } = props;

  const showVat = vatRateBps > 0 || vatPence > 0;

  return (
    <Document
      title={`Invoice ${invoiceNumber ?? periodLabel} — ${billTo.agencyName}`}
      author="Harbor Ops"
    >
      <Page size="A4" style={styles.page}>
        <View style={styles.headerRow}>
          <View style={styles.issuerBlock}>
            <Text style={styles.issuerName}>Harbor Ops</Text>
            <Text style={styles.issuerLine}>harborops.co.uk</Text>
          </View>

          <View style={styles.titleBlock}>
            <Text style={[styles.title, { color: BRAND }]}>INVOICE</Text>
            {invoiceNumber && (
              <View style={styles.metaRow}>
                <Text style={styles.metaLabel}>Number</Text>
                <Text style={styles.metaValue}>{invoiceNumber}</Text>
              </View>
            )}
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Period</Text>
              <Text style={styles.metaValue}>{periodLabel}</Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Date</Text>
              <Text style={styles.metaValue}>{formatDay(issuedAt ?? periodStart)}</Text>
            </View>
          </View>
        </View>

        <View style={styles.brandRule} />

        {/* A draft is a working figure, not a bill. Anyone who ends up holding
            this file needs to know that from the document itself, not from the
            screen it was downloaded from. */}
        {status === "draft" && (
          <View style={styles.draftBanner}>
            <Text style={styles.draftText}>
              DRAFT — not yet issued. Figures may change and no payment is due.
            </Text>
          </View>
        )}

        {status === "void" && (
          <View style={styles.draftBanner}>
            <Text style={styles.draftText}>
              VOID — this invoice has been cancelled. Nothing is owed on it.
            </Text>
          </View>
        )}

        <View style={styles.billToCard}>
          <Text style={styles.cardLabel}>Bill to</Text>
          <Text style={styles.billToName}>{billTo.agencyName}</Text>
          {billTo.billingName && billTo.billingName !== billTo.agencyName && (
            <Text style={styles.billToLine}>{billTo.billingName}</Text>
          )}
          {billTo.billingAddress &&
            billTo.billingAddress
              .split("\n")
              .filter((line) => line.trim())
              .map((line, index) => (
                <Text key={index} style={styles.billToLine}>
                  {line.trim()}
                </Text>
              ))}
          {billTo.billingEmail && (
            <Text style={styles.billToLine}>{billTo.billingEmail}</Text>
          )}
        </View>

        <View style={styles.tableHead}>
          <Text style={[styles.th, styles.colKind]}>TYPE</Text>
          <Text style={[styles.th, styles.colDesc]}>DESCRIPTION</Text>
          <Text style={[styles.th, styles.colQty]}>QTY</Text>
          <Text style={[styles.th, styles.colUnit]}>UNIT</Text>
          <Text style={[styles.th, styles.colAmount]}>AMOUNT</Text>
        </View>

        {lines.length === 0 ? (
          <Text style={styles.empty}>No charges for this period.</Text>
        ) : (
          lines.map((line, index) => (
            <View key={index} style={styles.row} wrap={false}>
              <Text style={[styles.cell, styles.colKind, { color: "#777" }]}>
                {KIND_LABEL[line.kind]}
              </Text>
              <Text style={[styles.cell, styles.colDesc]}>{line.description}</Text>
              <Text style={[styles.cell, styles.colQty]}>{line.quantity}</Text>
              <Text style={[styles.cell, styles.colUnit]}>{gbp(line.unitPricePence)}</Text>
              <Text style={[styles.cell, styles.colAmount]}>{gbp(line.amountPence)}</Text>
            </View>
          ))
        )}

        <View style={styles.totalsBlock}>
          <View style={styles.totalsRow}>
            <Text style={styles.totalsLabel}>Subtotal</Text>
            <Text style={styles.totalsValue}>{gbp(subtotalPence)}</Text>
          </View>
          {showVat && (
            <View style={styles.totalsRow}>
              <Text style={styles.totalsLabel}>
                VAT ({(vatRateBps / 100).toFixed(vatRateBps % 100 === 0 ? 0 : 2)}%)
              </Text>
              <Text style={styles.totalsValue}>{gbp(vatPence)}</Text>
            </View>
          )}
          <View style={styles.grandRow}>
            <Text style={styles.grandLabel}>Total</Text>
            <Text style={styles.grandValue}>{gbp(totalPence)}</Text>
          </View>
        </View>

        {status === "paid" && (
          <View style={styles.paidStamp}>
            <Text style={styles.paidText}>PAID</Text>
          </View>
        )}

        {paymentNote && status !== "paid" && status !== "void" && (
          <View style={styles.paymentCard}>
            <Text style={styles.cardLabel}>Payment</Text>
            <Text style={styles.paymentText}>{paymentNote}</Text>
          </View>
        )}

        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>
            Harbor Ops · {periodLabel} · {formatDay(periodStart)} to {formatDay(periodEnd)}
          </Text>
          <Text
            style={styles.footerText}
            render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`}
          />
        </View>
      </Page>
    </Document>
  );
}
