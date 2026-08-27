import { PRODUCT, TENANT } from "@/lib/branding";

const RESEND_API_URL = "https://api.resend.com/emails";

const BRAND = {
  navy: "#232f3f",
  navySoft: "#3a4e59",
  accent: "#f59e0b",
  ink: "#0f172a",
  muted: "#64748b",
  border: "#e2e8f0",
  bg: "#f8fafc",
} as const;

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatEur(amount: number): string {
  return amount.toLocaleString("pt-PT", { style: "currency", currency: "EUR" });
}

function originFromUrl(url: string): string {
  try {
    return new URL(url).origin;
  } catch {
    return "";
  }
}

/**
 * Shared Operon + tenant HTML shell. Logos use absolute URLs derived from the
 * CTA link so they work in any deployment; the Operon wordmark is also rendered
 * as text because SVG support in email clients is unreliable.
 */
function brandLayout(params: {
  title: string;
  bodyHtml: string;
  cta?: { label: string; url: string };
  footnote?: string;
}): string {
  const { title, bodyHtml, cta, footnote } = params;
  const baseUrl = cta ? originFromUrl(cta.url) : "";
  const tenantLogo =
    baseUrl && TENANT.logo ? `${baseUrl}${TENANT.logo}` : "";

  const ctaBlock = cta
    ? `
      <p style="margin:28px 0 8px;">
        <a href="${escapeHtml(cta.url)}"
           style="display:inline-block;background:${BRAND.accent};color:${BRAND.navy};font-weight:700;padding:12px 22px;border-radius:8px;text-decoration:none;font-size:14px;">
          ${escapeHtml(cta.label)}
        </a>
      </p>`
    : "";

  const footnoteBlock = footnote
    ? `<p style="color:${BRAND.muted};font-size:13px;line-height:1.5;margin:20px 0 0;">${footnote}</p>`
    : "";

  // Operon ships as SVG in the app; email clients often strip SVG, so the
  // product mark is a text wordmark. Tenant logos are typically PNG and render.
  const tenantMark = tenantLogo
    ? `<img src="${escapeHtml(tenantLogo)}" alt="${escapeHtml(TENANT.name)}" width="100" height="42" style="display:block;margin:12px auto 0;object-fit:contain;max-height:42px;" />`
    : `<p style="margin:10px 0 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:11px;letter-spacing:0.06em;text-transform:uppercase;color:#94a3b8;">${escapeHtml(TENANT.name)}</p>`;

  return `
<!DOCTYPE html>
<html lang="pt">
<body style="margin:0;padding:0;background:${BRAND.bg};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.bg};padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid ${BRAND.border};">
          <tr>
            <td style="background:${BRAND.navy};padding:22px 28px;text-align:center;">
              <p style="margin:0;font-family:Georgia,'Times New Roman',serif;font-size:26px;letter-spacing:0.08em;color:#ffffff;">
                ${escapeHtml(PRODUCT.name)}
              </p>
              <p style="margin:8px 0 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:12px;color:#cbd5e1;">
                ${escapeHtml(PRODUCT.modules.portal)}
              </p>
              ${tenantMark}
            </td>
          </tr>
          <tr>
            <td style="padding:28px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:${BRAND.ink};font-size:15px;line-height:1.55;">
              <h1 style="margin:0 0 16px;font-size:20px;font-weight:700;color:${BRAND.navy};">${escapeHtml(title)}</h1>
              ${bodyHtml}
              ${ctaBlock}
              ${footnoteBlock}
            </td>
          </tr>
          <tr>
            <td style="padding:16px 28px 22px;border-top:1px solid ${BRAND.border};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:12px;line-height:1.5;color:${BRAND.muted};text-align:center;">
              <strong style="color:${BRAND.navySoft};">${escapeHtml(TENANT.legalName)}</strong><br />
              ${escapeHtml(TENANT.address)} · ${escapeHtml(TENANT.city)}<br />
              ${escapeHtml(TENANT.nif)} · ${escapeHtml(TENANT.contact)}
            </td>
          </tr>
        </table>
        <p style="margin:14px 0 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:11px;color:#94a3b8;">
          ${escapeHtml(PRODUCT.name)} · ${escapeHtml(PRODUCT.modules.portal)}
        </p>
      </td>
    </tr>
  </table>
</body>
</html>`.trim();
}

