// utils/systemEmailTemplates.js
function escapeHtml(s = '') {
  return (s + '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

function systemCredentialsTemplate({ system, password, adminName = 'Admin' }) {
  const subject = `System Registration Credentials - ${system.system_name}`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #333; border-bottom: 2px solid #f0f0f0; padding-bottom: 10px;">System Registration Complete</h2>
      
      <p>Hello,</p>
      
      <p>Your system <strong>${escapeHtml(system.system_name)}</strong> has been registered successfully in our Ticketing System.</p>
      <p>Here are the credentials to access the system:</p>
      
      <div style="background: #f9f9f9; padding: 15px; border-radius: 5px; margin: 20px 0;">
        <table style="width: 100%;">
          <tr>
            <td style="padding: 8px 0; font-weight: bold; width: 120px;">System Name:</td>
            <td style="padding: 8px 0;">${escapeHtml(system.system_name)}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; font-weight: bold;">System ID:</td>
            <td style="padding: 8px 0;">${escapeHtml(system.system_id)}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; font-weight: bold;">Login Email:</td>
            <td style="padding: 8px 0;">${escapeHtml(system.system_user.email)}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; font-weight: bold;">Password:</td>
            <td style="padding: 8px 0; font-family: monospace; font-size: 16px;">
              <strong>${escapeHtml(password)}</strong>
            </td>
          </tr>
          <tr>
            <td style="padding: 8px 0; font-weight: bold;">Role:</td>
            <td style="padding: 8px 0;">${escapeHtml(system.system_user.role_name)}</td>
          </tr>
        </table>
      </div>
      
      <div style="background: #e8f4fd; padding: 15px; border-radius: 5px; margin: 20px 0;">
        <h4 style="margin: 0 0 10px 0; color: #0066cc;">How to Use:</h4>
        <ol style="margin: 0; padding-left: 20px;">
          <li>Use the credentials above to login at: <strong>${process.env.APP_URL || 'http://localhost:3000'}/login</strong></li>
          <li>After login, you can create tickets using the API endpoints</li>
          <li>Use the session cookie for authenticated requests</li>
        </ol>
      </div>
      
      <div style="background: #fff3cd; padding: 15px; border-radius: 5px; margin: 20px 0; border: 1px solid #ffeaa7;">
        <p style="margin: 0; color: #856404;">
          <strong>Security Notice:</strong> This password is temporary. Please change it after first login if possible.
          Keep these credentials secure and do not share them.
        </p>
      </div>
      
      <h4>API Usage Example:</h4>
      <div style="background: #2d3748; color: #e2e8f0; padding: 15px; border-radius: 5px; font-family: monospace; font-size: 12px; margin: 10px 0;">
        <div>// 1. Login to get session cookie</div>
        <div>POST ${process.env.APP_URL || 'http://localhost:3000'}/api/auth/login</div>
        <div>Body: {"email": "${system.system_user.email}", "password": "${password}"}</div>
        <br>
        <div>// 2. Create ticket (use session cookie)</div>
        <div>POST ${process.env.APP_URL || 'http://localhost:3000'}/api/ticket/raise</div>
        <div>Body: {"category": "Technical", "comments": "Issue description", "priority": "High"}</div>
      </div>
      
      <p>
        <a href="${process.env.APP_URL || 'http://localhost:3000'}/login" 
           style="background: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block; font-weight: bold;">
          Login to System
        </a>
      </p>
      
      <p>If you have any questions or need assistance with integration, please contact our support team.</p>
      
      <p>Best regards,<br/>
      <strong>${escapeHtml(adminName)}</strong><br/>
      Ticketing System Team</p>
      
      <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #f0f0f0; font-size: 12px; color: #666;">
        <p>This is an automated message. Please do not reply to this email.</p>
      </div>
    </div>
  `;
  
  const text = `
    SYSTEM REGISTRATION CREDENTIALS
    
    Your system "${system.system_name}" has been registered successfully.
    
    System Name: ${system.system_name}
    System ID: ${system.system_id}
    Login Email: ${system.system_user.email}
    Password: ${password}
    Role: ${system.system_user.role_name}
    
    Login URL: ${process.env.APP_URL || 'http://localhost:3000'}/login
    
    HOW TO USE:
    1. Use the credentials above to login
    2. After login, you can create tickets using API endpoints
    3. Use the session cookie for authenticated requests
    
    API USAGE EXAMPLE:
    
    // 1. Login to get session cookie
    POST ${process.env.APP_URL || 'http://localhost:3000'}/api/auth/login
    Body: {"email": "${system.system_user.email}", "password": "${password}"}
    
    // 2. Create ticket (use session cookie)
    POST ${process.env.APP_URL || 'http://localhost:3000'}/api/ticket/raise
    Body: {"category": "Technical", "comments": "Issue description", "priority": "High"}
    
    SECURITY NOTICE: 
    This password is temporary. Please change it after first login if possible.
    Keep these credentials secure and do not share them.
    
    Best regards,
    ${adminName}
    Ticketing System Team
    
    This is an automated message. Please do not reply to this email.
  `;
  
  return { subject, html, text };
}

module.exports = { systemCredentialsTemplate };