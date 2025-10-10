// models/IssueType.js
module.exports = (sequelize, DataTypes) => {
  const IssueType = sequelize.define('IssueType', {
    issue_type_id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    name: { type: DataTypes.STRING(150), allowNull: false, unique: true },
    description: { type: DataTypes.TEXT, allowNull: true },
    priority_id: { type: DataTypes.INTEGER, allowNull: true },
    is_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    created_on: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    updated_on: { type: DataTypes.DATE, allowNull: true }
  }, {
    tableName: 'issue_type',
    timestamps: false
  });

  IssueType.associate = (models) => {
    IssueType.belongsTo(models.Priority, { foreignKey: 'priority_id', as: 'default_priority' });
    IssueType.hasMany(models.Ticket, { foreignKey: 'issue_type_id', as: 'tickets' });
    IssueType.hasMany(models.SLA, { foreignKey: 'issue_type_id', as: 'slas' });
  };

  return IssueType;
};