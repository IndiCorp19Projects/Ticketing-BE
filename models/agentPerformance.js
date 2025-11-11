// models/agentPerformance.js
module.exports = (sequelize, DataTypes) => {
  const AgentPerformance = sequelize.define(
    'AgentPerformance',
    {
      performance_id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      agent_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: 'user',
          key: 'user_id'
        }
      },
      period_start: {
        type: DataTypes.DATE,
        allowNull: false,
      },
      period_end: {
        type: DataTypes.DATE,
        allowNull: false,
      },
      period_type: {
        type: DataTypes.ENUM('daily', 'weekly', 'monthly', 'yearly'),
        defaultValue: 'monthly'
      },
      // Resolution metrics
      total_tickets_assigned: {
        type: DataTypes.INTEGER,
        defaultValue: 0
      },
      tickets_resolved: {
        type: DataTypes.INTEGER,
        defaultValue: 0
      },
      tickets_pending: {
        type: DataTypes.INTEGER,
        defaultValue: 0
      },
      tickets_reopened: {
        type: DataTypes.INTEGER,
        defaultValue: 0
      },
      // Time metrics
      avg_resolution_time_seconds: {
        type: DataTypes.DECIMAL(10, 2),
        defaultValue: 0
      },
      avg_first_response_time_seconds: {
        type: DataTypes.DECIMAL(10, 2),
        defaultValue: 0
      },
      total_resolution_time_seconds: {
        type: DataTypes.DECIMAL(10, 2),
        defaultValue: 0
      },
      // SLA metrics
      sla_met_count: {
        type: DataTypes.INTEGER,
        defaultValue: 0
      },
      sla_missed_count: {
        type: DataTypes.INTEGER,
        defaultValue: 0
      },
      // Quality metrics
      customer_satisfaction_score: {
        type: DataTypes.DECIMAL(3, 2),
        allowNull: true
      },
      first_contact_resolution_rate: {
        type: DataTypes.DECIMAL(5, 2),
        defaultValue: 0
      },
      // Calculated fields
      resolution_rate: {
        type: DataTypes.DECIMAL(5, 2),
        defaultValue: 0
      },
      sla_compliance_rate: {
        type: DataTypes.DECIMAL(5, 2),
        defaultValue: 0
      }
    },
    {
      tableName: 'agent_performance',
      timestamps: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at'
    }
  );

  AgentPerformance.associate = (models) => {
    AgentPerformance.belongsTo(models.User, {
      foreignKey: 'agent_id',
      as: 'agent'
    });
  };

  return AgentPerformance;
};