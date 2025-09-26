// models/index.js
const Sequelize = require('sequelize');
require('dotenv').config();

const { db } = require('../config/config');

const sequelize = new Sequelize(db.database, db.username, db.password, {
  host: db.host,
  dialect: db.dialect,
  logging: false,
});

const dbObj = { sequelize, Sequelize };

// explicit model imports
const User = require('./user')(sequelize, Sequelize.DataTypes);
const Ticket = require('./ticket')(sequelize, Sequelize.DataTypes);
const TicketReply = require('./ticketReply')(sequelize, Sequelize.DataTypes);
const TicketImage = require('./TicketImage')(sequelize, Sequelize.DataTypes);
const SLA = require('./SLA')(sequelize, Sequelize.DataTypes);

// attach to db object
dbObj.User = User;
dbObj.Ticket = Ticket;
dbObj.TicketReply = TicketReply;
dbObj.TicketImage = TicketImage;
dbObj.SLA = SLA;

// call associate on each model if present (once)
Object.keys(dbObj).forEach((key) => {
  if (key === 'sequelize' || key === 'Sequelize') return;
  const model = dbObj[key];
  if (model && typeof model.associate === 'function') {
    model.associate(dbObj);
  }
});

module.exports = dbObj;
