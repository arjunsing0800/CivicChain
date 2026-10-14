import nodemailer from 'nodemailer';
import { currentLogger } from '@/lib/server/requestContext';

/**
 * CivicChain outbound notification email (Phase 13).
 *
 * Reuses the same honest policy as the magic-link sender (src/lib/email/magic-link.ts):
 *   - Resend HTTP API (`RESEND_API_KEY`) first — works on Vercel/serverless.
 *   - Then SMTP (`EMAIL_SERVER`) via nodemailer.
 *   - In local development without either, the email is rendered to the server
 *     console so the flow can be verified, but delivery is never claimed.
 *   - In production without either, sending reports non-delivery — we never
 *     pretend a notification email was delivered.
 *
 * Notification emails are an outbound, fire-and-forget side effect: callers
 * must treat a failure here as non-fatal (a failing channel must never corrupt
 * the in-app notification or the business transaction that triggered it).
 */

export interface NotificationEmailInput {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

/** Safe, minimal HTML wrapper for notification emails. */
function wrapHtml(title: string, bodyParagraphs: string[]): string {
  return (
    `<div style="font-family:system-ui,sans-serif;max-width:480px;margin:auto">` +
    `<h2 style="color:#0a0a0a">CivicChain</h2>` +
    `<h3 style="color:#0a0a0a">${title}</h3>` +
    bodyParagraphs.map((p) => `<p style="color:#333;line-height:1.5">${p}</p>`).join('') +
    `<p style="color:#999;font-size:12px">You received this because you are signed in to CivicChain. Manage preferences from your profile settings.</p>` +
    `</div>`
  );
}

/**
 * Send a notification email. Returns `{ delivered: true }` on success and
 * `{ delivered: false, reason }` when a channel is unavailable or delivery
 * fails — it never throws into the caller's business logic.
 */
export async function sendNotificationEmail(
  input: NotificationEmailInput,
): Promise<{ delivered: boolean; reason?: string }> {
  const from = process.env.EMAIL_FROM || 'CivicChain <noreply@civicchain.example>';

  if (process.env.RESEND_API_KEY) {
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from,
          to: input.to,
          subject: input.subject,
          html: input.html ?? wrapHtml(input.subject, [input.text]),
          text: input.text,
        }),
      });
      if (!res.ok) {
        return { delivered: false, reason: `Resend delivery failed (${res.status}).` };
      }
      return { delivered: true };
    } catch (error) {
      currentLogger().error({ err: error, to: input.to, subject: input.subject }, 'notification email delivery failed (resend)');
      return { delivered: false, reason: 'Email delivery failed.' };
    }
  }

  const smtpUrl = process.env.EMAIL_SERVER;

  if (!smtpUrl) {
    // No provider configured — honest non-delivery.
    if (process.env.NODE_ENV === 'production') {
      return {
        delivered: false,
        reason: 'Neither RESEND_API_KEY nor EMAIL_SERVER is configured — the notification email was NOT sent.',
      };
    }
    // Local dev: log the email so the channel can be inspected/previewed, but
    // explicitly do NOT claim it was delivered.
    currentLogger().debug(
      { email: { to: input.to, subject: input.subject, text: input.text } },
      '[CivicChain DEV] Notification email (no SMTP configured)',
    );
    return { delivered: false, reason: 'No SMTP configured (dev preview log only).' };
  }

  try {
    const transport = nodemailer.createTransport(smtpUrl);
    await transport.sendMail({
      from,
      to: input.to,
      subject: input.subject,
      text: input.text,
      html: input.html ?? wrapHtml(input.subject, [input.text]),
    });
    return { delivered: true };
  } catch (error) {
    currentLogger().error({ err: error, to: input.to, subject: input.subject }, 'notification email delivery failed');
    return { delivered: false, reason: 'Email delivery failed.' };
  }
}
