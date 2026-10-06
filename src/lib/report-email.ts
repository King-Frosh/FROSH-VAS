import * as XLSX from "xlsx";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { reportDeliveryLogs, reportSettings, transactions } from "@/db/schema";

type ReportSetting = typeof reportSettings.$inferSelect;

export function nigeriaDateString(date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Lagos",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return \`${get("year")}-${get("month")}-${get("day")}\`;
}

export function previousNigeriaDate(date = new Date()): string {
  const now = nigeriaDateString(date);
  const [y, m, d] = now.split("-").map(Number);
  const previous = new Date(Date.UTC(y, m - 1, d - 1));
  return previous.toISOString().slice(0, 10);
}

function validDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(\`\${value}T00:00:00Z\`));
}

function recipientList(value: string): string[] {
  return value.split(/[;,\n]/).map((v) => v.trim()).filter(Boolean);
}

function reportWorkbook(
  rows: Array<{
    transactionAt: Date;
    servicePartner: string | null;
    serviceId: string;
    amount: string;
    productId: string | null;
    productName: string | null;
    transactionType: string | null;
    txnCount: number;
    revenue: string;
  }>,
) {
  const data = rows.map((r) => ({
    DATE: r.transactionAt.toISOString().slice(0, 10),
    "SERVICE PARTNER": r.servicePartner ?? "",
    "SERVICE ID": r.serviceId,
    "PRICE POINT": Number(r.amount),
    "PRODUCT ID": r.productId ?? "",
    "PRODUCT NAME": r.productName ?? "",
    TRANSACTION: r.transactionType ?? "",
    COUNT: r.txnCount,
    REVENUE: Number(r.revenue),
  }));

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(data.length ? data : [{
    DATE: "",
    "SERVICE PARTNER": "",
    "SERVICE ID": "",
    "PRICE POINT": 0,
    "PRODUCT ID": "",
    "PRODUCT NAME": "",
    TRANSACTION: "",
    COUNT: 0,
    REVENUE: 0,
  }], {
    header: [
      "DATE", "SERVICE PARTNER", "SERVICE ID", "PRICE POINT",
      "PRODUCT ID", "PRODUCT NAME", "TRANSACTION", "COUNT", "REVENUE",
    ],
  });
  ws["!cols"] = [
    { wch: 13 }, { wch: 22 }, { wch: 20 }, { wch: 14 }, { wch: 18 },
    { wch: 28 }, { wch: 18 }, { wch: 12 }, { wch: 18 },
  ];
  if (ws["!ref"]) {
    ws["!autofilter"] = { ref: ws["!ref"] };
    ws["!views"] = [{ state: "frozen", ySplit: 1, topLeftCell: "A2", activeCell: "A2" }];
  }
  XLSX.utils.book_append_sheet(wb, ws, "Service Report");
  return XLSX.write(wb, { bookType: "xlsx", type: "buffer" }) as Buffer;
}

async function sendViaResend(args: {
  to: string[];
  cc: string[];
  subject: string;
  html: string;
  filename: string;
  attachment: Buffer;
}) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.REPORT_FROM_EMAIL;
  if (!apiKey || !from) {
    throw new Error("Email service is not configured. Add RESEND_API_KEY and REPORT_FROM_EMAIL in Vercel.");
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: \`Bearer \${apiKey}\`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: args.to,
      ...(args.cc.length ? { cc: args.cc } : {}),
      subject: args.subject,
      html: args.html,
      attachments: [{ filename, content: args.attachment.toString("base64") }],
    }),
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body?.message || body?.error || \`Email provider returned HTTP \${response.status}\`);
  }
  return String(body?.id ?? "");
}

export async function sendPartnerReport(
  setting: ReportSetting,
  reportDate: string,
  options: { force?: boolean } = {},
) {
  if (!validDate(reportDate)) throw new Error("Invalid report date.");
  if (!setting.enabled && !options.force) return { status: "disabled" as const };

  const existing = await db
    .select({ id: reportDeliveryLogs.id })
    .from(reportDeliveryLogs)
    .where(and(
      eq(reportDeliveryLogs.partnerName, setting.partnerName),
      eq(reportDeliveryLogs.reportDate, reportDate),
      eq(reportDeliveryLogs.status, "sent"),
    ))
    .limit(1);

  if (existing.length && !options.force) {
    return { status: "already_sent" as const };
  }

  const partnerCondition = sql\`(${transactions.transactionAt} + interval '1 hour')::date = \${reportDate} and coalesce(${transactions.servicePartner}, ${transactions.network}, '') = \${setting.partnerName}\`;

  const rows = await db
    .select({
      transactionAt: transactions.transactionAt,
      servicePartner: transactions.servicePartner,
      serviceId: transactions.serviceId,
      amount: transactions.amount,
      productId: transactions.productId,
      productName: transactions.productName,
      transactionType: transactions.transactionType,
      txnCount: transactions.txnCount,
      revenue: transactions.revenue,
    })
    .from(transactions)
    .where(partnerCondition)
    .orderBy(transactions.transactionAt);

  const [summary] = await db
    .select({
      txns: sql<number>\`coalesce(sum(${transactions.txnCount}),0)::int\`,
      revenue: sql<number>\`coalesce(sum(${transactions.revenue}::numeric),0)\`.mapWith(Number),
    })
    .from(transactions)
    .where(partnerCondition);

  const attachment = reportWorkbook(rows);
  const filename = \`BRICCS_VAS_Report_\${setting.partnerName.replace(/[^a-zA-Z0-9_-]+/g, "_")}_\${reportDate}.xlsx\`;
  const to = recipientList(setting.email);
  const cc = recipientList(setting.cc ?? "");

  if (!to.length) throw new Error(\`No recipient email configured for \${setting.partnerName}.\`);

  const subject = \`BRICCS VAS Service Report - \${setting.partnerName} - \${reportDate}\`;
  const html = \`
    <p>Dear Partner,</p>
    <p>Please find attached the VAS service report for <strong>\${setting.partnerName}</strong> for <strong>\${reportDate}</strong>.</p>
    <p><strong>Transactions:</strong> \${Number(summary?.txns ?? 0).toLocaleString()}<br/>
    <strong>Gross Revenue:</strong> NGN \${Number(summary?.revenue ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
    <p>Regards,<br/>BRICCS International Ideal Limited</p>
  \`;

  try {
    const messageId = await sendViaResend({ to, cc, subject, html, filename, attachment });
    await db.insert(reportDeliveryLogs).values({
      partnerName: setting.partnerName,
      reportDate,
      recipient: to.join(", "),
      status: "sent",
      messageId,
      error: null,
    });
    return { status: "sent" as const, messageId, rows: rows.length, txns: Number(summary?.txns ?? 0), revenue: Number(summary?.revenue ?? 0) };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await db.insert(reportDeliveryLogs).values({
      partnerName: setting.partnerName,
      reportDate,
      recipient: to.join(", "),
      status: "failed",
      messageId: null,
      error: message,
    });
    throw error;
  }
}
