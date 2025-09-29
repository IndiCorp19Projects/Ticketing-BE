// controllers/ticketController.js
const { Ticket, TicketReply, TicketImage, sequelize, User, SLA } = require('../models');
const { sendMail } = require('../utils/mailer');
const { ticketCreatedTemplate, ticketReplyTemplate, ticketStatusChangedTemplate } = require('../utils/emailTemplates');

const ensureOwnerOrAdmin = async (req, ticket) => {
  if (!ticket) return false;
  if (req.user && req.user.role_name === 'admin') return true;
  // req.user may have id or user_id depending on your auth
  const uid = req.user && (req.user.id ?? req.user.user_id);
  return ticket.user_id === uid;
};

function secondsBetween(a, b) {
  if (!a || !b) return null;
  return Math.floor((new Date(b).getTime() - new Date(a).getTime()) / 1000);
}

/**
 * Compute SLA compliance flags for a ticket (non-persistent; returned in API)
 * returns object with response_sla_met (bool|null) and resolve_sla_met (bool|null)
 */
async function computeSLACompliance(ticket) {
  if (!ticket) return { response_sla_met: null, resolve_sla_met: null, sla: null };

  // If ticket has association `sla` already (eager loaded) use it, otherwise fetch if sla_id present
  let sla = ticket.sla ?? null;
  if (!sla && ticket.sla_id) {
    sla = await SLA.findByPk(ticket.sla_id);
  }

  let response_sla_met = null;
  let resolve_sla_met = null;

  if (sla) {
    if (ticket.response_time_seconds != null) {
      response_sla_met = ticket.response_time_seconds <= (sla.response_target_minutes * 60);
    }
    if (ticket.resolve_time_seconds != null) {
      resolve_sla_met = ticket.resolve_time_seconds <= (sla.resolve_target_minutes * 60);
    }
  }

  return { response_sla_met, resolve_sla_met, sla };
}

/* --------------------------
   READ endpoints (list / detail)
   -------------------------*/

