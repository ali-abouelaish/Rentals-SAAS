import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Image
} from "@react-pdf/renderer";
import { formatGBP, formatDate } from "@/lib/utils/formatters";

type InvoicePdfProps = {
  invoice: {
    invoice_number: string;
    issue_date: string;
    due_date: string;
    payment_terms_days: number;
    balance_due: number;
    subtotal: number;
    total: number;
    status: string;
    notes: string | null;
    created_at: string;
    landlords?: {
      name: string;
      billing_address?: string | null;
      email?: string | null;
      contact?: string | null;
    } | null;
    billing_profiles?: {
      sender_company_name: string;
      sender_address?: string | null;
      sender_email?: string | null;
      sender_phone?: string | null;
      bank_account_holder_name: string;
      bank_account_number: string;
      bank_sort_code: string;
      logo_url?: string | null;
      footer_thank_you_text: string;
    } | null;
    created_by?: { display_name: string | null } | null;
  };
  items: Array<{
    description: string;
    quantity: number;
    rate: number;
    amount: number;
  }>;
};

const styles = StyleSheet.create({
  page: {
    paddingTop: 36,
    paddingBottom: 36,
    paddingHorizontal: 32,
    fontSize: 10,
    fontFamily: "Helvetica",
    color: "#333",
    backgroundColor: "#ffffff",
    lineHeight: 1.35
  },

  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 26
  },

  companyInfo: {
    flexGrow: 1,
    marginRight: 18
  },

  companyLogo: {
    width: 78,
    height: 78,
    marginBottom: 10,
    borderRadius: 6,
    objectFit: "contain"
  },

  companyTitle: {
    fontSize: 14,
    fontWeight: 700,
    marginBottom: 8,
    color: "#2c2c2c"
  },

  companyLine: {
    fontSize: 9,
    marginVertical: 2,
    color: "#333"
  },

  invoiceDetails: {
    width: 228,
    alignItems: "flex-end"
  },

  invoiceTitle: {
    fontSize: 18,
    fontWeight: 700,
    color: "#2c2c2c",
    letterSpacing: 1,
    marginBottom: 6
  },

  invoiceNumber: {
    fontSize: 10,
    fontWeight: 700,
    marginBottom: 10
  },

  invoiceMeta: {
    backgroundColor: "#f6f6f6",
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e1e1e1",
    width: "100%",
    marginBottom: 10
  },

  invoiceMetaRow: {
    fontSize: 9,
    marginVertical: 3
  },

  statusRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    width: "100%",
    marginBottom: 10
  },

  statusBadge: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 999,
    fontSize: 8,
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: 0.5
  },

  statusDraft: { backgroundColor: "#f3f4f6", color: "#374151" },
  statusSent: { backgroundColor: "#dbeafe", color: "#1e40af" },
  statusPaid: { backgroundColor: "#d1fae5", color: "#065f46" },
  statusOverdue: { backgroundColor: "#fee2e2", color: "#991b1b" },
  statusCancelled: { backgroundColor: "#f3f4f6", color: "#374151" },

  balanceDueBox: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#d6d6d6",
    backgroundColor: "#f1f1f1",
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%"
  },

  balanceDueText: {
    fontSize: 10,
    fontWeight: 700,
    color: "#2c2c2c"
  },

  billingRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 22
  },

  billingColumn: {
    flex: 1,
    marginRight: 12
  },

  infoCard: {
    borderWidth: 1,
    borderColor: "#e3e3e3",
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 12
  },

  sectionTitle: {
    fontSize: 10,
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 8,
    color: "#2c2c2c"
  },

  clientLine: {
    fontSize: 9,
    marginVertical: 2
  },

  itemsTable: {
    borderWidth: 1,
    borderColor: "#e2e2e2",
    borderRadius: 8,
    overflow: "hidden",
    marginBottom: 18
  },

  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#2c2c2c",
    color: "#ffffff",
    paddingVertical: 11,
    paddingHorizontal: 12
  },

  headerCell: {
    fontSize: 9,
    fontWeight: 700
  },

  tableRow: {
    flexDirection: "row",
    paddingVertical: 11,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0"
  },

  rowAlt: {
    backgroundColor: "#fafafa"
  },

  colItem: { width: "50%" },
  colQty: { width: "15%", textAlign: "center" },
  colRate: { width: "17.5%", textAlign: "right" },
  colAmount: { width: "17.5%", textAlign: "right" },

  totalsSection: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginBottom: 18
  },

  totalsTable: {
    width: 228,
    borderWidth: 1,
    borderColor: "#e2e2e2",
    borderRadius: 8,
    overflow: "hidden"
  },

  totalsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
    fontSize: 9
  },

  totalsRowFinal: {
    backgroundColor: "#2c2c2c",
    color: "#ffffff",
    fontWeight: 700
  },

  notesSection: {
    marginTop: 16,
    paddingTop: 12,
    paddingBottom: 10,
    borderTopWidth: 1,
    borderTopColor: "#e2e2e2"
  },

  notesTitle: {
    fontSize: 10,
    fontWeight: 700,
    marginBottom: 7,
    color: "#2c2c2c"
  },

  notesText: {
    fontSize: 9,
    color: "#666",
    lineHeight: 1.45
  },

  footer: {
    marginTop: 22,
    textAlign: "center",
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#e2e2e2",
    color: "#999",
    fontSize: 9,
    lineHeight: 1.35
  }
});

