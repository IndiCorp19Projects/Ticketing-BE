// controllers/ticketController.js
// const { Ticket, TicketReply, Document, sequelize, User, SLA } = require('../models');
const { Ticket, TicketReply, Document, sequelize, User, SLA, Category, SubCategory, IssueType, Priority , WorkingHours } = require('../models');
const { sendMail } = require('../utils/mailer');
const { ticketCreatedTemplate, ticketReplyTemplate, ticketStatusChangedTemplate } = require('../utils/emailTemplates');
const SLACalculator = require('../utils/slaCalculator');
// const ensureOwnerOrAdmin = async (req, ticket) => {
//   if (!ticket) return false;
//   if (req.user && req.user.role_name === 'admin' || req.user.role_name === 'executive') return true;
//   const uid = req.user && (req.user.id ?? req.user.user_id);
//   return ticket.user_id === uid;
// };



// In controllers/ticketController.js - UPDATE THESE FUNCTIONS

// In controllers/ticketController.js - UPDATE THESE FUNCTIONS

// In controllers/ticketController.js - UPDATE THESE FUNCTIONS

const ensureOwnerOrAdmin = async (req, ticket) => {
  if (!ticket) return false;
  
  // Systems can access tickets they created
  if (req.user && (req.user.role_name === 'admin' || req.user.role_name === 'executive' || req.user.role_name === 'system')) {
    // For systems, they can only access their own tickets (unless admin/executive)
    if (req.user.role_name === 'system') {
      return ticket.user_id === req.user.id;
    }
    return true;
  }
  
  const uid = req.user && (req.user.id ?? req.user.user_id);
  return ticket.user_id === uid;
};

const ensureCanReply = async (req, ticket) => {
  if (!ticket) return false;
  const uid = req.user && (req.user.id ?? req.user.user_id);
  if (!req.user) return false;
  
  // Systems can reply to tickets they created
  if (req.user.role_name === 'admin' || req.user.role_name === 'system') {
    if (req.user.role_name === 'system') {
      return ticket.user_id === uid; // Systems can only reply to their own tickets
    }
    return true;
  }
  
  if (req.user.role_name === 'user') return ticket.user_id === uid;
  if (req.user.role_name === 'executive') {
    return Number(ticket.assigned_to) === Number(uid);
  }
  return false;
};

function secondsBetween(a, b) {
  if (!a || !b) return null;
  return Math.floor((new Date(b).getTime() - new Date(a).getTime()) / 1000);
}

// async function computeSLACompliance(ticket) {
//   if (!ticket) return { response_sla_met: null, resolve_sla_met: null, sla: null };
//   let sla = ticket.sla ?? null;
//   if (!sla && ticket.sla_id) sla = await SLA.findByPk(ticket.sla_id);
//   let response_sla_met = null;
//   let resolve_sla_met = null;
//   if (sla) {
//     if (ticket.response_time_seconds != null) {
//       response_sla_met = ticket.response_time_seconds <= (sla.response_target_minutes * 60);
//     }
//     if (ticket.resolve_time_seconds != null) {
//       resolve_sla_met = ticket.resolve_time_seconds <= (sla.resolve_target_minutes * 60);
//     }
//   }
//   return { response_sla_met, resolve_sla_met, sla };
// }


async function computeSLACompliance(ticket) {
  if (!ticket) return { response_sla_met: null, resolve_sla_met: null, sla: null };
  
  let sla = ticket.sla ?? null;
  if (!sla && ticket.sla_id) {
    sla = await SLA.findByPk(ticket.sla_id, {
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
        // Calculate actual working minutes used for response
        const actualWorkingMinutes = SLACalculator.getWorkingMinutesBetween(
          new Date(ticket.created_at),
          new Date(ticket.response_at),
          sla.working_hours
        );
        response_sla_met = actualWorkingMinutes <= sla.response_target_minutes;
      } else {
        // Fallback to simple time calculation
        response_sla_met = ticket.response_time_seconds <= (sla.response_target_minutes * 60);
      }
    }

    if (ticket.resolved_at && sla.resolve_target_minutes) {
      if (sla.working_hours) {
        // Calculate actual working minutes used for resolution
        const actualWorkingMinutes = SLACalculator.getWorkingMinutesBetween(
          new Date(ticket.created_at),
          new Date(ticket.resolved_at),
          sla.working_hours
        );
        resolve_sla_met = actualWorkingMinutes <= sla.resolve_target_minutes;
      } else {
        // Fallback to simple time calculation
        resolve_sla_met = ticket.resolve_time_seconds <= (sla.resolve_target_minutes * 60);
      }
    }
  }

  return { response_sla_met, resolve_sla_met, sla };
}


// const ensureCanReply = async (req, ticket) => {
//   if (!ticket) return false;
//   const uid = req.user && (req.user.id ?? req.user.user_id);
//   if (!req.user) return false;
//   if (req.user.role_name === 'admin') return true;
//   if (req.user.role_name === 'user') return ticket.user_id === uid;
//   if (req.user.role_name === 'executive') {
//     // only if assigned_to equals exec id
//     return Number(ticket.assigned_to) === Number(uid);
//   }
//   return false;
// };




/* --------------------------
   READ endpoints
---------------------------*/





