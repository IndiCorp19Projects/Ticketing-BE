// models/TicketImage.js
module.exports = (sequelize, DataTypes) => {
  const TicketImage = sequelize.define('TicketImage', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    ticket_id: { type: DataTypes.INTEGER, allowNull: false },
    filename: { type: DataTypes.STRING(255), allowNull: true },
    mimetype: { type: DataTypes.STRING(100), allowNull: true },
    data: { type: DataTypes.BLOB('long'), allowNull: true }, // LONGBLOB
    created_on: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW }
  }, {
    tableName: 'ticket_images',
    timestamps: false
  });

  TicketImage.associate = (models) => {
    TicketImage.belongsTo(models.Ticket, { foreignKey: 'ticket_id' });
  };

  return TicketImage;
};
