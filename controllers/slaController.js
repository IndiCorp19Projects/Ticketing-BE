const { SLA, sequelize } = require('../models');

exports.listSLAs = async (req, res) => {
  try {
    const includeInactive = req.query.includeInactive === 'true';
    const where = includeInactive ? {} : { is_active: true };

    const slas = await SLA.findAll({
      where,
      order: [['issue_type', 'ASC']]
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
    const sla = await SLA.findByPk(id);
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
      issue_type,
      response_target_minutes,
      resolve_target_minutes,
      is_active,
      created_by
    } = req.body;

    if (!issue_type || String(issue_type).trim() === '') {
      await t.rollback();
      return res.status(400).json({ message: 'issue_type is required' });
    }

    // check uniqueness (case-insensitive)
    const existing = await SLA.findOne({
      where: sequelize.where(
        sequelize.fn('lower', sequelize.col('issue_type')),
        sequelize.fn('lower', String(issue_type).trim())
      )
    });

    if (existing) {
      await t.rollback();
      return res.status(409).json({ message: 'SLA for this issue_type already exists' });
    }

    const sla = await SLA.create({
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

    if (issue_type && String(issue_type).trim() !== sla.issue_type) {
      // uniqueness check for new issue_type (case-insensitive)
      const existing = await SLA.findOne({
        where: sequelize.where(
          sequelize.fn('lower', sequelize.col('issue_type')),
          sequelize.fn('lower', String(issue_type).trim())
        )
      });
      if (existing && existing.sla_id !== sla.sla_id) {
        await t.rollback();
        return res.status(409).json({ message: 'Another SLA with this issue_type already exists' });
      }
      sla.issue_type = String(issue_type).trim();
    }

    if (response_target_minutes !== undefined) sla.response_target_minutes = Number(response_target_minutes) || sla.response_target_minutes;
    if (resolve_target_minutes !== undefined) sla.resolve_target_minutes = Number(resolve_target_minutes) || sla.resolve_target_minutes;
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
    const sla = await SLA.findByPk(id, { transaction: t });
    if (!sla) {
      await t.rollback();
      return res.status(404).json({ message: 'SLA not found' });
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