/**
 * Low-level Resend send. Without RESEND_API_KEY, logs and returns so local
 * dev / CI keep working. Failures throw so auth flows can surface them;
 * business callers that must not break wrap this in try/catch.
 */
async function sendEmail(params: {
  to: string | string[];
  subject: string;
  html: string;
  logFallback: string;
}): Promise<void> {
  const recipients = (Array.isArray(params.to) ? params.to : [params.to]).filter(
    Boolean,
  );
  if (recipients.length === 0) return;

  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM ?? `${TENANT.name} <onboarding@resend.dev>`;

  if (!apiKey) {
    console.log(`[email] RESEND_API_KEY não configurada — ${params.logFallback}`);
    return;
  }

  const res = await fetch(RESEND_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: recipients.length === 1 ? recipients[0] : recipients,
      subject: params.subject,
      html: params.html,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    console.error("[email] Falha ao enviar email via Resend:", res.status, body);
    throw new Error("Não foi possível enviar o email.");
  }
}

function p(text: string): string {
  return `<p style="margin:0 0 12px;">${text}</p>`;
}

// ── Auth ────────────────────────────────────────────────────────────────────

export async function sendPasswordResetEmail(to: string, resetUrl: string) {
  await sendEmail({
    to,
    subject: `Repor palavra-passe — ${PRODUCT.modules.portal}`,
    logFallback: `link de reposição para ${to}: ${resetUrl}`,
    html: brandLayout({
      title: "Repor palavra-passe",
      bodyHtml: p(
        `Recebemos um pedido para repor a palavra-passe da sua conta no ${escapeHtml(PRODUCT.modules.portal)} da ${escapeHtml(TENANT.name)}.`,
      ),
      cta: { label: "Repor palavra-passe", url: resetUrl },
      footnote:
        "Este link é válido durante 1 hora. Se não pediu esta alteração, ignore este email.",
    }),
  });
}

export async function sendInviteEmail(
  to: string,
  params: { name: string; roleLabel: string; setupUrl: string; inviterName: string },
) {
  const { name, roleLabel, setupUrl, inviterName } = params;
  await sendEmail({
    to,
    subject: `Foi convidado para o ${PRODUCT.modules.portal}`,
    logFallback: `convite para ${to}: ${setupUrl}`,
    html: brandLayout({
      title: `Bem-vindo(a), ${name}`,
      bodyHtml: p(
        `${escapeHtml(inviterName)} convidou-o(a) para uma conta de <strong>${escapeHtml(roleLabel)}</strong> no ${escapeHtml(PRODUCT.modules.portal)} da ${escapeHtml(TENANT.name)}.`,
      ),
      cta: { label: "Definir a minha palavra-passe", url: setupUrl },
      footnote:
        "Este link é válido durante 1 hora. Se não esperava este convite, ignore este email.",
    }),
  });
}

// ── Orders ──────────────────────────────────────────────────────────────────

export async function sendOrderStatusUpdateEmail(
  to: string | string[],
  params: { reference: string; statusLabel: string; orderUrl: string },
) {
  const { reference, statusLabel, orderUrl } = params;
  await sendEmail({
    to,
    subject: `Encomenda ${reference} — ${statusLabel}`,
    logFallback: `notificação de estado para ${String(to)}: ${reference} -> ${statusLabel}`,
    html: brandLayout({
      title: "Atualização da sua encomenda",
      bodyHtml: p(
        `A encomenda <strong>${escapeHtml(reference)}</strong> passou para o estado <strong>${escapeHtml(statusLabel)}</strong>.`,
      ),
      cta: { label: "Ver encomenda no portal", url: orderUrl },
    }),
  });
}

