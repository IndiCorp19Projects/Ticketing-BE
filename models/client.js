module.exports = (sequelize, DataTypes) => {
  const Client = sequelize.define(
    'Client',
    {
      client_id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      company_name: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },
      contact_person: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      email: {
        type: DataTypes.STRING(255),
        allowNull: false,
        unique: false,
      },
      password_hash: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },
      phone: {
        type: DataTypes.STRING(50),
        allowNull: true,
      },
      address: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      is_active: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      registration_date: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
      last_login_date: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      // NEW FIELDS
      allowed_file_size: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 10, // Default 10 MB
        comment: 'Maximum allowed file size in MB for uploads'
      },
      ticket_auto_close_timer: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 7, // Default 7 days
        comment: 'Auto close tickets after X days of resolution'
      }
    },
    {
      tableName: 'client',
      timestamps: false,
      hooks: {
        beforeCreate: async (client) => {
          if (client.password_hash) {
            const pwd = require('../utils/passwordHashing');
            client.password_hash = await pwd.hashPassword(client.password_hash);
          }
        },
        beforeUpdate: async (client) => {
          if (client.changed('password_hash')) {
            const pwd = require('../utils/passwordHashing');
            client.password_hash = await pwd.hashPassword(client.password_hash);
          }
        },
      },
    }
  );

  Client.associate = (models) => {
    Client.hasMany(models.Ticket, { foreignKey: 'client_id', as: 'tickets' });
    Client.hasMany(models.ClientSLA, { foreignKey: 'client_id', as: 'slas' });
    Client.hasMany(models.TicketReply, { 
      foreignKey: 'sender_id', 
      as: 'sentReplies',
      constraints: false,
      scope: {
        sender_type: 'client'
      }
    });
  };

  return Client;
};