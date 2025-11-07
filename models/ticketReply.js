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
        type: DataTypes.ENUM('user', 'admin', 'system', 'client'),
        allowNull: false,
      },
      client_sender_name: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      message: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      log_message: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      created_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
      // Store actual field values
      // status: {
      //   type: DataTypes.ENUM('Open', 'Pending', 'Resolved', 'Closed'),
      //   allowNull: true
      // },
            status: {
        type: DataTypes.ENUM('Open', 'Pending', 'Resolved', 'Closed','Reopen','Cancel'),
        defaultValue: 'Open'
      },
      assigned_to: { 
        type: DataTypes.INTEGER, 
        allowNull: true 
      },
      priority: {
        type: DataTypes.STRING(50),
        allowNull: true
      },
      flag_log: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
      },
      assigned_client_user_id: {
        type: DataTypes.STRING(255),
        allowNull: true
      },
      // Store changes for detailed logging
      change_log: {
        type: DataTypes.JSON,
        allowNull: true,
        defaultValue: null
      }
    },
    {
      tableName: 'ticket_reply',
      timestamps: false,
    }
  );

  TicketReply.associate = (models) => {
    TicketReply.belongsTo(models.Ticket, {
      foreignKey: 'ticket_id',
      as: 'ticket'
    });

    TicketReply.belongsTo(models.User, {
      foreignKey: 'sender_id',
      as: 'sender',
      constraints: false
    });

    TicketReply.belongsTo(models.Client, {
      foreignKey: 'sender_id',
      as: 'sender_client',
      constraints: false
    });

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