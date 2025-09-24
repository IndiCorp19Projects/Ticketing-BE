module.exports = (sequelize, DataTypes) => {
  const TicketReply = sequelize.define(
    'TicketReply',
    {
      reply_id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      ticket_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      sender_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      sender_type: {
        type: DataTypes.ENUM('user', 'admin', 'system'),
        allowNull: false,
      },
      message: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      created_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
    },
    {
      tableName: 'ticket_reply',
      timestamps: false,
    }
  );

  return TicketReply;
};
