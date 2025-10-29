// models/systemRegistration.js
module.exports = (sequelize, DataTypes) => {
  const SystemRegistration = sequelize.define(
    'SystemRegistration',
    {
      system_id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      system_name: {
        type: DataTypes.STRING(255),
        allowNull: false,
        unique: false
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      contact_email: {  // NEW: Contact email for sending credentials
        type: DataTypes.STRING(255),
        allowNull: false,
        validate: {
          isEmail: true
        }
      },
      system_user_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: 'user',
          key: 'user_id'
        }
      },
      created_by: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: 'user',
          key: 'user_id'
        }
      },
      is_active: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true
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
      tableName: 'system_registration',
      timestamps: false
    }
  );

  SystemRegistration.associate = (models) => {
    SystemRegistration.belongsTo(models.User, { 
      foreignKey: 'created_by', 
      as: 'admin_creator' 
    });
    SystemRegistration.belongsTo(models.User, { 
      foreignKey: 'system_user_id', 
      as: 'system_user' 
    });
  };

  return SystemRegistration;
};