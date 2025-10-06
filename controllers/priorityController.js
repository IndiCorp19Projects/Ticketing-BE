// controllers/priorityController.js
const { Priority } = require('../models');

exports.listPriorities = async (req, res) => {
  try {
    const priorities = await Priority.findAll({ order: [['sort_order', 'ASC'], ['name', 'ASC']] });
    return res.json({ priorities });
  } catch (err) {
    console.error('listPriorities', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

exports.getPriority = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const p = await Priority.findByPk(id);
    if (!p) return res.status(404).json({ message: 'Priority not found' });
    return res.json({ priority: p });
  } catch (err) {
    console.error('getPriority', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

exports.createPriority = async (req, res) => {
  try {
    const { name, sort_order } = req.body;
    if (!name) return res.status(400).json({ message: 'name is required' });

    const existing = await Priority.findOne({ where: { name } });
    if (existing) return res.status(409).json({ message: 'Priority already exists' });

    const p = await Priority.create({ name: String(name).trim(), sort_order: sort_order ?? 100 });
    return res.status(201).json({ message: 'Priority created', priority: p });
  } catch (err) {
    console.error('createPriority', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

exports.updatePriority = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { name, sort_order } = req.body;
    const p = await Priority.findByPk(id);
    if (!p) return res.status(404).json({ message: 'Priority not found' });

    if (name) p.name = String(name).trim();
    if (sort_order !== undefined) p.sort_order = parseInt(sort_order, 10) || p.sort_order;
    await p.save();
    return res.json({ message: 'Priority updated', priority: p });
  } catch (err) {
    console.error('updatePriority', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

exports.deletePriority = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const p = await Priority.findByPk(id);
    if (!p) return res.status(404).json({ message: 'Priority not found' });

    // Hard delete is OK for a simple lookup; or enforce referential integrity in DB.
    await p.destroy();
    return res.json({ message: 'Priority deleted' });
  } catch (err) {
    console.error('deletePriority', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};
