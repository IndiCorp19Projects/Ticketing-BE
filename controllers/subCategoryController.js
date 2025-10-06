// controllers/subCategoryController.js
const { SubCategory, Category, IssueType } = require('../models');

exports.listSubCategories = async (req, res) => {
  try {
    const categoryId = req.query.categoryId ? parseInt(req.query.categoryId, 10) : null;
    const where = { is_active: true };
    if (categoryId) where.category_id = categoryId;

    const subs = await SubCategory.findAll({
      where,
      include: [{ model: IssueType, as: 'issue_types', where: { is_active: true }, required: false }]
    });
    return res.json({ subcategories: subs });
  } catch (err) {
    console.error('listSubCategories', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

exports.getSubCategory = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const sub = await SubCategory.findByPk(id, {
      include: [{ model: IssueType, as: 'issue_types', where: { is_active: true }, required: false }, { model: Category, as: 'category' }]
    });
    if (!sub) return res.status(404).json({ message: 'SubCategory not found' });
    return res.json({ subcategory: sub });
  } catch (err) {
    console.error('getSubCategory', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

exports.createSubCategory = async (req, res) => {
  try {
    const { category_id, name, description } = req.body;
    if (!category_id || !name) return res.status(400).json({ message: 'category_id and name are required' });

    const cat = await Category.findByPk(category_id);
    if (!cat) return res.status(400).json({ message: 'Parent category not found' });

    const sub = await SubCategory.create({ category_id, name: String(name).trim(), description: description ?? null });
    return res.status(201).json({ message: 'SubCategory created', subcategory: sub });
  } catch (err) {
    console.error('createSubCategory', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

exports.updateSubCategory = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { name, description, is_active, category_id } = req.body;
    const sub = await SubCategory.findByPk(id);
    if (!sub) return res.status(404).json({ message: 'SubCategory not found' });

    if (category_id) {
      const cat = await Category.findByPk(category_id);
      if (!cat) return res.status(400).json({ message: 'Parent category not found' });
      sub.category_id = category_id;
    }
    if (name) sub.name = String(name).trim();
    if (description !== undefined) sub.description = description;
    if (is_active !== undefined) sub.is_active = !!is_active;

    await sub.save();
    return res.json({ message: 'SubCategory updated', subcategory: sub });
  } catch (err) {
    console.error('updateSubCategory', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

exports.deleteSubCategory = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const sub = await SubCategory.findByPk(id);
    if (!sub) return res.status(404).json({ message: 'SubCategory not found' });

    // soft delete
    await sub.update({ is_active: false });
    return res.json({ message: 'SubCategory deactivated' });
  } catch (err) {
    console.error('deleteSubCategory', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};
