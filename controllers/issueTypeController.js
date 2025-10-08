const { IssueType, Priority, SLA } = require('../models');

exports.listIssueTypes = async (req, res) => {
  try {
    // REMOVE: subcategoryId filtering
    const where = { is_active: true };

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
      include: [
        { model: Priority, as: 'default_priority' }, 
        { model: SLA, as: 'sla' }
        // REMOVE: SubCategory inclusion
      ]
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
    const { name, sla_id, priority_id, description } = req.body;
    // REMOVE: subcategory_id validation
    if (!name) return res.status(400).json({ message: 'name is required' });

    // REMOVE: SubCategory lookup

    if (sla_id) {
      const sla = await SLA.findByPk(sla_id);
      if (!sla) return res.status(400).json({ message: 'SLA not found' });
    }
    if (priority_id) {
      const pr = await Priority.findByPk(priority_id);
      if (!pr) return res.status(400).json({ message: 'Priority not found' });
    }

    const it = await IssueType.create({
      // REMOVE: subcategory_id
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
    const { name, sla_id, priority_id, description, is_active } = req.body;
    // REMOVE: subcategory_id from destructuring
    const it = await IssueType.findByPk(id);
    if (!it) return res.status(404).json({ message: 'IssueType not found' });

    // REMOVE: subcategory_id update logic

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

// deleteIssueType remains the same

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
