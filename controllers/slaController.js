// const { SLA, sequelize } = require('../models');
const { SLA, User, IssueType, sequelize } = require('../models');
// exports.listSLAs = async (req, res) => {
//   try {
//     const includeInactive = req.query.includeInactive === 'true';
//     const where = includeInactive ? {} : { is_active: true };

//     const slas = await SLA.findAll({
//       where,
//       order: [['issue_type', 'ASC']]
//     });

//     return res.json({ slas });
//   } catch (err) {
//     console.error('listSLAs', err);
//     return res.status(500).json({ message: 'Internal server error' });
//   }
// };

// exports.getSLA = async (req, res) => {
//   try {
//     const id = parseInt(req.params.id, 10);
//     const sla = await SLA.findByPk(id);
//     if (!sla) return res.status(404).json({ message: 'SLA not found' });
//     return res.json({ sla });
//   } catch (err) {
//     console.error('getSLA', err);
//     return res.status(500).json({ message: 'Internal server error' });
//   }
// };

// exports.createSLA = async (req, res) => {
//   const t = await sequelize.transaction();
//   try {
//     const {
//       issue_type,
//       response_target_minutes,
//       resolve_target_minutes,
//       is_active,
//       created_by
//     } = req.body;

//     if (!issue_type || String(issue_type).trim() === '') {
//       await t.rollback();
//       return res.status(400).json({ message: 'issue_type is required' });
//     }

//     // check uniqueness (case-insensitive)
//     const existing = await SLA.findOne({
//       where: sequelize.where(
//         sequelize.fn('lower', sequelize.col('issue_type')),
//         sequelize.fn('lower', String(issue_type).trim())
//       )
//     });

//     if (existing) {
//       await t.rollback();
//       return res.status(409).json({ message: 'SLA for this issue_type already exists' });
//     }

//     const sla = await SLA.create({
//       issue_type: String(issue_type).trim(),
//       response_target_minutes: Number(response_target_minutes) || 60,
//       resolve_target_minutes: Number(resolve_target_minutes) || 1440,
//       is_active: is_active === undefined ? true : !!is_active,
//       created_by: created_by ?? (req.user && req.user.username) ?? null
//     }, { transaction: t });

//     await t.commit();
//     return res.status(201).json({ message: 'SLA created', sla });
//   } catch (err) {
//     console.error('createSLA', err);
//     try { await t.rollback(); } catch (_) {}
//     return res.status(500).json({ message: 'Internal server error' });
//   }
// };

// exports.updateSLA = async (req, res) => {
//   const t = await sequelize.transaction();
//   try {
//     const id = parseInt(req.params.id, 10);
//     const {
//       issue_type,
//       response_target_minutes,
//       resolve_target_minutes,
//       is_active,
//       updated_by
//     } = req.body;

//     const sla = await SLA.findByPk(id, { transaction: t });
//     if (!sla) {
//       await t.rollback();
//       return res.status(404).json({ message: 'SLA not found' });
//     }

//     if (issue_type && String(issue_type).trim() !== sla.issue_type) {
//       // uniqueness check for new issue_type (case-insensitive)
//       const existing = await SLA.findOne({
//         where: sequelize.where(
//           sequelize.fn('lower', sequelize.col('issue_type')),
//           sequelize.fn('lower', String(issue_type).trim())
//         )
//       });
//       if (existing && existing.sla_id !== sla.sla_id) {
//         await t.rollback();
//         return res.status(409).json({ message: 'Another SLA with this issue_type already exists' });
//       }
//       sla.issue_type = String(issue_type).trim();
//     }

//     if (response_target_minutes !== undefined) sla.response_target_minutes = Number(response_target_minutes) || sla.response_target_minutes;
//     if (resolve_target_minutes !== undefined) sla.resolve_target_minutes = Number(resolve_target_minutes) || sla.resolve_target_minutes;
//     if (is_active !== undefined) sla.is_active = !!is_active;
//     sla.updated_by = updated_by ?? (req.user && req.user.username) ?? sla.updated_by;
//     sla.updated_on = new Date();

//     await sla.save({ transaction: t });
//     await t.commit();

//     return res.json({ message: 'SLA updated', sla });
//   } catch (err) {
//     console.error('updateSLA', err);
//     try { await t.rollback(); } catch (_) {}
//     return res.status(500).json({ message: 'Internal server error' });
//   }
// };

// exports.deleteSLA = async (req, res) => {
//   const t = await sequelize.transaction();
//   try {
//     const id = parseInt(req.params.id, 10);
//     const sla = await SLA.findByPk(id, { transaction: t });
//     if (!sla) {
//       await t.rollback();
//       return res.status(404).json({ message: 'SLA not found' });
//     }

