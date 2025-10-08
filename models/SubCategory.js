module.exports = (sequelize, DataTypes) => {
  const SubCategory = sequelize.define('SubCategory', {
    subcategory_id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    category_id: { type: DataTypes.INTEGER, allowNull: false },
    name: { type: DataTypes.STRING(150), allowNull: false },
    description: { type: DataTypes.TEXT, allowNull: true },
    is_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    created_on: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW }
  }, {
    tableName: 'subcategory',
    timestamps: false,
    indexes: [{ unique: false, fields: ['category_id'] }]
  });

  SubCategory.associate = (models) => {
    SubCategory.belongsTo(models.Category, { foreignKey: 'category_id', as: 'category' });
    // REMOVE: association with IssueType
    // SubCategory.hasMany(models.IssueType, { foreignKey: 'subcategory_id', as: 'issue_types' });
    SubCategory.hasMany(models.Ticket, { foreignKey: 'subcategory_id', as: 'tickets' });
  };

  return SubCategory;
};