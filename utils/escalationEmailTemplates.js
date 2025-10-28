// utils/escalationEmailTemplates.js
function escapeHtml(s = '') {
  return (s + '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

function escalationEmailTemplate({ escalation, ticket, client }) {
  const subject = `[ESCALATION Level ${escalation.escalated_to_level}] ${escalation.subject}`;
  
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #d32f2f; border-bottom: 2px solid #d32f2f; padding-bottom: 10px;">
        🚨 Ticket Escalation - Level ${escalation.escalated_to_level}
      </h2>
      
      <div style="background: #ffebee; padding: 15px; border-radius: 5px; margin: 20px 0;">
        <h3 style="margin: 0 0 10px 0; color: #d32f2f;">Escalation Details</h3>
        <table style="width: 100%;">
          <tr>
            <td style="padding: 5px 0; font-weight: bold; width: 120px;">Ticket ID:</td>
            <td style="padding: 5px 0;">${escapeHtml(ticket.ticket_no)}</td>
          </tr>
          <tr>
            <td style="padding: 5px 0; font-weight: bold;">Category:</td>
            <td style="padding: 5px 0;">${escapeHtml(ticket.module)}</td>
          </tr>
          <tr>
            <td style="padding: 5px 0; font-weight: bold;">Issue Type:</td>
            <td style="padding: 5px 0;">${escapeHtml(ticket.category)}</td>
          </tr>
          <tr>
            <td style="padding: 5px 0; font-weight: bold;">Escalated By:</td>
            <td style="padding: 5px 0;">${escapeHtml(client.name)} (${escapeHtml(client.company_name)})</td>
          </tr>
          <tr>
            <td style="padding: 5px 0; font-weight: bold;">Escalation Level:</td>
            <td style="padding: 5px 0;">Level ${escalation.escalated_to_level}</td>
          </tr>
        </table>
      </div>

      <div style="background: #e3f2fd; padding: 15px; border-radius: 5px; margin: 20px 0;">
        <h3 style="margin: 0 0 10px 0; color: #1976d2;">Escalation Message</h3>
        <p style="margin: 0; white-space: pre-wrap;">${escapeHtml(escalation.message)}</p>
      </div>

      <div style="background: #f3e5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
        <h3 style="margin: 0 0 10px 0; color: #7b1fa2;">Ticket Description</h3>
        <p style="margin: 0; white-space: pre-wrap;">${escapeHtml(ticket.comments)}</p>
      </div>

      <div style="text-align: center; margin: 30px 0;">
        <a href="${process.env.APP_URL || 'http://localhost:3000'}/tickets/${ticket.ticket_id}" 
           style="background: #d32f2f; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block; font-weight: bold;">
          View Ticket Details
        </a>
      </div>

      <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #e0e0e0; font-size: 12px; color: #666;">
        <p>This is an automated escalation email. Please take appropriate action.</p>
      </div>
    </div>
  `;

  const text = `
    TICKET ESCALATION - LEVEL ${escalation.escalated_to_level}

    Subject: ${escalation.subject}

    ESCALATION DETAILS:
    Ticket ID: ${ticket.ticket_no}
    Category: ${ticket.module}
    Issue Type: ${ticket.category}
    Escalated By: ${client.name} (${client.company_name})
    Escalation Level: Level ${escalation.escalated_to_level}

    ESCALATION MESSAGE:
    ${escalation.message}

    TICKET DESCRIPTION:
    ${ticket.comments}

    View Ticket: ${process.env.APP_URL || 'http://localhost:3000'}/tickets/${ticket.ticket_id}

    This is an automated escalation email. Please take appropriate action.
  `;

  return { subject, html, text };
}

function escalationReminderTemplate({ escalation, ticket, client, reminder_message }) {
  const subject = `[REMINDER - ESCALATION Level ${escalation.escalated_to_level}] ${escalation.subject}`;
  
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #ff9800; border-bottom: 2px solid #ff9800; padding-bottom: 10px;">
        ⏰ Escalation Reminder - Level ${escalation.escalated_to_level}
      </h2>
      
      <div style="background: #fff3e0; padding: 15px; border-radius: 5px; margin: 20px 0;">
        <h3 style="margin: 0 0 10px 0; color: #ff9800;">Reminder Details</h3>
        <table style="width: 100%;">
          <tr>
            <td style="padding: 5px 0; font-weight: bold; width: 120px;">Ticket ID:</td>
            <td style="padding: 5px 0;">${escapeHtml(ticket.ticket_no)}</td>
          </tr>
          <tr>
            <td style="padding: 5px 0; font-weight: bold;">Original Escalation:</td>
            <td style="padding: 5px 0;">${escapeHtml(escalation.subject)}</td>
          </tr>
          <tr>
            <td style="padding: 5px 0; font-weight: bold;">Escalated By:</td>
            <td style="padding: 5px 0;">${escapeHtml(client.name)} (${escapeHtml(client.company_name)})</td>
          </tr>
          <tr>
            <td style="padding: 5px 0; font-weight: bold;">Reminder Count:</td>
            <td style="padding: 5px 0;">${escalation.reminder_count + 1}</td>
          </tr>
        </table>
      </div>

      ${reminder_message ? `
      <div style="background: #e8f5e8; padding: 15px; border-radius: 5px; margin: 20px 0;">
        <h3 style="margin: 0 0 10px 0; color: #2e7d32;">Additional Message</h3>
        <p style="margin: 0; white-space: pre-wrap;">${escapeHtml(reminder_message)}</p>
      </div>
      ` : ''}

      <div style="text-align: center; margin: 30px 0;">
        <a href="${process.env.APP_URL || 'http://localhost:3000'}/tickets/${ticket.ticket_id}" 
           style="background: #ff9800; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block; font-weight: bold;">
          View Ticket Details
        </a>
      </div>

      <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #e0e0e0; font-size: 12px; color: #666;">
        <p>This is an automated reminder for the escalated ticket.</p>
      </div>
    </div>
  `;

  const text = `
    ESCALATION REMINDER - LEVEL ${escalation.escalated_to_level}

    Subject: ${escalation.subject}

    REMINDER DETAILS:
    Ticket ID: ${ticket.ticket_no}
    Original Escalation: ${escalation.subject}
    Escalated By: ${client.name} (${client.company_name})
    Reminder Count: ${escalation.reminder_count + 1}

    ${reminder_message ? `
    ADDITIONAL MESSAGE:
    ${reminder_message}
    ` : ''}

    View Ticket: ${process.env.APP_URL || 'http://localhost:3000'}/tickets/${ticket.ticket_id}

    This is an automated reminder for the escalated ticket.
  `;

  return { subject, html, text };
}

module.exports = {
  escalationEmailTemplate,
  escalationReminderTemplate
};