module.exports = (sequelize, DataTypes) => {
  const Ticket = sequelize.define(
    'Ticket',
    {
      ticket_id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      user_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      module: {
        type: DataTypes.STRING(100),
        allowNull: false,
      },
      sub_module: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },
      category: {
        type: DataTypes.STRING(100),
        allowNull: false,
      },
      comment: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      screenshot_url: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      status: {
        type: DataTypes.ENUM('Open', 'In Progress', 'Resolved', 'Pending Closure', 'Closed', 'Reopened'),
        defaultValue: 'Open',
      },
      prev_status: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },
      created_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
      updated_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
    },
    {
      tableName: 'ticket',
      timestamps: false,
    }
  );

  return Ticket;
};
