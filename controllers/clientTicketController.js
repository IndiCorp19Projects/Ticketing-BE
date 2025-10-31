const { Op } = require('sequelize');
// controllers/clientController.js
const { Ticket, TicketReply, Document, Client, User, ClientSLA, IssueType, WorkingHours, sequelize } = require('../models');
const { sendMail } = require('../utils/mailer');
const { ticketCreatedTemplate, ticketReplyTemplate, ticketEscalatedTemplate } = require('../utils/emailTemplates');
const SLACalculator = require('../utils/slaCalculator');

function checkClientUserPermissions(req, ticket) {
  const get = (obj, key) => {
    if (!obj) return undefined;
    if (Object.prototype.hasOwnProperty.call(obj, key)) return obj[key];
    if (obj.dataValues && Object.prototype.hasOwnProperty.call(obj.dataValues, key))
      return obj.dataValues[key];
    return undefined;
  };

  const ticketClientId = get(ticket, 'client_id');
  const ticketId = get(ticket, 'ticket_id');

  console.log('[PERMISSION DEBUG]', {
    ticketClientId,
    reqClientId: req.client?.id,
    clientUser: req.client_user,
    ticketCreatorId: get(ticket, 'client_user_id'),
    ticketAssignedId: get(ticket, 'assigned_client_user_id')
  });

  // Client ownership check
  if (ticketClientId != null && req.client && req.client.id != null) {
    if (String(ticketClientId) !== String(req.client.id)) {
      console.log(`[PERMISSION DENIED] Client ID mismatch`);
      return false;
    }
  }

  // Client Admin can access all tickets
  if (req.client_user && (req.client_user.role === 'admin' || req.client_user.client_user_role === 'admin')) {
    console.log(`[PERMISSION GRANTED] Client admin access`);
    return true;
  }

  // For client users
  const runtimeUserId = req.client_user && (
    req.client_user.id ??
    req.client_user.client_user_id ??
    req.client_user.user_id ??
    req.client_user.client_id ??
    null
  );

  if (!runtimeUserId) {
    console.log('[PERMISSION DENIED] No user ID found');
    return false;
  }

  const ticketCreatorId = get(ticket, 'client_user_id');
  const ticketAssignedId = get(ticket, 'assigned_client_user_id');

  // Convert all to string for safe comparison
  const runtimeUserIdStr = String(runtimeUserId);
  const ticketCreatorIdStr = ticketCreatorId != null ? String(ticketCreatorId) : null;
  const ticketAssignedIdStr = ticketAssignedId != null ? String(ticketAssignedId) : null;

  console.log(`[PERMISSION CHECK] User ${runtimeUserIdStr} - Creator: ${ticketCreatorIdStr}, Assigned: ${ticketAssignedIdStr}`);

  // UPDATED LOGIC: If ticket has assigned_client_user_id value, only assigned user can access
  // If no assigned_client_user_id, then creator can access
  if (ticketAssignedIdStr && ticketAssignedIdStr !== '' && ticketAssignedIdStr !== 'null') {
    // Ticket is assigned to someone - only assigned user can access
    console.log(`[PERMISSION CHECK] Ticket is assigned to ${ticketAssignedIdStr}`);
    return ticketAssignedIdStr === runtimeUserIdStr;
  } else {
    // Ticket is not assigned - creator can access
    console.log(`[PERMISSION CHECK] Ticket is not assigned, checking creator`);
    return ticketCreatorIdStr === runtimeUserIdStr;
  }
}


