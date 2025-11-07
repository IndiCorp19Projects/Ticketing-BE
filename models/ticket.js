// models/ticket.js
module.exports = (sequelize, DataTypes) => {
  const Ticket = sequelize.define(
    'Ticket',
    {
      ticket_id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      user_id: { type: DataTypes.INTEGER, allowNull: true },
      client_id: { type: DataTypes.INTEGER, allowNull: true },

      // link to category/subcategory/issuetype
      category_id: { type: DataTypes.INTEGER, allowNull: true },
      subcategory_id: { type: DataTypes.INTEGER, allowNull: true },
      issue_type_id: { type: DataTypes.INTEGER, allowNull: true },

      // custom issue name when IssueType = Other
      issue_name: { type: DataTypes.STRING(255), allowNull: true },

      // NEW: Flag to identify "Other" issue type
      is_other_issue: { type: DataTypes.BOOLEAN, defaultValue: false },

      // priority (FK + textual denormalized fallback)
      priority_id: { type: DataTypes.INTEGER, allowNull: true },
      priority: {
        type: DataTypes.STRING(50),
        allowNull: false,
        defaultValue: 'Medium'
      },

      // ... rest of your existing fields
      sla_resolve_datetime: { type: DataTypes.DATE, allowNull: true },
      sla_response_datetime: { type: DataTypes.DATE, allowNull: true },
      module: { type: DataTypes.STRING(100), allowNull: true },
      sub_module: { type: DataTypes.STRING(100), allowNull: true },
      category: { type: DataTypes.STRING(100), allowNull: true },
      comment: { type: DataTypes.TEXT, allowNull: false },
      screenshot_url: { type: DataTypes.BLOB('long'), allowNull: true },
      status: {
        type: DataTypes.ENUM('Open', 'Pending', 'Resolved', 'Closed','Reopen','Cancel'),
        defaultValue: 'Open'
      },
      prev_status: { type: DataTypes.STRING(100), allowNull: true },
      created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },

      // SLA and tracking
      sla_id: { type: DataTypes.INTEGER, allowNull: true },
      response_at: { type: DataTypes.DATE, allowNull: true },
      response_time_seconds: { type: DataTypes.DECIMAL(10, 2), allowNull: true },
      resolved_at: { type: DataTypes.DATE, allowNull: true },
      resolve_time_seconds: { type: DataTypes.DECIMAL(10, 2), allowNull: true },
      last_updated_by: { type: DataTypes.STRING(100), allowNull: true },
      assigned_to: { type: DataTypes.INTEGER, allowNull: true },

      client_user_id: {
        type: DataTypes.STRING(255),
        allowNull: true
      },
      client_user_name: {
        type: DataTypes.STRING(255),
        allowNull: true
      },
      client_user_email: {
        type: DataTypes.STRING(255),
        allowNull: true
      },
      client_user_role: {
        type: DataTypes.ENUM('admin', 'user'),
        defaultValue: 'user',
        allowNull: false
      },
      assigned_client_user_id: {
        type: DataTypes.STRING(255),
        allowNull: true
      },
      assigned_client_user_name: {
        type: DataTypes.STRING(255),
        allowNull: true
      },
      assigned_client_user_email: {
        type: DataTypes.STRING(255),
        allowNull: true
      },
      // In models/ticket.js, add these fields:
      escalation_level: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: null
      },
      escalation_status: {
        type: DataTypes.ENUM('not_escalated', 'level_1', 'level_2', 'level_3', 'resolved'),
        defaultValue: 'not_escalated'
      },
      current_escalation_id: {
        type: DataTypes.INTEGER,
        allowNull: true
      },
      owner_by: {
        type: DataTypes.STRING(255),
        allowNull: true
      },
      ticket_total_file_size: {
        type: DataTypes.DECIMAL(10, 0),
        allowNull: false,
        defaultValue: 0, // Default 10 MB
      },
    },
    {
      tableName: 'ticket',
      timestamps: false
    }
  );

  // models/ticket.js - Add these to the associate function
  Ticket.associate = (models) => {
    Ticket.belongsTo(models.User, { foreignKey: 'user_id', as: 'creator' });

    // ADD Client association
    Ticket.belongsTo(models.Client, {
      foreignKey: 'client_id',
      as: 'client',
      constraints: false
    });

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

    // ADD ClientSLA association
    if (models.ClientSLA) {
      Ticket.belongsTo(models.ClientSLA, {
        foreignKey: 'client_sla_id',
        as: 'client_sla',
        constraints: false
      });
    }

    if (models.Document) {
      Ticket.hasMany(models.Document, {
        foreignKey: 'linked_id',
        as: 'documents',
        scope: { table_name: 'ticket' },
        constraints: false
      });
    }

    Ticket.belongsTo(models.User, { foreignKey: 'assigned_to', as: 'assignee', constraints: false });

    // ADD THESE ESCALATION ASSOCIATIONS
    if (models.Escalation) {
      // A ticket can have many escalations (history)
      Ticket.hasMany(models.Escalation, {
        foreignKey: 'ticket_id',
        as: 'escalations'
      });

      // A ticket can have one current escalation
      Ticket.belongsTo(models.Escalation, {
        foreignKey: 'current_escalation_id',
        as: 'current_escalation'
      });
    }
  };
  return Ticket;
};