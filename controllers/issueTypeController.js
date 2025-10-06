// controllers/issueTypeController.js
const { IssueType, SubCategory, Priority, SLA } = require('../models');

exports.listIssueTypes = async (req, res) => {
  try {
    const subcategoryId = req.query.subcategoryId ? parseInt(req.query.subcategoryId, 10) : null;
    const where = { is_active: true };
    if (subcategoryId) where.subcategory_id = subcategoryId;

    const types = await IssueType.findAll({
      where,
      include: [
        { model: Priority, as: 'default_priority', attributes: ['priority_id', 'name'] },
        { model: SLA, as: 'sla', attributes: ['sla_id', 'issue_type', 'response_target_minutes', 'resolve_target_minutes'] }
      ],
      order: [['name', 'ASC']]
    });

    return res.json({ issue_types: types });
  } catch (err) {
    console.error('listIssueTypes', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

exports.getIssueType = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const it = await IssueType.findByPk(id, {
      include: [{ model: Priority, as: 'default_priority' }, { model: SLA, as: 'sla' }, { model: SubCategory, as: 'subcategory' }]
    });
    if (!it) return res.status(404).json({ message: 'IssueType not found' });
    return res.json({ issue_type: it });
  } catch (err) {
    console.error('getIssueType', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

exports.createIssueType = async (req, res) => {
  try {
    const { subcategory_id, name, sla_id, priority_id, description } = req.body;
    if (!subcategory_id || !name) return res.status(400).json({ message: 'subcategory_id and name are required' });

    const sub = await SubCategory.findByPk(subcategory_id);
    if (!sub) return res.status(400).json({ message: 'SubCategory not found' });

    if (sla_id) {
      const sla = await SLA.findByPk(sla_id);
      if (!sla) return res.status(400).json({ message: 'SLA not found' });
    }
    if (priority_id) {
      const pr = await Priority.findByPk(priority_id);
      if (!pr) return res.status(400).json({ message: 'Priority not found' });
    }

    const it = await IssueType.create({
      subcategory_id,
      name: String(name).trim(),
      sla_id: sla_id ?? null,
      priority_id: priority_id ?? null,
      description: description ?? null,
      is_active: true
    });

    return res.status(201).json({ message: 'IssueType created', issue_type: it });
  } catch (err) {
    console.error('createIssueType', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

exports.updateIssueType = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { name, sla_id, priority_id, description, is_active, subcategory_id } = req.body;
    const it = await IssueType.findByPk(id);
    if (!it) return res.status(404).json({ message: 'IssueType not found' });

    if (subcategory_id) {
      const sub = await SubCategory.findByPk(subcategory_id);
      if (!sub) return res.status(400).json({ message: 'SubCategory not found' });
      it.subcategory_id = subcategory_id;
    }
    if (name) it.name = String(name).trim();
    if (sla_id !== undefined) {
      if (sla_id !== null) {
        const sla = await SLA.findByPk(sla_id);
        if (!sla) return res.status(400).json({ message: 'SLA not found' });
      }
      it.sla_id = sla_id;
    }
    if (priority_id !== undefined) {
      if (priority_id !== null) {
        const pr = await Priority.findByPk(priority_id);
        if (!pr) return res.status(400).json({ message: 'Priority not found' });
      }
      it.priority_id = priority_id;
    }
    if (description !== undefined) it.description = description;
    if (is_active !== undefined) it.is_active = !!is_active;

    await it.save();
    return res.json({ message: 'IssueType updated', issue_type: it });
  } catch (err) {
    console.error('updateIssueType', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

exports.deleteIssueType = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const it = await IssueType.findByPk(id);
    if (!it) return res.status(404).json({ message: 'IssueType not found' });

    // soft delete
    await it.update({ is_active: false });
    return res.json({ message: 'IssueType deactivated' });
  } catch (err) {
    console.error('deleteIssueType', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};
