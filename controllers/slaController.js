// controllers/slaController.js
const { SLA, User, IssueType, Ticket, sequelize } = require('../models');

exports.listSLAs = async (req, res) => {
  try {
    const includeInactive = req.query.includeInactive === 'true';
    const where = includeInactive ? {} : { is_active: true };

    const slas = await SLA.findAll({
      where,
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['user_id', 'username', 'first_name', 'last_name', 'email']
        },
        {
          model: IssueType,
          as: 'issue_type',
          attributes: ['issue_type_id', 'name', 'is_active']
        }
      ],
      order: [['created_on', 'DESC']]
    });

    return res.json({ slas });
  } catch (err) {
    console.error('listSLAs', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

exports.getSLA = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    
    const sla = await SLA.findByPk(id, {
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['user_id', 'username', 'first_name', 'last_name', 'email']
        },
        {
          model: IssueType,
          as: 'issue_type',
          attributes: ['issue_type_id', 'name', 'is_active']
        }
      ]
    });
    
    if (!sla) return res.status(404).json({ message: 'SLA not found' });
    return res.json({ sla });
  } catch (err) {
    console.error('getSLA', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

exports.createSLA = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const {
      user_id,
      name,
      issue_type_id,
      response_target_minutes,
      resolve_target_minutes,
      is_active,
      created_by
    } = req.body;

    // Validation
    if (!user_id) {
      await t.rollback();
      return res.status(400).json({ message: 'user_id is required' });
    }

    if (!name || name.trim() === '') {
      await t.rollback();
      return res.status(400).json({ message: 'SLA name is required' });
    }

    if (!issue_type_id) {
      await t.rollback();
      return res.status(400).json({ message: 'issue_type_id is required' });
    }

    // Check if user exists
    const user = await User.findByPk(user_id);
    if (!user) {
      await t.rollback();
      return res.status(404).json({ message: 'User not found' });
    }

    // Check if issue type exists and is active
    const issueType = await IssueType.findOne({
      where: { issue_type_id, is_active: true }
    });
    if (!issueType) {
      await t.rollback();
      return res.status(400).json({ message: 'Issue type not found or inactive' });
    }

    // Check uniqueness (user_id + issue_type_id combination)
    const existingIssueTypeSLA = await SLA.findOne({
      where: { user_id, issue_type_id }
    });

    if (existingIssueTypeSLA) {
      await t.rollback();
      return res.status(409).json({ 
        message: 'SLA for this user and issue type already exists' 
      });
    }

    // Check uniqueness (user_id + name combination)
    const existingNameSLA = await SLA.findOne({
      where: { user_id, name: name.trim() }
    });

    if (existingNameSLA) {
      await t.rollback();
      return res.status(409).json({ 
        message: 'SLA with this name already exists for this user' 
      });
    }


    // In createSLA method - add this check if you want issue types to be globally unique
const globalIssueTypeCheck = await SLA.findOne({
  where: { 
    issue_type_id: Number(issue_type_id),
    is_active: true
  }
});

if (globalIssueTypeCheck) {
  await t.rollback();
  return res.status(409).json({ 
    message: 'This issue type is already associated with another SLA' 
  });
}



    

    const sla = await SLA.create({
      user_id: Number(user_id),
      name: name.trim(),
      issue_type_id: Number(issue_type_id),
      response_target_minutes: Number(response_target_minutes) || 60,
      resolve_target_minutes: Number(resolve_target_minutes) || 1440,
      is_active: is_active === undefined ? true : !!is_active,
      created_by: created_by ?? (req.user && req.user.username) ?? null
    }, { transaction: t });

    await t.commit();
    
    // Fetch created SLA with associations
    const createdSLA = await SLA.findByPk(sla.sla_id, {
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['user_id', 'username', 'first_name', 'last_name', 'email']
        },
        {
          model: IssueType,
          as: 'issue_type',
          attributes: ['issue_type_id', 'name', 'is_active']
        }
      ]
    });

    return res.status(201).json({ message: 'SLA created', sla: createdSLA });
  } catch (err) {
    console.error('createSLA', err);
    try { await t.rollback(); } catch (_) {}
    return res.status(500).json({ message: 'Internal server error' });
  }
};

