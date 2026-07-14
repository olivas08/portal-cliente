const RESEND_API_URL = "https://api.resend.com/emails";

/**
 * Sends the password-reset email via Resend.
 * If RESEND_API_KEY is not configured (e.g. local dev without a key),
 * falls back to logging the reset link to the console so the flow
 * can still be tested end-to-end.
 */
export async function sendPasswordResetEmail(to: string, resetUrl: string) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM ?? "Jolucor <onboarding@resend.dev>";

  if (!apiKey) {
    console.log(
      `[email] RESEND_API_KEY não configurada — link de reposição para ${to}: ${resetUrl}`
    );
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
      to,
      subject: "Repor palavra-passe — Portal Jolucor",
      html: `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
          <h2 style="color:#0f172a;">Repor palavra-passe</h2>
          <p>Recebemos um pedido para repor a palavra-passe da sua conta no Portal do Cliente Jolucor.</p>
          <p>
            <a href="${resetUrl}" style="display:inline-block;background:#f59e0b;color:#0f172a;font-weight:600;padding:10px 20px;border-radius:8px;text-decoration:none;">
              Repor palavra-passe
            </a>
          </p>
          <p style="color:#64748b;font-size:13px;">Este link é válido durante 1 hora. Se não pediu esta alteração, ignore este email.</p>
        </div>
      `,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    console.error("[email] Falha ao enviar email via Resend:", res.status, body);
    throw new Error("Não foi possível enviar o email de reposição.");
  }
}

/**
 * Notifies a client by email that one of their orders changed status.
 * Same graceful fallback as the password-reset email: without a
 * RESEND_API_KEY the notification is only logged, never blocking the
 * caller. Any Resend failure is thrown so callers can decide whether
 * to swallow it (order-status updates should not fail because of it).
 */
export async function sendOrderStatusUpdateEmail(
  to: string,
  params: { reference: string; statusLabel: string; orderUrl: string }
) {
  const { reference, statusLabel, orderUrl } = params;
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM ?? "Jolucor <onboarding@resend.dev>";

  if (!apiKey) {
    console.log(
      `[email] RESEND_API_KEY não configurada — notificação de estado para ${to}: ${reference} -> ${statusLabel}`
    );
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
      to,
      subject: `Encomenda ${reference} — ${statusLabel}`,
      html: `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
          <h2 style="color:#0f172a;">Atualização da sua encomenda</h2>
          <p>A encomenda <strong>${reference}</strong> passou para o estado <strong>${statusLabel}</strong>.</p>
          <p>
            <a href="${orderUrl}" style="display:inline-block;background:#f59e0b;color:#0f172a;font-weight:600;padding:10px 20px;border-radius:8px;text-decoration:none;">
              Ver encomenda no portal
            </a>
          </p>
          <p style="color:#64748b;font-size:13px;">Portal do Cliente Jolucor.</p>
        </div>
      `,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    console.error("[email] Falha ao enviar notificação de estado via Resend:", res.status, body);
    throw new Error("Não foi possível enviar a notificação de estado.");
  }
}