async function getTicketDetails(req, res) {
  try {
    const { ticketId } = req.params;

    const ticket = await Ticket.findByPk(ticketId, {
      include: [
        {
          model: TicketReply,
          as: 'replies',
          include: [{
            model: Document,
            as: 'documents',
            attributes: ['document_id', 'doc_name', 'mime_type', 'doc_base64', 'created_on']
          }],
          order: [['created_at', 'ASC']]
        },
        {
          model: Client,
          as: 'client',
          attributes: ['client_id', 'company_name', 'contact_person', 'email']
        },
        {
          model: ClientSLA,
          as: 'client_sla'
        },
        {
          model: Document,
          as: 'documents',
          attributes: ['document_id', 'doc_name', 'doc_base64', 'mime_type', 'created_on']
        }
      ]
    });

    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: 'Ticket not found'
      });
    }

    // Check permissions using updated logic
    if (!checkClientUserPermissions(req, ticket)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied to this ticket'
      });
    }

    const plain = ticket.toJSON ? ticket.toJSON() : ticket;

    // Process replies to handle sender information
    if (Array.isArray(plain.replies)) {
      for (let reply of plain.replies) {
        // For client replies, set sender information
        if (reply.sender_type === 'client') {
          reply.sender = {
            user_id: plain.client.client_id,
            username: plain.client.company_name,
            email: plain.client.email,
            is_client: true
          };
        }
      }
      plain.replies.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    }

    const { response_sla_met, resolve_sla_met, sla } = await computeClientSLACompliance(plain);
    plain.client_sla = sla ? (sla.toJSON ? sla.toJSON() : sla) : plain.client_sla ?? null;
    plain.response_sla_met = response_sla_met;
    plain.resolve_sla_met = resolve_sla_met;

    // Add user permissions based on current ticket state
    const canAssign = req.client_user.role === 'admin';
    const canReply = checkClientUserPermissions(req, ticket) && ticket.status !== 'Closed';

    const userPermissions = {
      can_reply: canReply,
      can_assign: canAssign,
      can_escalate: req.client_user.role === 'admin',
      can_view_all: req.client_user.role === 'admin'
    };

    return res.json({
      success: true,
      ticket: plain,
      user_permissions: userPermissions
    });

  } catch (error) {
    console.error('Get ticket details error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
}

function checkClientUserPermissions(req, ticket) {
  // Admin can access all tickets
  if (req.client_user.role === 'admin') {
    return true;
  }

  // Non-admin users can only access tickets assigned to them
  const ticketAssignedUserId = String(ticket.assigned_client_user_id || '');
  const currentUserId = String(req.client_user.client_user_id || '');

  return ticketAssignedUserId === currentUserId;
}




function canReplyToTicket(req, ticket) {
  if (!ticket) return false;

  // Can't reply to closed tickets
  if (ticket.status === 'Closed') return false;

  // Check if user has permission to access this ticket
  return checkClientUserPermissions(req, ticket);
}

// Also update the fetchTickets function to filter by assigned user
async function getTickets(req, res) {
  try {
    const whereClause = {
      client_id: req.client.client_id
    };

    // UPDATED: For non-admin users, only show tickets assigned to them
    if (req.client_user.role !== 'admin') {
      whereClause.assigned_client_user_id = req.client_user.client_user_id;
    }

    const tickets = await Ticket.findAll({
      where: whereClause,
      include: [
        {
          model: ClientSLA,
          as: 'client_sla'
        }
      ],
      order: [['created_at', 'DESC']]
    });

    const ticketsWithSLA = await Promise.all(
      tickets.map(async (ticket) => {
        const plain = ticket.toJSON ? ticket.toJSON() : ticket;
        const { response_sla_met, resolve_sla_met, sla } = await computeClientSLACompliance(plain);
        return {
          ...plain,
          client_sla: sla ? (sla.toJSON ? sla.toJSON() : sla) : plain.client_sla ?? null,
          response_sla_met,
          resolve_sla_met
        };
      })
    );

    return res.json({
      success: true,
      tickets: ticketsWithSLA
    });

  } catch (error) {
    console.error('Get tickets error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
}

// Also update the replyToTicket function to check permissions
// async function replyToTicket(req, res) {
//   const transaction = await sequelize.transaction();
//   try {
//     const { ticketId } = req.params;
//     const {
//       message: rawMessage,
//       screenshot_url,
//       status,
//       assigned_client_user_id,
//       assigned_client_user_name,
//       assigned_client_user_email
//     } = req.body;
//     const files = req.files && Array.isArray(req.files) ? req.files : [];

//         const clientUserInfo = {
//       id: req.client_user.id,
//       name: req.client_user.name,
//       email: req.client_user.email,
//       role: req.client_user.role
//     };


//     console.log(clientUserInfo , "clientUserInfo")

//     if ((!rawMessage || String(rawMessage).trim() === '') && files.length === 0 && !screenshot_url && !assigned_client_user_id) {
//       await transaction.rollback();
//       return res.status(400).json({
//         success: false,
//         message: 'At least one of message / files / screenshot_url / assignment is required'
//       });
//     }

//     // Fetch ticket (with transaction)
//     const ticket = await Ticket.findByPk(ticketId, { transaction });
//     if (!ticket) {
//       await transaction.rollback();
//       return res.status(404).json({
//         success: false,
//         message: 'Ticket not found'
//       });
//     }






    

//     // UPDATED: Permission check using new function
//     if (!checkClientUserPermissions(req, ticket)) {
//       await transaction.rollback();
//       return res.status(403).json({
//         success: false,
//         message: 'Access denied to this ticket'
//       });
//     }

//     const clientId = req.client.id;
//     const clientUserName = req.client_user.name || req.client_user.username || `user-${req.client_user.id || req.client_user.client_user_id}`;

//     console.log(clientUserName , clientId , "clientIdddddd")


//     console.log(req.username)


//     // Handle assignment if provided
//     let assignmentUpdated = false;
//     if (assigned_client_user_id) {
//       // Check if user is Client Admin for assignment
//       if (req.client_user.role !== 'admin') {
//         await transaction.rollback();
//         return res.status(403).json({
//           success: false,
//           message: 'Only Client Admin can assign tickets'
//         });
//       }

//       // Update assignment
//       await ticket.update({
//         assigned_client_user_id,
//         assigned_client_user_name,
//         assigned_client_user_email,
//         last_updated_by: clientUserName,
//         updated_at: new Date()
//       }, { transaction });

//       assignmentUpdated = true;
//     }

//     // Handle status update if provided
//     let statusUpdated = false;
//     let previousStatus = ticket.status;

//     if (status && status === 'Closed' && ticket.status !== 'Closed') {
//       // Validate that user can close the ticket
//       if (ticket.status === 'Open' || ticket.status === 'Pending' || ticket.status === 'Resolved') {
//         await ticket.update({
//           status: 'Closed',
//           prev_status: previousStatus,
//           last_updated_by: clientUserName,
//           updated_at: new Date()
//         }, { transaction });
//         statusUpdated = true;
//       }
//     }

//     let reply = null;
//     let systemReply = null;

//     // Create assignment system message if assignment was updated
//     if (assignmentUpdated) {
//       systemReply = await TicketReply.create({
//         ticket_id: ticket.ticket_id,
//         sender_id: clientId,
//         sender_type: 'client',
//          client_sender_name:req?.first_name,
//         message: `Ticket assigned to ${assigned_client_user_name} (${assigned_client_user_email}) by ${clientUserName}`
//       }, { transaction });
//     }

//     // Create user's reply if there's a message
//     if (rawMessage && String(rawMessage).trim() !== '') {
//       let finalMessage = rawMessage;

//       // Combine status change info with user message if both occurred
//       if (statusUpdated) {
//         finalMessage = `Ticket status changed from ${previousStatus} to Closed. ${rawMessage}`;
//       }

//       reply = await TicketReply.create({
//         ticket_id: ticket.ticket_id,
//         sender_id: clientId,
//         sender_type: 'client',
//         client_sender_name:req?.first_name,
//         message: finalMessage
//       }, { transaction });
//     } else if (statusUpdated && !assignmentUpdated) {
//       // Create a separate reply for status change if no message was provided and no assignment
//       reply = await TicketReply.create({
//         ticket_id: ticket.ticket_id,
//         sender_id: clientId,
//         sender_type: 'client',
//          client_sender_name:req?.first_name,
//         message: `Ticket status changed from ${previousStatus} to Closed by ${clientUserName}.`
//       }, { transaction });
//     }

//     // Handle files - attach to either user reply or system reply
//     const createdDocsMeta = [];
//     if (files.length > 0) {
//       let replyToAttach = reply || systemReply;
//       if (!replyToAttach) {
//         replyToAttach = await TicketReply.create({
//           ticket_id: ticket.ticket_id,
//           sender_id: clientId,
//           sender_type: 'client',
//           message: ''
//         }, { transaction });
//       }

//       const docsToCreate = files.map((file) => {
//         const b64 = file.buffer ? file.buffer.toString('base64') : null;
//         const mime = file.mimetype || 'application/octet-stream';
//         const isImage = mime.startsWith('image/');
//         return {
//           linked_id: replyToAttach.reply_id,
//           table_name: 'ticket_reply',
//           type: isImage ? 'image' : 'attachment',
//           doc_name: file.originalname || file.filename || 'upload',
//           mime_type: mime,
//           doc_base64: b64,
//           created_by: clientUserName,
//           status: 'active'
//         };
//       });
//       const created = await Document.bulkCreate(docsToCreate, { transaction });
//       created.forEach((d) => {
//         createdDocsMeta.push({
//           document_id: d.document_id,
//           doc_name: d.doc_name,
//           mime_type: d.mime_type,
//           created_on: d.created_on
//         });
//       });
//     }

//     // Screenshot URL handling
//     if (screenshot_url) {
//       const dataUrl = String(screenshot_url);
//       const m = dataUrl.match(/^data:(.+);base64,(.+)$/);
//       if (m) {
//         const mimetype = m[1];
//         const b64 = m[2];
//         let replyToAttach = reply || systemReply;
//         if (!replyToAttach) {
//           replyToAttach = await TicketReply.create({
//             ticket_id: ticket.ticket_id,
//             sender_id: clientId,
//             sender_type: 'client',
//             message: ''
//           }, { transaction });
//         }

//         const doc = await Document.create({
//           linked_id: replyToAttach.reply_id,
//           table_name: 'ticket_reply',
//           type: mimetype.startsWith('image/') ? 'image' : 'attachment',
//           doc_name: req.body.screenshot_name ?? `screenshot.${(mimetype.split('/')[1] || 'png')}`,
//           mime_type: mimetype,
//           doc_base64: b64,
//           created_by: clientUserName,
//           status: 'active'
//         }, { transaction });

//         createdDocsMeta.push({
//           document_id: doc.document_id,
//           doc_name: doc.doc_name,
//           mime_type: doc.mime_type,
//           created_on: doc.created_on
//         });
//       }
//     }

//     // Update ticket metadata if neither status nor assignment was updated
//     if (!statusUpdated && !assignmentUpdated) {
//       ticket.updated_at = new Date();
//       ticket.last_updated_by = clientUserName;
//       await ticket.save({ transaction });
//     }

//     await transaction.commit();

//     // Refresh ticket data for response
//     const updatedTicket = await Ticket.findByPk(ticketId, {
//       include: [
//         {
//           model: TicketReply,
//           as: 'replies',
//           include: [{
//             model: Document,
//             as: 'documents',
//             attributes: ['document_id', 'doc_name', 'mime_type', 'created_on']
//           }]
//         },
//         {
//           model: ClientSLA,
//           as: 'client_sla'
//         }
//       ]
//     });

//     // Notify admins async
//     notifyAdminsTicketReply(updatedTicket, reply || systemReply, req.client, clientUserName).catch(err => {
//       console.error('notifyAdminsTicketReply error:', err);
//     });

//     const ticketPlainFinal = updatedTicket.toJSON ? updatedTicket.toJSON() : updatedTicket;
//     const { response_sla_met, resolve_sla_met, sla } = await computeClientSLACompliance(ticketPlainFinal);

//     // Build success message based on actions performed
//     let successMessage = 'Action completed successfully';
//     if (assignmentUpdated && statusUpdated && rawMessage) {
//       successMessage = 'Ticket assigned, closed, and reply sent successfully';
//     } else if (assignmentUpdated && statusUpdated) {
//       successMessage = 'Ticket assigned and closed successfully';
//     } else if (assignmentUpdated && rawMessage) {
//       successMessage = 'Ticket assigned and reply sent successfully';
//     } else if (statusUpdated && rawMessage) {
//       successMessage = 'Reply sent and ticket closed successfully';
//     } else if (assignmentUpdated) {
//       successMessage = 'Ticket assigned successfully';
//     } else if (statusUpdated) {
//       successMessage = 'Ticket closed successfully';
//     } else if (rawMessage || files.length > 0) {
//       successMessage = 'Reply added successfully';
//     }

//     return res.status(201).json({
//       success: true,
//       message: successMessage,
//       reply: reply || systemReply,
//       documents: createdDocsMeta,
//       assignment_updated: assignmentUpdated,
//       status_updated: statusUpdated,
//       ticket: {
//         ...ticketPlainFinal,
//         client_sla: sla,
//         response_sla_met,
//         resolve_sla_met
//       }
//     });

//   } catch (error) {
//     console.error('Client replyToTicket error:', error);
//     try { await transaction.rollback(); } catch (e) { /* ignore */ }
//     return res.status(500).json({
//       success: false,
//       message: 'Internal server error: ' + (error && error.message ? error.message : String(error))
//     });
//   }
// }




/**
 * Create Ticket (for Client User) chandrashekhar old
 */
async function createTicket(req, res) {
  const transaction = await sequelize.transaction();
  try {
    const {
      category,
      subCategory,
      issueType,
      issueName,
      comments,
      priority 
    } = req.body;

    const files = req.files && Array.isArray(req.files) ? req.files : [];

    // Validation
    if (!category || !comments) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: 'Category and comments are required'
      });
    }

    const clientId = req.client.id;

    // Use client user info from token (set by middleware)
    const clientUserInfo = {
      id: req.client_user.id,
      name: req.client_user.name,
      email: req.client_user.email,
      role: req.client_user.role
    };


    console.log(clientUserInfo , "clientUserInfo")

    // Determine SLA
    let clientSlaId = null;
    const isOtherIssueType = issueType === 'Other';

    let issue_type_id = isOtherIssueType ? null : (req.body.issueType_id ? parseInt(req.body.issueType_id) : null);
    let issue_name = isOtherIssueType && issueName ? issueName : null;

    // Find client SLA if issue type is provided
    if (issue_type_id && !isOtherIssueType) {
      const clientSLA = await ClientSLA.findOne({
        where: {
          client_id: clientId,
          issue_type_id: issue_type_id,
          is_active: true
        },
        order: [
          ['response_target_minutes', 'ASC'],
          ['resolve_target_minutes', 'ASC']
        ],
        transaction
      });

      if (clientSLA) {
        clientSlaId = clientSLA.client_sla_id;
      }
    }



    // Set default clientSlaId to 4 for "Other" issue types
if (isOtherIssueType && !clientSlaId) {
  clientSlaId = 4;
}

    // Create ticket
    const ticket = await Ticket.create({
      client_id: clientId,
      // Client user fields from token
      client_user_id: clientUserInfo.id,
      client_user_name: clientUserInfo.name,
      client_user_email: clientUserInfo.email,
      client_user_role: clientUserInfo.role,
      assigned_client_user_id: clientUserInfo.id,
      // Ticket details
      module: category,
      sub_module: subCategory,
      category: isOtherIssueType ? issueName : issueType,
      issue_type_id: issue_type_id,
      issue_name: issue_name,
      comment: comments,
      status: 'Open',
      client_sla_id: clientSlaId,
      priority: priority,
      is_other_issue: isOtherIssueType
    }, { transaction });

    // Handle file uploads
    const ticketDocsMeta = [];
    if (files.length > 0) {
      const docsToCreate = files.map((file) => {
        return {
          linked_id: ticket.ticket_id,
          table_name: 'ticket',
          type: (file.mimetype || '').startsWith('image/') ? 'image' : 'attachment',
          doc_name: file.originalname || file.filename || 'upload',
          mime_type: file.mimetype || 'application/octet-stream',
          doc_base64: file.buffer ? file.buffer.toString('base64') : null,
          created_by: clientUserInfo.name,
          status: 'active'
        };
      });
      const created = await Document.bulkCreate(docsToCreate, { transaction });
      created.forEach((d) => {
        ticketDocsMeta.push({
          document_id: d.document_id,
          doc_name: d.doc_name,
          mime_type: d.mime_type,
          created_on: d.created_on
        });
      });
    }

    await transaction.commit();

    const ticketPlain = ticket.toJSON ? ticket.toJSON() : ticket;

    // Get SLA details
    let slaRecord = null;
    if (ticketPlain.client_sla_id) {
      slaRecord = await ClientSLA.findByPk(ticketPlain.client_sla_id, {
        include: [
          {
            model: IssueType,
            as: 'issue_type',
            attributes: ['issue_type_id', 'name']
          }
        ]
      });
    }

    // Compute SLA compliance
    const { response_sla_met, resolve_sla_met } = await computeClientSLACompliance(ticketPlain);

    const responseTicket = {
      ...ticketPlain,
      ticket_documents: ticketDocsMeta,
      client_sla: slaRecord ? (slaRecord.toJSON ? slaRecord.toJSON() : slaRecord) : null,
      response_sla_met,
      resolve_sla_met,
      is_other_issue: isOtherIssueType
    };

    // Notify admins about new client ticket (async — fire & forget)
    notifyAdminsTicketCreated(responseTicket, clientUserInfo).catch(err => {
      console.error('notifyAdminsTicketCreated error:', err);
    });

    return res.status(201).json({
      success: true,
      message: 'Ticket raised successfully',
      ticket: responseTicket
    });

  } catch (error) {
    console.error('Client createTicket error:', error);
    try { await transaction.rollback(); } catch (e) { /* ignore */ }
    return res.status(500).json({
      success: false,
      message: 'Internal server error: ' + (error && error.message ? error.message : String(error))
    });
  }
}




