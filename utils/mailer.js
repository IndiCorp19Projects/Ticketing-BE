// utils/mailer.js
const nodemailer = require('nodemailer');
require('dotenv').config();

const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = parseInt(process.env.SMTP_PORT || '587', 10);
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const FROM_EMAIL = process.env.EMAIL_FROM || 'no-reply@example.com';
const FROM_NAME = process.env.EMAIL_FROM_NAME || 'Ticketing System';

// create transporter
const transporter = nodemailer.createTransport({
  host: SMTP_HOST,
  port: SMTP_PORT,
  secure: SMTP_PORT === 465, // true for 465, false for other ports
  auth: SMTP_USER ? { user: SMTP_USER, pass: SMTP_PASS } : undefined,
  // tls: { rejectUnauthorized: false } // if needed in dev
});

// verify connection (optional)
transporter.verify().then(() => {
  console.log('Mailer: SMTP connection OK');
}).catch((err) => {
  console.warn('Mailer: SMTP verify failed', err && err.message ? err.message : err);
});

// simple send helper
async function sendMail({ to, cc, bcc, subject, text, html }) {
  const mailOptions = {
    from: `"${FROM_NAME}" <${FROM_EMAIL}>`,
    to,
    cc,
    bcc,
    subject,
    text,
    html
  };

  const info = await transporter.sendMail(mailOptions);
  return info;
}

module.exports = { sendMail };
