// const { Ticket, TicketReply, User } = require('../models');

const { Ticket, TicketReply, TicketImage, sequelize , User } = require('../models'); // TicketImage may be undefined if model not added

const ensureOwnerOrAdmin = async (req, ticket) => {
  if (!ticket) return false;
  if (req.user.role_name === 'admin') return true;
  return ticket.user_id === req.user.id;
};

// exports.raiseTicket = async (req, res) => {
//   try {
//     const { module, sub_module, category, comment, screenshot_url } = req.body;

//     console.log('raiseTicket body:', req.body);
//     if (!module || !category || !comment) {
//       return res.status(400).json({ message: 'module, category, comment are required' });
//     }

//     const ticket = await Ticket.create({
//       user_id: req.user.id,
//       module,
//       sub_module,
//       category,
//       comment,
//       screenshot_url,
//       status: 'Open',
//     });

//     // Add system reply to indicate created (optional)
//     await TicketReply.create({
//       ticket_id: ticket.ticket_id,
//       sender_id: req.user.id,
//       sender_type: 'system',
//       message: 'Ticket created by user.',
//     });

//     return res.status(201).json({ message: 'Ticket raised', ticket });
//   } catch (err) {
//     console.error('raiseTicket', err);
//     return res.status(500).json({ message: 'Internal server error' });
//   }
// };

