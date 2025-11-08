module.exports = (sequelize, DataTypes) => {
  const slaBreachmailLogModel = sequelize.define(
    "slaBreachmailLogModel",
    {
      sla_breach_mail_log_id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      ticket_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      to: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      subject: {
        type: DataTypes.TEXT,
        allowNull: false,
        unique: false,
      },
      text: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      html: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
    },
    {
      tableName: "sla_breach_mail_log",
      timestamps: true,
    }
  );

  return slaBreachmailLogModel;
};
