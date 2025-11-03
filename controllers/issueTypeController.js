// controllers/issueTypeController.js
const { IssueType, Priority, SLA, User } = require('../models');


exports.listIssueTypes = async (req, res) => {
  try {
    const where = { is_active: true };

    const types = await IssueType.findAll({
      where,
      include: [
        { 
          model: Priority, 
          as: 'default_priority', 
          attributes: ['priority_id', 'name'] 
        }
        // REMOVED: SLA inclusion since we don't have direct relationship anymore
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
        { model: Priority, as: 'default_priority' }
        // REMOVED: SLA inclusion
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
    const { name, priority_id, description } = req.body;
    
    if (!name) return res.status(400).json({ message: 'name is required' });

    // Check if priority exists
    if (priority_id) {
      const pr = await Priority.findByPk(priority_id);
      if (!pr) return res.status(400).json({ message: 'Priority not found' });
    }

    const it = await IssueType.create({
      name: String(name).trim(),
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
    const { name, priority_id, description, is_active } = req.body;
    
    const it = await IssueType.findByPk(id);
    if (!it) return res.status(404).json({ message: 'IssueType not found' });

    if (name) it.name = String(name).trim();
    
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

    // Check if issue type is being used by any SLAs
    const slaCount = await SLA.count({
      where: { issue_type_id: id, is_active: true }
    });

    if (slaCount > 0) {
      return res.status(400).json({ 
        message: `Cannot deactivate issue type. It is currently being used by ${slaCount} active SLA(s).`
      });
    }

    // Check if issue type is being used by any tickets
    // const Ticket = require('../models/Ticket');
    // const ticketCount = await Ticket.count({
    //   where: { issue_type_id: id }
    // });

    // if (ticketCount > 0) {
    //   return res.status(400).json({ 
    //     message: `Cannot deactivate issue type. It is currently being used by ${ticketCount} ticket(s).`
    //   });
    // }

    // Soft-delete
    await it.update({ is_active: false });
    return res.json({ message: 'IssueType deactivated' });
  } catch (err) {
    console.error('deleteIssueType', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