async function listTickets(req, res) {
  try {
    const clientId = req.client_user.client_id;
    const { status, priority, page = 1, limit = 20, search } = req.query;

    // Base: ticket must belong to same client
    let whereCondition = { client_id: clientId };

    // For non-admin users
    if (req.client_user.role === 'user') {
      const userId = req.client_user.id;

      whereCondition = {
        client_id: clientId,
        assigned_client_user_id: userId
      };
    } // admin role sees all tickets for client

    // Add filters
    if (status && status !== 'all') whereCondition.status = status;
    if (priority && priority !== 'all') whereCondition.priority = priority;

    // Search
    if (search) {
      const searchConditions = [
        { comment: { [Op.like]: `%${search}%` } },
        { category: { [Op.like]: `%${search}%` } },
        { module: { [Op.like]: `%${search}%` } },
        { ticket_no: { [Op.like]: `%${search}%` } },
        { client_user_name: { [Op.like]: `%${search}%` } },
        { assigned_client_user_name: { [Op.like]: `%${search}%` } }
      ];

      if (whereCondition[Op.or]) {
        whereCondition[Op.or] = whereCondition[Op.or].concat(searchConditions);
      } else {
        whereCondition[Op.or] = searchConditions;
      }
    }

    const offset = (page - 1) * limit;

    const { count, rows: tickets } = await Ticket.findAndCountAll({
      where: whereCondition,
      include: [
        {
          model: Client,
          as: 'client',
          attributes: ['client_id', 'company_name', 'contact_person', 'email']
        },
        {
          model: TicketReply,
          as: 'replies',
          include: [{
            model: Document,
            as: 'documents',
            attributes: ['document_id', 'doc_name', 'mime_type', 'created_on']
          }]
        },
        {
          model: Document,
          as: 'documents',
          attributes: ['document_id', 'doc_name', 'mime_type', 'created_on']
        },
        {
          model: ClientSLA,
          as: 'client_sla'
        }
      ],
      order: [['created_at', 'DESC']],
      limit: parseInt(limit, 10),
      offset: parseInt(offset, 10)
    });

    // Process tickets with SLA
    const ticketsWithSLA = await Promise.all(
      tickets.map(async (ticket) => {
        const plain = ticket.toJSON ? ticket.toJSON() : ticket;
        if (Array.isArray(plain.replies)) {
          for (let reply of plain.replies) {
            if (reply.sender_type === 'client') {
              reply.sender = {
                user_id: plain.client.client_id,
                username: plain.client.company_name,
                email: plain.client.email,
                is_client: true
              };
            }
          }
          plain.replies.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
        }
        const { response_sla_met, resolve_sla_met, sla } = await computeClientSLACompliance(plain);
        plain.client_sla = sla ? (sla.toJSON ? sla.toJSON() : sla) : plain.client_sla ?? null;
        plain.response_sla_met = response_sla_met;
        plain.resolve_sla_met = resolve_sla_met;
        return plain;
      })
    );

    // User permissions
    const userPermissions = req.client_user.role === 'admin' ?
      ['view_all_tickets', 'assign_tickets', 'escalate_tickets'] :
      ['view_own_unassigned_tickets', 'view_assigned_tickets', 'create_tickets'];

    return res.json({
      success: true,
      tickets: ticketsWithSLA,
      user_info: {
        id: req.client_user.client_user_id,
        name: req.client_user.name,
        role: req.client_user.role,
        permissions: userPermissions
      },
      pagination: {
        total: count,
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        totalPages: Math.ceil(count / limit)
      }
    });
  } catch (error) {
    console.error('List tickets error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
}

/**
 * Assign Ticket to Client User (Client Admin only)
 */
async function assignTicket(req, res) {
  const transaction = await sequelize.transaction();
  try {
    const { ticketId } = req.params;
    const {
      assigned_client_user_id,
      assigned_client_user_name,
      assigned_client_user_email
    } = req.body;

    // Check if user is Client Admin
    if (req.client_user.role !== 'admin') {
      await transaction.rollback();
      return res.status(403).json({
        success: false,
        message: 'Only Client Admin can assign tickets'
      });
    }

    const ticket = await Ticket.findByPk(ticketId, { transaction });
    if (!ticket) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: 'Ticket not found'
      });
    }

    // Verify ticket belongs to client
    if (!checkClientUserPermissions(req, ticket)) {
      await transaction.rollback();
      return res.status(403).json({
        success: false,
        message: 'Access denied to this ticket'
      });
    }

    // Update assignment
    await ticket.update({
      assigned_client_user_id,
      assigned_client_user_name,
      assigned_client_user_email,
      last_updated_by: req.client_user.name,
      updated_at: new Date()
    }, { transaction });

    // Create assignment log as a reply
    await TicketReply.create({
      ticket_id: ticket.ticket_id,
      sender_id: req.client.id,
      sender_type: 'client',
      message: `Ticket assigned to ${assigned_client_user_name} (${assigned_client_user_email}) by ${req.client_user.name}`
    }, { transaction });

    await transaction.commit();

    return res.json({
      success: true,
      message: 'Ticket assigned successfully',
      ticket: {
        ticket_id: ticket.ticket_id,
        assigned_client_user_id,
        assigned_client_user_name,
        assigned_client_user_email
      }
    });

  } catch (error) {
    console.error('Assign ticket error:', error);
    try { await transaction.rollback(); } catch (e) { /* ignore */ }
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
}

