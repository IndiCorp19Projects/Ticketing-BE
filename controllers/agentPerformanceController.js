// controllers/agentPerformanceController.js
const { User, Ticket, TicketReply, AgentPerformance, sequelize } = require('../models');
const { Op } = require('sequelize');

// Helper function to calculate agent performance
async function calculateAgentPerformance(agentId, startDate, endDate) {
  try {
    // Get all tickets assigned to this agent within the period
    const tickets = await Ticket.findAll({
      where: {
        assigned_to: agentId,
        created_at: {
          [Op.between]: [startDate, endDate]
        }
      },
      include: [
        {
          model: TicketReply,
          as: 'replies',
          attributes: ['reply_id', 'created_at', 'sender_id']
        }
      ]
    });

    if (tickets.length === 0) {
      return null;
    }

    let metrics = {
      total_tickets_assigned: tickets.length,
      tickets_resolved: 0,
      tickets_pending: 0,
      tickets_reopened: 0,
      total_resolution_time_seconds: 0,
      sla_met_count: 0,
      sla_missed_count: 0,
      resolution_times: [],
      first_response_times: []
    };

    for (let ticket of tickets) {
      // Count by status
      if (ticket.status === 'Resolved' || ticket.status === 'Closed') {
        metrics.tickets_resolved++;
        
        // Calculate resolution time
        if (ticket.resolved_at && ticket.created_at) {
          const resolutionTime = (new Date(ticket.resolved_at) - new Date(ticket.created_at)) / 1000;
          metrics.total_resolution_time_seconds += resolutionTime;
          metrics.resolution_times.push(resolutionTime);
        }
      } else if (ticket.status === 'Pending') {
        metrics.tickets_pending++;
      } else if (ticket.status === 'Reopen') {
        metrics.tickets_reopened++;
      }

      // Calculate first response time
      const firstAgentReply = ticket.replies
        .filter(reply => 
          reply.sender_type === 'admin' && 
          reply.sender_id === agentId
        )
        .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))[0];

      if (firstAgentReply && ticket.created_at) {
        const firstResponseTime = (new Date(firstAgentReply.created_at) - new Date(ticket.created_at)) / 1000;
        metrics.first_response_times.push(firstResponseTime);
      }

      // Track SLA compliance
      const slaCompliance = await computeSLACompliance(ticket);
      if (slaCompliance.resolve_sla_met) {
        metrics.sla_met_count++;
      } else if (slaCompliance.resolve_sla_met === false) {
        metrics.sla_missed_count++;
      }
    }

    // Calculate averages
    metrics.avg_resolution_time_seconds = metrics.resolution_times.length > 0 
      ? metrics.resolution_times.reduce((a, b) => a + b, 0) / metrics.resolution_times.length 
      : 0;

    metrics.avg_first_response_time_seconds = metrics.first_response_times.length > 0
      ? metrics.first_response_times.reduce((a, b) => a + b, 0) / metrics.first_response_times.length
      : 0;

    // Calculate rates
    metrics.resolution_rate = metrics.total_tickets_assigned > 0
      ? (metrics.tickets_resolved / metrics.total_tickets_assigned) * 100
      : 0;

    const totalSlaTickets = metrics.sla_met_count + metrics.sla_missed_count;
    metrics.sla_compliance_rate = totalSlaTickets > 0
      ? (metrics.sla_met_count / totalSlaTickets) * 100
      : 0;

    return metrics;
  } catch (error) {
    console.error('Error calculating agent performance:', error);
    throw error;
  }
}

// Compute SLA compliance (similar to your existing function)
async function computeSLACompliance(ticket) {
  // Implement your SLA compliance logic here
  // This should be similar to the computeSLACompliance function in your ticketController
  return {
    response_sla_met: null,
    resolve_sla_met: null,
    sla: null
  };
}

// Get agent performance for a specific period
exports.getAgentPerformance = async (req, res) => {
  try {
    const { agentId, startDate, endDate, periodType = 'monthly' } = req.query;
    
    let start = startDate ? new Date(startDate) : new Date();
    let end = endDate ? new Date(endDate) : new Date();

    // Adjust dates based on period type
    switch (periodType) {
      case 'daily':
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);
        break;
      case 'weekly':
        start.setDate(start.getDate() - start.getDay());
        start.setHours(0, 0, 0, 0);
        end.setDate(start.getDate() + 6);
        end.setHours(23, 59, 59, 999);
        break;
      case 'monthly':
        start.setDate(1);
        start.setHours(0, 0, 0, 0);
        end = new Date(start.getFullYear(), start.getMonth() + 1, 0);
        end.setHours(23, 59, 59, 999);
        break;
      case 'yearly':
        start = new Date(start.getFullYear(), 0, 1);
        end = new Date(start.getFullYear(), 11, 31, 23, 59, 59, 999);
        break;
    }

    const performance = await calculateAgentPerformance(agentId, start, end);
    
    if (!performance) {
      return res.status(404).json({
        message: 'No performance data found for the specified period',
        agent_id: agentId,
        period: { start, end }
      });
    }

    return res.json({
      message: 'Agent performance retrieved successfully',
      agent_id: agentId,
      period: { start, end, type: periodType },
      performance: performance
    });

  } catch (error) {
    console.error('getAgentPerformance error:', error);
    return res.status(500).json({ message: 'Internal server error: ' + error.message });
  }
};

