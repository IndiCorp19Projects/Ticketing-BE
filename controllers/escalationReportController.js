// controllers/escalationReportController.js - FIXED VERSION
const { EscalationHistory, Ticket, Client, User, EscalationMatrix, sequelize } = require('../models');
const { Op } = require('sequelize');

/**
 * Get comprehensive escalation reports with multiple filter options - FIXED
 */
exports.getEscalationReport = async (req, res) => {
  try {
    const {
      startDate,
      endDate,
      clientId,
      escalationLevel,
      conditionType,
      status,
      priority,
      page = 1,
      limit = 50
    } = req.query;

    // Build where conditions for escalation history
    const whereClause = {};
    
    // Date range filter
    if (startDate || endDate) {
      whereClause.created_at = {};
      if (startDate) {
        whereClause.created_at[Op.gte] = new Date(startDate);
      }
      if (endDate) {
        whereClause.created_at[Op.lte] = new Date(endDate);
      }
    }

    // Build include array properly
    const includes = [];

    // Ticket include with proper structure
    const ticketInclude = {
      model: Ticket,
      as: 'ticket',
      attributes: ['ticket_id', 'module', 'category', 'priority', 'status', 'created_at', 'resolved_at'],
      required: true
    };

    // Add where conditions to ticket if needed
    const ticketWhere = {};
    if (status) ticketWhere.status = status;
    if (priority) ticketWhere.priority = priority;
    
    if (Object.keys(ticketWhere).length > 0) {
      ticketInclude.where = ticketWhere;
    }

    // Add client include to ticket
    ticketInclude.include = [];

    if (clientId) {
      ticketInclude.include.push({
        model: Client,
        as: 'client',
        attributes: ['client_id', 'company_name'],
        where: { client_id: clientId },
        required: true
      });
    } else {
      ticketInclude.include.push({
        model: Client,
        as: 'client',
        attributes: ['client_id', 'company_name'],
        required: true
      });
    }

    includes.push(ticketInclude);

    // Escalation matrix include
    const escalationMatrixWhere = {};
    if (escalationLevel) {
      escalationMatrixWhere.level = escalationLevel;
    }
    if (conditionType) {
      escalationMatrixWhere.condition_type = conditionType;
    }

    includes.push({
      model: EscalationMatrix,
      as: 'escalation_matrix',
      attributes: ['level', 'condition_type', 'condition_value', 'escalate_to_role'],
      where: Object.keys(escalationMatrixWhere).length > 0 ? escalationMatrixWhere : undefined,
      required: true
    });

    const offset = (page - 1) * limit;

    // Get escalation history with pagination - FIXED
    const { count, rows: escalations } = await EscalationHistory.findAndCountAll({
      where: whereClause,
      include: includes,
      order: [['created_at', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset),
      distinct: true // Important for count with includes
    });

    // Get summary statistics
    const summary = await this.getEscalationSummary({
      startDate,
      endDate,
      clientId,
      escalationLevel,
      conditionType
    });

    return res.json({
      success: true,
      report: {
        escalations: escalations.map(esc => this.formatEscalationRecord(esc)),
        summary,
        pagination: {
          total: count,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(count / limit)
        }
      }
    });

  } catch (error) {
    console.error('Get escalation report error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error: ' + error.message
    });
  }
};

/**
 * Get escalation summary statistics - FIXED
 */
