// routes/escalationLevels.js
const express = require('express');
const router = express.Router();
const { EscalationLevel, Client, User } = require('../models');
const { requireAdmin } = require('../middleware/roleMiddleware');
const authMiddleware = require('../middleware/authMiddleware');
router.use(authMiddleware, requireAdmin);

// GET all escalation levels with client and user details
router.get('/',   async (req, res) => {
  try {
    const escalationLevels = await EscalationLevel.findAll({
      include: [
        {
          model: Client,
          as: 'client',
          attributes: ['client_id', 'company_name']
        },
        {
          model: User,
          as: 'default_assignee',
          attributes: ['user_id', 'first_name', 'last_name', 'email']
        }
      ],
      order: [['level_number', 'ASC']]
    });

    res.json({
      success: true,
      escalationLevels: escalationLevels
    });
  } catch (error) {
    console.error('Error fetching escalation levels:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch escalation levels',
      error: error.message
    });
  }
});

// GET escalation level by ID
router.get('/:id',   async (req, res) => {
  try {
    const { id } = req.params;
    const escalationLevel = await EscalationLevel.findByPk(id, {
      include: [
        {
          model: Client,
          as: 'client',
          attributes: ['client_id', 'company_name']
        },
        {
          model: User,
          as: 'default_assignee',
          attributes: ['user_id', 'first_name', 'last_name', 'email']
        }
      ]
    });

    if (!escalationLevel) {
      return res.status(404).json({
        success: false,
        message: 'Escalation level not found'
      });
    }

    res.json({
      success: true,
      escalationLevel: escalationLevel
    });
  } catch (error) {
    console.error('Error fetching escalation level:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch escalation level',
      error: error.message
    });
  }
});

// CREATE new escalation level
router.post('/',   async (req, res) => {
  try {
    const {
      level_number,
      level_name,
      default_assignee_id,
      default_email,
      description,
      client_id,
      escalation_rule,
      is_active = true
    } = req.body;

    // Validate required fields
    if (!level_number || !level_name || !client_id) {
      return res.status(400).json({
        success: false,
        message: 'Level number, level name, and client are required'
      });
    }

    // Check if client exists
    const client = await Client.findByPk(client_id);
    if (!client) {
      return res.status(404).json({
        success: false,
        message: 'Client not found'
      });
    }

    // Check if default assignee exists if provided
    if (default_assignee_id) {
      const user = await User.findByPk(default_assignee_id);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'Default assignee not found'
        });
      }
    }

    const escalationLevel = await EscalationLevel.create({
      level_number,
      level_name,
      default_assignee_id,
      default_email,
      description,
      client_id,
      escalation_rule,
      is_active
    });

    // Fetch the created escalation level with associations
    const createdEscalationLevel = await EscalationLevel.findByPk(escalationLevel.level_id, {
      include: [
        {
          model: Client,
          as: 'client',
          attributes: ['client_id', 'company_name']
        },
        {
          model: User,
          as: 'default_assignee',
          attributes: ['user_id', 'first_name', 'last_name', 'email']
        }
      ]
    });

    res.status(201).json({
      success: true,
      message: 'Escalation level created successfully',
      escalationLevel: createdEscalationLevel
    });
  } catch (error) {
    console.error('Error creating escalation level:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create escalation level',
      error: error.message
    });
  }
});

// UPDATE escalation level
router.put('/:id',  async (req, res) => {
  try {
    const { id } = req.params;
    const {
      level_number,
      level_name,
      default_assignee_id,
      default_email,
      description,
      client_id,
      escalation_rule,
      is_active
    } = req.body;

    const escalationLevel = await EscalationLevel.findByPk(id);
    if (!escalationLevel) {
      return res.status(404).json({
        success: false,
        message: 'Escalation level not found'
      });
    }

    // Check if client exists if provided
    if (client_id) {
      const client = await Client.findByPk(client_id);
      if (!client) {
        return res.status(404).json({
          success: false,
          message: 'Client not found'
        });
      }
    }

    // Check if default assignee exists if provided
    if (default_assignee_id) {
      const user = await User.findByPk(default_assignee_id);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'Default assignee not found'
        });
      }
    }

    await escalationLevel.update({
      level_number,
      level_name,
      default_assignee_id,
      default_email,
      description,
      client_id,
      escalation_rule,
      is_active
    });

    // Fetch the updated escalation level with associations
    const updatedEscalationLevel = await EscalationLevel.findByPk(id, {
      include: [
        {
          model: Client,
          as: 'client',
          attributes: ['client_id', 'company_name']
        },
        {
          model: User,
          as: 'default_assignee',
          attributes: ['user_id', 'first_name', 'last_name', 'email']
        }
      ]
    });

    res.json({
      success: true,
      message: 'Escalation level updated successfully',
      escalationLevel: updatedEscalationLevel
    });
  } catch (error) {
    console.error('Error updating escalation level:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update escalation level',
      error: error.message
    });
  }
});

// DELETE escalation level
router.delete('/:id',  async (req, res) => {
  try {
    const { id } = req.params;
    const escalationLevel = await EscalationLevel.findByPk(id);

    if (!escalationLevel) {
      return res.status(404).json({
        success: false,
        message: 'Escalation level not found'
      });
    }

    await escalationLevel.destroy();

    res.json({
      success: true,
      message: 'Escalation level deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting escalation level:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete escalation level',
      error: error.message
    });
  }
});

module.exports = router;