// Get performance for all agents
exports.getAllAgentsPerformance = async (req, res) => {
  try {
    const { startDate, endDate, periodType = 'monthly' } = req.query;
    
    // let start = startDate ? new Date(startDate) : new Date();
    // let end = endDate ? new Date(endDate) : new Date();


        let start =  new Date();
    let end =  new Date();


    // Get all agents (executives and admins)
    const agents = await User.findAll({
      where: {
        role_name: ['admin', 'executive'],
        is_active: true
      },
      attributes: ['user_id', 'username', 'first_name', 'last_name', 'role_name']
    });

    const performanceData = [];

    for (let agent of agents) {
      const performance = await calculateAgentPerformance(agent.user_id, start, end);
      
      if (performance) {
        performanceData.push({
          agent: {
            user_id: agent.user_id,
            username: agent.username,
            first_name: agent.first_name,
            last_name: agent.last_name,
            role_name: agent.role_name
          },
          performance: performance
        });
      }
    }

    // Sort by resolution rate (highest first)
    performanceData.sort((a, b) => 
      b.performance.resolution_rate - a.performance.resolution_rate
    );

    return res.json({
      message: 'All agents performance retrieved successfully',
      period: { start, end, type: periodType },
      total_agents: performanceData.length,
      performance_data: performanceData
    });

  } catch (error) {
    console.error('getAllAgentsPerformance error:', error);
    return res.status(500).json({ message: 'Internal server error: ' + error.message });
  }
};

// Get agent performance trends over time
exports.getAgentPerformanceTrends = async (req, res) => {
  try {
    const { agentId } = req.params;
    const { months = 6 } = req.query;

    const trends = [];
    const endDate = new Date();
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - parseInt(months));

    // Generate monthly trends
    for (let i = 0; i < months; i++) {
      const monthStart = new Date(startDate.getFullYear(), startDate.getMonth() + i, 1);
      const monthEnd = new Date(startDate.getFullYear(), startDate.getMonth() + i + 1, 0, 23, 59, 59, 999);

      const performance = await calculateAgentPerformance(agentId, monthStart, monthEnd);
      
      trends.push({
        period: `${monthStart.toLocaleString('default', { month: 'long' })} ${monthStart.getFullYear()}`,
        period_start: monthStart,
        period_end: monthEnd,
        performance: performance || {
          total_tickets_assigned: 0,
          tickets_resolved: 0,
          resolution_rate: 0,
          avg_resolution_time_seconds: 0,
          sla_compliance_rate: 0
        }
      });
    }

    return res.json({
      message: 'Agent performance trends retrieved successfully',
      agent_id: agentId,
      trends: trends
    });

  } catch (error) {
    console.error('getAgentPerformanceTrends error:', error);
    return res.status(500).json({ message: 'Internal server error: ' + error.message });
  }
};

// Get detailed ticket breakdown for an agent
exports.getAgentTicketBreakdown = async (req, res) => {
  try {
    const { agentId } = req.params;
    const { startDate, endDate } = req.query;

    let whereClause = { assigned_to: agentId };
    
    if (startDate && endDate) {
      whereClause.created_at = {
        [Op.between]: [new Date(startDate), new Date(endDate)]
      };
    }

    const tickets = await Ticket.findAll({
      where: whereClause,
      include: [
        {
          model: User,
          as: 'creator',
          attributes: ['user_id', 'username', 'first_name', 'last_name']
        },
        {
          model: TicketReply,
          as: 'replies',
          attributes: ['reply_id', 'created_at', 'sender_id', 'sender_type']
        }
      ],
      order: [['created_at', 'DESC']]
    });

    // Get agent details
    const agent = await User.findByPk(agentId, {
      attributes: ['user_id', 'username', 'first_name', 'last_name']
    });

    const breakdown = {
      by_status: {},
      by_priority: {},
      resolution_times: [],
      response_times: []
    };

    for (let ticket of tickets) {
      // Count by status
      breakdown.by_status[ticket.status] = (breakdown.by_status[ticket.status] || 0) + 1;
      
      // Count by priority
      breakdown.by_priority[ticket.priority] = (breakdown.by_priority[ticket.priority] || 0) + 1;

      // Calculate resolution time for resolved tickets
      if ((ticket.status === 'Resolved' || ticket.status === 'Closed') && ticket.resolved_at) {
        const resolutionTime = (new Date(ticket.resolved_at) - new Date(ticket.created_at)) / 1000;
        breakdown.resolution_times.push({
          ticket_id: ticket.ticket_id,
          resolution_time_seconds: resolutionTime,
          created_at: ticket.created_at,
          resolved_at: ticket.resolved_at
        });
      }

      // Calculate first response time
      const firstAgentReply = ticket.replies
        .filter(reply => 
          reply.sender_type === 'admin' && 
          reply.sender_id === parseInt(agentId)
        )
        .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))[0];

      if (firstAgentReply) {
        const responseTime = (new Date(firstAgentReply.created_at) - new Date(ticket.created_at)) / 1000;
        breakdown.response_times.push({
          ticket_id: ticket.ticket_id,
          response_time_seconds: responseTime,
          created_at: ticket.created_at,
          first_response_at: firstAgentReply.created_at
        });
      }
    }

    return res.json({
      message: 'Agent ticket breakdown retrieved successfully',
      agent_id: agentId,
      agent_name: agent ? `${agent.first_name} ${agent.last_name}` : 'Unknown Agent',
      total_tickets: tickets.length,
      breakdown: breakdown,
      recent_tickets: tickets.slice(0, 10).map(ticket => ({
        ticket_id: ticket.ticket_id,
        status: ticket.status,
        priority: ticket.priority,
        created_at: ticket.created_at,
        resolved_at: ticket.resolved_at,
        created_by: ticket.creator ? 
          `${ticket.creator.first_name} ${ticket.creator.last_name}` : 
          'Unknown'
      }))
    });

  } catch (error) {
    console.error('getAgentTicketBreakdown error:', error);
    return res.status(500).json({ message: 'Internal server error: ' + error.message });
  }
};

