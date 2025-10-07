// models/ticket.js
module.exports = (sequelize, DataTypes) => {
  const Ticket = sequelize.define(
    'Ticket',
    {
      ticket_id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      user_id: { type: DataTypes.INTEGER, allowNull: false },

      // link to category/subcategory/issuetype
      category_id: { type: DataTypes.INTEGER, allowNull: true },
      subcategory_id: { type: DataTypes.INTEGER, allowNull: true },
      issue_type_id: { type: DataTypes.INTEGER, allowNull: true },

      // custom issue name when IssueType = Other
      issue_name: { type: DataTypes.STRING(255), allowNull: true },

      // priority (FK + textual denormalized fallback)
      priority_id: { type: DataTypes.INTEGER, allowNull: true },
      priority: { type: DataTypes.STRING(50), allowNull: false, defaultValue: 'Medium' },

      module: { type: DataTypes.STRING(100), allowNull: true }, // legacy / optional
      sub_module: { type: DataTypes.STRING(100), allowNull: true },
      category: { type: DataTypes.STRING(100), allowNull: true },
      comment: { type: DataTypes.TEXT, allowNull: false },
      screenshot_url: { type: DataTypes.BLOB('long'), allowNull: true },
      status: {
        type: DataTypes.ENUM('Open', 'Pending', 'Resolved', 'Closed'),
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
    Ticket.belongsTo(models.User, { foreignKey: 'user_id', as: 'creator' });

    Ticket.belongsTo(models.Category, { foreignKey: 'category_id', as: 'category_obj', constraints: false });
    Ticket.belongsTo(models.SubCategory, { foreignKey: 'subcategory_id', as: 'subcategory_obj', constraints: false });
    Ticket.belongsTo(models.IssueType, { foreignKey: 'issue_type_id', as: 'issue_type_obj', constraints: false });

    Ticket.belongsTo(models.Priority, { foreignKey: 'priority_id', as: 'priority_obj', constraints: false });

    Ticket.hasMany(models.TicketReply, { foreignKey: 'ticket_id', as: 'replies' });

    if (models.TicketImage) {
      Ticket.hasMany(models.TicketImage, { foreignKey: 'ticket_id', as: 'images' });
    }

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
