// routes/client/slaRoutes.js
const express = require('express');
const router = express.Router();
const clientAuth = require('../middleware/clientAuth');
const { ClientSLA, IssueType, WorkingHours } = require('../models');

// Get all SLAs for client
router.get('/', clientAuth, async (req, res) => {
  try {
    const slas = await ClientSLA.findAll({
      where: { 
        client_id: req.client.id  // CHANGED: user_id -> client_id
      },
      include: [
        {
          model: IssueType,
          as: 'issue_type',
          attributes: ['issue_type_id', 'name']
        },
        {
          model: WorkingHours,
          as: 'working_hours',
          attributes: ['working_hours_id', 'name', 'timezone']
        }
      ],
      order: [['created_on', 'DESC']]
    });

    res.json({
      success: true,
      data: slas
    });
  } catch (error) {
    console.error('Get SLAs error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching SLAs'
    });
  }
});

// Update SLA status and remark
router.put('/:id', clientAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { is_active, remark } = req.body;

    // Find SLA belonging to this client
    const sla = await ClientSLA.findOne({
      where: {
        client_sla_id: id,  // CHANGED: sla_id -> client_sla_id
        client_id: req.client.id  // CHANGED: user_id -> client_id
      }
    });

    if (!sla) {
      return res.status(404).json({
        success: false,
        message: 'SLA not found'
      });
    }

    // Prepare update data
    const updateData = {
      updated_on: new Date(),
      updated_by: req.client_user.email || req.client.email
    };

    if (typeof is_active !== 'undefined') {
      updateData.is_active = is_active;
    }

    if (typeof remark !== 'undefined') {
      updateData.remark = remark;
    }

    // Update SLA
    await ClientSLA.update(updateData, {
      where: {
        client_sla_id: id,  // CHANGED: sla_id -> client_sla_id
        client_id: req.client.id  // CHANGED: user_id -> client_id
      }
    });

    // Get updated SLA
    const updatedSLA = await ClientSLA.findByPk(id, {
      include: [
        {
          model: IssueType,
          as: 'issue_type',
          attributes: ['issue_type_id', 'name']
        },
        {
          model: WorkingHours,
          as: 'working_hours',
          attributes: ['working_hours_id', 'name', 'timezone']
        }
      ]
    });

    res.json({
      success: true,
      message: 'SLA updated successfully',
      data: updatedSLA
    });

  } catch (error) {
    console.error('Update SLA error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating SLA'
    });
  }
});

// Get single SLA
router.get('/:id', clientAuth, async (req, res) => {
  try {
    const { id } = req.params;

    const sla = await ClientSLA.findOne({
      where: {
        client_sla_id: id,  // CHANGED: sla_id -> client_sla_id
        client_id: req.client.id  // CHANGED: user_id -> client_id
      },
      include: [
        {
          model: IssueType,
          as: 'issue_type',
          attributes: ['issue_type_id', 'name']
        },
        {
          model: WorkingHours,
          as: 'working_hours',
          attributes: ['working_hours_id', 'name', 'timezone']
        }
      ]
    });

    if (!sla) {
      return res.status(404).json({
        success: false,
        message: 'SLA not found'
      });
    }

    res.json({
      success: true,
      data: sla
    });
  } catch (error) {
    console.error('Get SLA error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching SLA'
    });
  }
});

module.exports = router;