// Update agent performance metrics (to be called periodically)
exports.updatePerformanceMetrics = async (req, res) => {
  try {
    const { periodType = 'monthly' } = req.body;

    const agents = await User.findAll({
      where: {
        role_name: ['admin', 'executive'],
        is_active: true
      }
    });

    const endDate = new Date();
    const startDate = new Date();

    switch (periodType) {
      case 'daily':
        startDate.setDate(startDate.getDate() - 1);
        break;
      case 'weekly':
        startDate.setDate(startDate.getDate() - 7);
        break;
      case 'monthly':
        startDate.setMonth(startDate.getMonth() - 1);
        break;
    }

    const updateResults = [];

    for (let agent of agents) {
      const performance = await calculateAgentPerformance(agent.user_id, startDate, endDate);
      
      if (performance) {
        // Store in AgentPerformance table
        await AgentPerformance.create({
          agent_id: agent.user_id,
          period_start: startDate,
          period_end: endDate,
          period_type: periodType,
          ...performance
        });

        updateResults.push({
          agent_id: agent.user_id,
          status: 'updated',
          performance: performance
        });
      }
    }

    return res.json({
      message: 'Performance metrics updated successfully',
      period: { start: startDate, end: endDate, type: periodType },
      updated_agents: updateResults.length,
      results: updateResults
    });

  } catch (error) {
    console.error('updatePerformanceMetrics error:', error);
    return res.status(500).json({ message: 'Internal server error: ' + error.message });
  }
};

// Get agent performance summary (for dashboard)
exports.getAgentPerformanceSummary = async (req, res) => {
  try {
    const { agentId } = req.params;
    
    // Get current month performance
    const startDate = new Date();
    startDate.setDate(1);
    startDate.setHours(0, 0, 0, 0);
    
    const endDate = new Date();
    endDate.setHours(23, 59, 59, 999);

    const currentMonthPerformance = await calculateAgentPerformance(agentId, startDate, endDate);

    // Get previous month performance for comparison
    const prevStartDate = new Date(startDate);
    prevStartDate.setMonth(prevStartDate.getMonth() - 1);
    
    const prevEndDate = new Date(startDate);
    prevEndDate.setDate(0);
    prevEndDate.setHours(23, 59, 59, 999);

    const prevMonthPerformance = await calculateAgentPerformance(agentId, prevStartDate, prevEndDate);

    // Get agent details
    const agent = await User.findByPk(agentId, {
      attributes: ['user_id', 'username', 'first_name', 'last_name', 'role_name', 'email']
    });

    if (!agent) {
      return res.status(404).json({
        message: 'Agent not found'
      });
    }

    return res.json({
      message: 'Agent performance summary retrieved successfully',
      agent: {
        user_id: agent.user_id,
        username: agent.username,
        first_name: agent.first_name,
        last_name: agent.last_name,
        role_name: agent.role_name,
        email: agent.email
      },
      current_period: {
        start: startDate,
        end: endDate,
        performance: currentMonthPerformance || {
          total_tickets_assigned: 0,
          tickets_resolved: 0,
          resolution_rate: 0,
          avg_resolution_time_seconds: 0,
          sla_compliance_rate: 0
        }
      },
      previous_period: {
        start: prevStartDate,
        end: prevEndDate,
        performance: prevMonthPerformance || {
          total_tickets_assigned: 0,
          tickets_resolved: 0,
          resolution_rate: 0,
          avg_resolution_time_seconds: 0,
          sla_compliance_rate: 0
        }
      }
    });

  } catch (error) {
    console.error('getAgentPerformanceSummary error:', error);
    return res.status(500).json({ message: 'Internal server error: ' + error.message });
  }
};