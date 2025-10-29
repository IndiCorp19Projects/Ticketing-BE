const pwd = require('../utils/passwordHashing');

module.exports = (sequelize, DataTypes) => {
  const User = sequelize.define(
    'User',
    {
      user_id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      usertype: {
        type: DataTypes.STRING(50),
        allowNull: true,
      },
      username: {
        type: DataTypes.STRING(100),
        allowNull: false,
        // unique: true,
      },
      first_name: {
        type: DataTypes.STRING(100),
        allowNull: false,
      },
      last_name: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },
      email: {
        type: DataTypes.STRING(255),
        allowNull: false,
        // unique: true,
      },
      password_hash: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },
      phone_no: {
        type: DataTypes.STRING(20),
        allowNull: true,
      },
      dob: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      designation: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },
      department: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },
      address1: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      address2: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      country: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },
      state: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },
      city: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },
      pincode: {
        type: DataTypes.STRING(20),
        allowNull: true,
      },
      permanent_address1: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      permanent_address2: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      permanent_country: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },
      permanent_state: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },
      permanent_city: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },
      permanent_pincode: {
        type: DataTypes.STRING(20),
        allowNull: true,
      },
      is_active: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      role_name: {
        type: DataTypes.STRING(50),
        allowNull: false,
        defaultValue: 'user',
      },
      registration_date: {
        type: DataTypes.DATE,
        allowNull: true,
        defaultValue: DataTypes.NOW,
      },
      last_login_date: {
        type: DataTypes.DATE,
        allowNull: true,
      },
    },
    {
      tableName: 'user',
      timestamps: false,
      hooks: {
        beforeCreate: async (user) => {
          if (user.password_hash) {
            user.password_hash = await pwd.hashPassword(user.password_hash);
          }
        },
        beforeUpdate: async (user) => {
          if (user.changed('password_hash')) {
            user.password_hash = await pwd.hashPassword(user.password_hash);
          }
        },
      },
    }
  );

  User.associate = (models) => {
    User.hasMany(models.Ticket, { foreignKey: 'user_id', as: 'tickets' });
    User.hasMany(models.TicketReply, { foreignKey: 'sender_id', as: 'sentReplies' });



    // Add Exception associations
    User.hasMany(models.Exception, { foreignKey: 'created_by', as: 'createdExceptions' });
    User.hasMany(models.Exception, { foreignKey: 'updated_by', as: 'updatedExceptions' });
  };

  return User;
};


