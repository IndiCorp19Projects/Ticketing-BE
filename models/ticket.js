// models/ticket.js
module.exports = (sequelize, DataTypes) => {
  const Ticket = sequelize.define(
    'Ticket',
    {
      ticket_id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      user_id: { type: DataTypes.INTEGER, allowNull: false },
      module: { type: DataTypes.STRING(100), allowNull: false },
      sub_module: { type: DataTypes.STRING(100), allowNull: true },
      category: { type: DataTypes.STRING(100), allowNull: false }, // This will store issue_type
      
      // NEW COLUMNS
      issue_name: { type: DataTypes.STRING(255), allowNull: true }, // Stores custom issue name when category is "Other"
      priority: { type: DataTypes.STRING(50), allowNull: false, defaultValue: 'Medium' }, // Stores priority
      
      comment: { type: DataTypes.TEXT, allowNull: false },
      screenshot_url: { type: DataTypes.BLOB('long'), allowNull: true },
      status: {
        type: DataTypes.ENUM('Open', 'In Progress', 'Resolved', 'Pending Closure', 'Closed', 'Reopened'),
        defaultValue: 'Open'
      },
      prev_status: { type: DataTypes.STRING(100), allowNull: true },
      created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },

      // SLA and tracking
      sla_id: { type: DataTypes.INTEGER, allowNull: true },
      response_at: { type: DataTypes.DATE, allowNull: true },
      response_time_seconds: { type: DataTypes.INTEGER, allowNull: true },
      resolved_at: { type: DataTypes.DATE, allowNull: true },
      resolve_time_seconds: { type: DataTypes.INTEGER, allowNull: true },
      last_updated_by: { type: DataTypes.STRING(100), allowNull: true }
    },
    {
      tableName: 'ticket',
      timestamps: false
    }
  );

  Ticket.associate = (models) => {
    // ticket creator
    Ticket.belongsTo(models.User, { foreignKey: 'user_id', as: 'creator' });

    // replies
    Ticket.hasMany(models.TicketReply, { foreignKey: 'ticket_id', as: 'replies' });

    // images (if model exists)
    if (models.TicketImage) {
      Ticket.hasMany(models.TicketImage, { foreignKey: 'ticket_id', as: 'images' });
    }

    // SLA
    if (models.SLA) {
      Ticket.belongsTo(models.SLA, { foreignKey: 'sla_id', as: 'sla' });
    }

    if (models.Document) {
      Ticket.hasMany(models.Document, {
        foreignKey: 'linked_id',
        as: 'documents',
        scope: { table_name: 'ticket' },
        constraints: false
      });
    }
  };

  return Ticket;
};