/**
 * Escalate Ticket to User Admin (Client Admin only)
 */
async function escalateTicket(req, res) {
  const transaction = await sequelize.transaction();
  try {
    const { ticketId } = req.params;
    const { admin_id, message } = req.body;

    // Check if user is Client Admin
    if (req.client_user.role !== 'admin') {
      await transaction.rollback();
      return res.status(403).json({
        success: false,
        message: 'Only Client Admin can escalate tickets'
      });
    }

    const ticket = await Ticket.findByPk(ticketId, { transaction });
    if (!ticket) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: 'Ticket not found'
      });
    }

    // Verify ticket belongs to client
    if (!checkClientUserPermissions(req, ticket)) {
      await transaction.rollback();
      return res.status(403).json({
        success: false,
        message: 'Access denied to this ticket'
      });
    }

    // Find the admin user
    const adminUser = await User.findOne({
      where: {
        user_id: admin_id,
        role_name: 'admin',
        is_active: true
      },
      transaction
    });

    if (!adminUser) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: 'Admin user not found or inactive'
      });
    }

    // Update ticket assignment to admin
    await ticket.update({
      assigned_to: admin_id,
      status: 'Escalated',
      last_updated_by: req.client_user.name,
      updated_at: new Date()
    }, { transaction });

    // Create escalation log
    await TicketReply.create({
      ticket_id: ticket.ticket_id,
      sender_id: req.client.id,
      sender_type: 'client',
      message: `Ticket escalated to Admin (${adminUser.username}) by ${req.client_user.name}. ${message || ''}`
    }, { transaction });

    await transaction.commit();

    // Notify the admin (async)
    notifyAdminTicketEscalated(ticket, adminUser, req.client_user).catch(err => {
      console.error('notifyAdminTicketEscalated error:', err);
    });

    return res.json({
      success: true,
      message: 'Ticket escalated successfully',
      ticket: {
        ticket_id: ticket.ticket_id,
        assigned_to: admin_id,
        assigned_admin_name: adminUser.username,
        status: 'Escalated'
      }
    });

  } catch (error) {
    console.error('Escalate ticket error:', error);
    try { await transaction.rollback(); } catch (e) { /* ignore */ }
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
}

