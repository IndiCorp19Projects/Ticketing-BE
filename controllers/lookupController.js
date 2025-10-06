// controllers/lookupController.js
const { Category, SubCategory, IssueType, Priority, SLA, sequelize } = require('../models');

/**
 * Category endpoints
 */
exports.createCategory = async (req, res) => {
  try {
    const { name, description, is_active = true } = req.body;
    if (!name) return res.status(400).json({ message: 'name is required' });
    const cat = await Category.create({ name, description, is_active });
    return res.status(201).json({ category: cat.toJSON ? cat.toJSON() : cat });
  } catch (err) {
    console.error('createCategory', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

exports.listCategories = async (req, res) => {
  try {
    const categories = await Category.findAll({
      include: [{ model: SubCategory, as: 'subcategories' }],
      order: [['name', 'ASC']]
    });
    return res.json({ categories });
  } catch (err) {
    console.error('listCategories', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

/**
 * SubCategory endpoints
 */
exports.createSubCategory = async (req, res) => {
  try {
    const { category_id, name, description, is_active = true } = req.body;
    if (!category_id || !name) return res.status(400).json({ message: 'category_id and name are required' });
    const sc = await SubCategory.create({ category_id, name, description, is_active });
    return res.status(201).json({ subcategory: sc });
  } catch (err) {
    console.error('createSubCategory', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

exports.listSubCategoriesForCategory = async (req, res) => {
  try {
    const categoryId = parseInt(req.params.categoryId, 10);
    const subcategories = await SubCategory.findAll({ where: { category_id: categoryId, is_active: true } });
    return res.json({ subcategories });
  } catch (err) {
    console.error('listSubCategoriesForCategory', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

/**
 * Priority endpoints
 */
exports.createPriority = async (req, res) => {
  try {
    const { name, sort_order = 100 } = req.body;
    if (!name) return res.status(400).json({ message: 'name is required' });
    const p = await Priority.create({ name, sort_order });
    return res.status(201).json({ priority: p });
  } catch (err) {
    console.error('createPriority', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

exports.listPriorities = async (req, res) => {
  try {
    const priorities = await Priority.findAll({ order: [['sort_order', 'ASC'], ['name', 'ASC']] });
    return res.json({ priorities });
  } catch (err) {
    console.error('listPriorities', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

/**
 * IssueType endpoints
 */
exports.createIssueType = async (req, res) => {
  try {
    const { subcategory_id, name, description = '', sla_id = null, priority_id = null, is_active = true } = req.body;
    if (!subcategory_id || !name) return res.status(400).json({ message: 'subcategory_id and name are required' });

    // optionally validate SLA/priority existence (best-effort)
    if (sla_id) {
      const s = await SLA.findByPk(sla_id);
      if (!s) return res.status(400).json({ message: 'sla_id not found' });
    }
    if (priority_id) {
      const p = await Priority.findByPk(priority_id);
      if (!p) return res.status(400).json({ message: 'priority_id not found' });
    }

    const it = await IssueType.create({ subcategory_id, name, description, sla_id, priority_id, is_active });
    return res.status(201).json({ issue_type: it });
  } catch (err) {
    console.error('createIssueType', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

exports.listIssueTypesForSubCategory = async (req, res) => {
  try {
    const subcategoryId = parseInt(req.params.subcategoryId, 10);
    const issueTypes = await IssueType.findAll({
      where: { subcategory_id: subcategoryId, is_active: true },
      include: [{ model: Priority, as: 'default_priority' }, { model: SLA, as: 'sla' }]
    });
    return res.json({ issueTypes });
  } catch (err) {
    console.error('listIssueTypesForSubCategory', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

