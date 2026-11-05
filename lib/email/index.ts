import "server-only";
import { Resend } from "resend";

export type EmailMessage = {
  to: string;
  subject: string;
  text: string;
};

let resend: Resend | undefined;

/**
 * Sends a plain-text email through Resend.
 *
 * Without RESEND_API_KEY in development, the email is printed to the server
 * console instead, so login links can be followed locally. In production a
 * missing key is an error. Never pass patient health data through here.
 */
export async function sendEmail(message: EmailMessage): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("RESEND_API_KEY is not set.");
    }
    console.info(
      `\n[email:dev] To: ${message.to}\n[email:dev] Subject: ${message.subject}\n${message.text}\n`,
    );
    return;
  }

  const from = process.env.EMAIL_FROM;
  if (!from) throw new Error("EMAIL_FROM is not set.");

  resend ??= new Resend(apiKey);
  const { error } = await resend.emails.send({
    from,
    to: message.to,
    subject: message.subject,
    text: message.text,
  });
  if (error) throw new Error(`Email failed to send: ${error.name}`);
}
