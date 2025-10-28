// models/escalationHistory.js
module.exports = (sequelize, DataTypes) => {
  const EscalationHistory = sequelize.define(
    'EscalationHistory',
    {
      history_id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      escalation_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: 'escalation',
          key: 'escalation_id'
        }
      },
      action: {
        type: DataTypes.ENUM('escalated', 'reminder_sent', 'acknowledged', 'resolved', 'reassigned'),
        allowNull: false
      },
      performed_by: {
        type: DataTypes.INTEGER,
        allowNull: false
      },
      performed_name: {
        type: DataTypes.TEXT,
        allowNull: true
      },
         performed_reminder_name: {
        type: DataTypes.TEXT,
        allowNull: true
      },

      notes: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      created_on: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
      }
    },
    {
      tableName: 'escalation_history',
      timestamps: false
    }
  );

  EscalationHistory.associate = (models) => {
    EscalationHistory.belongsTo(models.Escalation, { foreignKey: 'escalation_id', as: 'escalation' });
    EscalationHistory.belongsTo(models.User, { foreignKey: 'performed_by', as: 'performer' });
  };

  return EscalationHistory;
};