/**
 * Reply to Ticket (Role-based permissions)
 */







// async function replyToTicket(req, res) {
//   const transaction = await sequelize.transaction();
//   try {
//     const { ticketId } = req.params;
//     const {
//       message: rawMessage,
//       screenshot_url,
//       status,
//       assigned_client_user_id,
//       assigned_client_user_name,
//       assigned_client_user_email
//     } = req.body;
//     const files = req.files && Array.isArray(req.files) ? req.files : [];

//     if ((!rawMessage || String(rawMessage).trim() === '') && files.length === 0 && !screenshot_url && !assigned_client_user_id) {
//       await transaction.rollback();
//       return res.status(400).json({
//         success: false,
//         message: 'At least one of message / files / screenshot_url / assignment is required'
//       });
//     }

//     // Fetch ticket (with transaction)
//     const ticket = await Ticket.findByPk(ticketId, { transaction });
//     if (!ticket) {
//       await transaction.rollback();
//       return res.status(404).json({
//         success: false,
//         message: 'Ticket not found'
//       });
//     }

//     // Permission check
//     if (!checkClientUserPermissions(req, ticket)) {
//       await transaction.rollback();
//       return res.status(403).json({
//         success: false,
//         message: 'Access denied to this ticket'
//       });
//     }

//     const clientId = req.client.id;
//     const clientUserName = req.client_user.name || req.client_user.username || `user-${req.client_user.id || req.client_user.client_user_id}`;

//     // Handle assignment if provided
//     let assignmentUpdated = false;
//     if (assigned_client_user_id) {
//       // Check if user is Client Admin for assignment
//       if (req.client_user.role !== 'admin') {
//         await transaction.rollback();
//         return res.status(403).json({
//           success: false,
//           message: 'Only Client Admin can assign tickets'
//         });
//       }

//       // Update assignment
//       await ticket.update({
//         assigned_client_user_id,
//         assigned_client_user_name,
//         assigned_client_user_email,
//         last_updated_by: clientUserName,
//         updated_at: new Date()
//       }, { transaction });

//       assignmentUpdated = true;
//     }

//     // Handle status update if provided
//     let statusUpdated = false;
//     let previousStatus = ticket.status;

//     if (status && status === 'Closed' && ticket.status !== 'Closed') {
//       // Validate that user can close the ticket
//       if (ticket.status === 'Open' || ticket.status === 'Pending' || ticket.status === 'Resolved') {
//         await ticket.update({
//           status: 'Closed',
//           prev_status: previousStatus,
//           last_updated_by: clientUserName,
//           updated_at: new Date()
//         }, { transaction });
//         statusUpdated = true;
//       }
//     }

//     let reply = null;
//     let systemReply = null;

//     // Create assignment system message if assignment was updated
//     if (assignmentUpdated) {
//       systemReply = await TicketReply.create({
//         ticket_id: ticket.ticket_id,
//         sender_id: clientId,
//         sender_type: 'client',
//          client_sender_name:req.client_user.name,
//         message: `Ticket assigned to ${assigned_client_user_name} (${assigned_client_user_email}) by ${clientUserName}`
//       }, { transaction });
//     }

//     // Create user's reply if there's a message
//     if (rawMessage && String(rawMessage).trim() !== '') {
//       let finalMessage = rawMessage;

//       // Combine status change info with user message if both occurred
//       if (statusUpdated) {
//         finalMessage = `Ticket status changed from ${previousStatus} to Closed. ${rawMessage}`;
//       }

//           const clientUserInfo = {
//       id: req.client_user.id,
//       name: req.client_user.name,
//       email: req.client_user.email,
//       role: req.client_user.role
//     };


//     console.log(clientUserInfo , "clientUserInfo")

//       reply = await TicketReply.create({
//         ticket_id: ticket.ticket_id,
//         sender_id: clientId,
//         sender_type: 'client',
//         client_sender_name:req.client_user.name,
        
//         message: finalMessage
//       }, { transaction });
//     } else if (statusUpdated && !assignmentUpdated) {
//       // Create a separate reply for status change if no message was provided and no assignment
//       reply = await TicketReply.create({
//         ticket_id: ticket.ticket_id,
//         sender_id: clientId,
//         sender_type: 'client',
//         message: `Ticket status changed from ${previousStatus} to Closed by ${clientUserName}.`
//       }, { transaction });
//     }

//     // Handle files - attach to either user reply or system reply
//     const createdDocsMeta = [];
//     if (files.length > 0) {
//       let replyToAttach = reply || systemReply;
//       if (!replyToAttach) {
//         replyToAttach = await TicketReply.create({
//           ticket_id: ticket.ticket_id,
//           sender_id: clientId,
//           sender_type: 'client',
//           message: ''
//         }, { transaction });
//       }

//       const docsToCreate = files.map((file) => {
//         const b64 = file.buffer ? file.buffer.toString('base64') : null;
//         const mime = file.mimetype || 'application/octet-stream';
//         const isImage = mime.startsWith('image/');
//         return {
//           linked_id: replyToAttach.reply_id,
//           table_name: 'ticket_reply',
//           type: isImage ? 'image' : 'attachment',
//           doc_name: file.originalname || file.filename || 'upload',
//           mime_type: mime,
//           doc_base64: b64,
//           created_by: clientUserName,
//           status: 'active'
//         };
//       });
//       const created = await Document.bulkCreate(docsToCreate, { transaction });
//       created.forEach((d) => {
//         createdDocsMeta.push({
//           document_id: d.document_id,
//           doc_name: d.doc_name,
//           mime_type: d.mime_type,
//           created_on: d.created_on
//         });
//       });
//     }

//     // Screenshot URL handling
//     if (screenshot_url) {
//       const dataUrl = String(screenshot_url);
//       const m = dataUrl.match(/^data:(.+);base64,(.+)$/);
//       if (m) {
//         const mimetype = m[1];
//         const b64 = m[2];
//         let replyToAttach = reply || systemReply;
//         if (!replyToAttach) {
//           replyToAttach = await TicketReply.create({
//             ticket_id: ticket.ticket_id,
//             sender_id: clientId,
//             sender_type: 'client',
//             message: ''
//           }, { transaction });
//         }

//         const doc = await Document.create({
//           linked_id: replyToAttach.reply_id,
//           table_name: 'ticket_reply',
//           type: mimetype.startsWith('image/') ? 'image' : 'attachment',
//           doc_name: req.body.screenshot_name ?? `screenshot.${(mimetype.split('/')[1] || 'png')}`,
//           mime_type: mimetype,
//           doc_base64: b64,
//           created_by: clientUserName,
//           status: 'active'
//         }, { transaction });

//         createdDocsMeta.push({
//           document_id: doc.document_id,
//           doc_name: doc.doc_name,
//           mime_type: doc.mime_type,
//           created_on: doc.created_on
//         });
//       }
//     }

//     // Update ticket metadata if neither status nor assignment was updated
//     if (!statusUpdated && !assignmentUpdated) {
//       ticket.updated_at = new Date();
//       ticket.last_updated_by = clientUserName;
//       await ticket.save({ transaction });
//     }

//     await transaction.commit();

