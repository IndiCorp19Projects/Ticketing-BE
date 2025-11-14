// routes/performance.js
const express = require('express');
const router = express.Router();
const { User, Ticket, TicketReply } = require('../models');
const { Op } = require('sequelize');

// GET /api/performance/executive-report
router.get('/executive-report', async (req, res) => {
  try {
    const { startDate, endDate, executiveId } = req.query;
    
    // Build where condition for tickets
    const ticketWhere = {
      status: 'Closed'
    };
    
    // Add date filter if provided
    if (startDate && endDate) {
      ticketWhere.created_at = {
        [Op.between]: [new Date(startDate), new Date(endDate)]
      };
    }
    
    // Add executive filter if provided
    if (executiveId) {
      ticketWhere.assigned_to = executiveId;
    }
    
    // Get all executives (users with executive role)
    const executives = await User.findAll({
      where: {
        role_name: 'executive',
        is_active: true
      },
      attributes: [
        'user_id',
        'username',
        'first_name',
        'last_name',
        'email'
      ],
      include: [
        {
          model: Ticket,
          as: 'assignedTickets',
          where: ticketWhere,
          attributes: ['ticket_id', 'created_at', 'resolved_at', 'status'],
          required: false // Left join to include executives with no closed tickets
        }
      ]
    });
    
    // Process the data to calculate metrics
    const performanceReport = executives.map(executive => {
      const closedTickets = executive.assignedTickets || [];
      const totalTickets = closedTickets.length;
      
      // Calculate mean time for closed tickets
      let meanTime = 0;
      if (totalTickets > 0) {
        const totalTime = closedTickets.reduce((sum, ticket) => {
          if (ticket.created_at && ticket.resolved_at) {
            const timeDiff = new Date(ticket.resolved_at) - new Date(ticket.created_at);
            return sum + timeDiff;
          }
          return sum;
        }, 0);
        
        meanTime = totalTime / totalTickets;
      }
      
      // Convert meanTime from milliseconds to hours
      const meanTimeHours = meanTime / (1000 * 60 * 60);
      
      return {
        executive_id: executive.user_id,
        executive_name: `${executive.first_name} ${executive.last_name}`.trim() || executive.username,
        username: executive.username,
        email: executive.email,
        total_closed_tickets: totalTickets,
        mean_time_hours: parseFloat(meanTimeHours.toFixed(2)),
        mean_time_days: parseFloat((meanTimeHours / 24).toFixed(2)),
        mean_time_readable: formatTimeReadable(meanTime)
      };
    });
    
    res.json({
      success: true,
      data: performanceReport,
      total_executives: performanceReport.length,
      report_period: {
        startDate: startDate || 'All time',
        endDate: endDate || 'All time'
      }
    });
    
  } catch (error) {
    console.error('Performance report error:', error);
    res.status(500).json({
      success: false,
      message: 'Error generating performance report',
      error: error.message
    });
  }
});

// Helper function to format time in readable format
function formatTimeReadable(milliseconds) {
  if (!milliseconds || milliseconds === 0) return '0 hours';
  
  const seconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (days > 0) {
    return `${days} days, ${hours % 24} hours`;
  } else if (hours > 0) {
    return `${hours} hours, ${minutes % 60} minutes`;
  } else {
    return `${minutes} minutes`;
  }
}

// GET /api/performance/executive-detail/:executiveId
router.get('/executive-detail/:executiveId', async (req, res) => {
  try {
    const { executiveId } = req.params;
    const { startDate, endDate } = req.query;
    
    // Build where condition
    const where = {
      assigned_to: parseInt(executiveId),
      status: 'Closed'
    };
    
    if (startDate && endDate) {
      where.created_at = {
        [Op.between]: [new Date(startDate), new Date(endDate)]
      };
    }
    
    // Get executive details
    const executive = await User.findOne({
      where: { 
        user_id: parseInt(executiveId),
        role_name: 'executive' 
      },
      attributes: ['user_id', 'username', 'first_name', 'last_name', 'email', 'department', 'designation']
    });
    
    if (!executive) {
      return res.status(404).json({
        success: false,
        message: 'Executive not found'
      });
    }
    
    // Get all closed tickets for this executive
    const closedTickets = await Ticket.findAll({
      where,
      attributes: [
        'ticket_id',
        'created_at',
        'resolved_at',
        'priority',
        'category',
        'status'
      ],
      order: [['resolved_at', 'DESC']]
    });
    
    // Calculate statistics
    const totalTickets = closedTickets.length;
    
    // Calculate resolution times
    const resolutionTimes = closedTickets
      .filter(ticket => ticket.created_at && ticket.resolved_at)
      .map(ticket => {
        return new Date(ticket.resolved_at) - new Date(ticket.created_at);
      });
    
    const meanTime = resolutionTimes.length > 0 ? 
      resolutionTimes.reduce((a, b) => a + b, 0) / resolutionTimes.length : 0;
    
    const minTime = resolutionTimes.length > 0 ? Math.min(...resolutionTimes) : 0;
    const maxTime = resolutionTimes.length > 0 ? Math.max(...resolutionTimes) : 0;
    
    // Group by priority
    const priorityStats = {};
    closedTickets.forEach(ticket => {
      const priority = ticket.priority || 'Not Set';
      priorityStats[priority] = (priorityStats[priority] || 0) + 1;
    });
    
    res.json({
      success: true,
      data: {
        executive: {
          ...executive.toJSON(),
          full_name: `${executive.first_name} ${executive.last_name}`.trim() || executive.username
        },
        performance_metrics: {
          total_closed_tickets: totalTickets,
          mean_resolution_time_hours: parseFloat((meanTime / (1000 * 60 * 60)).toFixed(2)),
          min_resolution_time_hours: parseFloat((minTime / (1000 * 60 * 60)).toFixed(2)),
          max_resolution_time_hours: parseFloat((maxTime / (1000 * 60 * 60)).toFixed(2)),
          mean_resolution_time_readable: formatTimeReadable(meanTime)
        },
        priority_distribution: priorityStats,
        recent_tickets: closedTickets.slice(0, 10) // Last 10 tickets
      }
    });
    
  } catch (error) {
    console.error('Executive detail error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching executive details',
      error: error.message
    });
  }
});

module.exports = router;