export async function sendOrderCancelledEmail(
  to: string | string[],
  params: {
    reference: string;
    reason: string;
    orderUrl: string;
    cancelledBy: "factory" | "client";
    actorName?: string;
  },
) {
  const { reference, reason, orderUrl, cancelledBy, actorName } = params;
  const forClient = cancelledBy === "factory";
  await sendEmail({
    to,
    subject: forClient
      ? `Encomenda ${reference} cancelada`
      : `Encomenda ${reference} anulada pelo cliente`,
    logFallback: `cancelamento de ${reference} para ${String(to)}`,
    html: brandLayout({
      title: forClient ? "Encomenda cancelada" : "Encomenda anulada pelo cliente",
      bodyHtml:
        p(
          forClient
            ? `A fábrica cancelou a encomenda <strong>${escapeHtml(reference)}</strong>.`
            : `${escapeHtml(actorName ?? "O cliente")} anulou a encomenda <strong>${escapeHtml(reference)}</strong>.`,
        ) + p(`Motivo: ${escapeHtml(reason)}`),
      cta: {
        label: forClient ? "Ver encomenda no portal" : "Ver encomenda no Core",
        url: orderUrl,
      },
    }),
  });
}

export async function sendOrderReactivatedEmail(
  to: string | string[],
  params: { reference: string; orderUrl: string },
) {
  const { reference, orderUrl } = params;
  await sendEmail({
    to,
    subject: `Encomenda ${reference} reaberta`,
    logFallback: `reativação de ${reference} para ${String(to)}`,
    html: brandLayout({
      title: "Encomenda reaberta",
      bodyHtml: p(
        `A encomenda <strong>${escapeHtml(reference)}</strong> foi reativada e está novamente pendente.`,
      ),
      cta: { label: "Ver encomenda no portal", url: orderUrl },
    }),
  });
}

export async function sendOrderCreatedEmail(
  to: string | string[],
  params: {
    reference: string;
    orderUrl: string;
    audience: "client" | "admin";
    companyName?: string;
  },
) {
  const { reference, orderUrl, audience, companyName } = params;
  const forClient = audience === "client";
  await sendEmail({
    to,
    subject: `Nova encomenda ${reference}`,
    logFallback: `nova encomenda ${reference} para ${String(to)}`,
    html: brandLayout({
      title: "Nova encomenda",
      bodyHtml: p(
        forClient
          ? `Foi registada a encomenda <strong>${escapeHtml(reference)}</strong> no portal.`
          : `${escapeHtml(companyName ?? "Um cliente")} registou a encomenda <strong>${escapeHtml(reference)}</strong>.`,
      ),
      cta: {
        label: forClient ? "Ver encomenda no portal" : "Ver encomenda no Core",
        url: orderUrl,
      },
    }),
  });
}

// ── Quotes ──────────────────────────────────────────────────────────────────

export async function sendQuoteSentEmail(
  to: string | string[],
  params: {
    reference: string;
    subject: string;
    totalEur: number;
    quoteUrl: string;
  },
) {
  const { reference, subject, totalEur, quoteUrl } = params;
  await sendEmail({
    to,
    subject: `Novo orçamento ${reference}`,
    logFallback: `orçamento ${reference} para ${String(to)}`,
    html: brandLayout({
      title: "Novo orçamento",
      bodyHtml:
        p(
          `Recebeu o orçamento <strong>${escapeHtml(reference)}</strong>: ${escapeHtml(subject)}.`,
        ) +
        p(`Valor total: <strong>${escapeHtml(formatEur(totalEur))}</strong>.`),
      cta: { label: "Ver orçamento no portal", url: quoteUrl },
      footnote: "Pode aceitar ou recusar o orçamento diretamente no portal.",
    }),
  });
}