exports.replyToTicket = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { ticketId } = req.params;
    // ADD priority to the destructured fields
    const { 
      message: rawMessage, 
      status: requestedStatus, 
      screenshot_url, 
      assigned_to,
      priority: requestedPriority // ADD THIS
    } = req.body;
    
    const files = req.files && Array.isArray(req.files) ? req.files : [];

    // Update validation to include priority
    const isAdminSender = req.user && req.user.role_name === 'admin';
    const hasAssignAction = (assigned_to !== undefined && assigned_to !== null && String(assigned_to).trim() !== '');
    const hasPriorityAction = (requestedPriority !== undefined && requestedPriority !== null && String(requestedPriority).trim() !== '');

    if (
      (!rawMessage || String(rawMessage).trim() === '') &&
      files.length === 0 &&
      !requestedStatus &&
      !screenshot_url &&
      !(isAdminSender && hasAssignAction) &&
      !(isAdminSender && hasPriorityAction) // ADD THIS
    ) {
      await t.rollback();
      return res.status(400).json({ 
        message: 'At least one of message / files / status / screenshot_url / assigned_to (admin) / priority (admin) is required' 
      });
    }

    const ticket = await Ticket.findByPk(ticketId, { transaction: t });
    if (!ticket) {
      await t.rollback();
      return res.status(404).json({ message: 'Ticket not found' });
    }

    // permission check: owner, admin, or assigned executive (via helper)
    if (!(await ensureCanReply(req, ticket))) {
      await t.rollback();
      return res.status(403).json({ message: 'Forbidden' });
    }

    const sender_type = (req.user && req.user.role_name === 'admin') ? 'admin' : (req.user && req.user.role_name === 'executive' ? 'admin' : 'user');
    const senderId = req.user && (req.user.id ?? req.user.user_id);

    // Only these statuses are allowed
    const allowedStatuses = ['Open', 'Pending', 'Resolved', 'Closed'];
    let statusChanged = false;
    let newStatus = undefined;
    if (requestedStatus) {
      newStatus = String(requestedStatus).trim();
      if (!allowedStatuses.includes(newStatus)) {
        await t.rollback();
        return res.status(400).json({ message: `Invalid status. Allowed: ${allowedStatuses.join(', ')}` });
      }
      if (ticket.status !== newStatus) statusChanged = true;
    }

    // ADD PRIORITY UPDATE LOGIC
    let priorityChanged = false;
    let newPriority = undefined;
    if (isAdminSender && hasPriorityAction) {
      newPriority = String(requestedPriority).trim();
      
      // Validate priority - you might want to fetch available priorities from DB
      const validPriorities = ['Low', 'Medium', 'High', 'Critical', 'Urgent']; // Adjust based on your priorities
      if (!validPriorities.includes(newPriority)) {
        await t.rollback();
        return res.status(400).json({ message: `Invalid priority. Allowed: ${validPriorities.join(', ')}` });
      }
      
      if (ticket.priority !== newPriority) priorityChanged = true;
    }

    const now = new Date();

    // If admin replies for the first time -> set response_at & response_time_seconds
    if (req.user && req.user.role_name === 'admin' && !ticket.response_at) {
      ticket.response_at = now;
      ticket.response_time_seconds = secondsBetween(ticket.created_at, now);
      ticket.last_updated_by = req.user.username ?? req.user.id ?? null;
    }

    // If admin provided assigned_to, handle assignment (only admin allowed)
    if (isAdminSender && hasAssignAction) {
      const assignedId = parseInt(assigned_to, 10);
      if (Number.isNaN(assignedId)) {
        await t.rollback();
        return res.status(400).json({ message: 'Invalid assigned_to value' });
      }
      const execUser = await User.findByPk(assignedId, { transaction: t });
      if (!execUser) {
        await t.rollback();
        return res.status(400).json({ message: 'Assignee user not found' });
      }
      if (execUser.role_name !== 'executive') {
        await t.rollback();
        return res.status(400).json({ message: 'Assignee must be an executive' });
      }

      ticket.assigned_to = assignedId;
      ticket.last_updated_by = req.user.username ?? String(senderId);
      ticket.updated_at = now;
    }

    // APPLY PRIORITY CHANGE (admin only)
    if (priorityChanged && newPriority) {
      ticket.priority = newPriority;
      ticket.last_updated_by = req.user.username ?? req.user.id ?? null;
      ticket.updated_at = now;
    }

    // Apply status change
    if (statusChanged && newStatus) {
      ticket.prev_status = ticket.status;
      ticket.status = newStatus;
      ticket.last_updated_by = req.user.username ?? req.user.id ?? null;
      ticket.updated_at = now;

      if ((newStatus === 'Resolved' || newStatus === 'Closed') && !ticket.resolved_at) {
        ticket.resolved_at = now;
        ticket.resolve_time_seconds = secondsBetween(ticket.created_at, now);
      }
    } else {
      // Update last_updated_by and updated_at even if only priority changed
      if (req.user && req.user.role_name === 'admin') {
        ticket.last_updated_by = req.user.username ?? req.user.id ?? null;
      }
      ticket.updated_at = now;
    }

    // persist ticket changes
    await ticket.save({ transaction: t });

    // Create reply only if message present
    let reply = null;
    if (rawMessage && String(rawMessage).trim() !== '') {
      reply = await TicketReply.create({
        ticket_id: ticket.ticket_id ?? ticket.id,
        sender_id: senderId,
        sender_type: (req.user && req.user.role_name === 'admin') ? 'admin' : 'user',
        message: rawMessage ?? ''
      }, { transaction: t });
    }

    // helper to create Document entries from files or base64 (reply-level docs)
    const createdDocsMeta = [];

    // Save multi-file uploads (req.files) => store base64 in doc_base64
    if (files.length > 0) {
      // ensure we have a reply to attach to; if assignment only and no reply created earlier, create a lightweight reply to attach files.
      let replyToAttach = reply;
      if (!replyToAttach) {
        // create a system/user reply to host attachments
        replyToAttach = await TicketReply.create({
          ticket_id: ticket.ticket_id ?? ticket.id,
          sender_id: senderId,
          sender_type: (req.user && req.user.role_name === 'admin') ? 'admin' : 'user',
          message: ''
        }, { transaction: t });
      }

      const docsToCreate = files.map((file) => {
        const b64 = file.buffer ? file.buffer.toString('base64') : null;
        const mime = file.mimetype || 'application/octet-stream';
        const isImage = mime.startsWith('image/');
        return {
          linked_id: replyToAttach.reply_id,
          table_name: 'ticket_reply',
          type: isImage ? 'image' : 'attachment',
          doc_name: file.originalname || file.filename || 'upload',
          mime_type: mime,
          doc_base64: b64,
          created_by: req.user.username ?? String(senderId),
          status: 'active'
        };
      });
      const created = await Document.bulkCreate(docsToCreate, { transaction: t });
      created.forEach((d) => {
        createdDocsMeta.push({
          document_id: d.document_id ?? d.id ?? null,
          doc_name: d.doc_name,
          mime_type: d.mime_type,
          created_on: d.created_on
        });
      });
    } else if (screenshot_url) {
      // screenshot_url as base64 data URI: data:<mimetype>;base64,<data>
      const dataUrl = String(screenshot_url);
      const m = dataUrl.match(/^data:(.+);base64,(.+)$/);
      if (m) {
        const mimetype = m[1];
        const b64 = m[2];
        // ensure we have reply to attach to
        let replyToAttach = reply;
        if (!replyToAttach) {
          replyToAttach = await TicketReply.create({
            ticket_id: ticket.ticket_id ?? ticket.id,
            sender_id: senderId,
            sender_type: (req.user && req.user.role_name === 'admin') ? 'admin' : 'user',
            message: ''
          }, { transaction: t });
        }

        const doc = await Document.create({
          linked_id: replyToAttach.reply_id,
          table_name: 'ticket_reply',
          type: mimetype.startsWith('image/') ? 'image' : 'attachment',
          doc_name: req.body.screenshot_name ?? `upload.${(mimetype.split('/')[1] || 'bin')}`,
          mime_type: mimetype,
          doc_base64: b64,
          created_by: req.user.username ?? String(senderId),
          status: 'active'
        }, { transaction: t });

        createdDocsMeta.push({
          document_id: doc.document_id ?? doc.id ?? null,
          doc_name: doc.doc_name,
          mime_type: doc.mime_type,
          created_on: doc.created_on
        });
      }
    }

    // commit
    await t.commit();

    // Notifications (fire-and-forget)
    (async () => {
      try {
        const ticketPlain = ticket.toJSON ? ticket.toJSON() : ticket;
        const replyPlain = reply ? (reply.toJSON ? reply.toJSON() : reply) : null;
        const sender = { username: req.user.username, email: req.user.email };

        if ((req.user && req.user.role_name === 'admin') || (req.user && req.user.role_name === 'executive')) {
          // notify owner
          const owner = await User.findByPk(ticket.user_id, { attributes: ['email', 'username'] });
          if (owner && owner.email) {
            try {
              const { subject, html, text } = ticketReplyTemplate({ ticket: ticketPlain, reply: replyPlain, sender });
              await sendMail({ to: owner.email, subject, html, text });
            } catch (mailErr) {
              console.error('Mail error (reply -> owner):', mailErr && mailErr.message ? mailErr.message : mailErr);
            }

            // Notify about status change
            if (statusChanged) {
              try {
                const { subject, html, text } = ticketStatusChangedTemplate({
                  ticket: ticketPlain,
                  oldStatus: ticket.prev_status,
                  newStatus: ticket.status,
                  admin: sender
                });
                await sendMail({ to: owner.email, subject, html, text });
              } catch (mailErr2) {
                console.error('Mail error (status change -> owner):', mailErr2 && mailErr2.message ? mailErr2.message : mailErr2);
              }
            }

            // ADD: Notify about priority change (you'll need to create this template)
            if (priorityChanged) {
              try {
                const { subject, html, text } = ticketPriorityChangedTemplate({
                  ticket: ticketPlain,
                  oldPriority: ticket.priority, // Note: you might want to store previous priority
                  newPriority: newPriority,
                  admin: sender
                });
                await sendMail({ to: owner.email, subject, html, text });
              } catch (mailErr3) {
                console.error('Mail error (priority change -> owner):', mailErr3 && mailErr3.message ? mailErr3.message : mailErr3);
              }
            }
          }
        } else {
          // user replied -> notify admins
          const admins = await User.findAll({ where: { role_name: 'admin', is_active: true }, attributes: ['email', 'username'] });
          const adminEmails = admins.map(a => a.email).filter(e => e && e !== req.user.email);
          if (adminEmails.length > 0) {
            try {
              const { subject, html, text } = ticketReplyTemplate({ ticket: ticketPlain, reply: replyPlain, sender });
              await sendMail({ to: adminEmails.join(','), subject, html, text });
            } catch (mailErr) {
              console.error('Mail error (reply -> admins):', mailErr && mailErr.message ? mailErr.message : mailErr);
            }
          }
        }
      } catch (outerMailErr) {
        console.error('Mail pipeline error:', outerMailErr && outerMailErr.message ? outerMailErr.message : outerMailErr);
      }
    })();

    // fetch reply with sender for response
    const replyWithSender = reply
      ? await TicketReply.findByPk(reply.reply_id, {
          include: [{ model: User, as: 'sender', attributes: ['user_id', 'username', 'email'] }]
        })
      : null;

    // prepare response
    const ticketPlain = ticket.toJSON ? ticket.toJSON() : ticket;
    
    // fetch ticket-level documents if any
    const ticketDocs = await Document.findAll({
      where: { linked_id: ticket.ticket_id, table_name: 'ticket' },
      attributes: ['document_id', 'doc_name', 'mime_type', 'created_on']
    });

    // attach assignee object if assigned
    let assigneeObj = null;
    if (ticketPlain.assigned_to) {
      const assigneeUser = await User.findByPk(ticketPlain.assigned_to);
      if (assigneeUser) {
        assigneeObj = {
          user_id: assigneeUser.user_id,
          username: assigneeUser.username,
          email: assigneeUser.email
        };
      }
    }

    const { response_sla_met, resolve_sla_met, sla } = await computeSLACompliance(ticketPlain);

    return res.status(201).json({
      message: 'Reply added',
      reply: replyWithSender,
      documents: createdDocsMeta,
      ticket: {
        ...ticketPlain,
        ticket_documents: ticketDocs.map(d => (d.toJSON ? d.toJSON() : d)),
        assignee: assigneeObj,
        sla,
        response_sla_met,
        resolve_sla_met
      }
    });
  } catch (err) {
    console.error('replyToTicket', err);
    try { await t.rollback(); } catch (e) { /* ignore */ }
    return res.status(500).json({ message: 'Internal server error' });
  }
};


