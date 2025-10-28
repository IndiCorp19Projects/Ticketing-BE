// models/index.js - FIXED VERSION
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
const Ticket = require('./Ticket')(sequelize, Sequelize.DataTypes);
const TicketReply = require('./TicketReply')(sequelize, Sequelize.DataTypes);
const TicketImage = require('./TicketImage')(sequelize, Sequelize.DataTypes);
const SLA = require('./SLA')(sequelize, Sequelize.DataTypes);
const Document = require('./Document')(sequelize, Sequelize.DataTypes); 

const Category = require('./Category')(sequelize, Sequelize.DataTypes);
const SubCategory = require('./SubCategory')(sequelize, Sequelize.DataTypes);
const IssueType = require('./IssueType')(sequelize, Sequelize.DataTypes);
const Priority = require('./Priority')(sequelize, Sequelize.DataTypes);
const WorkingHours = require('./WorkingHours')(sequelize, Sequelize.DataTypes);
const SystemRegistration = require('./SystemRegistration')(sequelize, Sequelize.DataTypes);

const Client = require('./client')(sequelize, Sequelize.DataTypes);
const ClientSLA = require('./clientSLA')(sequelize, Sequelize.DataTypes);

const Escalation = require('./escalation.js')(sequelize, Sequelize.DataTypes);

const EscalationHistory = require('./escalationHistory')(sequelize, Sequelize.DataTypes);
const EscalationLevel = require('./escalationLevel')(sequelize, Sequelize.DataTypes);

// FIXED: Use correct property names - don't overwrite Document with IssueType
dbObj.User = User;
dbObj.Ticket = Ticket;
dbObj.TicketReply = TicketReply;
dbObj.TicketImage = TicketImage;
dbObj.SLA = SLA;
dbObj.Document = Document; // This is the actual Document model

dbObj.Category = Category;
dbObj.SubCategory = SubCategory;
dbObj.IssueType = IssueType; // Fixed: Use IssueType, not Document
dbObj.Priority = Priority;   // Fixed: Use Priority, not priority
dbObj.WorkingHours = WorkingHours;
dbObj.SystemRegistration = SystemRegistration; // ADD THIS

dbObj.Client = Client;
dbObj.ClientSLA = ClientSLA;


dbObj.Escalation = Escalation; // ADD THIS

dbObj.EscalationHistory = EscalationHistory;
dbObj.EscalationLevel = EscalationLevel;

// call associate on each model if present (once)
Object.keys(dbObj).forEach((key) => {
  if (key === 'sequelize' || key === 'Sequelize') return;
  const model = dbObj[key];
  if (model && typeof model.associate === 'function') {
    model.associate(dbObj);
  }
});

module.exports = dbObj;