export async function sendQuoteDecisionEmail(
  to: string | string[],
  params: {
    reference: string;
    subject: string;
    companyName: string;
    decision: "accepted" | "rejected";
    quoteUrl: string;
  },
) {
  const { reference, subject, companyName, decision, quoteUrl } = params;
  const accepted = decision === "accepted";
  await sendEmail({
    to,
    subject: `Orçamento ${reference} ${accepted ? "aceite" : "recusado"}`,
    logFallback: `decisão de orçamento ${reference} para ${String(to)}`,
    html: brandLayout({
      title: accepted ? "Orçamento aceite" : "Orçamento recusado",
      bodyHtml: p(
        `<strong>${escapeHtml(companyName)}</strong> ${accepted ? "aceitou" : "recusou"} o orçamento <strong>${escapeHtml(reference)}</strong> (“${escapeHtml(subject)}”).`,
      ),
      cta: { label: "Ver orçamento no Core", url: quoteUrl },
    }),
  });
}

// ── Requests ────────────────────────────────────────────────────────────────

export async function sendRequestCreatedEmail(
  to: string | string[],
  params: {
    reference: string;
    typeLabel: string;
    subject: string;
    authorName: string;
    requestUrl: string;
  },
) {
  const { reference, typeLabel, subject, authorName, requestUrl } = params;
  await sendEmail({
    to,
    subject: `Novo requerimento ${reference} — ${typeLabel}`,
    logFallback: `requerimento ${reference} para ${String(to)}`,
    html: brandLayout({
      title: "Novo requerimento",
      bodyHtml:
        p(
          `<strong>${escapeHtml(authorName)}</strong> abriu o requerimento <strong>${escapeHtml(reference)}</strong> (${escapeHtml(typeLabel)}).`,
        ) + p(`Assunto: ${escapeHtml(subject)}`),
      cta: { label: "Ver requerimento no Core", url: requestUrl },
    }),
  });
}

export async function sendRequestMessageEmail(
  to: string | string[],
  params: {
    reference: string;
    requestUrl: string;
    audience: "client" | "admin";
    authorName?: string;
  },
) {
  const { reference, requestUrl, audience, authorName } = params;
  const forClient = audience === "client";
  await sendEmail({
    to,
    subject: `Requerimento ${reference} — nova mensagem`,
    logFallback: `mensagem de requerimento ${reference} para ${String(to)}`,
    html: brandLayout({
      title: forClient ? "Resposta da fábrica" : "Nova mensagem do cliente",
      bodyHtml: p(
        forClient
          ? `Há uma nova resposta da fábrica no requerimento <strong>${escapeHtml(reference)}</strong>.`
          : `${escapeHtml(authorName ?? "O cliente")} respondeu no requerimento <strong>${escapeHtml(reference)}</strong>.`,
      ),
      cta: {
        label: forClient ? "Ver no portal" : "Ver no Core",
        url: requestUrl,
      },
    }),
  });
}

// ── Invoices ────────────────────────────────────────────────────────────────

export async function sendInvoiceIssuedEmail(
  to: string | string[],
  params: {
    orderReference: string;
    invoiceNumber: string | null;
    totalEur: number;
    pdfUrl: string | null;
    orderUrl: string;
  },
) {
  const { orderReference, invoiceNumber, totalEur, pdfUrl, orderUrl } = params;
  const numberLabel = invoiceNumber ? ` ${invoiceNumber}` : "";
  await sendEmail({
    to,
    subject: `Fatura${numberLabel} — encomenda ${orderReference}`,
    logFallback: `fatura de ${orderReference} para ${String(to)}`,
    html: brandLayout({
      title: "Fatura emitida",
      bodyHtml:
        p(
          `Foi emitida a fatura${invoiceNumber ? ` <strong>${escapeHtml(invoiceNumber)}</strong>` : ""} relativa à encomenda <strong>${escapeHtml(orderReference)}</strong>.`,
        ) +
        p(`Valor total: <strong>${escapeHtml(formatEur(totalEur))}</strong>.`),
      cta: {
        label: pdfUrl ? "Descarregar fatura (PDF)" : "Ver encomenda no portal",
        url: pdfUrl || orderUrl,
      },
      footnote: pdfUrl
        ? `Também pode consultar a encomenda no portal: ${escapeHtml(orderUrl)}`
        : undefined,
    }),
  });
}