//     // Refresh ticket data for response
//     const updatedTicket = await Ticket.findByPk(ticketId, {
//       include: [
//         {
//           model: TicketReply,
//           as: 'replies',
//           include: [{
//             model: Document,
//             as: 'documents',
//             attributes: ['document_id', 'doc_name', 'mime_type', 'created_on']
//           }]
//         },
//         {
//           model: ClientSLA,
//           as: 'client_sla'
//         }
//       ]
//     });

//     // Notify admins async
//     notifyAdminsTicketReply(updatedTicket, reply || systemReply, req.client, clientUserName).catch(err => {
//       console.error('notifyAdminsTicketReply error:', err);
//     });

//     const ticketPlainFinal = updatedTicket.toJSON ? updatedTicket.toJSON() : updatedTicket;
//     const { response_sla_met, resolve_sla_met, sla } = await computeClientSLACompliance(ticketPlainFinal);

//     // Build success message based on actions performed
//     let successMessage = 'Action completed successfully';
//     if (assignmentUpdated && statusUpdated && rawMessage) {
//       successMessage = 'Ticket assigned, closed, and reply sent successfully';
//     } else if (assignmentUpdated && statusUpdated) {
//       successMessage = 'Ticket assigned and closed successfully';
//     } else if (assignmentUpdated && rawMessage) {
//       successMessage = 'Ticket assigned and reply sent successfully';
//     } else if (statusUpdated && rawMessage) {
//       successMessage = 'Reply sent and ticket closed successfully';
//     } else if (assignmentUpdated) {
//       successMessage = 'Ticket assigned successfully';
//     } else if (statusUpdated) {
//       successMessage = 'Ticket closed successfully';
//     } else if (rawMessage || files.length > 0) {
//       successMessage = 'Reply added successfully';
//     }

//     return res.status(201).json({
//       success: true,
//       message: successMessage,
//       reply: reply || systemReply,
//       documents: createdDocsMeta,
//       assignment_updated: assignmentUpdated,
//       status_updated: statusUpdated,
//       ticket: {
//         ...ticketPlainFinal,
//         client_sla: sla,
//         response_sla_met,
//         resolve_sla_met
//       }
//     });

//   } catch (error) {
//     console.error('Client replyToTicket error:', error);
//     try { await transaction.rollback(); } catch (e) { /* ignore */ }
//     return res.status(500).json({
//       success: false,
//       message: 'Internal server error: ' + (error && error.message ? error.message : String(error))
//     });
//   }
// }



async function replyToTicket(req, res) {
  const transaction = await sequelize.transaction();
  try {
    const { ticketId } = req.params;
    const {
      message: rawMessage,
      screenshot_url,
      status,
      assigned_client_user_id,
      assigned_client_user_name,
      assigned_client_user_email
    } = req.body;
    const files = req.files && Array.isArray(req.files) ? req.files : [];

    if ((!rawMessage || String(rawMessage).trim() === '') && files.length === 0 && !screenshot_url && !assigned_client_user_id) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: 'At least one of message / files / screenshot_url / assignment is required'
      });
    }

    // Fetch ticket (with transaction)
    const ticket = await Ticket.findByPk(ticketId, { transaction });
    if (!ticket) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: 'Ticket not found'
      });
    }

    // Permission check
    if (!checkClientUserPermissions(req, ticket)) {
      await transaction.rollback();
      return res.status(403).json({
        success: false,
        message: 'Access denied to this ticket'
      });
    }

    const clientId = req.client.id;
    const clientUserName = req.client_user.name || req.client_user.username || `user-${req.client_user.id || req.client_user.client_user_id}`;

    // Handle assignment if provided
    let assignmentUpdated = false;
    if (assigned_client_user_id) {
      // Check if user is Client Admin for assignment
      if (req.client_user.role !== 'admin') {
        await transaction.rollback();
        return res.status(403).json({
          success: false,
          message: 'Only Client Admin can assign tickets'
        });
      }

      // Update assignment
      await ticket.update({
        assigned_client_user_id,
        assigned_client_user_name,
        assigned_client_user_email,
        last_updated_by: clientUserName,
        updated_at: new Date()
      }, { transaction });

      assignmentUpdated = true;
    }

    // Handle status update if provided
    let statusUpdated = false;
    let previousStatus = ticket.status;

    if (status && status === 'Closed' && ticket.status !== 'Closed') {
      // Validate that user can close the ticket
      if (ticket.status === 'Open' || ticket.status === 'Pending' || ticket.status === 'Resolved') {
        await ticket.update({
          status: 'Closed',
          prev_status: previousStatus,
          last_updated_by: clientUserName,
          updated_at: new Date()
        }, { transaction });
        statusUpdated = true;
      }
    }

    let reply = null;
    const createdDocsMeta = [];

    // ONLY CREATE REPLY IF USER PROVIDES EXPLICIT MESSAGE/FILES/SCREENSHOT
    // Remove all system message creation for assignments/status changes

    // Create user's reply only if there's a message, files, or screenshot
    const hasUserContent = (rawMessage && String(rawMessage).trim() !== '') || 
                          files.length > 0 || 
                          screenshot_url;

    if (hasUserContent) {
      let finalMessage = rawMessage || '';

      // Create the reply with user's content
      reply = await TicketReply.create({
        ticket_id: ticket.ticket_id,
        sender_id: clientId,
        sender_type: 'client',
        client_sender_name: req.client_user.name,
        message: finalMessage.trim()
      }, { transaction });

      // Handle files - attach to user reply
      if (files.length > 0) {
        const docsToCreate = files.map((file) => {
          const b64 = file.buffer ? file.buffer.toString('base64') : null;
          const mime = file.mimetype || 'application/octet-stream';
          const isImage = mime.startsWith('image/');
          return {
            linked_id: reply.reply_id,
            table_name: 'ticket_reply',
            type: isImage ? 'image' : 'attachment',
            doc_name: file.originalname || file.filename || 'upload',
            mime_type: mime,
            doc_base64: b64,
            created_by: clientUserName,
            status: 'active'
          };
        });
        const created = await Document.bulkCreate(docsToCreate, { transaction });
        created.forEach((d) => {
          createdDocsMeta.push({
            document_id: d.document_id,
            doc_name: d.doc_name,
            mime_type: d.mime_type,
            created_on: d.created_on
          });
        });
      }

      // Screenshot URL handling
      if (screenshot_url) {
        const dataUrl = String(screenshot_url);
        const m = dataUrl.match(/^data:(.+);base64,(.+)$/);
        if (m) {
          const mimetype = m[1];
          const b64 = m[2];
          const doc = await Document.create({
            linked_id: reply.reply_id,
            table_name: 'ticket_reply',
            type: mimetype.startsWith('image/') ? 'image' : 'attachment',
            doc_name: req.body.screenshot_name ?? `screenshot.${(mimetype.split('/')[1] || 'png')}`,
            mime_type: mimetype,
            doc_base64: b64,
            created_by: clientUserName,
            status: 'active'
          }, { transaction });

          createdDocsMeta.push({
            document_id: doc.document_id,
            doc_name: doc.doc_name,
            mime_type: doc.mime_type,
            created_on: doc.created_on
          });
        }
      }
    }

    // Update ticket metadata if changes were made (assignment, status, or reply)
    if (assignmentUpdated || statusUpdated || hasUserContent) {
      ticket.updated_at = new Date();
      ticket.last_updated_by = clientUserName;
      await ticket.save({ transaction });
    }

    await transaction.commit();

    // Refresh ticket data for response
    const updatedTicket = await Ticket.findByPk(ticketId, {
      include: [
        {
          model: TicketReply,
          as: 'replies',
          include: [{
            model: Document,
            as: 'documents',
            attributes: ['document_id', 'doc_name', 'mime_type', 'created_on']
          }]
        },
        {
          model: ClientSLA,
          as: 'client_sla'
        }
      ]
    });

    // Notify admins async (only if there's an actual user reply)
    if (reply) {
      notifyAdminsTicketReply(updatedTicket, reply, req.client, clientUserName).catch(err => {
        console.error('notifyAdminsTicketReply error:', err);
      });
    }

    const ticketPlainFinal = updatedTicket.toJSON ? updatedTicket.toJSON() : updatedTicket;
    const { response_sla_met, resolve_sla_met, sla } = await computeClientSLACompliance(ticketPlainFinal);

    // Build success message based on actions performed
    let successMessage = 'Action completed successfully';
    if (assignmentUpdated && statusUpdated && hasUserContent) {
      successMessage = 'Ticket assigned, closed, and reply sent successfully';
    } else if (assignmentUpdated && statusUpdated) {
      successMessage = 'Ticket assigned and closed successfully';
    } else if (assignmentUpdated && hasUserContent) {
      successMessage = 'Ticket assigned and reply sent successfully';
    } else if (statusUpdated && hasUserContent) {
      successMessage = 'Reply sent and ticket closed successfully';
    } else if (assignmentUpdated) {
      successMessage = 'Ticket assigned successfully';
    } else if (statusUpdated) {
      successMessage = 'Ticket closed successfully';
    } else if (hasUserContent) {
      successMessage = 'Reply added successfully';
    }

    return res.status(201).json({
      success: true,
      message: successMessage,
      reply: reply, // Only user replies, no system replies
      documents: createdDocsMeta,
      assignment_updated: assignmentUpdated,
      status_updated: statusUpdated,
      ticket: {
        ...ticketPlainFinal,
        client_sla: sla,
        response_sla_met,
        resolve_sla_met
      }
    });

  } catch (error) {
    console.error('Client replyToTicket error:', error);
    try { await transaction.rollback(); } catch (e) { /* ignore */ }
    return res.status(500).json({
      success: false,
      message: 'Internal server error: ' + (error && error.message ? error.message : String(error))
    });
  }
}

