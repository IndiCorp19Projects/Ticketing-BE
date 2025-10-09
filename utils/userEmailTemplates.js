function escapeHtml(s = '') {
  return (s + '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

function userCredentialsTemplate({ user, password, adminName = 'Admin' }) {
  const subject = `Your Account Credentials - ${user.first_name} ${user.last_name}`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #333; border-bottom: 2px solid #f0f0f0; padding-bottom: 10px;">Account Credentials</h2>
      
      <p>Hello <strong>${escapeHtml(user.first_name)} ${escapeHtml(user.last_name)}</strong>,</p>
      
      <p>Your account has been ${user.is_new ? 'created' : 'updated'} successfully. Here are your login credentials:</p>
      
      <div style="background: #f9f9f9; padding: 15px; border-radius: 5px; margin: 20px 0;">
        <table style="width: 100%;">
          <tr>
            <td style="padding: 8px 0; font-weight: bold; width: 120px;">Username:</td>
            <td style="padding: 8px 0;">${escapeHtml(user.username)}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; font-weight: bold;">Email:</td>
            <td style="padding: 8px 0;">${escapeHtml(user.email)}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; font-weight: bold;">Password:</td>
            <td style="padding: 8px 0; font-family: monospace;">${escapeHtml(password)}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; font-weight: bold;">Role:</td>
            <td style="padding: 8px 0;">${escapeHtml(user.role_name)}</td>
          </tr>
        </table>
      </div>
      
      <div style="background: #e8f4fd; padding: 15px; border-radius: 5px; margin: 20px 0;">
        <p style="margin: 0; color: #0066cc;">
          <strong>Important:</strong> Please change your password after first login.
        </p>
      </div>
      
      <p>
        <a href="${process.env.APP_URL || 'http://localhost:3000'}/login" 
           style="background: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">
          Login to Your Account
        </a>
      </p>
      
      <p>If you have any questions, please contact the administrator.</p>
      
      <p>Best regards,<br/>
      <strong>${escapeHtml(adminName)}</strong><br/>
      Ticketing System</p>
    </div>
  `;
  
  const text = `
    ACCOUNT CREDENTIALS
    
    Hello ${user.first_name} ${user.last_name},
    
    Your account has been ${user.is_new ? 'created' : 'updated'} successfully.
    
    Username: ${user.username}
    Email: ${user.email}
    Password: ${password}
    Role: ${user.role_name}
    
    Login URL: ${process.env.APP_URL || 'http://localhost:3000'}/login
    
    Important: Please change your password after first login.
    
    Best regards,
    ${adminName}
    Ticketing System
  `;
  
  return { subject, html, text };
}

module.exports = { userCredentialsTemplate };