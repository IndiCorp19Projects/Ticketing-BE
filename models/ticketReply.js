// models/ticketReply.js
module.exports = (sequelize, DataTypes) => {
  const TicketReply = sequelize.define(
    'TicketReply',
    {
      reply_id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      ticket_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      sender_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      sender_type: {
        type: DataTypes.ENUM('user', 'admin', 'system'),
        allowNull: false,
      },
      message: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      created_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
    },
    {
      tableName: 'ticket_reply',
      timestamps: false,
    }
  );

  TicketReply.associate = (models) => {
    TicketReply.belongsTo(models.Ticket, { foreignKey: 'ticket_id', as: 'ticket' });
    TicketReply.belongsTo(models.User, { foreignKey: 'sender_id', as: 'sender' });

    if (models.Document) {
      TicketReply.hasMany(models.Document, {
        foreignKey: 'linked_id',
        as: 'documents',
        scope: { table_name: 'ticket_reply' },
        constraints: false
      });
    }
  };

  return TicketReply;
};