/**
 * Get Ticket Details
 */
async function getTicketDetails(req, res) {
  try {
    const { ticketId } = req.params;

    const ticket = await Ticket.findByPk(ticketId, {
      include: [
        {
          model: TicketReply,
          as: 'replies',
          include: [{
            model: Document,
            as: 'documents',
            attributes: ['document_id', 'doc_name', 'mime_type', 'doc_base64', 'created_on']
          }],
          order: [['created_at', 'ASC']]
        },
        {
          model: Client,
          as: 'client',
          attributes: ['client_id', 'company_name', 'contact_person', 'email']
        },
        {
          model: ClientSLA,
          as: 'client_sla'
        },
        {
          model: Document,
          as: 'documents',
          attributes: ['document_id', 'doc_name', 'doc_base64', 'mime_type', 'created_on']
        }
      ]
    });

    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: 'Ticket not found'
      });
    }

    // Check permissions
    if (!checkClientUserPermissions(req, ticket)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied to this ticket'
      });
    }

    const plain = ticket.toJSON ? ticket.toJSON() : ticket;

    // Process replies to handle sender information
    if (Array.isArray(plain.replies)) {
      for (let reply of plain.replies) {
        // For client replies, set sender information
        if (reply.sender_type === 'client') {
          reply.sender = {
            user_id: plain.client.client_id,
            username: plain.client.company_name,
            email: plain.client.email,
            is_client: true
          };
        }
      }
      plain.replies.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    }

    const { response_sla_met, resolve_sla_met, sla } = await computeClientSLACompliance(plain);
    plain.client_sla = sla ? (sla.toJSON ? sla.toJSON() : sla) : plain.client_sla ?? null;
    plain.response_sla_met = response_sla_met;
    plain.resolve_sla_met = resolve_sla_met;

    // Add user permissions
    const userPermissions = {
      can_reply: true,
      can_assign: req.client_user.role === 'admin',
      can_escalate: req.client_user.role === 'admin',
      can_view_all: req.client_user.role === 'admin'
    };

    return res.json({
      success: true,
      ticket: plain,
      user_permissions: userPermissions
    });

  } catch (error) {
    console.error('Get ticket details error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
}

/**
 * Update Ticket Status
 */
async function updateTicketStatus(req, res) {
  const transaction = await sequelize.transaction();
  try {
    const { ticketId } = req.params;
    const { status, message } = req.body;

    const validStatuses = ['Open', 'Pending', 'Resolved', 'Closed'];
    if (!validStatuses.includes(status)) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: 'Invalid status. Must be one of: ' + validStatuses.join(', ')
      });
    }

    const ticket = await Ticket.findByPk(ticketId, { transaction });
    if (!ticket) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: 'Ticket not found'
      });
    }

    // Check permissions
    if (!checkClientUserPermissions(req, ticket)) {
      await transaction.rollback();
      return res.status(403).json({
        success: false,
        message: 'Access denied to this ticket'
      });
    }

    const previousStatus = ticket.status;

    // Update ticket status
    await ticket.update({
      status: status,
      prev_status: previousStatus,
      last_updated_by: req.client_user.name,
      updated_at: new Date()
    }, { transaction });

    // Create status change log
    if (message) {
      await TicketReply.create({
        ticket_id: ticket.ticket_id,
        sender_id: req.client.id,
        sender_type: 'client',
        message: `Status changed from ${previousStatus} to ${status}. ${message}`
      }, { transaction });
    }

    await transaction.commit();

    return res.json({
      success: true,
      message: 'Ticket status updated successfully',
      ticket: {
        ticket_id: ticket.ticket_id,
        previous_status: previousStatus,
        new_status: status,
        updated_by: req.client_user.name
      }
    });

  } catch (error) {
    console.error('Update ticket status error:', error);
    try { await transaction.rollback(); } catch (e) { /* ignore */ }
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
}