exports.updateSLA = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const id = parseInt(req.params.id, 10);
    const {
      user_id,
      name,
      issue_type_id,
      response_target_minutes,
      resolve_target_minutes,
      is_active,
      updated_by
    } = req.body;

    const sla = await SLA.findByPk(id, { transaction: t });
    if (!sla) {
      await t.rollback();
      return res.status(404).json({ message: 'SLA not found' });
    }

    // If user_id is being updated, verify the user exists
    if (user_id && Number(user_id) !== sla.user_id) {
      const user = await User.findByPk(user_id);
      if (!user) {
        await t.rollback();
        return res.status(404).json({ message: 'User not found' });
      }
      sla.user_id = Number(user_id);
    }

    // Check name uniqueness if name is being updated
    if (name && name.trim() !== sla.name) {
      const existingNameSLA = await SLA.findOne({
        where: { 
          user_id: sla.user_id, 
          name: name.trim() 
        },
        transaction: t
      });
      
      if (existingNameSLA && existingNameSLA.sla_id !== sla.sla_id) {
        await t.rollback();
        return res.status(409).json({ 
          message: 'Another SLA with this name already exists for this user' 
        });
      }
      sla.name = name.trim();
    }

    if (issue_type_id && Number(issue_type_id) !== sla.issue_type_id) {
      // Check if issue type exists and is active
      const issueType = await IssueType.findOne({
        where: { issue_type_id: Number(issue_type_id), is_active: true },
        transaction: t
      });
      if (!issueType) {
        await t.rollback();
        return res.status(400).json({ message: 'Issue type not found or inactive' });
      }

      // Check uniqueness for new user_id + issue_type_id combination
      const existingIssueTypeSLA = await SLA.findOne({
        where: { 
          user_id: sla.user_id, 
          issue_type_id: Number(issue_type_id) 
        },
        transaction: t
      });
      
      if (existingIssueTypeSLA && existingIssueTypeSLA.sla_id !== sla.sla_id) {
        await t.rollback();
        return res.status(409).json({ 
          message: 'Another SLA with this user and issue type already exists' 
        });
      }
      sla.issue_type_id = Number(issue_type_id);
    }

    if (response_target_minutes !== undefined) {
      sla.response_target_minutes = Number(response_target_minutes);
    }
    if (resolve_target_minutes !== undefined) {
      sla.resolve_target_minutes = Number(resolve_target_minutes);
    }
    if (is_active !== undefined) sla.is_active = !!is_active;
    sla.updated_by = updated_by ?? (req.user && req.user.username) ?? sla.updated_by;
    sla.updated_on = new Date();

    await sla.save({ transaction: t });
    await t.commit();

    // Fetch updated SLA with associations
    const updatedSLA = await SLA.findByPk(id, {
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['user_id', 'username', 'first_name', 'last_name', 'email']
        },
        {
          model: IssueType,
          as: 'issue_type',
          attributes: ['issue_type_id', 'name', 'is_active']
        }
      ]
    });

    return res.json({ message: 'SLA updated', sla: updatedSLA });
  } catch (err) {
    console.error('updateSLA', err);
    try { await t.rollback(); } catch (_) {}
    return res.status(500).json({ message: 'Internal server error' });
  }
};

exports.deleteSLA = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const id = parseInt(req.params.id, 10);
    const sla = await SLA.findByPk(id, { transaction: t });
    
    if (!sla) {
      await t.rollback();
      return res.status(404).json({ message: 'SLA not found' });
    }

    // Check if SLA is being used by any tickets
    const ticketCount = await Ticket.count({
      where: { sla_id: id },
      transaction: t
    });

    if (ticketCount > 0) {
      await t.rollback();
      return res.status(400).json({ 
        message: `Cannot deactivate SLA. It is currently being used by ${ticketCount} ticket(s).`
      });
    }

    // Soft-delete: mark inactive
    sla.is_active = false;
    sla.updated_on = new Date();
    sla.updated_by = req.user && req.user.username ? req.user.username : sla.updated_by;
    await sla.save({ transaction: t });

    await t.commit();
    return res.json({ message: 'SLA deactivated' });
  } catch (err) {
    console.error('deleteSLA', err);
    try { await t.rollback(); } catch (_) {}
    return res.status(500).json({ message: 'Internal server error' });
  }
};

