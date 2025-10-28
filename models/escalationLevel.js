// models/escalationLevel.js
module.exports = (sequelize, DataTypes) => {
  const EscalationLevel = sequelize.define(
    'EscalationLevel',
    {
      level_id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      level_number: {
        type: DataTypes.INTEGER,
        allowNull: false,
        unique: true
      },
      level_name: {
        type: DataTypes.STRING(100),
        allowNull: false
      },
      default_assignee_id: {
        type: DataTypes.INTEGER,
        allowNull: true
      },
      default_email: {
        type: DataTypes.STRING(255),
        allowNull: true
      },
      is_active: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: true
      }
    },
    {
      tableName: 'escalation_level',
      timestamps: false
    }
  );

  EscalationLevel.associate = (models) => {
    EscalationLevel.belongsTo(models.User, { foreignKey: 'default_assignee_id', as: 'default_assignee' });
  };

  return EscalationLevel;
};