function checkClientUserPermissions(req, ticket) {
  const get = (obj, key) => {
    if (!obj) return undefined;
    if (Object.prototype.hasOwnProperty.call(obj, key)) return obj[key];
    if (obj.dataValues && Object.prototype.hasOwnProperty.call(obj.dataValues, key))
      return obj.dataValues[key];
    return undefined;
  };

  const ticketClientId = get(ticket, 'client_id');
  const ticketId = get(ticket, 'ticket_id');

  console.log('[PERMISSION DEBUG]', {
    ticketClientId,
    reqClientId: req.client?.id,
    clientUser: req.client_user,
    ticketCreatorId: get(ticket, 'client_user_id'),
    ticketAssignedId: get(ticket, 'assigned_client_user_id')
  });

  // Client ownership check
  if (ticketClientId != null && req.client && req.client.id != null) {
    if (String(ticketClientId) !== String(req.client.id)) {
      console.log(`[PERMISSION DENIED] Client ID mismatch`);
      return false;
    }
  }

  // Client Admin can access all tickets
  if (req.client_user && (req.client_user.role === 'admin' || req.client_user.client_user_role === 'admin')) {
    console.log(`[PERMISSION GRANTED] Client admin access`);
    return true;
  }

  // For client users
  const runtimeUserId = req.client_user && (
    req.client_user.id ??
    req.client_user.client_user_id ??
    req.client_user.user_id ??
    req.client_user.client_id ??
    null
  );

  if (!runtimeUserId) {
    console.log('[PERMISSION DENIED] No user ID found');
    return false;
  }

  const ticketCreatorId = get(ticket, 'client_user_id');
  const ticketAssignedId = get(ticket, 'assigned_client_user_id');

  // Convert all to string for safe comparison
  const runtimeUserIdStr = String(runtimeUserId);
  const ticketCreatorIdStr = ticketCreatorId != null ? String(ticketCreatorId) : null;
  const ticketAssignedIdStr = ticketAssignedId != null ? String(ticketAssignedId) : null;

  const isCreator = ticketCreatorIdStr === runtimeUserIdStr;
  const isAssigned = ticketAssignedIdStr === runtimeUserIdStr;

  console.log(`[PERMISSION CHECK] User ${runtimeUserIdStr} - Creator: ${ticketCreatorIdStr}, Assigned: ${ticketAssignedIdStr}`);

  if (isCreator || isAssigned) {
    console.log('[PERMISSION GRANTED] User is creator or assigned');
    return true;
  }

  console.log('[PERMISSION DENIED] User not authorized');
  return false;
}

/**
 * Compute SLA compliance for client tickets
 */
async function computeClientSLACompliance(ticket) {
  if (!ticket) return { response_sla_met: null, resolve_sla_met: null, sla: null };

  let sla = ticket.client_sla ?? null;
  if (!sla && ticket.client_sla_id) {
    sla = await ClientSLA.findByPk(ticket.client_sla_id, {
      include: [
        {
          model: WorkingHours,
          as: 'working_hours',
          attributes: ['working_hours_id', 'working_days', 'start_time', 'end_time', 'timezone']
        }
      ]
    });
  }

  let response_sla_met = null;
  let resolve_sla_met = null;

  if (sla) {
    if (ticket.response_at && sla.response_target_minutes) {
      if (sla.working_hours) {
        const actualWorkingMinutes = SLACalculator.getWorkingMinutesBetween(
          new Date(ticket.created_at),
          new Date(ticket.response_at),
          sla.working_hours
        );
        response_sla_met = actualWorkingMinutes <= sla.response_target_minutes;
      } else {
        response_sla_met = ticket.response_time_seconds <= (sla.response_target_minutes * 60);
      }
    }

    if (ticket.resolved_at && sla.resolve_target_minutes) {
      if (sla.working_hours) {
        const actualWorkingMinutes = SLACalculator.getWorkingMinutesBetween(
          new Date(ticket.created_at),
          new Date(ticket.resolved_at),
          sla.working_hours
        );
        resolve_sla_met = actualWorkingMinutes <= sla.resolve_target_minutes;
      } else {
        resolve_sla_met = ticket.resolve_time_seconds <= (sla.resolve_target_minutes * 60);
      }
    }
  }

  return { response_sla_met, resolve_sla_met, sla };
}

/**
 * Notify admins about new ticket
 */
async function notifyAdminsTicketCreated(ticket, clientUser) {
  try {
    const admins = await User.findAll({
      where: { role_name: 'admin', is_active: true },
      attributes: ['email', 'username']
    });

    if (admins.length > 0) {
      const adminEmails = admins.map(admin => admin.email).filter(Boolean);

      if (adminEmails.length > 0) {
        const creator = {
          username: clientUser.name,
          email: clientUser.email,
          type: 'client',
          client_user_role: clientUser.role
        };
        const { subject, html, text } = ticketCreatedTemplate({
          ticket: ticket,
          creator
        });
        await sendMail({ to: adminEmails.join(','), subject, html, text });
        console.log(`Notified admins about new ticket: ${ticket.ticket_id}`);
      }
    }
  } catch (error) {
    console.error('Ticket creation notification error:', error);
  }
}

/**
 * Notify admin about escalated ticket
 */
async function notifyAdminTicketEscalated(ticket, adminUser, clientUser) {
  try {
    const ticketPlain = ticket.toJSON ? ticket.toJSON() : ticket;
    const sender = {
      username: clientUser.name,
      email: clientUser.email,
      type: 'client'
    };

    const { subject, html, text } = ticketEscalatedTemplate({
      ticket: ticketPlain,
      admin: adminUser,
      sender
    });

    await sendMail({ to: adminUser.email, subject, html, text });
    console.log(`Notified admin ${adminUser.email} about escalated ticket: ${ticket.ticket_id}`);
  } catch (error) {
    console.error('Escalation notification error:', error);
  }
}

/**
 * Notify admins about reply to ticket
 */
async function notifyAdminsTicketReply(ticket, reply, client, clientUserName) {
  try {
    const admins = await User.findAll({
      where: { role_name: 'admin', is_active: true },
      attributes: ['email', 'username']
    });

    if (admins.length > 0) {
      const adminEmails = admins.map(admin => admin.email).filter(Boolean);

      if (adminEmails.length > 0) {
        const ticketPlain = ticket.toJSON ? ticket.toJSON() : ticket;
        const replyPlain = reply ? (reply.toJSON ? reply.toJSON() : reply) : null;
        const sender = {
          username: clientUserName,
          email: client.email,
          type: 'client'
        };

        const { subject, html, text } = ticketReplyTemplate({
          ticket: ticketPlain,
          reply: replyPlain,
          sender
        });
        await sendMail({ to: adminEmails.join(','), subject, html, text });
        console.log(`Notified admins about reply to ticket: ${ticket.ticket_id}`);
      }
    }
  } catch (error) {
    console.error('Reply notification error:', error);
  }
}

/**
 * Get Client Statistics
 */
async function getClientStatistics(req, res) {
  try {
    const clientId = req.client.id;

    // Build where condition based on role
    let whereCondition = { client_id: clientId };
    if (req.client_user.role === 'user') {
      whereCondition.client_user_id = req.client_user.id;
    }

    const tickets = await Ticket.findAll({ where: whereCondition });

    const statistics = {
      total: tickets.length,
      open: tickets.filter(t => t.status === 'Open').length,
      pending: tickets.filter(t => t.status === 'Pending').length,
      resolved: tickets.filter(t => t.status === 'Resolved').length,
      closed: tickets.filter(t => t.status === 'Closed').length,
      high_priority: tickets.filter(t => t.priority === 'high').length,
      medium_priority: tickets.filter(t => t.priority === 'medium').length,
      low_priority: tickets.filter(t => t.priority === 'low').length
    };

    return res.json({
      success: true,
      statistics,
      user_role: req.client_user.role
    });

  } catch (error) {
    console.error('Get client statistics error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
}

// Export functions (also provide aliases to keep existing router names working)
module.exports = {
  // canonical
  createTicket,
  listTickets,
  assignTicket,
  escalateTicket,
  replyToTicket,
  getTicketDetails,
  updateTicketStatus,
  getClientStatistics,

  // // backwards-compatible aliases (if your router uses different names)
  raiseTicket: createTicket,
  getClientTickets: listTickets,
  getTicketById: getTicketDetails,
  assignToClientUser: assignTicket
};
