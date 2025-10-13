const { WorkingHours, SLA , sequelize} = require('../models');

exports.createWorkingHours = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const {
      name,
      timezone,
      working_days,
      start_time,
      end_time,
      is_default
    } = req.body;

    // If setting as default, unset any existing default
    if (is_default) {
      await WorkingHours.update(
        { is_default: false },
        { where: { is_default: true }, transaction: t }
      );
    }

    const workingHours = await WorkingHours.create({
      name,
      timezone: timezone || 'UTC',
      working_days: working_days || 62, // Monday-Friday
      start_time: start_time || '09:00:00',
      end_time: end_time || '18:00:00',
      is_default: is_default || false,
      created_by: req.user.username
    }, { transaction: t });

    await t.commit();

    return res.status(201).json({
      message: 'Working hours created successfully',
      working_hours: workingHours
    });
  } catch (err) {
    await t.rollback();
    console.error('createWorkingHours error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

exports.getWorkingHours = async (req, res) => {
  try {
    const workingHours = await WorkingHours.findAll({
      where: { is_active: true },
      order: [['is_default', 'DESC'], ['name', 'ASC']]
    });

    return res.json({ working_hours: workingHours });
  } catch (err) {
    console.error('getWorkingHours error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

exports.updateWorkingHours = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { id } = req.params;
    const updates = req.body;

    const workingHours = await WorkingHours.findByPk(id);
    if (!workingHours) {
      await t.rollback();
      return res.status(404).json({ message: 'Working hours not found' });
    }

    // If setting as default, unset any existing default
    if (updates.is_default) {
      await WorkingHours.update(
        { is_default: false },
        { where: { is_default: true }, transaction: t }
      );
    }

    updates.updated_by = req.user.username;
    updates.updated_on = new Date();

    await workingHours.update(updates, { transaction: t });
    await t.commit();

    return res.json({
      message: 'Working hours updated successfully',
      working_hours: workingHours
    });
  } catch (err) {
    await t.rollback();
    console.error('updateWorkingHours error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

exports.deleteWorkingHours = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { id } = req.params;

    const workingHours = await WorkingHours.findByPk(id);
    if (!workingHours) {
      await t.rollback();
      return res.status(404).json({ message: 'Working hours not found' });
    }

    if (workingHours.is_default) {
      await t.rollback();
      return res.status(400).json({ message: 'Cannot delete default working hours' });
    }

    // Check if any SLA is using these working hours
    const slasUsing = await SLA.count({
      where: { working_hours_id: id },
      transaction: t
    });

    if (slasUsing > 0) {
      await t.rollback();
      return res.status(400).json({ 
        message: 'Cannot delete working hours that are being used by SLAs' 
      });
    }

    await workingHours.destroy({ transaction: t });
    await t.commit();

    return res.json({ message: 'Working hours deleted successfully' });
  } catch (err) {
    await t.rollback();
    console.error('deleteWorkingHours error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

exports.setDefaultWorkingHours = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { id } = req.params;

    const workingHours = await WorkingHours.findByPk(id);
    if (!workingHours) {
      await t.rollback();
      return res.status(404).json({ message: 'Working hours not found' });
    }

    // Unset all defaults
    await WorkingHours.update(
      { is_default: false },
      { where: { is_default: true }, transaction: t }
    );

    // Set new default
    await workingHours.update({ is_default: true }, { transaction: t });
    await t.commit();

    return res.json({
      message: 'Default working hours updated successfully',
      working_hours: workingHours
    });
  } catch (err) {
    await t.rollback();
    console.error('setDefaultWorkingHours error:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};