exports.getEscalationSummary = async (filters = {}) => {
  try {
    const { startDate, endDate, clientId, escalationLevel, conditionType } = filters;

    const whereClause = {};
    
    // Date range
    if (startDate || endDate) {
      whereClause.created_at = {};
      if (startDate) whereClause.created_at[Op.gte] = new Date(startDate);
      if (endDate) whereClause.created_at[Op.lte] = new Date(endDate);
    }

    // Build include for summary query
    const includes = [{
      model: EscalationMatrix,
      as: 'escalation_matrix',
      where: {},
      required: true
    }];

    if (escalationLevel) includes[0].where.level = escalationLevel;
    if (conditionType) includes[0].where.condition_type = conditionType;

    // Add client filter if needed
    if (clientId) {
      includes.push({
        model: Ticket,
        as: 'ticket',
        where: { client_id: clientId },
        required: true,
        include: [{
          model: Client,
          as: 'client',
          attributes: [],
          required: true
        }]
      });
    }

    // Total escalations
    const totalEscalations = await EscalationHistory.count({
      where: whereClause,
      include: includes
    });

    // Escalations by level
    const escalationsByLevel = await EscalationHistory.findAll({
      where: whereClause,
      include: includes,
      attributes: [
        [sequelize.col('escalation_matrix.level'), 'level'],
        [sequelize.fn('COUNT', sequelize.col('EscalationHistory.escalation_history_id')), 'count']
      ],
      group: ['escalation_matrix.level'],
      raw: true
    });

    // Escalations by condition type
    const escalationsByCondition = await EscalationHistory.findAll({
      where: whereClause,
      include: includes,
      attributes: [
        [sequelize.col('escalation_matrix.condition_type'), 'condition_type'],
        [sequelize.fn('COUNT', sequelize.col('EscalationHistory.escalation_history_id')), 'count']
      ],
      group: ['escalation_matrix.condition_type'],
      raw: true
    });

    // Escalations by client
    const escalationsByClient = await EscalationHistory.findAll({
      where: whereClause,
      include: [
        {
          model: EscalationMatrix,
          as: 'escalation_matrix',
          required: true
        },
        {
          model: Ticket,
          as: 'ticket',
          attributes: [],
          required: true,
          include: [{
            model: Client,
            as: 'client',
            attributes: ['client_id', 'company_name'],
            required: true
          }]
        }
      ],
      attributes: [
        [sequelize.col('ticket.client.client_id'), 'client_id'],
        [sequelize.col('ticket.client.company_name'), 'company_name'],
        [sequelize.fn('COUNT', sequelize.col('EscalationHistory.escalation_history_id')), 'count']
      ],
      group: ['ticket.client.client_id', 'ticket.client.company_name'],
      raw: true
    });

    // Recent escalations (last 7 days)
    const lastWeek = new Date();
    lastWeek.setDate(lastWeek.getDate() - 7);
    
    const recentEscalations = await EscalationHistory.count({
      where: {
        created_at: {
          [Op.gte]: lastWeek
        }
      },
      include: includes
    });

    return {
      total_escalations: totalEscalations,
      recent_escalations: recentEscalations,
      by_level: escalationsByLevel.reduce((acc, item) => {
        acc[`level_${item.level}`] = parseInt(item.count);
        return acc;
      }, {}),
      by_condition_type: escalationsByCondition.reduce((acc, item) => {
        acc[item.condition_type] = parseInt(item.count);
        return acc;
      }, {}),
      by_client: escalationsByClient.reduce((acc, item) => {
        acc[item.company_name] = parseInt(item.count);
        return acc;
      }, {})
    };

  } catch (error) {
    console.error('Get escalation summary error:', error);
    return {};
  }
};

/**
 * Format escalation record for response
 */
exports.formatEscalationRecord = (escalation) => {
  if (!escalation) return null;
  
  const plain = escalation.toJSON ? escalation.toJSON() : escalation;
  
  return {
    escalation_id: plain.escalation_history_id,
    ticket_id: plain.ticket?.ticket_id,
    ticket_module: plain.ticket?.module,
    ticket_category: plain.ticket?.category,
    ticket_priority: plain.ticket?.priority,
    ticket_status: plain.ticket?.status,
    ticket_created_at: plain.ticket?.created_at,
    client_id: plain.ticket?.client?.client_id,
    client_name: plain.ticket?.client?.company_name,
    escalation_level: plain.escalation_matrix?.level,
    escalation_condition: plain.escalation_matrix?.condition_type,
    escalation_condition_value: plain.escalation_matrix?.condition_value,
    escalated_to_role: plain.escalation_matrix?.escalate_to_role,
    escalated_from: plain.escalated_from,
    escalated_by_type: plain.escalated_by_type,
    escalation_reason: plain.escalation_reason,
    escalated_at: plain.created_at,
    time_to_escalation: this.calculateTimeToEscalation(plain.ticket?.created_at, plain.created_at)
  };
};

/**
 * Calculate time from ticket creation to escalation
 */
exports.calculateTimeToEscalation = (ticketCreatedAt, escalationAt) => {
  if (!ticketCreatedAt || !escalationAt) return null;
  
  const ticketDate = new Date(ticketCreatedAt);
  const escalationDate = new Date(escalationAt);
  const diffMs = escalationDate - ticketDate;
  
  return {
    hours: Math.floor(diffMs / (1000 * 60 * 60)),
    minutes: Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60)),
    total_minutes: Math.floor(diffMs / (1000 * 60))
  };
};

/**
 * Get escalation trends over time - FIXED
 */