// Get SLAs by user ID
exports.getSLAsByUser = async (req, res) => {
  try {
    const userId = parseInt(req.params.userId, 10);
    
    const slas = await SLA.findAll({
      where: { user_id: userId, is_active: true },
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['user_id', 'username', 'first_name', 'last_name']
        },
        {
          model: IssueType,
          as: 'issue_type',
          attributes: ['issue_type_id', 'name']
        }
      ],
      order: [['name', 'ASC']]
    });

    return res.json({ slas });
  } catch (err) {
    console.error('getSLAsByUser', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

// Get active users for SLA assignment
exports.getUsersForSLA = async (req, res) => {
  try {
    const users = await User.findAll({
      where: { is_active: true },
      attributes: ['user_id', 'username', 'first_name', 'last_name', 'email'],
      order: [['first_name', 'ASC']]
    });

    return res.json({ users });
  } catch (err) {
    console.error('getUsersForSLA', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

// Get issue types for SLA assignment
exports.getIssueTypesForSLA = async (req, res) => {
  try {
    const issueTypes = await IssueType.findAll({
      where: { is_active: true },
      attributes: ['issue_type_id', 'name', 'description'],
      order: [['name', 'ASC']]
    });

    return res.json({ issue_types: issueTypes });
  } catch (err) {
    console.error('getIssueTypesForSLA', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

// Get available SLAs for an issue type and user
exports.getUserSLAsForIssueType = async (req, res) => {
  try {
    const userId = parseInt(req.params.userId, 10);
    const issueTypeId = parseInt(req.params.issueTypeId, 10);
    
    if (!userId || !issueTypeId) {
      return res.status(400).json({ message: 'User ID and Issue Type ID are required' });
    }

    const slas = await SLA.findAll({
      where: { 
        user_id: userId,
        issue_type_id: issueTypeId,
        is_active: true 
      },
      order: [['name', 'ASC']]
    });

    return res.json({ 
      user_id: userId,
      issue_type_id: issueTypeId,
      slas: slas 
    });
  } catch (err) {
    console.error('getUserSLAsForIssueType', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

// Get primary SLA for user and issue type
exports.getPrimarySLAForUserAndIssueType = async (req, res) => {
  try {
    const userId = parseInt(req.params.userId, 10);
    const issueTypeId = parseInt(req.params.issueTypeId, 10);

    if (!userId || !issueTypeId) {
      return res.status(400).json({ message: 'User ID and Issue Type ID are required' });
    }

    // Get the primary SLA
    const sla = await SLA.findOne({
      where: {
        user_id: userId,
        issue_type_id: issueTypeId,
        is_active: true
      },
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['user_id', 'username', 'first_name', 'last_name']
        },
        {
          model: IssueType,
          as: 'issue_type',
          attributes: ['issue_type_id', 'name', 'description']
        }
      ],
      order: [
        ['response_target_minutes', 'ASC'],
        ['resolve_target_minutes', 'ASC']
      ]
    });

    if (!sla) {
      return res.status(404).json({ 
        message: 'No active SLA found for this user and issue type combination',
        user_id: userId,
        issue_type_id: issueTypeId
      });
    }

    return res.json({
      user: {
        user_id: sla.user.user_id,
        username: sla.user.username,
        first_name: sla.user.first_name,
        last_name: sla.user.last_name
      },
      issue_type: {
        issue_type_id: sla.issue_type.issue_type_id,
        name: sla.issue_type.name,
        description: sla.issue_type.description
      },
      sla: {
        sla_id: sla.sla_id,
        name: sla.name,
        response_target_minutes: sla.response_target_minutes,
        resolve_target_minutes: sla.resolve_target_minutes,
        created_on: sla.created_on,
        created_by: sla.created_by
      }
    });
  } catch (err) {
    console.error('getPrimarySLAForUserAndIssueType', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};