exports.adminRequestClose = async (req, res) => {
  try {
    const { ticketId } = req.params;
    const ticket = await Ticket.findByPk(ticketId);
    if (!ticket) return res.status(404).json({ message: 'Ticket not found' });

    if (ticket.status === 'Closed' || ticket.status === 'Pending') {
      return res.status(400).json({ message: 'Ticket already closed or pending' });
    }

    ticket.prev_status = ticket.status;
    ticket.status = 'Pending';
    ticket.updated_at = new Date();
    ticket.last_updated_by = req.user.username ?? req.user.id ?? null;
    await ticket.save();

    await TicketReply.create({
      ticket_id: ticket.ticket_id,
      sender_id: req.user.id ?? req.user.user_id,
      sender_type: 'admin',
      message: 'Admin has requested to close this ticket. Please approve or decline.'
    });

    // notify owner
    (async () => {
      try {
        const owner = await User.findByPk(ticket.user_id, { attributes: ['email', 'username'] });
        const admin = { username: req.user.username, email: req.user.email };
        if (owner && owner.email) {
          const { subject, html, text } = ticketStatusChangedTemplate({ ticket: ticket.toJSON ? ticket.toJSON() : ticket, oldStatus: ticket.prev_status, newStatus: ticket.status, admin });
          await sendMail({ to: owner.email, subject, html, text });
        }
      } catch (e) {
        console.error('Mail error (adminRequestClose):', e && e.message ? e.message : e);
      }
    })();

    const plain = ticket.toJSON ? ticket.toJSON() : ticket;
    const { response_sla_met, resolve_sla_met, sla } = await computeSLACompliance(plain);

    return res.json({ message: 'Ticket marked Pending', ticket: { ...plain, sla, response_sla_met, resolve_sla_met } });
  } catch (err) {
    console.error('adminRequestClose', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

exports.adminUpdateStatus = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { ticketId } = req.params;
    const { status } = req.body;
    const allowed = ['Open', 'Pending', 'Resolved', 'Closed'];
    if (!allowed.includes(status)) {
      await t.rollback();
      return res.status(400).json({ message: 'Invalid status' });
    }

    const ticket = await Ticket.findByPk(ticketId, { transaction: t });
    if (!ticket) {
      await t.rollback();
      return res.status(404).json({ message: 'Ticket not found' });
    }

    const oldStatus = ticket.status;
    ticket.prev_status = ticket.status;
    ticket.status = status;
    ticket.updated_at = new Date();
    ticket.last_updated_by = req.user.username ?? req.user.id ?? null;

    if ((status === 'Resolved' || status === 'Closed') && !ticket.resolved_at) {
      const now = new Date();
      ticket.resolved_at = now;
      ticket.resolve_time_seconds = secondsBetween(ticket.created_at, now);
    }

    await ticket.save({ transaction: t });

    await TicketReply.create({
      ticket_id: ticket.ticket_id,
      sender_id: req.user.id ?? req.user.user_id,
      sender_type: 'admin',
      message: `Admin updated status to ${status}`
    }, { transaction: t });

    await t.commit();

    // notify owner
    (async () => {
      try {
        const owner = await User.findByPk(ticket.user_id, { attributes: ['email', 'username'] });
        const admin = { username: req.user.username, email: req.user.email };
        if (owner && owner.email) {
          const { subject, html, text } = ticketStatusChangedTemplate({ ticket: ticket.toJSON ? ticket.toJSON() : ticket, oldStatus, newStatus: status, admin });
          await sendMail({ to: owner.email, subject, html, text });
        }
      } catch (e) {
        console.error('Mail error (adminUpdateStatus):', e && e.message ? e.message : e);
      }
    })();

    const plain = ticket.toJSON ? ticket.toJSON() : ticket;
    const { response_sla_met, resolve_sla_met, sla } = await computeSLACompliance(plain);

    return res.json({ message: 'Status updated', ticket: { ...plain, sla, response_sla_met, resolve_sla_met } });
  } catch (err) {
    console.error('adminUpdateStatus', err);
    await t.rollback();
    return res.status(500).json({ message: 'Internal server error' });
  }
};

/* --------------------------
   User actions that affect resolve time
---------------------------*/

exports.userApproveClosure = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { ticketId } = req.params;
    const ticket = await Ticket.findByPk(ticketId, { transaction: t });
    if (!ticket) { await t.rollback(); return res.status(404).json({ message: 'Ticket not found' }); }
    const uid = req.user.id ?? req.user.user_id;
    if (ticket.user_id !== uid) { await t.rollback(); return res.status(403).json({ message: 'Only owner can approve' }); }
    if (ticket.status !== 'Pending') { await t.rollback(); return res.status(400).json({ message: 'Ticket not pending' }); }

    ticket.prev_status = ticket.status;
    ticket.status = 'Closed';
    ticket.updated_at = new Date();

    if (!ticket.resolved_at) {
      const now = new Date();
      ticket.resolved_at = now;
      ticket.resolve_time_seconds = secondsBetween(ticket.created_at, now);
    }

    await ticket.save({ transaction: t });

    await TicketReply.create({
      ticket_id: ticket.ticket_id,
      sender_id: uid,
      sender_type: 'user',
      message: 'User approved closure.'
    }, { transaction: t });

    await t.commit();

    // notify admins optionally
    (async () => {
      try {
        const admins = await User.findAll({ where: { role_name: 'admin', is_active: true }, attributes: ['email', 'username'] });
        const adminEmails = admins.map(a => a.email).filter(Boolean);
        if (adminEmails.length > 0) {
          const adminActor = { username: req.user.username, email: req.user.email };
          const { subject, html, text } = ticketStatusChangedTemplate({ ticket: ticket.toJSON ? ticket.toJSON() : ticket, oldStatus: ticket.prev_status, newStatus: ticket.status, admin: adminActor });
          await sendMail({ to: adminEmails.join(','), subject, html, text });
        }
      } catch (e) {
        console.error('Mail error (userApproveClosure):', e && e.message ? e.message : e);
      }
    })();

    const plain = ticket.toJSON ? ticket.toJSON() : ticket;
    const { response_sla_met, resolve_sla_met, sla } = await computeSLACompliance(plain);

    return res.json({ message: 'Ticket closed', ticket: { ...plain, sla, response_sla_met, resolve_sla_met } });
  } catch (err) {
    console.error('userApproveClosure', err);
    await t.rollback();
    return res.status(500).json({ message: 'Internal server error' });
  }
};

