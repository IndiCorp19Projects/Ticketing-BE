// controllers/slaController.js
const { SLA, User, IssueType, sequelize } = require('../models');

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
      issue_type_id, // Now we take issue_type_id instead of issue_type string
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
    const existing = await SLA.findOne({
      where: { user_id, issue_type_id }
    });

    if (existing) {
      await t.rollback();
      return res.status(409).json({ 
        message: 'SLA for this user and issue type already exists' 
      });
    }

    const sla = await SLA.create({
      user_id: Number(user_id),
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
      const existing = await SLA.findOne({
        where: { 
          user_id: sla.user_id, 
          issue_type_id: Number(issue_type_id) 
        },
        transaction: t
      });
      
      if (existing && existing.sla_id !== sla.sla_id) {
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
      order: [['issue_type_id', 'ASC']]
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




// controllers/slaController.js - Add this method
// exports.getSLAForUserAndIssueType = async (req, res) => {
//   try {
//     const userId = parseInt(req.params.userId, 10);
//     const issueTypeId = parseInt(req.params.issueTypeId, 10);

//     if (!userId || !issueTypeId) {
//       return res.status(400).json({ message: 'User ID and Issue Type ID are required' });
//     }

//     // Verify user exists
//     const user = await User.findByPk(userId);
//     if (!user) {
//       return res.status(404).json({ message: 'User not found' });
//     }

//     // Verify issue type exists and is active
//     const issueType = await IssueType.findOne({
//       where: { issue_type_id: issueTypeId, is_active: true }
//     });
//     if (!issueType) {
//       return res.status(404).json({ message: 'Issue type not found or inactive' });
//     }

//     // Get all active SLAs for this user and issue type
//     const slas = await SLA.findAll({
//       where: {
//         user_id: userId,
//         issue_type_id: issueTypeId,
//         is_active: true
//       },
//       include: [
//         {
//           model: User,
//           as: 'user',
//           attributes: ['user_id', 'username', 'first_name', 'last_name']
//         },
//         {
//           model: IssueType,
//           as: 'issue_type',
//           attributes: ['issue_type_id', 'name', 'description']
//         }
//       ],
//       order: [
//         ['response_target_minutes', 'ASC'], // Sort by fastest response time first
//         ['resolve_target_minutes', 'ASC']   // Then by fastest resolve time
//       ]
//     });

//     if (slas.length === 0) {
//       return res.status(404).json({ 
//         message: 'No active SLA found for this user and issue type combination',
//         user_id: userId,
//         issue_type_id: issueTypeId
//       });
//     }

//     return res.json({
//       user: {
//         user_id: user.user_id,
//         username: user.username,
//         first_name: user.first_name,
//         last_name: user.last_name
//       },
//       issue_type: {
//         issue_type_id: issueType.issue_type_id,
//         name: issueType.name,
//         description: issueType.description
//       },
//       slas: slas.map(sla => ({
//         sla_id: sla.sla_id,
//         name: sla.name,
//         response_target_minutes: sla.response_target_minutes,
//         resolve_target_minutes: sla.resolve_target_minutes,
//         created_on: sla.created_on,
//         created_by: sla.created_by
//       })),
//       sla_count: slas.length,
//       // Return the primary SLA (first one based on sorting)
//       primary_sla: slas[0] ? {
//         sla_id: slas[0].sla_id,
//         name: slas[0].name,
//         response_target_minutes: slas[0].response_target_minutes,
//         resolve_target_minutes: slas[0].resolve_target_minutes
//       } : null
//     });
//   } catch (err) {
//     console.error('getSLAForUserAndIssueType', err);
//     return res.status(500).json({ message: 'Internal server error' });
//   }
// };

// Alternative version that returns a single SLA (for backward compatibility)
exports.getPrimarySLAForUserAndIssueType = async (req, res) => {
  try {
    const userId = parseInt(req.params.userId, 10);
    const issueTypeId = parseInt(req.params.issueTypeId, 10);

    if (!userId || !issueTypeId) {
      return res.status(400).json({ message: 'User ID and Issue Type ID are required' });
    }

    // Get the primary SLA (fastest response time)
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


// Get user-specific issue types with their SLAs
exports.getUserIssueTypesWithSLA = async (req, res) => {
  try {
    const userId = parseInt(req.params.userId, 10);
    
    if (!userId) {
      return res.status(400).json({ message: 'User ID is required' });
    }

    // Verify user exists
    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Get all active issue types
    const issueTypes = await IssueType.findAll({
      where: { is_active: true },
      include: [
        { 
          model: Priority, 
          as: 'default_priority', 
          attributes: ['priority_id', 'name', 'level'] 
        }
      ],
      order: [['name', 'ASC']]
    });

    // Get user-specific SLAs
    const userSLAs = await SLA.findAll({
      where: { 
        user_id: userId,
        is_active: true 
      },
      include: [{
        model: IssueType,
        as: 'issue_type',
        attributes: ['issue_type_id', 'name']
      }]
    });

    // Create a map of user SLAs by issue type ID
    const userSLAMap = {};
    userSLAs.forEach(sla => {
      if (sla.issue_type) {
        userSLAMap[sla.issue_type.issue_type_id] = {
          sla_id: sla.sla_id,
          name: sla.name,
          response_target_minutes: sla.response_target_minutes,
          resolve_target_minutes: sla.resolve_target_minutes
        };
      }
    });

    // Combine issue types with user-specific SLAs
    const userIssueTypes = issueTypes.map(issueType => {
      const issueTypeData = issueType.get({ plain: true });
      const userSLA = userSLAMap[issueTypeData.issue_type_id] || null;
      
      return {
        issue_type_id: issueTypeData.issue_type_id,
        name: issueTypeData.name,
        description: issueTypeData.description,
        default_priority: issueTypeData.default_priority,
        priority_id: issueTypeData.priority_id,
        user_sla: userSLA,
        has_user_specific_sla: !!userSLA
      };
    });

    return res.json({ 
      user: {
        user_id: user.user_id,
        username: user.username,
        first_name: user.first_name,
        last_name: user.last_name
      },
      issue_types: userIssueTypes 
    });
  } catch (err) {
    console.error('getUserIssueTypesWithSLA', err);
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


exports.getSLAForUserAndIssueType = async (req, res) => {
  try {
    const userId = parseInt(req.params.userId, 10);
    const issueTypeId = parseInt(req.params.issueTypeId, 10);

    if (!userId || !issueTypeId) {
      return res.status(400).json({ message: 'User ID and Issue Type ID are required' });
    }

    // Verify user exists
    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Verify issue type exists and is active
    const issueType = await IssueType.findOne({
      where: { issue_type_id: issueTypeId, is_active: true }
    });
    if (!issueType) {
      return res.status(404).json({ message: 'Issue type not found or inactive' });
    }

    // Get all active SLAs for this user and issue type
    const slas = await SLA.findAll({
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
        ['response_target_minutes', 'ASC'], // Sort by fastest response time first
        ['resolve_target_minutes', 'ASC']   // Then by fastest resolve time
      ]
    });

    if (slas.length === 0) {
      return res.status(404).json({ 
        message: 'No active SLA found for this user and issue type combination',
        user_id: userId,
        issue_type_id: issueTypeId
      });
    }

    return res.json({
      user: {
        user_id: user.user_id,
        username: user.username,
        first_name: user.first_name,
        last_name: user.last_name
      },
      issue_type: {
        issue_type_id: issueType.issue_type_id,
        name: issueType.name,
        description: issueType.description
      },
      slas: slas.map(sla => ({
        sla_id: sla.sla_id,
        name: sla.name,
        response_target_minutes: sla.response_target_minutes,
        resolve_target_minutes: sla.resolve_target_minutes,
        created_on: sla.created_on,
        created_by: sla.created_by
      })),
      sla_count: slas.length,
      // Return the primary SLA (first one based on sorting)
      primary_sla: slas[0] ? {
        sla_id: slas[0].sla_id,
        name: slas[0].name,
        response_target_minutes: slas[0].response_target_minutes,
        resolve_target_minutes: slas[0].resolve_target_minutes
      } : null
    });
  } catch (err) {
    console.error('getSLAForUserAndIssueType', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};