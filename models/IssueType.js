// models/issueType.js
module.exports = (sequelize, DataTypes) => {
  const IssueType = sequelize.define('IssueType', {
    issue_type_id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    subcategory_id: { type: DataTypes.INTEGER, allowNull: false },
    name: { type: DataTypes.STRING(150), allowNull: false, unique: true }, // e.g. "Login Issue" or "Other"
    description: { type: DataTypes.TEXT, allowNull: true },
    sla_id: { type: DataTypes.INTEGER, allowNull: true },
    priority_id: { type: DataTypes.INTEGER, allowNull: true }, // default priority for this issue type
    is_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    created_on: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    updated_on: { type: DataTypes.DATE, allowNull: true }
  }, {
    tableName: 'issue_type',
    timestamps: false
  });

  IssueType.associate = (models) => {
    IssueType.belongsTo(models.SubCategory, { foreignKey: 'subcategory_id', as: 'subcategory' });
    IssueType.belongsTo(models.SLA, { foreignKey: 'sla_id', as: 'sla' });
    IssueType.belongsTo(models.Priority, { foreignKey: 'priority_id', as: 'default_priority' });
    IssueType.hasMany(models.Ticket, { foreignKey: 'issue_type_id', as: 'tickets' });
  };

  return IssueType;
};
