// controllers/exceptionController.js
const { Exception, User } = require('../models');
const { sequelize } = require('../models');

/**
 * Get all exceptions
 */
exports.getAllExceptions = async (req, res) => {
  try {
    const exceptions = await Exception.findAll({
      // Remove include temporarily until associations are fixed
      // include: [
      //   {
      //     model: User,
      //     as: 'creator',
      //     attributes: ['user_id', 'first_name', 'last_name']
      //   },
      //   {
      //     model: User,
      //     as: 'updater',
      //     attributes: ['user_id', 'first_name', 'last_name']
      //   }
      // ],
      order: [['date', 'DESC']]
    });

    return res.json({
      success: true,
      exceptions: exceptions
    });
  } catch (error) {
    console.error('Get exceptions error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

/**
 * Get exception by ID
 */
exports.getExceptionById = async (req, res) => {
  try {
    const { id } = req.params;

    const exception = await Exception.findByPk(id, {
      // Remove include temporarily
      // include: [
      //   {
      //     model: User,
      //     as: 'creator',
      //     attributes: ['user_id', 'first_name', 'last_name']
      //   },
      //   {
      //     model: User,
      //     as: 'updater',
      //     attributes: ['user_id', 'first_name', 'last_name']
      //   }
      // ]
    });

    if (!exception) {
      return res.status(404).json({
        success: false,
        message: 'Exception not found'
      });
    }

    return res.json({
      success: true,
      exception: exception
    });
  } catch (error) {
    console.error('Get exception by ID error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

/**
 * Create new exception
 */
exports.createException = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const {
      date,
      open_time,
      close_time,
      type
    } = req.body;

    // Check if exception already exists for this date
    const existingException = await Exception.findOne({
      where: { date },
      transaction
    });

    if (existingException) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: 'Exception already exists for this date'
      });
    }

    // Validate time fields based on type
    if (type === 'half day') {
      if (!open_time || !close_time) {
        await transaction.rollback();
        return res.status(400).json({
          success: false,
          message: 'Open time and close time are required for half day'
        });
      }
      
      // Validate that close time is after open time
      const openTime = new Date(`1970-01-01T${open_time}`);
      const closeTime = new Date(`1970-01-01T${close_time}`);
      if (closeTime <= openTime) {
        await transaction.rollback();
        return res.status(400).json({
          success: false,
          message: 'Close time must be after open time'
        });
      }
    }

    // Calculate working hours
    let working_hour = 0;
    if (type === 'half day' && open_time && close_time) {
      const openTime = new Date(`1970-01-01T${open_time}`);
      const closeTime = new Date(`1970-01-01T${close_time}`);
      const diffMs = closeTime - openTime;
      working_hour = diffMs / (1000 * 60 * 60);
    }

    const exception = await Exception.create({
      date,
      open_time: type === 'half day' ? open_time : null,
      close_time: type === 'half day' ? close_time : null,
      type,
      working_hour,
      created_by: req.user?.user_id || 1, // Fallback to user_id 1 if not available
      updated_by: req.user?.user_id || 1  // Fallback to user_id 1 if not available
    }, { transaction });

    await transaction.commit();

    return res.json({
      success: true,
      message: 'Exception created successfully',
      exception: exception
    });

  } catch (error) {
    console.error('Create exception error:', error);
    try { await transaction.rollback(); } catch (e) { /* ignore */ }
    
    // Handle specific Sequelize validation errors
    if (error.name === 'SequelizeValidationError') {
      const errors = error.errors.map(err => err.message);
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: errors
      });
    }
    
    // Handle unique constraint errors
    if (error.name === 'SequelizeUniqueConstraintError') {
      return res.status(400).json({
        success: false,
        message: 'Exception already exists for this date'
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

/**
 * Update exception
 */
exports.updateException = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const { id } = req.params;
    const {
      date,
      open_time,
      close_time,
      type
    } = req.body;

    const exception = await Exception.findByPk(id, { transaction });
    if (!exception) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: 'Exception not found'
      });
    }

    // Check if exception already exists for this date (excluding current exception)
    if (date !== exception.date) {
      const existingException = await Exception.findOne({
        where: { date },
        transaction
      });

      if (existingException) {
        await transaction.rollback();
        return res.status(400).json({
          success: false,
          message: 'Exception already exists for this date'
        });
      }
    }

    // Validate time fields based on type
    if (type === 'half day') {
      if (!open_time || !close_time) {
        await transaction.rollback();
        return res.status(400).json({
          success: false,
          message: 'Open time and close time are required for half day'
        });
      }
      
      // Validate that close time is after open time
      const openTime = new Date(`1970-01-01T${open_time}`);
      const closeTime = new Date(`1970-01-01T${close_time}`);
      if (closeTime <= openTime) {
        await transaction.rollback();
        return res.status(400).json({
          success: false,
          message: 'Close time must be after open time'
        });
      }
    }

    // Calculate working hours
    let working_hour = 0;
    if (type === 'half day' && open_time && close_time) {
      const openTime = new Date(`1970-01-01T${open_time}`);
      const closeTime = new Date(`1970-01-01T${close_time}`);
      const diffMs = closeTime - openTime;
      working_hour = diffMs / (1000 * 60 * 60);
    }

    await exception.update({
      date,
      open_time: type === 'half day' ? open_time : null,
      close_time: type === 'half day' ? close_time : null,
      type,
      working_hour,
      updated_by: req.user?.user_id || 1  // Fallback to user_id 1 if not available
    }, { transaction });

    await transaction.commit();

    return res.json({
      success: true,
      message: 'Exception updated successfully',
      exception: exception
    });

  } catch (error) {
    console.error('Update exception error:', error);
    try { await transaction.rollback(); } catch (e) { /* ignore */ }
    
    // Handle specific Sequelize validation errors
    if (error.name === 'SequelizeValidationError') {
      const errors = error.errors.map(err => err.message);
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: errors
      });
    }
    
    // Handle unique constraint errors
    if (error.name === 'SequelizeUniqueConstraintError') {
      return res.status(400).json({
        success: false,
        message: 'Exception already exists for this date'
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

/**
 * Delete exception
 */
exports.deleteException = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const { id } = req.params;

    const exception = await Exception.findByPk(id, { transaction });
    if (!exception) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: 'Exception not found'
      });
    }

    await exception.destroy({ transaction });
    await transaction.commit();

    return res.json({
      success: true,
      message: 'Exception deleted successfully'
    });

  } catch (error) {
    console.error('Delete exception error:', error);
    try { await transaction.rollback(); } catch (e) { /* ignore */ }
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

/**
 * Check if date has exception
 */
exports.checkDateException = async (req, res) => {
  try {
    const { date } = req.params;

    const exception = await Exception.findOne({
      where: { date }
    });

    if (!exception) {
      return res.json({
        success: true,
        hasException: false,
        message: 'No exception found for this date'
      });
    }

    return res.json({
      success: true,
      hasException: true,
      exception: exception
    });

  } catch (error) {
    console.error('Check date exception error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

/**
 * Get exceptions by date range
 */
exports.getExceptionsByDateRange = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: 'Start date and end date are required'
      });
    }

    const exceptions = await Exception.findAll({
      where: {
        date: {
          [sequelize.Op.between]: [startDate, endDate]
        }
      },
      order: [['date', 'ASC']]
    });

    return res.json({
      success: true,
      exceptions: exceptions,
      count: exceptions.length
    });

  } catch (error) {
    console.error('Get exceptions by date range error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};