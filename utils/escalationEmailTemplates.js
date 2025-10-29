// utils/escalationEmailTemplates.js
function escapeHtml(s = '') {
  return (s + '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

function escalationEmailTemplate({ escalation, ticket, client }) {
  const subject = `[ESCALATION Level ${escalation.escalated_to_level}] ${escalation.subject}`;
  
  // Build CC/BCC information section if available
  let ccBccSection = '';
  if (escalation.cc_emails || escalation.bcc_emails) {
    ccBccSection = `
      <div style="background: #e8f5e8; padding: 10px; border-radius: 5px; margin: 10px 0; border-left: 4px solid #4caf50;">
        <h4 style="margin: 0 0 8px 0; color: #2e7d32;">📧 Email Distribution</h4>
        ${escalation.cc_emails ? `
          <p style="margin: 4px 0;">
            <strong>CC:</strong> ${escapeHtml(escalation.cc_emails)}
          </p>
        ` : ''}
        ${escalation.bcc_emails ? `
          <p style="margin: 4px 0;">
            <strong>BCC:</strong> ${escapeHtml(escalation.bcc_emails)}
          </p>
        ` : ''}
      </div>
    `;
  }
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${subject}</title>
      <style>
        @media only screen and (max-width: 600px) {
          .container {
            width: 100% !important;
            padding: 10px !important;
          }
          .button {
            display: block !important;
            width: 100% !important;
            text-align: center !important;
          }
        }
      </style>
    </head>
    <body style="font-family: Arial, sans-serif; margin: 0; padding: 20px; background-color: #f6f6f6;">
      <div class="container" style="max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); overflow: hidden;">
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #d32f2f, #b71c1c); padding: 25px 30px; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 24px; display: flex; align-items: center; justify-content: center;">
            🚨 Ticket Escalation - Level ${escalation.escalated_to_level}
          </h1>
          <p style="color: rgba(255,255,255,0.9); margin: 8px 0 0 0; font-size: 14px;">
            Immediate attention required - Priority Level ${escalation.escalated_to_level}
          </p>
        </div>

        <!-- Main Content -->
        <div style="padding: 25px 30px;">
          ${ccBccSection}

          <!-- Escalation Details -->
          <div style="background: #ffebee; padding: 20px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #d32f2f;">
            <h3 style="margin: 0 0 15px 0; color: #d32f2f; font-size: 18px; display: flex; align-items: center;">
              <span style="background: #d32f2f; color: white; padding: 4px 8px; border-radius: 4px; margin-right: 8px;">!</span>
              Escalation Details
            </h3>
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; font-weight: bold; width: 140px; color: #d32f2f;">Ticket ID:</td>
                <td style="padding: 8px 0; font-weight: bold;">${escapeHtml(ticket.ticket_no)}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; font-weight: bold; color: #d32f2f;">Category:</td>
                <td style="padding: 8px 0;">${escapeHtml(ticket.module)}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; font-weight: bold; color: #d32f2f;">Issue Type:</td>
                <td style="padding: 8px 0;">${escapeHtml(ticket.category)}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; font-weight: bold; color: #d32f2f;">Escalated By:</td>
                <td style="padding: 8px 0;">${escapeHtml(client.name)} (${escapeHtml(client.company_name)})</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; font-weight: bold; color: #d32f2f;">Escalation Level:</td>
                <td style="padding: 8px 0;">
                  <span style="background: #d32f2f; color: white; padding: 4px 8px; border-radius: 4px; font-size: 12px;">
                    Level ${escalation.escalated_to_level}
                  </span>
                </td>
              </tr>
              <tr>
                <td style="padding: 8px 0; font-weight: bold; color: #d32f2f;">Primary Contact:</td>
                <td style="padding: 8px 0;">${escapeHtml(escalation.escalated_to_email)}</td>
              </tr>
            </table>
          </div>

          <!-- Escalation Message -->
          <div style="background: #e3f2fd; padding: 20px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #1976d2;">
            <h3 style="margin: 0 0 15px 0; color: #1976d2; font-size: 18px; display: flex; align-items: center;">
              <span style="background: #1976d2; color: white; padding: 4px 8px; border-radius: 4px; margin-right: 8px;">💬</span>
              Escalation Message
            </h3>
            <div style="background: white; padding: 15px; border-radius: 4px; border: 1px solid #bbdefb;">
              ${escalation.message.replace(/\n/g, '<br>')}
            </div>
          </div>

          <!-- Ticket Description -->
          <div style="background: #f3e5f5; padding: 20px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #7b1fa2;">
            <h3 style="margin: 0 0 15px 0; color: #7b1fa2; font-size: 18px; display: flex; align-items: center;">
              <span style="background: #7b1fa2; color: white; padding: 4px 8px; border-radius: 4px; margin-right: 8px;">📋</span>
              Original Ticket Description
            </h3>
            <div style="background: white; padding: 15px; border-radius: 4px; border: 1px solid #e1bee7;">
              ${escapeHtml(ticket.comments).replace(/\n/g, '<br>')}
            </div>
          </div>

          <!-- Action Button -->
          <div style="text-align: center; margin: 30px 0 20px 0;">
            <a href="${process.env.APP_URL || 'http://localhost:3000'}/tickets/${ticket.ticket_id}" 
               style="background: linear-gradient(135deg, #d32f2f, #b71c1c); color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold; font-size: 16px; box-shadow: 0 2px 8px rgba(211,47,47,0.3); transition: all 0.3s ease;">
              🔍 View Ticket Details & Take Action
            </a>
          </div>

          <!-- Urgency Notice -->
          <div style="background: #fff8e1; padding: 15px; border-radius: 6px; margin: 20px 0; border: 1px dashed #ffa000;">
            <h4 style="margin: 0 0 8px 0; color: #ff8f00; display: flex; align-items: center;">
              <span style="margin-right: 8px;">⚠️</span>
              Urgent Action Required
            </h4>
            <p style="margin: 0; color: #ff8f00; font-size: 14px;">
              This ticket has been escalated to Level ${escalation.escalated_to_level} and requires immediate attention. 
              Please respond within the agreed SLA timeframe.
            </p>
          </div>
        </div>

        <!-- Footer -->
        <div style="background: #f5f5f5; padding: 20px 30px; border-top: 1px solid #e0e0e0;">
          <div style="text-align: center; color: #666; font-size: 12px; line-height: 1.5;">
            <p style="margin: 0 0 10px 0;">
              This is an automated escalation email generated by the Support Ticket System.
            </p>
            <p style="margin: 0;">
              <strong>System Generated:</strong> ${new Date().toLocaleString()} |
              <strong>Ticket ID:</strong> ${escapeHtml(ticket.ticket_no)} |
              <strong>Escalation ID:</strong> ESC-${escalation.escalation_id}
            </p>
            <p style="margin: 15px 0 0 0; padding-top: 15px; border-top: 1px solid #e0e0e0;">
              Please do not reply to this automated message. For any queries, please contact the system administrator.
            </p>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;

  const text = `
🚨 TICKET ESCALATION - LEVEL ${escalation.escalated_to_level}
${'='.repeat(50)}

SUBJECT: ${escalation.subject}

${escalation.cc_emails ? `CC: ${escalation.cc_emails}\n` : ''}${escalation.bcc_emails ? `BCC: ${escalation.bcc_emails}\n` : ''}

ESCALATION DETAILS:
${'-'.repeat(30)}
Ticket ID: ${ticket.ticket_no}
Category: ${ticket.module}
Issue Type: ${ticket.category}
Escalated By: ${client.name} (${client.company_name})
Escalation Level: Level ${escalation.escalated_to_level}
Primary Contact: ${escalation.escalated_to_email}

ESCALATION MESSAGE:
${'-'.repeat(30)}
${escalation.message}

ORIGINAL TICKET DESCRIPTION:
${'-'.repeat(50)}
${ticket.comments}

URGENT ACTION REQUIRED:
${'-'.repeat(30)}
This ticket has been escalated to Level ${escalation.escalated_to_level} and requires immediate attention.

VIEW TICKET: ${process.env.APP_URL || 'http://localhost:3000'}/tickets/${ticket.ticket_id}

---
This is an automated escalation email generated by the Support Ticket System.
System Generated: ${new Date().toLocaleString()}
Ticket ID: ${ticket.ticket_no} | Escalation ID: ESC-${escalation.escalation_id}
Please do not reply to this automated message.
  `;

  return { subject, html, text };
}

function escalationReminderTemplate({ escalation, ticket, client, reminder_message }) {
  const subject = `[REMINDER - ESCALATION Level ${escalation.escalated_to_level}] ${escalation.subject}`;
  
  // Build CC/BCC information section if available
  let ccBccSection = '';
  if (escalation.cc_emails || escalation.bcc_emails) {
    ccBccSection = `
      <div style="background: #e8f5e8; padding: 10px; border-radius: 5px; margin: 10px 0; border-left: 4px solid #4caf50;">
        <h4 style="margin: 0 0 8px 0; color: #2e7d32;">📧 Email Distribution</h4>
        ${escalation.cc_emails ? `
          <p style="margin: 4px 0;">
            <strong>CC:</strong> ${escapeHtml(escalation.cc_emails)}
          </p>
        ` : ''}
        ${escalation.bcc_emails ? `
          <p style="margin: 4px 0;">
            <strong>BCC:</strong> ${escapeHtml(escalation.bcc_emails)}
          </p>
        ` : ''}
      </div>
    `;
  }
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${subject}</title>
      <style>
        @media only screen and (max-width: 600px) {
          .container {
            width: 100% !important;
            padding: 10px !important;
          }
          .button {
            display: block !important;
            width: 100% !important;
            text-align: center !important;
          }
        }
      </style>
    </head>
    <body style="font-family: Arial, sans-serif; margin: 0; padding: 20px; background-color: #f6f6f6;">
      <div class="container" style="max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); overflow: hidden;">
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #ff9800, #f57c00); padding: 25px 30px; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 24px; display: flex; align-items: center; justify-content: center;">
            ⏰ Escalation Reminder - Level ${escalation.escalated_to_level}
          </h1>
          <p style="color: rgba(255,255,255,0.9); margin: 8px 0 0 0; font-size: 14px;">
            Follow-up required - Reminder #${escalation.reminder_count + 1}
          </p>
        </div>

        <!-- Main Content -->
        <div style="padding: 25px 30px;">
          ${ccBccSection}

          <!-- Reminder Details -->
          <div style="background: #fff3e0; padding: 20px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #ff9800;">
            <h3 style="margin: 0 0 15px 0; color: #ff9800; font-size: 18px; display: flex; align-items: center;">
              <span style="background: #ff9800; color: white; padding: 4px 8px; border-radius: 4px; margin-right: 8px;">🔔</span>
              Reminder Details
            </h3>
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; font-weight: bold; width: 140px; color: #ff9800;">Ticket ID:</td>
                <td style="padding: 8px 0; font-weight: bold;">${escapeHtml(ticket.ticket_no)}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; font-weight: bold; color: #ff9800;">Original Subject:</td>
                <td style="padding: 8px 0;">${escapeHtml(escalation.subject)}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; font-weight: bold; color: #ff9800;">Escalated By:</td>
                <td style="padding: 8px 0;">${escapeHtml(client.name)} (${escapeHtml(client.company_name)})</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; font-weight: bold; color: #ff9800;">Escalation Level:</td>
                <td style="padding: 8px 0;">
                  <span style="background: #ff9800; color: white; padding: 4px 8px; border-radius: 4px; font-size: 12px;">
                    Level ${escalation.escalated_to_level}
                  </span>
                </td>
              </tr>
              <tr>
                <td style="padding: 8px 0; font-weight: bold; color: #ff9800;">Reminder Count:</td>
                <td style="padding: 8px 0;">
                  <span style="background: #ff5722; color: white; padding: 4px 8px; border-radius: 4px; font-size: 12px;">
                    Reminder #${escalation.reminder_count + 1}
                  </span>
                </td>
              </tr>
              <tr>
                <td style="padding: 8px 0; font-weight: bold; color: #ff9800;">Primary Contact:</td>
                <td style="padding: 8px 0;">${escapeHtml(escalation.escalated_to_email)}</td>
              </tr>
            </table>
          </div>

          <!-- Additional Message -->
          ${reminder_message ? `
          <div style="background: #e8f5e8; padding: 20px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #4caf50;">
            <h3 style="margin: 0 0 15px 0; color: #2e7d32; font-size: 18px; display: flex; align-items: center;">
              <span style="background: #4caf50; color: white; padding: 4px 8px; border-radius: 4px; margin-right: 8px;">💬</span>
              Additional Message from ${escapeHtml(client.name)}
            </h3>
            <div style="background: white; padding: 15px; border-radius: 4px; border: 1px solid #c8e6c9;">
              ${escapeHtml(reminder_message).replace(/\n/g, '<br>')}
            </div>
          </div>
          ` : ''}

          <!-- Original Escalation Message (Brief) -->
          <div style="background: #f3e5f5; padding: 15px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #7b1fa2;">
            <h3 style="margin: 0 0 10px 0; color: #7b1fa2; font-size: 16px; display: flex; align-items: center;">
              <span style="background: #7b1fa2; color: white; padding: 3px 6px; border-radius: 3px; margin-right: 8px; font-size: 12px;">📋</span>
              Original Escalation Message
            </h3>
            <div style="background: white; padding: 12px; border-radius: 4px; border: 1px solid #e1bee7; font-size: 14px; max-height: 100px; overflow: hidden; position: relative;">
              ${escalation.message.replace(/\n/g, '<br>').substring(0, 200)}${escalation.message.length > 200 ? '...' : ''}
            </div>
          </div>

          <!-- Action Button -->
          <div style="text-align: center; margin: 30px 0 20px 0;">
            <a href="${process.env.APP_URL || 'http://localhost:3000'}/tickets/${ticket.ticket_id}" 
               style="background: linear-gradient(135deg, #ff9800, #f57c00); color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold; font-size: 16px; box-shadow: 0 2px 8px rgba(255,152,0,0.3); transition: all 0.3s ease;">
              🔍 View Full Ticket & Respond
            </a>
          </div>

          <!-- Urgency Notice -->
          <div style="background: #fff8e1; padding: 15px; border-radius: 6px; margin: 20px 0; border: 1px dashed #ffa000;">
            <h4 style="margin: 0 0 8px 0; color: #ff8f00; display: flex; align-items: center;">
              <span style="margin-right: 8px;">🚨</span>
              Pending Action Required
            </h4>
            <p style="margin: 0; color: #ff8f00; font-size: 14px;">
              This is reminder #${escalation.reminder_count + 1} for this escalated ticket. Your immediate attention is still required.
            </p>
          </div>
        </div>

        <!-- Footer -->
        <div style="background: #f5f5f5; padding: 20px 30px; border-top: 1px solid #e0e0e0;">
          <div style="text-align: center; color: #666; font-size: 12px; line-height: 1.5;">
            <p style="margin: 0 0 10px 0;">
              This is an automated reminder for an escalated ticket in the Support Ticket System.
            </p>
            <p style="margin: 0;">
              <strong>System Generated:</strong> ${new Date().toLocaleString()} |
              <strong>Ticket ID:</strong> ${escapeHtml(ticket.ticket_no)} |
              <strong>Escalation ID:</strong> ESC-${escalation.escalation_id}
            </p>
            <p style="margin: 15px 0 0 0; padding-top: 15px; border-top: 1px solid #e0e0e0;">
              Please do not reply to this automated message. For any queries, please contact the system administrator.
            </p>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;

  const text = `
⏰ ESCALATION REMINDER - LEVEL ${escalation.escalated_to_level}
${'='.repeat(50)}

SUBJECT: ${escalation.subject}

${escalation.cc_emails ? `CC: ${escalation.cc_emails}\n` : ''}${escalation.bcc_emails ? `BCC: ${escalation.bcc_emails}\n` : ''}

REMINDER DETAILS:
${'-'.repeat(30)}
Ticket ID: ${ticket.ticket_no}
Original Subject: ${escalation.subject}
Escalated By: ${client.name} (${client.company_name})
Escalation Level: Level ${escalation.escalated_to_level}
Reminder Count: #${escalation.reminder_count + 1}
Primary Contact: ${escalation.escalated_to_email}

${reminder_message ? `
ADDITIONAL MESSAGE FROM ${client.name.toUpperCase()}:
${'-'.repeat(40)}
${reminder_message}
` : ''}

ORIGINAL ESCALATION MESSAGE (BRIEF):
${'-'.repeat(50)}
${escalation.message.substring(0, 200)}${escalation.message.length > 200 ? '...' : ''}

PENDING ACTION REQUIRED:
${'-'.repeat(30)}
This is reminder #${escalation.reminder_count + 1} for this escalated ticket.

VIEW FULL TICKET: ${process.env.APP_URL || 'http://localhost:3000'}/tickets/${ticket.ticket_id}

---
This is an automated reminder for an escalated ticket in the Support Ticket System.
System Generated: ${new Date().toLocaleString()}
Ticket ID: ${ticket.ticket_no} | Escalation ID: ESC-${escalation.escalation_id}
Please do not reply to this automated message.
  `;

  return { subject, html, text };
}

module.exports = {
  escalationEmailTemplate,
  escalationReminderTemplate
};