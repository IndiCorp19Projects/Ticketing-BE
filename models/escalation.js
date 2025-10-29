// models/escalation.js
module.exports = (sequelize, DataTypes) => {
  const Escalation = sequelize.define(
    'Escalation',
    {
      escalation_id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      ticket_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: 'ticket',
          key: 'ticket_id'
        }
      },
      escalated_by: {
        type: DataTypes.INTEGER,
        allowNull: false
      },
      escalated_to_level: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 1
      },
      escalated_to_user_id: {
        type: DataTypes.INTEGER,
        allowNull: true
      },
      escalated_to_email: {
        type: DataTypes.STRING(255),
        allowNull: false
      },
      escalated_to_user_name: {
        type: DataTypes.TEXT,
        allowNull: false
      },
      subject: {
        type: DataTypes.STRING(500),
        allowNull: false
      },
      message: {
        type: DataTypes.TEXT,
        allowNull: false
      },
      image_base64: {
        type: DataTypes.TEXT('long'), // Use TEXT('long') for large base64 strings
        allowNull: true
      },

//       image_base64: {
//   type: DataTypes.BLOB('long'), // Use BLOB('long') for LONGBLOB
//   allowNull: true
// },
      status: {
        type: DataTypes.ENUM('pending', 'acknowledged', 'resolved', 'cancelled'),
        defaultValue: 'pending'
      },
      reminder_sent: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
      },
      reminder_count: {
        type: DataTypes.INTEGER,
        defaultValue: 0
      },
      created_on: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
      },
      updated_on: {
        type: DataTypes.DATE,
        allowNull: true
      },
      cc_emails: {
  type: DataTypes.TEXT,
  allowNull: true
},
bcc_emails: {
  type: DataTypes.TEXT,
  allowNull: true
}
    },
    {
      tableName: 'escalation',
      timestamps: false
    }
  );

  Escalation.associate = (models) => {
    Escalation.belongsTo(models.Ticket, { foreignKey: 'ticket_id', as: 'ticket' });
    Escalation.belongsTo(models.User, { foreignKey: 'escalated_by', as: 'escalator' });
    Escalation.belongsTo(models.User, { foreignKey: 'escalated_to_user_id', as: 'escalated_to_user' });
    Escalation.hasMany(models.EscalationHistory, { 
      foreignKey: 'escalation_id', 
      as: 'history' 
    });
  };

  return Escalation;
};