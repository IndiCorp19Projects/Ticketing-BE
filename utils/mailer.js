// utils/mailer.js
const nodemailer = require('nodemailer');

const {
  SMTP_HOST,
  SMTP_PORT,
  SMTP_USER,
  SMTP_PASS,
  EMAIL_FROM,
  EMAIL_FROM_NAME,
  NODE_ENV
} = process.env;

const port = Number(SMTP_PORT || 587);

// Build transporter with STARTTLS (port 587) or implicit TLS (port 465)
const transporter = nodemailer.createTransport({
  host: SMTP_HOST || 'smtp.gmail.com',
  port: port,
  secure: port === 465, // true for 465, false for 587 (STARTTLS)
  auth: SMTP_USER && SMTP_PASS ? { user: SMTP_USER, pass: SMTP_PASS } : undefined,
  tls: {
    // allow self-signed certs if necessary (set to false for production)
    rejectUnauthorized: false
  },
  // sensible timeouts (milliseconds)
  connectionTimeout: 15000, // 15s
  greetingTimeout: 15000,
  socketTimeout: 15000
});

// verify transport on start (non-blocking)
(async function verifyTransport() {
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    console.warn('Mailer: SMTP credentials not configured (EMAIL will be logged to console).');
    return;
  }
  try {
    await transporter.verify();
    console.info('Mailer: SMTP verified OK');
  } catch (err) {
    console.error('Mailer: SMTP verify failed', err && err.message ? err.message : err);
  }
})();

/**
 * sendMail({ to, subject, html, text, cc, bcc })
 * - to can be string or comma-separated
 */
async function sendMail({ to, subject, html, text, cc, bcc }) {
  // fall back to console logging if transporter not configured
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    console.warn('Mailer: SMTP not fully configured — fallback to console.log');
    console.log('MAIL =>', { to, subject, text, html, cc, bcc });
    return { fallback: true };
  }

  const from = EMAIL_FROM_NAME ? `"${EMAIL_FROM_NAME}" <${EMAIL_FROM}>` : EMAIL_FROM || SMTP_USER;

  try {
    const info = await transporter.sendMail({
      from,
      to,
      cc,
      bcc,
      subject,
      text,
      html
    });
    // nodemailer returns messageId etc.
    return info;
  } catch (err) {
    // log but do not throw to break the app flow
    console.error('Mailer: sendMail error', err && err.message ? err.message : err);
    // return error shape for callers if they want to inspect
    return { error: true, message: err && err.message ? err.message : String(err) };
  }
}

module.exports = { sendMail, transporter };