//     // Soft-delete: mark inactive
//     sla.is_active = false;
//     sla.updated_on = new Date();
//     sla.updated_by = req.user && req.user.username ? req.user.username : sla.updated_by;
//     await sla.save({ transaction: t });

//     await t.commit();
//     return res.json({ message: 'SLA deactivated' });
//   } catch (err) {
//     console.error('deleteSLA', err);
//     try { await t.rollback(); } catch (_) {}
//     return res.status(500).json({ message: 'Internal server error' });
//   }
// };




// controllers/slaController.js


exports.listSLAs = async (req, res) => {
  try {
    const includeInactive = req.query.includeInactive === 'true';
    const includeIssueTypes = req.query.includeIssueTypes === 'true';
    
    const where = includeInactive ? {} : { is_active: true };

    const include = [
      {
        model: User,
        as: 'user',
        attributes: ['user_id', 'username', 'first_name', 'last_name', 'email']
      }
    ];

    if (includeIssueTypes) {
      include.push({
        model: IssueType,
        as: 'issue_types',
        attributes: ['issue_type_id', 'name', 'is_active']
      });
    }

    const slas = await SLA.findAll({
      where,
      include,
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
    const includeIssueTypes = req.query.includeIssueTypes === 'true';
    
    const include = [
      {
        model: User,
        as: 'user',
        attributes: ['user_id', 'username', 'first_name', 'last_name', 'email']
      }
    ];

    if (includeIssueTypes) {
      include.push({
        model: IssueType,
        as: 'issue_types',
        attributes: ['issue_type_id', 'name', 'is_active']
      });
    }

    const sla = await SLA.findByPk(id, { include });
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
      issue_type,
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

    if (!issue_type || String(issue_type).trim() === '') {
      await t.rollback();
      return res.status(400).json({ message: 'issue_type is required' });
    }

    // Check if user exists
    const user = await User.findByPk(user_id);
    if (!user) {
      await t.rollback();
      return res.status(404).json({ message: 'User not found' });
    }

    // Check uniqueness (user_id + issue_type combination)
    const existing = await SLA.findOne({
      where: {
        user_id,
        issue_type: sequelize.where(
          sequelize.fn('lower', sequelize.col('issue_type')),
          sequelize.fn('lower', String(issue_type).trim())
        )
      }
    });

    if (existing) {
      await t.rollback();
      return res.status(409).json({ 
        message: 'SLA for this user and issue type already exists' 
      });
    }

    const sla = await SLA.create({
      user_id: Number(user_id),
      issue_type: String(issue_type).trim(),
      response_target_minutes: Number(response_target_minutes) || 60,
      resolve_target_minutes: Number(resolve_target_minutes) || 1440,
      is_active: is_active === undefined ? true : !!is_active,
      created_by: created_by ?? (req.user && req.user.username) ?? null
    }, { transaction: t });

    await t.commit();
    return res.status(201).json({ message: 'SLA created', sla });
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
      issue_type,
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

    if (issue_type && String(issue_type).trim() !== sla.issue_type) {
      // Check uniqueness for new user_id + issue_type combination
      const existing = await SLA.findOne({
        where: {
          user_id: sla.user_id,
          issue_type: sequelize.where(
            sequelize.fn('lower', sequelize.col('issue_type')),
            sequelize.fn('lower', String(issue_type).trim())
          )
        }
      });
      
      if (existing && existing.sla_id !== sla.sla_id) {
        await t.rollback();
        return res.status(409).json({ 
          message: 'Another SLA with this user and issue type already exists' 
        });
      }
      sla.issue_type = String(issue_type).trim();
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

    return res.json({ message: 'SLA updated', sla });
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
    const sla = await SLA.findByPk(id, {
      include: [{
        model: IssueType,
        as: 'issue_types',
        where: { is_active: true },
        required: false
      }],
      transaction: t
    });
    
    if (!sla) {
      await t.rollback();
      return res.status(404).json({ message: 'SLA not found' });
    }

    // Check if SLA is being used by any active IssueTypes
    if (sla.issue_types && sla.issue_types.length > 0) {
      await t.rollback();
      return res.status(400).json({ 
        message: 'Cannot deactivate SLA. It is currently being used by active IssueTypes.',
        issue_types: sla.issue_types.map(it => it.name)
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
          as: 'issue_types',
          attributes: ['issue_type_id', 'name'],
          where: { is_active: true },
          required: false
        }
      ],
      order: [['issue_type', 'ASC']]
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