exports.getUserTickets = async (req, res) => {
  try {
    const tickets = await Ticket.findAll({
      where: { user_id: req.user.id },
      include: [
        { model: TicketReply, as: 'replies', include: [{ model: User, as: 'sender', attributes: ['user_id','username','email'] }] },
      ],
      order: [['created_at', 'DESC']],
    });
    return res.json(tickets);
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
        { model: TicketReply, as: 'replies', include: [{ model: User, as: 'sender', attributes: ['user_id','username','email'] }] },
        { model: User, as: 'creator', attributes: ['user_id','username','email'] },
      ],
    });
    if (!ticket) return res.status(404).json({ message: 'Ticket not found' });
    // permission check
    if (!(await ensureOwnerOrAdmin(req, ticket))) return res.status(403).json({ message: 'Forbidden' });
    return res.json(ticket);
  } catch (err) {
    console.error('getTicketById', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

exports.replyToTicket = async (req, res) => {
  try {
    const { ticketId } = req.params;
    const { message } = req.body;
    if (!message) return res.status(400).json({ message: 'message is required' });

    const ticket = await Ticket.findByPk(ticketId);
    if (!ticket) return res.status(404).json({ message: 'Ticket not found' });

    if (!(await ensureOwnerOrAdmin(req, ticket))) return res.status(403).json({ message: 'Forbidden' });

    const sender_type = req.user.role_name === 'admin' ? 'admin' : 'user';

    const reply = await TicketReply.create({
      ticket_id: ticket.ticket_id,
      sender_id: req.user.id,
      sender_type,
      message,
    });

    // Optionally update ticket status when admin replies
    if (sender_type === 'admin' && ticket.status === 'Open') {
      ticket.prev_status = ticket.status;
      ticket.status = 'In Progress';
      ticket.updated_at = new Date();
      await ticket.save();
    }

    return res.status(201).json({ message: 'Reply added', reply });
  } catch (err) {
    console.error('replyToTicket', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

// ADMIN: get all tickets
exports.adminGetAllTickets = async (req, res) => {
  try {
    const tickets = await Ticket.findAll({
      include: [
        { model: TicketReply, as: 'replies', include: [{ model: User, as: 'sender', attributes: ['user_id','username'] }] },
        { model: User, as: 'creator', attributes: ['user_id','username','email'] },
      ],
      order: [['created_at', 'DESC']],
    });
    return res.json(tickets);
  } catch (err) {
    console.error('adminGetAllTickets', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

// ADMIN: request closure (change to 'Pending Closure')
exports.adminRequestClose = async (req, res) => {
  try {
    const { ticketId } = req.params;
    const ticket = await Ticket.findByPk(ticketId);
    if (!ticket) return res.status(404).json({ message: 'Ticket not found' });

    // only if not already closed or pending
    if (ticket.status === 'Closed' || ticket.status === 'Pending Closure') {
      return res.status(400).json({ message: 'Ticket already closed or pending' });
    }

    ticket.prev_status = ticket.status;
    ticket.status = 'Pending Closure';
    ticket.updated_at = new Date();
    await ticket.save();

    // add admin system reply
    await TicketReply.create({
      ticket_id: ticket.ticket_id,
      sender_id: req.user.id,
      sender_type: 'admin',
      message: 'Admin has requested to close this ticket. Please approve or decline.',
    });

    return res.json({ message: 'Ticket marked Pending Closure', ticket });
  } catch (err) {
    console.error('adminRequestClose', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

// USER: approve closure
exports.userApproveClosure = async (req, res) => {
  try {
    const { ticketId } = req.params;
    const ticket = await Ticket.findByPk(ticketId);
    if (!ticket) return res.status(404).json({ message: 'Ticket not found' });

    if (ticket.user_id !== req.user.id) return res.status(403).json({ message: 'Only owner can approve' });

    if (ticket.status !== 'Pending Closure') return res.status(400).json({ message: 'Ticket not pending closure' });

    ticket.prev_status = ticket.status;
    ticket.status = 'Closed';
    ticket.updated_at = new Date();
    await ticket.save();

    await TicketReply.create({
      ticket_id: ticket.ticket_id,
      sender_id: req.user.id,
      sender_type: 'user',
      message: 'User approved closure.',
    });

    return res.json({ message: 'Ticket closed', ticket });
  } catch (err) {
    console.error('userApproveClosure', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

// USER: decline closure
exports.userDeclineClosure = async (req, res) => {
  try {
    const { ticketId } = req.params;
    const ticket = await Ticket.findByPk(ticketId);
    if (!ticket) return res.status(404).json({ message: 'Ticket not found' });

    if (ticket.user_id !== req.user.id) return res.status(403).json({ message: 'Only owner can decline' });

    if (ticket.status !== 'Pending Closure') return res.status(400).json({ message: 'Ticket not pending closure' });

    const previous = ticket.prev_status || 'Open';
    ticket.status = previous;
    ticket.prev_status = null;
    ticket.updated_at = new Date();
    await ticket.save();

    await TicketReply.create({
      ticket_id: ticket.ticket_id,
      sender_id: req.user.id,
      sender_type: 'user',
      message: 'User declined closure. Reopened for work.',
    });

    return res.json({ message: 'Ticket reverted to previous status', ticket });
  } catch (err) {
    console.error('userDeclineClosure', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

// USER: reopen (only if Closed)
exports.userReopenTicket = async (req, res) => {
  try {
    const { ticketId } = req.params;
    const ticket = await Ticket.findByPk(ticketId);
    if (!ticket) return res.status(404).json({ message: 'Ticket not found' });

    if (ticket.user_id !== req.user.id) return res.status(403).json({ message: 'Only owner can reopen' });

    if (ticket.status !== 'Closed') return res.status(400).json({ message: 'Only closed tickets can be reopened' });

    ticket.prev_status = ticket.status;
    ticket.status = 'Reopened';
    ticket.updated_at = new Date();
    await ticket.save();

    await TicketReply.create({
      ticket_id: ticket.ticket_id,
      sender_id: req.user.id,
      sender_type: 'user',
      message: 'User reopened the ticket.',
    });

    return res.json({ message: 'Ticket reopened', ticket });
  } catch (err) {
    console.error('userReopenTicket', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

// ADMIN: update status freely (but not directly to Closed)
exports.adminUpdateStatus = async (req, res) => {
  try {
    const { ticketId } = req.params;
    const { status } = req.body;
    const allowed = ['Open','In Progress','Resolved','Pending Closure','Reopened'];
    if (!allowed.includes(status)) return res.status(400).json({ message: 'Invalid status' });

    const ticket = await Ticket.findByPk(ticketId);
    if (!ticket) return res.status(404).json({ message: 'Ticket not found' });

    ticket.prev_status = ticket.status;
    ticket.status = status;
    ticket.updated_at = new Date();
    await ticket.save();

    await TicketReply.create({
      ticket_id: ticket.ticket_id,
      sender_id: req.user.id,
      sender_type: 'admin',
      message: `Admin updated status to ${status}`,
    });

    return res.json({ message: 'Status updated', ticket });
  } catch (err) {
    console.error('adminUpdateStatus', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};


// controllers/ticketController.js


exports.raiseTicket = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    // DEBUG: log what multer parsed
    console.log('req.body keys:', Object.keys(req.body));
    console.log('req.files count:', (req.files && req.files.length) || 0);

    // Accept different field names to be tolerant
    const moduleVal = req.body.module ?? req.body.modules;
    const sub_module = req.body.sub_module ?? req.body.submodule ?? req.body.subModule ?? '';
    const category = req.body.category;
    const comment = req.body.comment ?? req.body.comments ?? req.body.description ?? '';

    if (!moduleVal || !category || !comment) {
      await t.rollback();
      return res.status(400).json({ message: 'module, category and comment are required' });
    }

    // Create Ticket
    const ticket = await Ticket.create({
      user_id: req.user && (req.user.id ?? req.user.user_id),
      module: moduleVal,
      sub_module,
      category,
      comment,
      status: 'Open'
    }, { transaction: t });

    // Save uploaded files: prefer TicketImage table if present
    if (req.files && Array.isArray(req.files) && req.files.length > 0) {
      if (TicketImage) {
        // persist all uploaded files into ticket_images table
        const imagesToCreate = req.files.map((file) => ({
          ticket_id: ticket.ticket_id ?? ticket.id,
          filename: file.originalname,
          mimetype: file.mimetype,
          data: file.buffer
        }));
        await TicketImage.bulkCreate(imagesToCreate, { transaction: t });
      } else {
        // fallback: store first file into Ticket.screenshot_url (single BLOB)
        const file = req.files[0];
        ticket.screenshot_url = file.buffer; // BLOB
        await ticket.save({ transaction: t });
      }
    } else if (req.body.screenshot_url) {
      // If frontend sends base64 data URL in screenshot_url, parse it
      // Accepts format: data:<mimetype>;base64,<data>
      const dataUrl = req.body.screenshot_url;
      const m = dataUrl.match(/^data:(.+);base64,(.+)$/);
      if (m) {
        const b64 = m[2];
        const buffer = Buffer.from(b64, 'base64');
        if (TicketImage) {
          await TicketImage.create({
            ticket_id: ticket.ticket_id ?? ticket.id,
            filename: req.body.screenshot_name ?? `upload.${m[1].split('/')[1]}`,
            mimetype: m[1],
            data: buffer
          }, { transaction: t });
        } else {
          ticket.screenshot_url = buffer;
          await ticket.save({ transaction: t });
        }
      }
    }

    // Initial system reply
    await TicketReply.create({
      ticket_id: ticket.ticket_id ?? ticket.id,
      sender_id: req.user && (req.user.id ?? req.user.user_id),
      sender_type: 'system',
      message: 'Ticket created by user.'
    }, { transaction: t });

    await t.commit();

    // Return created ticket (without BLOB data)
    const out = ticket.toJSON ? ticket.toJSON() : ticket;
    return res.status(201).json({ message: 'Ticket raised', ticket: out });
  } catch (err) {
    console.error('raiseTicket error:', err);
    await t.rollback();
    return res.status(500).json({ message: 'Internal server error' });
  }
};
