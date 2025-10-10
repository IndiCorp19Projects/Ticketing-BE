// models/SLA.js
module.exports = (sequelize, DataTypes) => {
  const SLA = sequelize.define(
    'SLA',
    {
      sla_id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      user_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: 'user',
          key: 'user_id'
        }
      },
      issue_type: {
        type: DataTypes.STRING(150),
        allowNull: false
      },
      response_target_minutes: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 60
      },
      resolve_target_minutes: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 1440
      },
      is_active: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true
      },
      created_by: {
        type: DataTypes.STRING(100),
        allowNull: true
      },
      updated_by: {
        type: DataTypes.STRING(100),
        allowNull: true
      },
      created_on: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
      },
      updated_on: {
        type: DataTypes.DATE,
        allowNull: true
      }
    },
    {
      tableName: 'sla',
      timestamps: false,
      indexes: [
        {
          unique: true,
          fields: ['user_id', 'issue_type']
        }
      ]
    }
  );

  SLA.associate = (models) => {
    SLA.belongsTo(models.User, { foreignKey: 'user_id', as: 'user' });
    SLA.hasMany(models.Ticket, { foreignKey: 'sla_id', as: 'tickets' });
    SLA.hasMany(models.IssueType, { foreignKey: 'sla_id', as: 'issue_types' });
  };

  return SLA;
};