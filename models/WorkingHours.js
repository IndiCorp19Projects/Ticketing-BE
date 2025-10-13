module.exports = (sequelize, DataTypes) => {
  const WorkingHours = sequelize.define(
    'WorkingHours',
    {
      working_hours_id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      name: {
        type: DataTypes.STRING(150),
        allowNull: false,
        defaultValue: 'Default Working Hours'
      },
      timezone: {
        type: DataTypes.STRING(100),
        allowNull: false,
        defaultValue: 'UTC'
      },
      // Store days as bitmask: 1=Sunday, 2=Monday, 4=Tuesday, 8=Wednesday, 16=Thursday, 32=Friday, 64=Saturday
      working_days: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 62 // Monday-Friday (2+4+8+16+32=62)
      },
      start_time: {
        type: DataTypes.TIME,
        allowNull: false,
        defaultValue: '09:00:00'
      },
      end_time: {
        type: DataTypes.TIME,
        allowNull: false,
        defaultValue: '18:00:00'
      },
      is_default: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
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
      tableName: 'working_hours',
      timestamps: false,
      indexes: [
        {
          unique: true,
          fields: ['is_default'],
          where: { is_default: true }
        }
      ]
    }
  );

  WorkingHours.associate = (models) => {
    WorkingHours.hasMany(models.SLA, { 
      foreignKey: 'working_hours_id', 
      as: 'slas' 
    });
  };

  return WorkingHours;
};