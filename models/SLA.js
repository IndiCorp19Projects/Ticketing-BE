// models/sla.js
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
      name: {
        type: DataTypes.STRING(150),
        allowNull: false
      },
      issue_type_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: 'issue_type',
          key: 'issue_type_id'
        }
      },
      working_hours_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
          model: 'working_hours',
          key: 'working_hours_id'
        }
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
      remark: {  // NEW FIELD
        type: DataTypes.TEXT,
        allowNull: true
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
          // unique: true,
          fields: ['user_id', 'issue_type_id']
        },
        {
          // unique: true,
          fields: ['user_id', 'name']
        }
      ]
    }
  );

  SLA.associate = (models) => {
    SLA.belongsTo(models.User, { foreignKey: 'user_id', as: 'user' });
    SLA.belongsTo(models.IssueType, { 
      foreignKey: 'issue_type_id', 
      as: 'issue_type',
      constraints: false
    });
    SLA.belongsTo(models.WorkingHours, {
      foreignKey: 'working_hours_id',
      as: 'working_hours',
      constraints: false
    });
    SLA.hasMany(models.Ticket, { foreignKey: 'sla_id', as: 'tickets' });
  };

  return SLA;
};