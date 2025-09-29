// utils/emailTemplates.js
function escapeHtml(s = '') {
  return (s + '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

function ticketCreatedTemplate({ ticket, creator }) {
  const subject = `New ticket created: ${ticket.ticket_id ?? ''} — ${ticket.module}`;
  const html = `
    <p>Hello Admin,</p>
    <p>A new ticket has been raised by <strong>${escapeHtml(creator.username || creator.email || 'User')}</strong>.</p>
    <ul>
      <li><strong>Ticket</strong>: ${escapeHtml(ticket.ticket_id ? String(ticket.ticket_id) : '')}</li>
      <li><strong>Module</strong>: ${escapeHtml(ticket.module)}</li>
      <li><strong>Category</strong>: ${escapeHtml(ticket.category)}</li>
      <li><strong>Comment</strong>: ${escapeHtml(ticket.comment)}</li>
    </ul>
    <p><a href="${process.env.APP_URL || 'http://localhost:3000'}/tickets/${ticket.ticket_id}">Open ticket</a></p>
    <p>Regards,<br/>Ticketing System</p>
  `;
  const text = `New ticket: ${ticket.ticket_id} - ${ticket.module}\nBy: ${creator.username || creator.email}\nComment: ${ticket.comment}\nView: ${process.env.APP_URL || 'http://localhost:3000'}/tickets/${ticket.ticket_id}`;
  return { subject, html, text };
}

function ticketReplyTemplate({ ticket, reply, sender }) {
  const subject = `Reply on ticket ${ticket.ticket_id}: ${ticket.module}`;
  const html = `
    <p>Hello,</p>
    <p><strong>${escapeHtml(sender.username || sender.email)}</strong> replied on ticket <strong>${escapeHtml(String(ticket.ticket_id))}</strong>:</p>
    <blockquote style="border-left:4px solid #ccc;padding-left:10px;">${escapeHtml(reply.message)}</blockquote>
    <p><a href="${process.env.APP_URL || 'http://localhost:3000'}/tickets/${ticket.ticket_id}">Open ticket conversation</a></p>
    <p>Regards,<br/>Ticketing System</p>
  `;
  const text = `${sender.username || sender.email} replied on ticket ${ticket.ticket_id}\n\n${reply.message}\n\nView: ${process.env.APP_URL || 'http://localhost:3000'}/tickets/${ticket.ticket_id}`;
  return { subject, html, text };
}

function ticketStatusChangedTemplate({ ticket, oldStatus, newStatus, admin }) {
  const subject = `Ticket ${ticket.ticket_id} status changed to ${newStatus}`;
  const html = `
    <p>Hello ${escapeHtml(ticket.creator?.username || ticket.creator?.email || 'User')},</p>
    <p>Status for ticket <strong>${escapeHtml(String(ticket.ticket_id))}</strong> has been updated by <strong>${escapeHtml(admin.username || admin.email)}</strong>.</p>
    <ul>
      <li>Previous status: ${escapeHtml(oldStatus)}</li>
      <li>New status: ${escapeHtml(newStatus)}</li>
    </ul>
    <p><a href="${process.env.APP_URL || 'http://localhost:3000'}/tickets/${ticket.ticket_id}">Open ticket</a></p>
    <p>Regards,<br/>Ticketing System</p>
  `;
  const text = `Ticket ${ticket.ticket_id} status changed from ${oldStatus} to ${newStatus} by ${admin.username || admin.email}\nView: ${process.env.APP_URL || 'http://localhost:3000'}/tickets/${ticket.ticket_id}`;
  return { subject, html, text };
}

module.exports = { ticketCreatedTemplate, ticketReplyTemplate, ticketStatusChangedTemplate };
