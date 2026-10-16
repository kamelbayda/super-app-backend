/**
 * Emails sent by the licence server, through Resend (https://resend.com, free up to 3000 a month).
 *
 * Set the secret RESEND_API_KEY (Worker -> Settings -> Variables and Secrets) once the domain is
 * verified in Resend; without it nothing is sent and every call reports { sent: false }.
 *
 * Each kind of email has its own sender:
 *   sales    promotions and messages to shops on trial
 *   info     activation keys and subscription confirmations
 *   support  replies about problems and faults
 */
const DOMAIN = 'beecash.app';
export const SENDERS = {
  sales: { name: 'BeeCash', address: `sales@${DOMAIN}` },
  info: { name: 'BeeCash', address: `info@${DOMAIN}` },
  support: { name: 'BeeCash Support', address: `support@${DOMAIN}` },
};
const LOGO = `https://${DOMAIN}/icon-192.png`;

export const mailConfigured = (env) => !!String(env.RESEND_API_KEY || '').trim();

const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

/** Right-to-left HTML email with the BeeCash header; `body` and `after` are plain text around the highlighted box. */
export function emailHtml(body, { highlight, after } = {}) {
  const para = (t) => escapeHtml(t).split(/\n{2,}/).map((p) => `<p style="margin:0 0 14px">${p.replace(/\n/g, '<br>')}</p>`).join('');
  const paragraphs = para(body);
  const box = highlight
    ? `<div style="margin:18px 0;padding:16px;border-radius:12px;background:#FFF6D6;border:1px solid #FFC21A;text-align:center;font-family:monospace;font-size:20px;font-weight:700;letter-spacing:1px;white-space:nowrap;color:#1E1B16;direction:ltr">${escapeHtml(highlight)}</div>`
    : '';
  return `<!doctype html><html dir="rtl" lang="ar"><body style="margin:0;background:#F6F3EC;padding:24px 12px;font-family:Tahoma,Arial,sans-serif">
<div style="max-width:560px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #EEE7D6">
<div style="background:#1E1B16;padding:18px 22px;text-align:right"><img src="${LOGO}" width="40" height="40" alt="" style="vertical-align:middle;border-radius:10px">
<span style="vertical-align:middle;margin-right:10px;font-size:22px;font-weight:800;color:#FFC21A">Bee<span style="color:#fff">Cash</span></span></div>
<div style="padding:24px 22px;font-size:16px;line-height:1.8;color:#1E1B16;text-align:right">${paragraphs}${box}${after ? para(after) : ''}</div>
<div style="padding:14px 22px;background:#FBF8F1;font-size:12px;color:#8A8273;text-align:center">BeeCash · <a href="https://${DOMAIN}" style="color:#B98600">${DOMAIN}</a></div>
</div></body></html>`;
}

/**
 * Sends one email. `from` is 'sales' | 'info' | 'support'.
 * Never throws: returns { sent: true, id } or { sent: false, reason }.
 */
export async function sendMail(env, { from = 'info', to, subject, text, highlight, after }) {
  if (!mailConfigured(env)) return { sent: false, reason: 'mail_not_configured' };
  const sender = SENDERS[from] || SENDERS.info;
  const body = [text, highlight, after].filter(Boolean).join('\n\n');
  try {
    const res = await fetch(env.RESEND_API_URL || 'https://api.resend.com/emails', {
      method: 'POST',
      headers: { authorization: `Bearer ${String(env.RESEND_API_KEY).trim()}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        from: `${sender.name} <${sender.address}>`,
        to: [to],
        reply_to: sender.address,
        subject,
        text: body,
        html: emailHtml(text, { highlight, after }),
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { sent: false, reason: data.name || data.message || `http_${res.status}` };
    return { sent: true, id: data.id ?? null };
  } catch (err) {
    console.error('mail error', err);
    return { sent: false, reason: 'mail_failed' };
  }
}

/** Fills {name}, {shop} and {left} the same way the app does. */
export const fillPlaceholders = (text, { name, shop, left }) =>
  String(text).replace(/\{name\}/g, name || 'عزيزنا').replace(/\{shop\}/g, shop || 'متجرك').replace(/\{left\}/g, String(left ?? ''));
