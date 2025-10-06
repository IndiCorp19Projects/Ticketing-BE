// models/priority.js
module.exports = (sequelize, DataTypes) => {
  const Priority = sequelize.define('Priority', {
    priority_id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    name: { type: DataTypes.STRING(50), allowNull: false, unique: true }, // e.g. Low, Medium, High
    sort_order: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 100 }
  }, {
    tableName: 'priority',
    timestamps: false
  });

  Priority.associate = (models) => {
    Priority.hasMany(models.IssueType, { foreignKey: 'priority_id', as: 'issue_types' });
    Priority.hasMany(models.Ticket, { foreignKey: 'priority_id', as: 'tickets' });
  };

  return Priority;
};
