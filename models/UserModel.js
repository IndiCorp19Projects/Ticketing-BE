
module.exports = (sequelize, DataTypes) => {
  const User = sequelize.define('User', {
        user_id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        username: {  // Changed column name to lowercase
            type: DataTypes.STRING(50),
            allowNull: false,
        },
        usermob: {  // Changed column name to lowercase
            type: DataTypes.STRING(50),
            allowNull: true,
        },
        password_hash: {  // Changed column name to lowercase
            type: DataTypes.STRING(255),
            allowNull: false,
            get() {
                // Return the hashed password``
                return this.getDataValue('password_hash');
            },
        },
        first_name: {  // Changed column name to lowercase
            type: DataTypes.STRING(100),
            allowNull: true
        },
        last_name: {  // Changed column name to lowercase
            type: DataTypes.STRING(100),
            allowNull: true
        },
        email: {  // Changed column name to lowercase
            type: DataTypes.STRING(255),
            allowNull: true
        },
        phone_number: {  // Changed column name to lowercase
            type: DataTypes.STRING(20),
            allowNull: true
        },
        address1_line1: {  // Changed column name to lowercase
            type: DataTypes.STRING(255),
            allowNull: true
        },
        address1_line2: {  // Changed column name to lowercase
            type: DataTypes.STRING(255),
            allowNull: true
        },
        city1: {  // Changed column name to lowercase
            type: DataTypes.STRING(100),
            allowNull: true
        },
        state1: {  // Changed column name to lowercase
            type: DataTypes.STRING(100),
            allowNull: true
        },
        country1: {  // Changed column name to lowercase
            type: DataTypes.STRING(100),
            allowNull: true
        },
        postal_code1: {  // Changed column name to lowercase
            type: DataTypes.STRING(20),
            allowNull: true
        },
        address2_line1: {  // Changed column name to lowercase
            type: DataTypes.STRING(255),
            allowNull: true
        },
        address2_line2: {  // Changed column name to lowercase
            type: DataTypes.STRING(255),
            allowNull: true
        },
        city2: {  // Changed column name to lowercase
            type: DataTypes.STRING(100),
            allowNull: true
        },
        state2: {  // Changed column name to lowercase
            type: DataTypes.STRING(100),
            allowNull: true
        },
        country2: {  // Changed column name to lowercase
            type: DataTypes.STRING(100),
            allowNull: true
        },
        postal_code2: {  // Changed column name to lowercase
            type: DataTypes.STRING(20),
            allowNull: true
        },
        date_of_birth: {  // Changed column name to lowercase
            type: DataTypes.DATEONLY,
            allowNull: true
        },
        dept_id: {
            type: DataTypes.INTEGER,
            allowNull: false
        },
        design_id: {
            type: DataTypes.INTEGER,
            allowNull: false
        },
        registration_date: {  // Changed column name to lowercase
            type: DataTypes.DATE,
            allowNull: true
        },
        last_login_date: {  // Changed column name to lowercase
            type: DataTypes.DATE,
            allowNull: true
        },
        is_active: {  // Changed column name to lowercase
            type: DataTypes.BOOLEAN,
            allowNull: true
        },
        role: {  // Changed column name to lowercase
            type: DataTypes.INTEGER,
            allowNull: true
        },
        profile_picture_url: {  // Changed column name to lowercase
            type: DataTypes.STRING(255),
            allowNull: true
        },
        two_factor_enabled: {  // Changed column name to lowercase
            type: DataTypes.BOOLEAN,
            allowNull: true
        },
        last_password_reset_date: {  // Changed column name to lowercase
            type: DataTypes.DATE,
            allowNull: true
        },
        notes: {  // Changed column name to lowercase
            type: DataTypes.TEXT,
            allowNull: true
        },
        role_name: {  // Changed column name to lowercase
            type: DataTypes.STRING(155),
            allowNull: true
        },
        status: {  // Changed column name to lowercase
            type: DataTypes.STRING(55),
            allowNull: true
        },
        created_by: {  // Changed column name to lowercase
            type: DataTypes.STRING(55),
            allowNull: true
        },
        updated_by: {  // Changed column name to lowercase
            type: DataTypes.STRING(55),
            allowNull: true
        }
    }, {
        tableName: 'user',
        timestamps: false,
        createdAt: 'created_on',
        updatedAt: 'updated_on',
    })

    return User;
};