exports.getEscalationTrends = async (req, res) => {
  try {
    const { period = '30d', clientId } = req.query;
    
    const periods = {
      '7d': 7,
      '30d': 30,
      '90d': 90,
      '1y': 365
    };
    
    const days = periods[period] || 30;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const whereClause = {
      created_at: {
        [Op.gte]: startDate
      }
    };

    // Build include conditions
    const includes = [];
    
    if (clientId) {
      includes.push({
        model: Ticket,
        as: 'ticket',
        attributes: [],
        required: true,
        include: [{
          model: Client,
          as: 'client',
          attributes: [],
          where: { client_id: clientId },
          required: true
        }]
      });
    }

    // Group by date
    const trends = await EscalationHistory.findAll({
      where: whereClause,
      include: includes,
      attributes: [
        [sequelize.fn('DATE', sequelize.col('created_at')), 'date'],
        [sequelize.fn('COUNT', sequelize.col('escalation_history_id')), 'count']
      ],
      group: [sequelize.fn('DATE', sequelize.col('created_at'))],
      order: [[sequelize.fn('DATE', sequelize.col('created_at')), 'ASC']],
      raw: true
    });

    // Fill missing dates with zero counts
    const filledTrends = this.fillMissingDates(trends, days);

    return res.json({
      success: true,
      trends: filledTrends,
      period: period,
      total_days: days
    });

  } catch (error) {
    console.error('Get escalation trends error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error: ' + error.message
    });
  }
};

/**
 * Fill missing dates in trends data
 */
exports.fillMissingDates = (trends, days) => {
  const result = [];
  const today = new Date();
  
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const dateString = date.toISOString().split('T')[0];
    
    const existing = trends.find(t => {
      const trendDate = t.date instanceof Date ? t.date.toISOString().split('T')[0] : t.date;
      return trendDate === dateString;
    });
    
    result.push({
      date: dateString,
      count: existing ? parseInt(existing.count) : 0
    });
  }
  
  return result;
};

/**
 * Export escalation report to CSV - FIXED
 */
exports.exportEscalationReport = async (req, res) => {
  try {
    const { startDate, endDate, clientId, format = 'csv' } = req.query;

    const whereClause = {};
    if (startDate || endDate) {
      whereClause.created_at = {};
      if (startDate) whereClause.created_at[Op.gte] = new Date(startDate);
      if (endDate) whereClause.created_at[Op.lte] = new Date(endDate);
    }

    // Build includes
    const includes = [
      {
        model: Ticket,
        as: 'ticket',
        attributes: ['ticket_id', 'module', 'category', 'priority', 'status', 'created_at'],
        required: true,
        include: [{
          model: Client,
          as: 'client',
          attributes: ['company_name'],
          required: true
        }]
      },
      {
        model: EscalationMatrix,
        as: 'escalation_matrix',
        attributes: ['level', 'condition_type', 'condition_value', 'escalate_to_role'],
        required: true
      }
    ];

    // Add client filter if needed
    if (clientId) {
      includes[0].include[0].where = { client_id: clientId };
    }

    const escalations = await EscalationHistory.findAll({
      where: whereClause,
      include: includes,
      order: [['created_at', 'DESC']]
    });

    if (format === 'csv') {
      const csvData = this.convertToCSV(escalations);
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=escalation-report-${new Date().toISOString().split('T')[0]}.csv`);
      return res.send(csvData);
    } else {
      return res.json({
        success: true,
        escalations: escalations.map(esc => this.formatEscalationRecord(esc))
      });
    }

  } catch (error) {
    console.error('Export escalation report error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error: ' + error.message
    });
  }
};

/**
 * Convert escalation data to CSV format
 */
exports.convertToCSV = (escalations) => {
  const headers = [
    'Ticket ID',
    'Client',
    'Module',
    'Category',
    'Priority',
    'Status',
    'Escalation Level',
    'Escalation Condition',
    'Escalated To Role',
    'Escalation Reason',
    'Ticket Created',
    'Escalated At',
    'Time to Escalation (hours)'
  ];

  const rows = escalations.map(esc => {
    const plain = esc.toJSON ? esc.toJSON() : esc;
    const timeToEscalation = this.calculateTimeToEscalation(
      plain.ticket?.created_at,
      plain.created_at
    );

    return [
      plain.ticket?.ticket_id || '',
      plain.ticket?.client?.company_name || '',
      plain.ticket?.module || '',
      plain.ticket?.category || '',
      plain.ticket?.priority || '',
      plain.ticket?.status || '',
      plain.escalation_matrix?.level || '',
      plain.escalation_matrix?.condition_type || '',
      plain.escalation_matrix?.escalate_to_role || '',
      plain.escalation_reason || '',
      plain.ticket?.created_at ? new Date(plain.ticket.created_at).toISOString() : '',
      plain.created_at ? new Date(plain.created_at).toISOString() : '',
      timeToEscalation ? timeToEscalation.hours : ''
    ];
  });

  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(field => `"${String(field).replace(/"/g, '""')}"`).join(','))
  ].join('\n');

  return csvContent;
};

