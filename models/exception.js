// models/Exception.js
module.exports = (sequelize, DataTypes) => {
  const Exception = sequelize.define('Exception', {
    exception_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    date: {
      type: DataTypes.DATEONLY,
      allowNull: false
    },
    open_time: {
      type: DataTypes.TIME,
      allowNull: true
    },
    close_time: {
      type: DataTypes.TIME,
      allowNull: true
    },
    type: {
      type: DataTypes.ENUM('half day', 'holiday'),
      allowNull: false
    },
    working_hour: {
      type: DataTypes.FLOAT,
      allowNull: true
    },
    created_on: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    },
    updated_on: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    },
    created_by: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    updated_by: {
      type: DataTypes.INTEGER,
      allowNull: true
    }
  }, {
    tableName: 'exceptions',
    timestamps: false,
    hooks: {
      beforeSave: (exception, options) => {
        exception.updated_on = new Date();
        
        // Calculate working hours for half day
        if (exception.type === 'half day' && exception.open_time && exception.close_time) {
          const openTime = new Date(`1970-01-01T${exception.open_time}`);
          const closeTime = new Date(`1970-01-01T${exception.close_time}`);
          const diffMs = closeTime - openTime;
          const diffHours = diffMs / (1000 * 60 * 60);
          exception.working_hour = diffHours;
        } else if (exception.type === 'holiday') {
          exception.working_hour = 0;
          exception.open_time = null;
          exception.close_time = null;
        }
      }
    }
  });

  // Add associations
  Exception.associate = (models) => {
    Exception.belongsTo(models.User, { foreignKey: 'created_by', as: 'creator' });
    Exception.belongsTo(models.User, { foreignKey: 'updated_by', as: 'updater' });
  };

  return Exception;
};