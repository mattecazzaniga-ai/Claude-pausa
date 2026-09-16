const apiKey = process.env.RESEND_API_KEY;
const fromAddress = process.env.EMAIL_FROM || "Mentathlos <onboarding@resend.dev>";

/** The rest of the app can check this to show a clear "email not configured" state instead of failing silently. */
export const isEmailConfigured = Boolean(apiKey);

function appUrl() {
  return process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
}

async function sendEmail(to: string, subject: string, html: string) {
  if (!apiKey) throw new Error("Email not configured: RESEND_API_KEY is missing.");

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: fromAddress, to, subject, html }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Resend API error ${res.status}: ${body}`);
  }
}

export async function sendPasswordResetEmail(to: string, rawToken: string) {
  const resetUrl = `${appUrl()}/reset-password?token=${rawToken}`;

  await sendEmail(
    to,
    "Reimposta la tua password Mentathlos",
    `<p>Hai richiesto di reimpostare la password del tuo account Mentathlos.</p>
     <p><a href="${resetUrl}">Clicca qui per scegliere una nuova password</a></p>
     <p>Il link scade tra un'ora. Se non sei stato tu a richiederlo, ignora questa email: la tua password resterà invariata.</p>`
  );
}