exports.getUserTickets = async (req, res) => {
  try {
    const tickets = await Ticket.findAll({
      where: { user_id: req.user.id ?? req.user.user_id },
      include: [
        {
          model: User,
          as: 'creator',
          attributes: ['user_id', 'username', 'email', 'first_name', 'last_name']
        },
        { model: TicketReply, as: 'replies', include: [{ model: User, as: 'sender', attributes: ['user_id', 'username', 'email'] }] },
        { model: SLA, as: 'sla' }
      ],
      order: [['created_at', 'DESC']],
    });

    const ticketsWithSLA = await Promise.all(
      tickets.map(async (t) => {
        const plain = t.toJSON ? t.toJSON() : t;
        const { response_sla_met, resolve_sla_met, sla } = await computeSLACompliance(plain);
        plain.sla = sla ? sla : plain.sla ?? null;
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

exports.getTicketById = async (req, res) => {
  try {
    const { ticketId } = req.params;
    const ticket = await Ticket.findByPk(ticketId, {
      include: [
        {
          model: TicketReply,
          as: 'replies',
          include: [{ model: User, as: 'sender', attributes: ['user_id', 'username', 'email'] }]
        },
        {
          model: User,
          as: 'creator',
          attributes: ['user_id', 'username', 'email', 'first_name', 'last_name']
        },
        {
          model: SLA,
          as: 'sla'
        },
        // if you want image metadata, you can include images:
        {
          model: TicketImage,
          as: 'images',
          attributes: ['id', 'filename', 'mimetype', 'created_on']
        }
      ],
    });
    if (!ticket) return res.status(404).json({ message: 'Ticket not found' });

    if (!(await ensureOwnerOrAdmin(req, ticket))) return res.status(403).json({ message: 'Forbidden' });

    const plain = ticket.toJSON ? ticket.toJSON() : ticket;
    const { response_sla_met, resolve_sla_met, sla } = await computeSLACompliance(plain);
    plain.sla = sla ? sla : plain.sla ?? null;
    plain.response_sla_met = response_sla_met;
    plain.resolve_sla_met = resolve_sla_met;
    plain.created_by_username = plain.creator?.username || 'Unknown';

    return res.json({ ticket: plain });
  } catch (err) {
    console.error('getTicketById', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

/* --------------------------
   Reply endpoint
   -------------------------*/

exports.replyToTicket = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { ticketId } = req.params;
    const { message } = req.body;
    if (!message) {
      await t.rollback();
      return res.status(400).json({ message: 'message is required' });
    }

    const ticket = await Ticket.findByPk(ticketId, { transaction: t });
    if (!ticket) {
      await t.rollback();
      return res.status(404).json({ message: 'Ticket not found' });
    }

    if (!(await ensureOwnerOrAdmin(req, ticket))) {
      await t.rollback();
      return res.status(403).json({ message: 'Forbidden' });
    }

    const sender_type = req.user.role_name === 'admin' ? 'admin' : 'user';

    // If first admin reply -> set response_at and response_time_seconds
    if (sender_type === 'admin' && !ticket.response_at) {
      const now = new Date();
      ticket.response_at = now;
      ticket.response_time_seconds = secondsBetween(ticket.created_at, now);
      ticket.last_updated_by = req.user.username ?? req.user.id ?? null;
      if (ticket.status === 'Open') {
        ticket.prev_status = ticket.status;
        ticket.status = 'In Progress';
      }
      ticket.updated_at = new Date();
      await ticket.save({ transaction: t });
    } else if (sender_type === 'admin') {
      ticket.last_updated_by = req.user.username ?? req.user.id ?? null;
      ticket.updated_at = new Date();
      if (ticket.status === 'Open') {
        ticket.prev_status = ticket.status;
        ticket.status = 'In Progress';
      }
      await ticket.save({ transaction: t });
    }

    const reply = await TicketReply.create({
      ticket_id: ticket.ticket_id,
      sender_id: req.user.id ?? req.user.user_id,
      sender_type,
      message,
    }, { transaction: t });

    await t.commit();

    // send notifications AFTER commit (errors logged but do not break API)
    (async () => {
      try {
        const ticketPlain = ticket.toJSON ? ticket.toJSON() : ticket;
        const replyPlain = reply.toJSON ? reply.toJSON() : reply;
        const sender = { username: req.user.username, email: req.user.email };

        if (sender_type === 'admin') {
          // notify ticket owner
          const owner = await User.findByPk(ticket.user_id, { attributes: ['email', 'username'] });
          if (owner && owner.email) {
            const { subject, html, text } = ticketReplyTemplate({ ticket: ticketPlain, reply: replyPlain, sender });
            await sendMail({ to: owner.email, subject, html, text });
          }
        } else {
          // user replied -> notify all admins (except the author)
          const admins = await User.findAll({ where: { role_name: 'admin', is_active: true }, attributes: ['email', 'username'] });
          const adminEmails = admins.map(a => a.email).filter(e => e && e !== req.user.email);
          if (adminEmails.length > 0) {
            const { subject, html, text } = ticketReplyTemplate({ ticket: ticketPlain, reply: replyPlain, sender });
            await sendMail({ to: adminEmails.join(','), subject, html, text });
          }
        }
      } catch (mailErr) {
        console.error('Mail error (reply):', mailErr && mailErr.message ? mailErr.message : mailErr);
      }
    })();

    // return the reply with sender info
    const replyWithSender = await TicketReply.findByPk(reply.reply_id, {
      include: [{ model: User, as: 'sender', attributes: ['user_id', 'username', 'email'] }]
    });

    const ticketPlain = ticket.toJSON ? ticket.toJSON() : ticket;
    const { response_sla_met, resolve_sla_met, sla } = await computeSLACompliance(ticketPlain);

    return res.status(201).json({
      message: 'Reply added',
      reply: replyWithSender,
      ticket: {
        ...ticketPlain,
        sla,
        response_sla_met,
        resolve_sla_met
      }
    });
  } catch (err) {
    console.error('replyToTicket', err);
    await t.rollback();
    return res.status(500).json({ message: 'Internal server error' });
  }
};

/* --------------------------
   Admin endpoints
   -------------------------*/

exports.adminGetAllTickets = async (req, res) => {
  try {
    const tickets = await Ticket.findAll({
      include: [
        { model: TicketReply, as: 'replies', include: [{ model: User, as: 'sender', attributes: ['user_id', 'username'] }] },
        { model: User, as: 'creator', attributes: ['user_id', 'username', 'email'] },
        { model: SLA, as: 'sla' }
      ],
      order: [['created_at', 'DESC']],
    });

    const ticketsWithSLA = await Promise.all(
      tickets.map(async (t) => {
        const plain = t.toJSON ? t.toJSON() : t;
        const { response_sla_met, resolve_sla_met, sla } = await computeSLACompliance(plain);
        plain.sla = sla ? sla : plain.sla ?? null;
        plain.response_sla_met = response_sla_met;
        plain.resolve_sla_met = resolve_sla_met;
        return plain;
      })
    );

    return res.json({ tickets: ticketsWithSLA });
  } catch (err) {
    console.error('adminGetAllTickets', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

exports.adminRequestClose = async (req, res) => {
  try {
    const { ticketId } = req.params;
    const ticket = await Ticket.findByPk(ticketId);
    if (!ticket) return res.status(404).json({ message: 'Ticket not found' });

    if (ticket.status === 'Closed' || ticket.status === 'Pending Closure') {
      return res.status(400).json({ message: 'Ticket already closed or pending' });
    }

    ticket.prev_status = ticket.status;
    ticket.status = 'Pending Closure';
    ticket.updated_at = new Date();
    ticket.last_updated_by = req.user.username ?? req.user.id ?? null;
    await ticket.save();

    await TicketReply.create({
      ticket_id: ticket.ticket_id,
      sender_id: req.user.id,
      sender_type: 'admin',
      message: 'Admin has requested to close this ticket. Please approve or decline.',
    });

    // notify owner after change (fire & forget)
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

    return res.json({ message: 'Ticket marked Pending Closure', ticket: { ...plain, sla, response_sla_met, resolve_sla_met } });
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
    const allowed = ['Open', 'In Progress', 'Resolved', 'Pending Closure', 'Reopened'];
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

    if (['Resolved'].includes(status) && !ticket.resolved_at) {
      const now = new Date();
      ticket.resolved_at = now;
      ticket.resolve_time_seconds = secondsBetween(ticket.created_at, now);
    }

    await ticket.save({ transaction: t });

    await TicketReply.create({
      ticket_id: ticket.ticket_id,
      sender_id: req.user.id,
      sender_type: 'admin',
      message: `Admin updated status to ${status}`,
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
   -------------------------*/

exports.userApproveClosure = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { ticketId } = req.params;
    const ticket = await Ticket.findByPk(ticketId, { transaction: t });
    if (!ticket) { await t.rollback(); return res.status(404).json({ message: 'Ticket not found' }); }
    if (ticket.user_id !== (req.user.id ?? req.user.user_id)) { await t.rollback(); return res.status(403).json({ message: 'Only owner can approve' }); }
    if (ticket.status !== 'Pending Closure') { await t.rollback(); return res.status(400).json({ message: 'Ticket not pending closure' }); }

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
      sender_id: req.user.id ?? req.user.user_id,
      sender_type: 'user',
      message: 'User approved closure.',
    }, { transaction: t });

    await t.commit();

    // notify admins about closure (optional) and return ticket
    (async () => {
      try {
        const admins = await User.findAll({ where: { role_name: 'admin', is_active: true }, attributes: ['email','username'] });
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
    if (ticket.user_id !== (req.user.id ?? req.user.user_id)) return res.status(403).json({ message: 'Only owner can decline' });
    if (ticket.status !== 'Pending Closure') return res.status(400).json({ message: 'Ticket not pending closure' });

    const previous = ticket.prev_status || 'Open';
    ticket.status = previous;
    ticket.prev_status = null;
    ticket.updated_at = new Date();
    await ticket.save();

    await TicketReply.create({
      ticket_id: ticket.ticket_id,
      sender_id: req.user.id ?? req.user.user_id,
      sender_type: 'user',
      message: 'User declined closure. Reopened for work.',
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
    if (ticket.user_id !== (req.user.id ?? req.user.user_id)) return res.status(403).json({ message: 'Only owner can reopen' });
    if (ticket.status !== 'Closed') return res.status(400).json({ message: 'Only closed tickets can be reopened' });

    ticket.prev_status = ticket.status;
    ticket.status = 'Reopened';
    ticket.updated_at = new Date();
    await ticket.save();

    await TicketReply.create({
      ticket_id: ticket.ticket_id,
      sender_id: req.user.id ?? req.user.user_id,
      sender_type: 'user',
      message: 'User reopened the ticket.',
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
   -------------------------*/

exports.raiseTicket = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    // Debug
    console.log('raiseTicket - req.body keys:', Object.keys(req.body));
    console.log('raiseTicket - req.files count:', (req.files && req.files.length) || 0);

    const moduleVal = req.body.module ?? req.body.modules;
    const sub_module = req.body.sub_module ?? req.body.submodule ?? req.body.subModule ?? '';
    const category = req.body.category;
    const comment = req.body.comment ?? req.body.comments ?? req.body.description ?? '';

    if (!moduleVal || !category || !comment) {
      await t.rollback();
      return res.status(400).json({ message: 'module, category and comment are required' });
    }

    // Determine SLA id
    let slaId = null;
    if (req.body.sla_id) {
      const parsed = parseInt(req.body.sla_id, 10);
      if (!Number.isNaN(parsed)) slaId = parsed;
    }
    if (!slaId && req.body.issue_type) {
      const issueType = String(req.body.issue_type).trim();
      const slaRec = await SLA.findOne({ where: { issue_type: issueType, is_active: true } });
      if (slaRec) slaId = slaRec.sla_id;
    }
    if (!slaId && category) {
      const slaRec = await SLA.findOne({
        where: sequelize.where(
          sequelize.fn('lower', sequelize.col('issue_type')),
          sequelize.fn('lower', category)
        )
      });
      if (slaRec && slaRec.is_active) slaId = slaRec.sla_id;
    }

    const userId = req.user && (req.user.id ?? req.user.user_id);
    if (!userId) {
      await t.rollback();
      return res.status(401).json({ message: 'Unauthorized' });
    }

    // Create ticket
    const ticket = await Ticket.create({
      user_id: userId,
      module: moduleVal,
      sub_module,
      category,
      comment,
      status: 'Open',
      sla_id: slaId
    }, { transaction: t });

    // Save files
    let imagesMeta = [];
    if (req.files && Array.isArray(req.files) && req.files.length > 0) {
      if (TicketImage) {
        const imagesToCreate = req.files.map((file) => ({
          ticket_id: ticket.ticket_id ?? ticket.id,
          filename: file.originalname,
          mimetype: file.mimetype,
          data: file.buffer
        }));
        const createdImages = await TicketImage.bulkCreate(imagesToCreate, { transaction: t });
        imagesMeta = createdImages.map((img) => ({
          id: img.id ?? img.image_id ?? null,
          filename: img.filename,
          mimetype: img.mimetype,
          created_on: img.created_on
        }));
      } else {
        const file = req.files[0];
        ticket.screenshot_url = file.buffer;
        await ticket.save({ transaction: t });
        imagesMeta = [{
          id: null,
          filename: file.originalname,
          mimetype: file.mimetype,
          note: 'stored in ticket.screenshot_url'
        }];
      }
    } else if (req.body.screenshot_url) {
      const dataUrl = String(req.body.screenshot_url);
      const m = dataUrl.match(/^data:(.+);base64,(.+)$/);
      if (m) {
        const mimetype = m[1];
        const b64 = m[2];
        const buffer = Buffer.from(b64, 'base64');
        if (TicketImage) {
          const created = await TicketImage.create({
            ticket_id: ticket.ticket_id ?? ticket.id,
            filename: req.body.screenshot_name ?? `upload.${mimetype.split('/')[1]}`,
            mimetype,
            data: buffer
          }, { transaction: t });
          imagesMeta = [{
            id: created.id ?? null,
            filename: created.filename,
            mimetype: created.mimetype,
            created_on: created.created_on
          }];
        } else {
          ticket.screenshot_url = buffer;
          await ticket.save({ transaction: t });
          imagesMeta = [{
            id: null,
            filename: req.body.screenshot_name ?? `upload.${mimetype.split('/')[1]}`,
            mimetype,
            note: 'stored in ticket.screenshot_url'
          }];
        }
      }
    }

    await t.commit();

    // Prepare response payload
    const ticketPlain = ticket.toJSON ? ticket.toJSON() : ticket;
    if (ticketPlain.screenshot_url) delete ticketPlain.screenshot_url;

    if (TicketImage && imagesMeta.length === 0) {
      const imgs = await TicketImage.findAll({ where: { ticket_id: ticket.ticket_id ?? ticket.id }, attributes: ['id','filename','mimetype','created_on'] });
      imagesMeta = imgs.map((img) => ({ id: img.id ?? null, filename: img.filename, mimetype: img.mimetype, created_on: img.created_on }));
    }

    let slaRecord = null;
    if (ticketPlain.sla_id) slaRecord = await SLA.findByPk(ticketPlain.sla_id);

    const { response_sla_met, resolve_sla_met } = await computeSLACompliance(ticketPlain);
    const responseTicket = {
      ...ticketPlain,
      images: imagesMeta,
      sla: slaRecord ? (slaRecord.toJSON ? slaRecord.toJSON() : slaRecord) : null,
      response_sla_met,
      resolve_sla_met
    };

    // Notify admins (after commit) - fire-and-forget but log errors
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

    return res.status(201).json({ message: 'Ticket raised', ticket: responseTicket });
  } catch (err) {
    console.error('raiseTicket error:', err);
    try { await t.rollback(); } catch (e) { /* ignore */ }
    return res.status(500).json({ message: 'Internal server error' });
  }
};