export function InvoicePdf({ invoice, items }: InvoicePdfProps) {
  const sender = invoice.billing_profiles;
  const receiver = invoice.landlords;
  const generatedBy = invoice.created_by?.display_name ?? "Agent";
  const generatedAt = new Date().toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });

  const statusKey = invoice.status?.toLowerCase() ?? "draft";
  const statusStyle =
    statusKey === "sent"
      ? styles.statusSent
      : statusKey === "paid"
      ? styles.statusPaid
      : statusKey === "overdue"
      ? styles.statusOverdue
      : statusKey === "cancelled"
      ? styles.statusCancelled
      : styles.statusDraft;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.headerRow}>
          <View style={styles.companyInfo}>
            {sender?.logo_url ? (
              <Image src={sender.logo_url} style={styles.companyLogo} />
            ) : null}

            <Text style={styles.companyTitle}>
              {sender?.sender_company_name ?? ""}
            </Text>

            <Text style={styles.companyLine}>
              <Text style={{ fontWeight: 700 }}>Business Banking</Text>
            </Text>
            <Text style={styles.companyLine}>
              <Text style={{ fontWeight: 700 }}>Account holder name:</Text>{" "}
              {sender?.bank_account_holder_name ?? ""}
            </Text>
            <Text style={styles.companyLine}>
              <Text style={{ fontWeight: 700 }}>Account number:</Text>{" "}
              {sender?.bank_account_number ?? ""}
            </Text>
            <Text style={styles.companyLine}>
              <Text style={{ fontWeight: 700 }}>Sort code:</Text>{" "}
              {sender?.bank_sort_code ?? ""}
            </Text>
          </View>

          <View style={styles.invoiceDetails}>
            <Text style={styles.invoiceTitle}>INVOICE</Text>
            <Text style={styles.invoiceNumber}># {invoice.invoice_number}</Text>

            <View style={styles.invoiceMeta}>
              <Text style={styles.invoiceMetaRow}>
                <Text style={{ fontWeight: 700 }}>Date:</Text>{" "}
                {formatDate(invoice.issue_date)}
              </Text>
              <Text style={styles.invoiceMetaRow}>
                <Text style={{ fontWeight: 700 }}>Payment Terms:</Text>{" "}
                Net {invoice.payment_terms_days} days
              </Text>
              <Text style={styles.invoiceMetaRow}>
                <Text style={{ fontWeight: 700 }}>Due Date:</Text>{" "}
                {formatDate(invoice.due_date)}
              </Text>
            </View>

            <View style={styles.statusRow}>
              <Text style={[styles.statusBadge, statusStyle]}>
                {invoice.status}
              </Text>
            </View>

            <View style={styles.balanceDueBox}>
              <Text style={styles.balanceDueText}>Balance Due:</Text>
              <Text style={styles.balanceDueText}>
                {formatGBP(Number(invoice.balance_due))}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.billingRow}>
          <View style={[styles.billingColumn, styles.infoCard]}>
            <Text style={styles.sectionTitle}>Receiver's Details</Text>
            <Text style={styles.clientLine}>
              <Text style={{ fontWeight: 700 }}>{receiver?.name ?? ""}</Text>
            </Text>

            {receiver?.billing_address ? (
              <Text style={styles.clientLine}>{receiver.billing_address}</Text>
            ) : null}

            {receiver?.email ? (
              <Text style={styles.clientLine}>
                <Text style={{ fontWeight: 700 }}>Email:</Text> {receiver.email}
              </Text>
            ) : null}

            {receiver?.contact ? (
              <Text style={styles.clientLine}>
                <Text style={{ fontWeight: 700 }}>Phone:</Text>{" "}
                {receiver.contact}
              </Text>
            ) : null}
          </View>

          <View style={[styles.billingColumn, styles.infoCard, { marginRight: 0 }]}>
            <Text style={styles.sectionTitle}>Generated by</Text>
            <Text style={styles.clientLine}>
              <Text style={{ fontWeight: 700 }}>{generatedBy}</Text>
            </Text>
          </View>
        </View>

        <View style={styles.itemsTable}>
          <View style={styles.tableHeader}>
            <Text style={[styles.colItem, styles.headerCell]}>Item</Text>
            <Text style={[styles.colQty, styles.headerCell]}>Quantity</Text>
            <Text style={[styles.colRate, styles.headerCell]}>Rate</Text>
            <Text style={[styles.colAmount, styles.headerCell]}>Amount</Text>
          </View>

          {items.map((item, index) => (
            <View
              key={`item-${index}`}
              style={index % 2 === 1 ? [styles.tableRow, styles.rowAlt] : styles.tableRow}
            >
              <Text style={styles.colItem}>{item.description}</Text>
              <Text style={styles.colQty}>{item.quantity}</Text>
              <Text style={styles.colRate}>{formatGBP(item.rate)}</Text>
              <Text style={styles.colAmount}>{formatGBP(item.amount)}</Text>
            </View>
          ))}
        </View>

        <View style={styles.totalsSection}>
          <View style={styles.totalsTable}>
            <View style={styles.totalsRow}>
              <Text>Subtotal:</Text>
              <Text>{formatGBP(Number(invoice.subtotal))}</Text>
            </View>
            <View style={[styles.totalsRow, styles.totalsRowFinal]}>
              <Text>Total:</Text>
              <Text>{formatGBP(Number(invoice.total))}</Text>
            </View>
          </View>
        </View>

        {invoice.notes ? (
          <View style={styles.notesSection}>
            <Text style={styles.notesTitle}>Notes</Text>
            <Text style={styles.notesText}>{invoice.notes}</Text>
          </View>
        ) : null}

        <View style={styles.footer}>
          <Text>
            {sender?.footer_thank_you_text ?? "Thank you for your business!"}
          </Text>
          <Text>Generated on {generatedAt}</Text>
        </View>
      </Page>
    </Document>
  );
}