/**
 * Get client-specific escalation report - FIXED
 */
exports.getClientEscalationReport = async (req, res) => {
  try {
    const clientId = req.client.id;
    const {
      startDate,
      endDate,
      escalationLevel,
      page = 1,
      limit = 50
    } = req.query;

    const whereClause = {};
    
    if (startDate || endDate) {
      whereClause.created_at = {};
      if (startDate) whereClause.created_at[Op.gte] = new Date(startDate);
      if (endDate) whereClause.created_at[Op.lte] = new Date(endDate);
    }

    const escalationMatrixWhere = {};
    if (escalationLevel) {
      escalationMatrixWhere.level = escalationLevel;
    }

    const offset = (page - 1) * limit;

    const { count, rows: escalations } = await EscalationHistory.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: Ticket,
          as: 'ticket',
          attributes: ['ticket_id', 'module', 'category', 'priority', 'status', 'created_at'],
          where: { client_id: clientId },
          required: true,
          include: [{
            model: Client,
            as: 'client',
            attributes: ['company_name'],
            required: true
          }]
        },
        {
          model: EscalationMatrix,
          as: 'escalation_matrix',
          attributes: ['level', 'condition_type', 'condition_value', 'escalate_to_role'],
          where: Object.keys(escalationMatrixWhere).length > 0 ? escalationMatrixWhere : undefined,
          required: true
        }
      ],
      order: [['created_at', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset),
      distinct: true
    });

    // Client-specific summary
    const summary = await this.getClientEscalationSummary(clientId, {
      startDate,
      endDate,
      escalationLevel
    });

    return res.json({
      success: true,
      report: {
        escalations: escalations.map(esc => this.formatEscalationRecord(esc)),
        summary,
        pagination: {
          total: count,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(count / limit)
        }
      }
    });

  } catch (error) {
    console.error('Get client escalation report error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error: ' + error.message
    });
  }
};

/**
 * Get client-specific escalation summary
 */
exports.getClientEscalationSummary = async (clientId, filters = {}) => {
  try {
    const { startDate, endDate, escalationLevel } = filters;

    const whereClause = {};
    if (startDate || endDate) {
      whereClause.created_at = {};
      if (startDate) whereClause.created_at[Op.gte] = new Date(startDate);
      if (endDate) whereClause.created_at[Op.lte] = new Date(endDate);
    }

    const escalationMatrixWhere = {};
    if (escalationLevel) escalationMatrixWhere.level = escalationLevel;

    // Total escalations for client
    const totalEscalations = await EscalationHistory.count({
      where: whereClause,
      include: [
        {
          model: Ticket,
          as: 'ticket',
          where: { client_id: clientId },
          required: true
        },
        {
          model: EscalationMatrix,
          as: 'escalation_matrix',
          where: Object.keys(escalationMatrixWhere).length > 0 ? escalationMatrixWhere : undefined,
          required: true
        }
      ]
    });

    // Average time to escalation for client
    const avgTimeResult = await EscalationHistory.findOne({
      where: whereClause,
      include: [
        {
          model: Ticket,
          as: 'ticket',
          where: { client_id: clientId },
          required: true
        }
      ],
      attributes: [
        [sequelize.fn('AVG', 
          sequelize.fn('TIMESTAMPDIFF', 
            sequelize.literal('HOUR'), 
            sequelize.col('ticket.created_at'), 
            sequelize.col('EscalationHistory.created_at')
          )
        ), 'avg_hours']
      ],
      raw: true
    });

    return {
      total_escalations: totalEscalations,
      avg_time_to_escalation_hours: avgTimeResult?.avg_hours ? 
        Math.round(avgTimeResult.avg_hours) : 0
    };

  } catch (error) {
    console.error('Get client escalation summary error:', error);
    return {};
  }
};