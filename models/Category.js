// models/category.js
module.exports = (sequelize, DataTypes) => {
  const Category = sequelize.define('Category', {
    category_id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    name: { type: DataTypes.STRING(150), allowNull: false, unique: true },
    description: { type: DataTypes.TEXT, allowNull: true },
    is_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    created_on: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  }, {
    tableName: 'category',
    timestamps: false
  });

  Category.associate = (models) => {
    Category.hasMany(models.SubCategory, { foreignKey: 'category_id', as: 'subcategories' });
    Category.hasMany(models.Ticket, { foreignKey: 'category_id', as: 'tickets' });
  };

  return Category;
};