exports.userDeclineClosure = async (req, res) => {
  try {
    const { ticketId } = req.params;
    const ticket = await Ticket.findByPk(ticketId);
    if (!ticket) return res.status(404).json({ message: 'Ticket not found' });
    const uid = req.user.id ?? req.user.user_id;
    if (ticket.user_id !== uid) return res.status(403).json({ message: 'Only owner can decline' });
    if (ticket.status !== 'Pending') return res.status(400).json({ message: 'Ticket not pending' });

    const previous = ticket.prev_status || 'Open';
    ticket.status = previous;
    ticket.prev_status = null;
    ticket.updated_at = new Date();
    await ticket.save();

    await TicketReply.create({
      ticket_id: ticket.ticket_id,
      sender_id: uid,
      sender_type: 'user',
      message: 'User declined closure. Reopened for work.'
    });

    const plain = ticket.toJSON ? ticket.toJSON() : ticket;
    const { response_sla_met, resolve_sla_met, sla } = await computeSLACompliance(plain);

    return res.json({ message: 'Ticket reverted to previous status', ticket: { ...plain, sla, response_sla_met, resolve_sla_met } });
  } catch (err) {
    console.error('userDeclineClosure', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

exports.userReopenTicket = async (req, res) => {
  try {
    const { ticketId } = req.params;
    const ticket = await Ticket.findByPk(ticketId);
    if (!ticket) return res.status(404).json({ message: 'Ticket not found' });
    const uid = req.user.id ?? req.user.user_id;
    if (ticket.user_id !== uid) return res.status(403).json({ message: 'Only owner can reopen' });
    if (ticket.status !== 'Closed') return res.status(400).json({ message: 'Only closed tickets can be reopened' });

    ticket.prev_status = ticket.status;
    ticket.status = 'Pending';
    ticket.updated_at = new Date();
    await ticket.save();

    await TicketReply.create({
      ticket_id: ticket.ticket_id,
      sender_id: uid,
      sender_type: 'user',
      message: 'User reopened the ticket.'
    });

    const plain = ticket.toJSON ? ticket.toJSON() : ticket;
    const { response_sla_met, resolve_sla_met, sla } = await computeSLACompliance(plain);

    return res.json({ message: 'Ticket reopened', ticket: { ...plain, sla, response_sla_met, resolve_sla_met } });
  } catch (err) {
    console.error('userReopenTicket', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

/* --------------------------
   Create ticket
---------------------------*/







exports.raiseTicket = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    console.log('raiseTicket - req.body keys:', Object.keys(req.body));
    console.log('raiseTicket - req.body:', req.body);
    console.log('raiseTicket - req.files count:', (req.files && req.files.length) || 0);

    // Map frontend field names to backend expected names
    const moduleVal = req.body.category;
    const sub_module = req.body.subCategory;

    // NEW: Store whether this is an "Other" issue type
    const isOtherIssueType = req.body.issueType === 'Other';
    
    // Handle issue type - if it's "Other", use issueName, otherwise use issueType
    let category = req.body.issueType;
    let issue_name = null; // NEW: Store custom issue name separately
    
    if (isOtherIssueType && req.body.issueName) {
      issue_name = req.body.issueName; // Store custom issue name
      category = req.body.issueName; // Also store in category for display
    }

    const comment = req.body.comments || req.body.comment || '';
    const priority = req.body.priority || 'Medium';
    const priority_id = req.body.priority_id || null;

    console.log('Mapped values:', { 
      moduleVal, 
      sub_module, 
      category, 
      issue_name, 
      comment, 
      priority, 
      priority_id,
      isOtherIssueType 
    });

    if (!moduleVal || !category || !comment) {
      await t.rollback();
      return res.status(400).json({
        message: 'Module, category and comments are required',
        received: { moduleVal, category, comment }
      });
    }

    const userId = req.user && (req.user.id ?? req.user.user_id);
    if (!userId) {
      await t.rollback();
      return res.status(401).json({ message: 'Unauthorized' });
    }

    // FIXED: Use issueType_id for regular issues, not issueType name
    const issue_type_id = isOtherIssueType ? null : (req.body.issueType_id ? parseInt(req.body.issueType_id) : null);

    // NEW: Determine SLA ID based on user_id and issue_type_id
    let slaId = null;
    
    if (req.body.sla_id=="00") {
      // If SLA ID is explicitly provided in request, use it
      const parsed = parseInt(req.body.sla_id, 10);
      if (!Number.isNaN(parsed)) slaId = parsed;
    } else if (issue_type_id && !isOtherIssueType) {
      // For regular issue types, find SLA for this user + issue type combination
      try {
        // Get the primary SLA (fastest response time) for this user and issue type
        const slaRec = await SLA.findOne({
          where: {
            user_id: userId,
            issue_type_id: issue_type_id,
            is_active: true
          },
          order: [
            ['response_target_minutes', 'ASC'], // Fastest response first
            ['resolve_target_minutes', 'ASC']   // Then fastest resolve
          ],
          transaction: t
        });

        if (slaRec) {
          slaId = slaRec.sla_id;
          console.log(`Found SLA for user ${userId} and issue type ${issue_type_id}: SLA ID ${slaId}`);
        } else {
          console.log(`No active SLA found for user ${userId} and issue type ${issue_type_id}`);
          // Option 1: Use default SLA ID = 1 as fallback
          slaId = 1;
          console.log(`Using default SLA ID: ${slaId}`);
          
          // Option 2: Leave it null and handle in SLA compliance calculation
          // slaId = null;
        }
      } catch (slaError) {
        console.error('Error finding SLA:', slaError);
        // Fallback to default SLA ID
        slaId = 1;
        console.log(`Error occurred, using default SLA ID: ${slaId}`);
      }
    } else if (isOtherIssueType) {
      // For "Other" issue types, use default SLA ID = 1
      slaId = 1;
      console.log(`Using default SLA ID for "Other" issue type: ${slaId}`);
    } else {
      // No issue_type_id and not "Other" type - use default
      slaId = 1;
      console.log(`Using default SLA ID as fallback: ${slaId}`);
    }
if (slaId) {
  const slaRecord = await SLA.findByPk(slaId, {
    include: [
      {
        model: WorkingHours,
        as: 'working_hours',
        attributes: ['working_hours_id', 'working_days', 'start_time', 'end_time', 'timezone']
      }
    ],
    transaction: t
  });

  if (slaRecord && slaRecord.working_hours) {
    const createdDate = new Date();
    
    // Calculate response due date
    if (slaRecord.response_target_minutes) {
      const responseDueDate = SLACalculator.calculateDueDate(
        createdDate,
        slaRecord.response_target_minutes,
        slaRecord.working_hours
      );
      // You might want to store this in the ticket
      ticket.response_due_date = responseDueDate;
    }

    // Calculate resolve due date
    if (slaRecord.resolve_target_minutes) {
      const resolveDueDate = SLACalculator.calculateDueDate(
        createdDate,
        slaRecord.resolve_target_minutes,
        slaRecord.working_hours
      );
      // You might want to store this in the ticket
      ticket.resolve_due_date = resolveDueDate;
    }
  }
}




    // Create ticket with mapped fields - INCLUDING issue_type_id and issue_name
    const ticket = await Ticket.create({
      user_id: userId,
      module: moduleVal,
      sub_module: sub_module,
      category: category,
      issue_type_id: issue_type_id, // FIXED: Use the ID, not the name
      issue_name: issue_name, // Store custom issue name for "Other" type
      comment: comment,
      status: 'Open',
      sla_id: slaId,
      priority: priority,
      priority_id: priority_id,
      is_other_issue: isOtherIssueType // NEW: Flag to identify "Other" issue type
    }, { transaction: t });

    // Handle file uploads
    const ticketDocsMeta = [];
    const files = req.files && Array.isArray(req.files) ? req.files : [];
    if (files.length > 0) {
      const docsToCreate = files.map((file) => {
        return {
          linked_id: ticket.ticket_id ?? ticket.id,
          table_name: 'ticket',
          type: (file.mimetype || '').startsWith('image/') ? 'image' : 'attachment',
          doc_name: file.originalname || file.filename || 'upload',
          mime_type: file.mimetype || 'application/octet-stream',
          doc_base64: file.buffer ? file.buffer.toString('base64') : null,
          created_by: req.user.username ?? String(userId),
          status: 'active'
        };
      });
      const created = await Document.bulkCreate(docsToCreate, { transaction: t });
      created.forEach((d) => {
        ticketDocsMeta.push({
          document_id: d.document_id ?? d.id ?? null,
          doc_name: d.doc_name,
          mime_type: d.mime_type,
          created_on: d.created_on
        });
      });
    }

    await t.commit();

    const ticketPlain = ticket.toJSON ? ticket.toJSON() : ticket;

    let slaRecord = null;
    if (ticketPlain.sla_id) {
      slaRecord = await SLA.findByPk(ticketPlain.sla_id, {
        include: [
          {
            model: IssueType,
            as: 'issue_type',
            attributes: ['issue_type_id', 'name']
          }
        ]
      });
    }

    const { response_sla_met, resolve_sla_met } = await computeSLACompliance(ticketPlain);
    const responseTicket = {
      ...ticketPlain,
      ticket_documents: ticketDocsMeta,
      sla: slaRecord ? (slaRecord.toJSON ? slaRecord.toJSON() : slaRecord) : null,
      response_sla_met,
      resolve_sla_met,
      is_other_issue: isOtherIssueType // Include in response
    };

    // Log SLA assignment details
    console.log('Ticket created with SLA details:', {
      ticket_id: responseTicket.ticket_id,
      user_id: userId,
      issue_type_id: issue_type_id,
      sla_id: slaId,
      is_other_issue: isOtherIssueType
    });

    // Notify admins
    (async () => {
      try {
        const admins = await User.findAll({ where: { role_name: 'admin', is_active: true }, attributes: ['email', 'username'] });
        const adminEmails = admins.map(a => a.email).filter(Boolean);
        if (adminEmails.length > 0) {
          const creator = { username: req.user.username || req.user.email, email: req.user.email };
          const { subject, html, text } = ticketCreatedTemplate({ ticket: responseTicket, creator });
          await sendMail({ to: adminEmails.join(','), subject, html, text });
        }
      } catch (mailErr) {
        console.error('Mail error (ticket created):', mailErr && mailErr.message ? mailErr.message : mailErr);
      }
    })();

    return res.status(201).json({ 
      message: 'Ticket raised successfully', 
      ticket: responseTicket,
      sla_assignment: {
        method: req.body.sla_id ? 'manual' : (isOtherIssueType ? 'default_other' : 'auto_user_issue_type'),
        sla_id: slaId
      }
    });
  } catch (err) {
    console.error('raiseTicket error:', err);
    try { await t.rollback(); } catch (e) { /* ignore */ }
    return res.status(500).json({ message: 'Internal server error: ' + err.message });
  }
};




exports.getDocument = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const doc = await Document.findByPk(id);
    if (!doc) return res.status(404).json({ message: 'Not found' });

    if (doc.doc_base64) {
      const buffer = Buffer.from(doc.doc_base64, 'base64');
      res.setHeader('Content-Type', doc.mime_type || 'application/octet-stream');
      res.setHeader('Content-Disposition', `attachment; filename="${doc.doc_name || 'file'}"`);
      return res.send(buffer);
    } else {
      return res.status(404).json({ message: 'No binary content' });
    }
  } catch (err) {
    console.error('getDocument', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};



// GET /api/ticket/my-tickets
exports.getUserTickets = async (req, res) => {
  try {
    const uid = req.user.id ?? req.user.user_id;
    const tickets = await Ticket.findAll({
      where: { user_id: uid },
      include: [
        { model: User, as: 'creator', attributes: ['user_id', 'username', 'email', 'first_name', 'last_name'] },
        {
          model: TicketReply,
          as: 'replies',
          include: [
            { model: User, as: 'sender', attributes: ['user_id', 'username', 'email'] },
            { model: Document, as: 'documents', attributes: ['document_id', 'doc_name', 'mime_type', 'doc_base64', 'created_on'] }
          ],
        },
        { model: Document, as: 'documents', attributes: ['document_id', 'doc_name', 'mime_type', 'doc_base64', 'created_on'] }, // ticket-level docs
        { model: SLA, as: 'sla' }
      ],
      // top-level order: replies ascending, tickets newest first
      order: [
        // order replies by created_at ASC
        [{ model: TicketReply, as: 'replies' }, 'created_at', 'ASC'],
        // then tickets by created_at DESC
        ['created_at', 'DESC']
      ]
    });

    // JS-side safeguard: ensure replies sorted ascending by created_at
    const ticketsWithSLA = await Promise.all(
      tickets.map(async (t) => {
        const plain = t.toJSON ? t.toJSON() : t;
        if (Array.isArray(plain.replies)) {
          plain.replies.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
        }
        const { response_sla_met, resolve_sla_met, sla } = await computeSLACompliance(plain);
        plain.sla = sla ? (sla.toJSON ? sla.toJSON() : sla) : plain.sla ?? null;
        plain.response_sla_met = response_sla_met;
        plain.resolve_sla_met = resolve_sla_met;
        return plain;
      })
    );

    return res.json({ tickets: ticketsWithSLA });
  } catch (err) {
    console.error('getUserTickets', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

// GET /api/ticket/:ticketId
exports.getTicketById = async (req, res) => {
  try {
    const { ticketId } = req.params;
    const ticket = await Ticket.findByPk(ticketId, {
      include: [
        {
          model: TicketReply,
          as: 'replies',
          include: [
            { model: User, as: 'sender', attributes: ['user_id', 'username', 'email'] },
            { model: Document, as: 'documents', attributes: ['document_id', 'doc_name', 'mime_type', 'doc_base64', 'created_on'] }
          ],
        },
        { model: User, as: 'creator', attributes: ['user_id', 'username', 'email', 'first_name', 'last_name'] },
        { model: SLA, as: 'sla' },
        { model: Document, as: 'documents', attributes: ['document_id', 'doc_name', 'doc_base64', 'mime_type', 'created_on'] }
      ],
      // order replies by created_at ascending for this single-ticket fetch
      order: [
        [{ model: TicketReply, as: 'replies' }, 'created_at', 'ASC']
      ]
    });

    if (!ticket) return res.status(404).json({ message: 'Ticket not found' });
    if (!(await ensureOwnerOrAdmin(req, ticket))) return res.status(403).json({ message: 'Forbidden' });

    const plain = ticket.toJSON ? ticket.toJSON() : ticket;

    // JS fallback sort to guarantee order
    if (Array.isArray(plain.replies)) {
      plain.replies.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    }

    const { response_sla_met, resolve_sla_met, sla } = await computeSLACompliance(plain);
    plain.sla = sla ? (sla.toJSON ? sla.toJSON() : sla) : plain.sla ?? null;
    plain.response_sla_met = response_sla_met;
    plain.resolve_sla_met = resolve_sla_met;
    plain.created_by_username = plain.creator?.username || 'Unknown';

    return res.json({ ticket: plain });
  } catch (err) {
    console.error('getTicketById', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};





// GET /api/ticket/admin/all
exports.adminGetAllTickets = async (req, res) => {
  try {
    const tickets = await Ticket.findAll({
      include: [
        {
          model: TicketReply,
          as: 'replies',
          include: [
            { model: User, as: 'sender', attributes: ['user_id', 'username'] },
            { model: Document, as: 'documents', attributes: ['document_id', 'doc_name', 'doc_base64', 'mime_type', 'created_on'] }
          ]
        },
        { model: User, as: 'creator', attributes: ['user_id', 'username', 'email'] },
        { model: Document, as: 'documents', attributes: ['document_id', 'doc_name', 'doc_base64', 'mime_type', 'created_on'] },
        { model: SLA, as: 'sla' }
      ],
      order: [
        // replies ascending
        [{ model: TicketReply, as: 'replies' }, 'created_at', 'ASC'],
        // tickets descending
        ['created_at', 'DESC']
      ]
    });

    // const ticketsWithSLA = await Promise.all(
    //   tickets.map(async (t) => {
    //     const plain = t.toJSON ? t.toJSON() : t;
    //     if (Array.isArray(plain.replies)) {
    //       plain.replies.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    //     }
    //     const { response_sla_met, resolve_sla_met, sla } = await computeSLACompliance(plain);
    //     plain.sla = sla ? (sla.toJSON ? sla.toJSON() : sla) : plain.sla ?? null;
    //     plain.response_sla_met = response_sla_met;
    //     plain.resolve_sla_met = resolve_sla_met;
    //     return plain;
    //   })
    // );


    // In both adminGetAllTickets and getUserTickets, add this line in the mapping function:
const ticketsWithSLA = await Promise.all(
  tickets.map(async (t) => {
    const plain = t.toJSON ? t.toJSON() : t;
    if (Array.isArray(plain.replies)) {
      plain.replies.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    }
    const { response_sla_met, resolve_sla_met, sla } = await computeSLACompliance(plain);
    plain.sla = sla ? (sla.toJSON ? sla.toJSON() : sla) : plain.sla ?? null;
    plain.response_sla_met = response_sla_met;
    plain.resolve_sla_met = resolve_sla_met;
    
    // ADD THIS LINE to ensure is_other_issue is included
    plain.is_other_issue = plain.is_other_issue ?? false;
    
    return plain;
  })
);

    return res.json({ tickets: ticketsWithSLA });
  } catch (err) {
    console.error('adminGetAllTickets', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};



exports.assignTicket = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { ticketId } = req.params;
    const { assigned_to } = req.body; // user id of executive
    if (!assigned_to) { await t.rollback(); return res.status(400).json({ message: 'assigned_to required' }); }

    // check admin
    if (!req.user || req.user.role_name !== 'admin') {
      await t.rollback();
      return res.status(403).json({ message: 'Only admins can assign tickets' });
    }

    const ticket = await Ticket.findByPk(ticketId, { transaction: t });
    if (!ticket) { await t.rollback(); return res.status(404).json({ message: 'Ticket not found' }); }

    // verify assignee exists and is executive
    const assignee = await User.findByPk(assigned_to);
    if (!assignee || assignee.role_name !== 'executive') {
      await t.rollback();
      return res.status(400).json({ message: 'Assignee must be an executive user' });
    }

    ticket.assigned_to = assigned_to;
    ticket.updated_at = new Date();
    ticket.last_updated_by = req.user.username ?? req.user.id ?? null;
    await ticket.save({ transaction: t });

    // create an admin reply log that admin assigned to executive (optional)
    await TicketReply.create({
      ticket_id: ticket.ticket_id,
      sender_id: req.user.id ?? req.user.user_id,
      sender_type: 'admin',
      message: `Assigned to ${assignee.username}`
    }, { transaction: t });

    await t.commit();

    // notify the executive (fire-and-forget)
    (async () => {
      try {
        if (assignee.email) {
          const subject = `Ticket #${ticket.ticket_id} assigned to you`;
          const text = `Ticket ${ticket.ticket_id} has been assigned to you.`;
          await sendMail({ to: assignee.email, subject, text });
        }
      } catch (e) { console.error('mail error', e); }
    })();

    return res.json({ message: 'Ticket assigned', ticket: ticket.toJSON ? ticket.toJSON() : ticket });
  } catch (err) {
    console.error('assignTicket', err);
    try { await t.rollback(); } catch (e) {}
    return res.status(500).json({ message: 'Internal server error' });
  }
};



exports.execGetAssignedTickets = async (req, res) => {
  try {
    const uid = req.user.id ?? req.user.user_id;
    if (!req.user || req.user.role_name !== 'executive') return res.status(403).json({ message: 'Forbidden' });

    const tickets = await Ticket.findAll({
      where: { assigned_to: uid },
      include: [
        { model: TicketReply, as: 'replies', include: [{ model: User, as: 'sender' }, { model: Document, as: 'documents' }] },
        { model: User, as: 'creator', attributes: ['user_id','username','email'] },
        { model: Document, as: 'documents' },
        { model: SLA, as: 'sla' }
      ],
      order: [
        [{ model: TicketReply, as: 'replies'}, 'created_at', 'ASC'],
        ['created_at','DESC']
      ]
    });

    // compute SLA etc (you already have computeSLACompliance)
    // const resp = await Promise.all(tickets.map(async (t) => {
    //   const plain = t.toJSON ? t.toJSON() : t;
    //   const { response_sla_met, resolve_sla_met, sla } = await computeSLACompliance(plain);
    //   plain.sla = sla ? (sla.toJSON ? sla.toJSON() : sla) : plain.sla;
    //   plain.response_sla_met = response_sla_met;
    //   plain.resolve_sla_met = resolve_sla_met;
    //   return plain;
    // }));


    // In both adminGetAllTickets and getUserTickets, add this line in the mapping function:
const resp = await Promise.all(
  tickets.map(async (t) => {
    const plain = t.toJSON ? t.toJSON() : t;
    if (Array.isArray(plain.replies)) {
      plain.replies.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    }
    const { response_sla_met, resolve_sla_met, sla } = await computeSLACompliance(plain);
    plain.sla = sla ? (sla.toJSON ? sla.toJSON() : sla) : plain.sla ?? null;
    plain.response_sla_met = response_sla_met;
    plain.resolve_sla_met = resolve_sla_met;
    
    // ADD THIS LINE to ensure is_other_issue is included
    plain.is_other_issue = plain.is_other_issue ?? false;
    
    return plain;
  })
);

    return res.json({ tickets: resp });
  } catch (err) {
    console.error('execGetAssignedTickets', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};



// Add this function to your ticketController.js
exports.updateTicketPriority = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { ticketId } = req.params;
    const { priority, priority_id } = req.body;
    const userId = req.user && (req.user.id ?? req.user.user_id);

    if (!userId) {
      await t.rollback();
      return res.status(401).json({ message: 'Unauthorized' });
    }

    // Find the ticket
    const ticket = await Ticket.findByPk(ticketId, { transaction: t });
    if (!ticket) {
      await t.rollback();
      return res.status(404).json({ message: 'Ticket not found' });
    }

    // Check if user is admin
    const user = await User.findByPk(userId);
    if (!user || user.role_name !== 'admin') {
      await t.rollback();
      return res.status(403).json({ message: 'Only admins can update ticket priority' });
    }

    // Validate that priority is provided
    if (!priority) {
      await t.rollback();
      return res.status(400).json({ message: 'Priority is required' });
    }

    // Update priority
    await ticket.update({
      priority: priority,
      priority_id: priority_id,
      last_updated_by: user.username,
      updated_at: new Date()
    }, { transaction: t });

    await t.commit();

    // Get the updated ticket with all relations
    const updatedTicket = await Ticket.findByPk(ticketId, {
      include: [
        {
          model: TicketReply,
          as: 'replies',
          include: [
            { model: User, as: 'sender', attributes: ['user_id', 'username', 'email'] },
            { model: Document, as: 'documents', attributes: ['document_id', 'doc_name', 'mime_type', 'doc_base64', 'created_on'] }
          ],
        },
        { model: User, as: 'creator', attributes: ['user_id', 'username', 'email', 'first_name', 'last_name'] },
        { model: SLA, as: 'sla' },
        { model: Document, as: 'documents', attributes: ['document_id', 'doc_name', 'doc_base64', 'mime_type', 'created_on'] }
      ],
      order: [
        [{ model: TicketReply, as: 'replies' }, 'created_at', 'ASC']
      ]
    });

    const plainTicket = updatedTicket.toJSON ? updatedTicket.toJSON() : updatedTicket;

    // Compute SLA compliance
    const { response_sla_met, resolve_sla_met, sla } = await computeSLACompliance(plainTicket);
    
    // Prepare response
    const responseTicket = {
      ...plainTicket,
      sla: sla ? (sla.toJSON ? sla.toJSON() : sla) : plainTicket.sla ?? null,
      response_sla_met,
      resolve_sla_met,
      created_by_username: plainTicket.creator?.username || 'Unknown'
    };

    return res.status(200).json({ 
      message: 'Ticket priority updated successfully', 
      ticket: responseTicket 
    });
  } catch (err) {
    console.error('updateTicketPriority error:', err);
    try { await t.rollback(); } catch (e) { /* ignore */ }
    return res.status(500).json({ message: 'Internal server error: ' + err.message });
  }
};