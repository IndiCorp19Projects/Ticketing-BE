const { escapeHtml } = require('./systemEmailTemplates');

function clientCredentialsTemplate({ client, password, adminName = 'Admin' }) {
  const subject = `Client Registration Credentials - ${client.company_name}`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #333; border-bottom: 2px solid #f0f0f0; padding-bottom: 10px;">Client Registration Complete</h2>
      
      <p>Hello ${escapeHtml(client.contact_person || 'Valued Client')},</p>
      
      <p>Your client account for <strong>${escapeHtml(client.company_name)}</strong> has been created successfully in our Ticketing System.</p>
      <p>Here are your login credentials:</p>
      
      <div style="background: #f9f9f9; padding: 15px; border-radius: 5px; margin: 20px 0;">
        <table style="width: 100%;">
          <tr>
            <td style="padding: 8px 0; font-weight: bold; width: 120px;">Company Name:</td>
            <td style="padding: 8px 0;">${escapeHtml(client.company_name)}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; font-weight: bold;">Contact Person:</td>
            <td style="padding: 8px 0;">${escapeHtml(client.contact_person || 'N/A')}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; font-weight: bold;">Login Email:</td>
            <td style="padding: 8px 0;">${escapeHtml(client.email)}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; font-weight: bold;">Password:</td>
            <td style="padding: 8px 0; font-family: monospace; font-size: 16px;">
              <strong>${escapeHtml(password)}</strong>
            </td>
          </tr>
        </table>
      </div>
      
      <div style="background: #e8f4fd; padding: 15px; border-radius: 5px; margin: 20px 0;">
        <h4 style="margin: 0 0 10px 0; color: #0066cc;">How to Use:</h4>
        <ol style="margin: 0; padding-left: 20px;">
          <li>Use the credentials above to login at: <strong>${process.env.CLIENT_APP_URL || process.env.APP_URL || 'http://localhost:3000'}/client/login</strong></li>
          <li>After login, you can raise tickets and track their status</li>
          <li>View your ticket history and communicate with support team</li>
        </ol>
      </div>
      
      <div style="background: #fff3cd; padding: 15px; border-radius: 5px; margin: 20px 0; border: 1px solid #ffeaa7;">
        <p style="margin: 0; color: #856404;">
          <strong>Security Notice:</strong> For security reasons, please change your password after first login.
          Keep these credentials secure and do not share them.
        </p>
      </div>
      
      <h4>What You Can Do:</h4>
      <ul style="margin: 10px 0; padding-left: 20px;">
        <li>Raise new support tickets</li>
        <li>Track existing ticket status</li>
        <li>Communicate with support team</li>
        <li>View ticket history and resolutions</li>
        <li>Update your company profile</li>
      </ul>
      
      <p>
        <a href="${process.env.CLIENT_APP_URL || process.env.APP_URL || 'http://localhost:3000'}/client/login" 
           style="background: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block; font-weight: bold;">
          Login to Client Portal
        </a>
      </p>
      
      <p>If you have any questions or need assistance, please contact our support team.</p>
      
      <p>Best regards,<br/>
      <strong>${escapeHtml(adminName)}</strong><br/>
      Ticketing System Team</p>
      
      <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #f0f0f0; font-size: 12px; color: #666;">
        <p>This is an automated message. Please do not reply to this email.</p>
      </div>
    </div>
  `;
  
  const text = `
    CLIENT REGISTRATION CREDENTIALS
    
    Your client account for "${client.company_name}" has been created successfully.
    
    Company Name: ${client.company_name}
    Contact Person: ${client.contact_person || 'N/A'}
    Login Email: ${client.email}
    Password: ${password}
    
    Login URL: ${process.env.CLIENT_APP_URL || process.env.APP_URL || 'http://localhost:3000'}/client/login
    
    HOW TO USE:
    1. Use the credentials above to login
    2. After login, you can raise tickets and track their status
    3. View your ticket history and communicate with support team
    
    WHAT YOU CAN DO:
    - Raise new support tickets
    - Track existing ticket status
    - Communicate with support team
    - View ticket history and resolutions
    - Update your company profile
    
    SECURITY NOTICE: 
    For security reasons, please change your password after first login.
    Keep these credentials secure and do not share them.
    
    Best regards,
    ${adminName}
    Ticketing System Team
    
    This is an automated message. Please do not reply to this email.
  `;
  
  return { subject, html, text };
}

function clientUpdateTemplate({ client, updates, adminName = 'Admin' }) {
  const subject = `Client Account Updated - ${client.company_name}`;
  
  let updateDetails = '';
  if (updates.email) {
    updateDetails += `<li><strong>Login Email:</strong> ${escapeHtml(updates.email)}</li>`;
  }
  if (updates.password) {
    updateDetails += `<li><strong>Password:</strong> Has been updated</li>`;
  }
  
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #333; border-bottom: 2px solid #f0f0f0; padding-bottom: 10px;">Client Account Updated</h2>
      
      <p>Hello ${escapeHtml(client.contact_person || 'Valued Client')},</p>
      
      <p>Your client account for <strong>${escapeHtml(client.company_name)}</strong> has been updated.</p>
      
      ${updateDetails ? `
      <div style="background: #f9f9f9; padding: 15px; border-radius: 5px; margin: 20px 0;">
        <h4 style="margin: 0 0 10px 0;">Updated Information:</h4>
        <ul style="margin: 0; padding-left: 20px;">
          ${updateDetails}
        </ul>
      </div>
      ` : ''}
      
      <p>You can login to your account using the following link:</p>
      
      <p>
        <a href="${process.env.CLIENT_APP_URL || process.env.APP_URL || 'http://localhost:3000'}/client/login" 
           style="background: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block; font-weight: bold;">
          Login to Client Portal
        </a>
      </p>
      
      <p>If you did not request these changes or have any concerns, please contact our support team immediately.</p>
      
      <p>Best regards,<br/>
      <strong>${escapeHtml(adminName)}</strong><br/>
      Ticketing System Team</p>
      
      <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #f0f0f0; font-size: 12px; color: #666;">
        <p>This is an automated message. Please do not reply to this email.</p>
      </div>
    </div>
  `;
  
  const text = `
    CLIENT ACCOUNT UPDATED
    
    Your client account for "${client.company_name}" has been updated.
    
    ${updates.email ? `Login Email: ${updates.email}` : ''}
    ${updates.password ? `Password: Has been updated` : ''}
    
    Login URL: ${process.env.CLIENT_APP_URL || process.env.APP_URL || 'http://localhost:3000'}/client/login
    
    If you did not request these changes or have any concerns, please contact our support team immediately.
    
    Best regards,
    ${adminName}
    Ticketing System Team
    
    This is an automated message. Please do not reply to this email.
  `;
  
  return { subject, html, text };
}

module.exports = { 
  clientCredentialsTemplate, 
  clientUpdateTemplate 
};