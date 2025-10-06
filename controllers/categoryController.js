// controllers/categoryController.js
const { Category, SubCategory } = require('../models');

exports.listCategories = async (req, res) => {
  try {
    const includeInactive = req.query.includeInactive === 'true';
    const where = includeInactive ? {} : { is_active: true };

    const categories = await Category.findAll({
      where,
      include: [{ model: SubCategory, as: 'subcategories', where: { is_active: true }, required: false }]
    });

    return res.json({ categories });
  } catch (err) {
    console.error('listCategories', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

exports.getCategory = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const category = await Category.findByPk(id, {
      include: [{ model: SubCategory, as: 'subcategories', where: { is_active: true }, required: false }]
    });
    if (!category) return res.status(404).json({ message: 'Category not found' });
    return res.json({ category });
  } catch (err) {
    console.error('getCategory', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

exports.createCategory = async (req, res) => {
  try {
    const { name, description } = req.body;
    if (!name || String(name).trim() === '') return res.status(400).json({ message: 'name is required' });

    const existing = await Category.findOne({ where: { name } });
    if (existing) return res.status(409).json({ message: 'Category already exists' });

    const category = await Category.create({ name: String(name).trim(), description: description ?? null });
    return res.status(201).json({ message: 'Category created', category });
  } catch (err) {
    console.error('createCategory', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

exports.updateCategory = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { name, description, is_active } = req.body;
    const category = await Category.findByPk(id);
    if (!category) return res.status(404).json({ message: 'Category not found' });

    if (name) category.name = String(name).trim();
    if (description !== undefined) category.description = description;
    if (is_active !== undefined) category.is_active = !!is_active;

    await category.save();
    return res.json({ message: 'Category updated', category });
  } catch (err) {
    console.error('updateCategory', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

exports.deleteCategory = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const category = await Category.findByPk(id);
    if (!category) return res.status(404).json({ message: 'Category not found' });

    // Soft delete
    await category.update({ is_active: false });
    return res.json({ message: 'Category deactivated' });
  } catch (err) {
    console.error('deleteCategory', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};
