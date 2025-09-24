// require('dotenv').config();

// module.exports = {
//   jwtSecret: process.env.JWT_SECRET,
//   salt: process.env.SALT,
// };


require('dotenv').config();

module.exports = {
  jwtSecret: process.env.JWT_SECRET || 'changeme',
  salt: process.env.SALT || '10',
  db: {
    host: process.env.DB_HOST || '148.135.138.69',
    username: process.env.DB_USER || 'pmauser',
    password: process.env.DB_PASS || 'LOGIndiCorp@20190307',
    database: process.env.DB_NAME || 'TicketingTool',
    dialect: process.env.DB_DIALECT || 'mysql',
  },
};

