module.exports = (sequelize, DataTypes) => {
  const ClientSLA = sequelize.define(
    'ClientSLA',
    {
      client_sla_id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      client_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: 'client',
          key: 'client_id'
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
      tableName: 'client_sla',
      timestamps: false,
      indexes: [
        {
          unique: true,
          fields: ['client_id', 'issue_type_id']
        }
      ]
    }
  );

  ClientSLA.associate = (models) => {
    ClientSLA.belongsTo(models.Client, { foreignKey: 'client_id', as: 'client' });
    ClientSLA.belongsTo(models.IssueType, { 
      foreignKey: 'issue_type_id', 
      as: 'issue_type',
      constraints: false
    });
    ClientSLA.belongsTo(models.WorkingHours, { 
      foreignKey: 'working_hours_id',
      as: 'working_hours',
      constraints: false
    });
    ClientSLA.hasMany(models.Ticket, { 
      foreignKey: 'client_sla_id', 
      as: 'tickets',
      constraints: false
    });
  };

  return ClientSLA;
};