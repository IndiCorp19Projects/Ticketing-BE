const fs = require('fs');
const path = require('path');
const Sequelize = require('sequelize');
require('dotenv').config();

const { db } = require('../config/config');

const sequelize = new Sequelize(db.database, db.username, db.password, {
  host: db.host,
  dialect: db.dialect,
  logging: false,
});

const dbObj = { sequelize, Sequelize };

const User = require('./user')(sequelize, Sequelize.DataTypes);
const Ticket = require('./ticket')(sequelize, Sequelize.DataTypes);
const TicketReply = require('./ticketReply')(sequelize, Sequelize.DataTypes);


const TicketImage = require('./TicketImage')(sequelize, Sequelize.DataTypes);





// associations
User.hasMany(Ticket, { foreignKey: 'user_id', as: 'tickets' });
Ticket.belongsTo(User, { foreignKey: 'user_id', as: 'creator' });

Ticket.hasMany(TicketReply, { foreignKey: 'ticket_id', as: 'replies' });
TicketReply.belongsTo(Ticket, { foreignKey: 'ticket_id', as: 'ticket' });

User.hasMany(TicketReply, { foreignKey: 'sender_id', as: 'sentReplies' });
TicketReply.belongsTo(User, { foreignKey: 'sender_id', as: 'sender' });


// Associations (after registering)
Ticket.hasMany(TicketImage, { foreignKey: 'ticket_id', as: 'images' });
TicketImage.belongsTo(Ticket, { foreignKey: 'ticket_id', as: 'ticket' });

dbObj.User = User;
dbObj.Ticket = Ticket;
dbObj.TicketReply = TicketReply;
dbObj.TicketImage = TicketImage;

module.exports = dbObj;
