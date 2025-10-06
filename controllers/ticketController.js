// controllers/ticketController.js
// const { Ticket, TicketReply, Document, sequelize, User, SLA } = require('../models');
const { Ticket, TicketReply, Document, sequelize, User, SLA, Category, SubCategory, IssueType, Priority } = require('../models');
const { sendMail } = require('../utils/mailer');
const { ticketCreatedTemplate, ticketReplyTemplate, ticketStatusChangedTemplate } = require('../utils/emailTemplates');

const ensureOwnerOrAdmin = async (req, ticket) => {
  if (!ticket) return false;
  if (req.user && req.user.role_name === 'admin') return true;
  const uid = req.user && (req.user.id ?? req.user.user_id);
  return ticket.user_id === uid;
};

function secondsBetween(a, b) {
  if (!a || !b) return null;
  return Math.floor((new Date(b).getTime() - new Date(a).getTime()) / 1000);
}

async function computeSLACompliance(ticket) {
  if (!ticket) return { response_sla_met: null, resolve_sla_met: null, sla: null };
  let sla = ticket.sla ?? null;
  if (!sla && ticket.sla_id) sla = await SLA.findByPk(ticket.sla_id);
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
   READ endpoints
---------------------------*/

// exports.getUserTickets = async (req, res) => {
//   try {
//     const uid = req.user.id ?? req.user.user_id;
//     const tickets = await Ticket.findAll({
//       where: { user_id: uid },
//       include: [
//         { model: User, as: 'creator', attributes: ['user_id', 'username', 'email', 'first_name', 'last_name'] },
//         {
//           model: TicketReply,
//           as: 'replies',
//           include: [
//             { model: User, as: 'sender', attributes: ['user_id', 'username', 'email'] },
//             { model: Document, as: 'documents', attributes: ['document_id', 'doc_name', 'mime_type', 'doc_base64', 'created_on'] }
//           ]
//         },
//         { model: Document, as: 'documents', attributes: ['document_id', 'doc_name', 'mime_type', 'doc_base64', 'created_on'] }, // ticket-level docs
//         { model: SLA, as: 'sla' }
//       ],
//       order: [['created_at', 'DESC']]
//     });

//     const ticketsWithSLA = await Promise.all(
//       tickets.map(async (t) => {
//         const plain = t.toJSON ? t.toJSON() : t;
//         const { response_sla_met, resolve_sla_met, sla } = await computeSLACompliance(plain);
//         plain.sla = sla ? (sla.toJSON ? sla.toJSON() : sla) : plain.sla ?? null;
//         plain.response_sla_met = response_sla_met;
//         plain.resolve_sla_met = resolve_sla_met;
//         return plain;
//       })
//     );

//     return res.json({ tickets: ticketsWithSLA });
//   } catch (err) {
//     console.error('getUserTickets', err);
//     return res.status(500).json({ message: 'Internal server error' });
//   }
// };



// exports.getTicketById = async (req, res) => {
//   try {
//     const { ticketId } = req.params;
//     const ticket = await Ticket.findByPk(ticketId, {
//       include: [
//         {
//           model: TicketReply,
//           as: 'replies',
//           include: [
//             { model: User, as: 'sender', attributes: ['user_id', 'username', 'email'] },
//             { model: Document, as: 'documents', attributes: ['document_id', 'doc_name', 'mime_type', 'doc_base64', 'created_on'] }
//           ],
//           order: [['created_at', 'ASC']] // ADD THIS LINE - order replies by creation date
//         },
//         { model: User, as: 'creator', attributes: ['user_id', 'username', 'email', 'first_name', 'last_name'] },
//         { model: SLA, as: 'sla' },
//         { model: Document, as: 'documents', attributes: ['document_id', 'doc_name', 'doc_base64', 'mime_type', 'created_on'] }
//       ]
//     });




//     if (!ticket) return res.status(404).json({ message: 'Ticket not found' });
//     if (!(await ensureOwnerOrAdmin(req, ticket))) return res.status(403).json({ message: 'Forbidden' });

//     const plain = ticket.toJSON ? ticket.toJSON() : ticket;
//     const { response_sla_met, resolve_sla_met, sla } = await computeSLACompliance(plain);
//     plain.sla = sla ? (sla.toJSON ? sla.toJSON() : sla) : plain.sla ?? null;
//     plain.response_sla_met = response_sla_met;
//     plain.resolve_sla_met = resolve_sla_met;
//     plain.created_by_username = plain.creator?.username || 'Unknown';

//     return res.json({ ticket: plain });
//   } catch (err) {
//     console.error('getTicketById', err);
//     return res.status(500).json({ message: 'Internal server error' });
//   }


// }




/* --------------------------
   Reply endpoint (message/files/status)
   - handles SLA updates, status changes, attachments saved to Document table
---------------------------*/

exports.replyToTicket = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { ticketId } = req.params;
    const { message: rawMessage, status: requestedStatus, screenshot_url } = req.body;
    const files = req.files && Array.isArray(req.files) ? req.files : [];

    // require at least one of message/files/status/screenshot
    if ((!rawMessage || String(rawMessage).trim() === '') && files.length === 0 && !requestedStatus && !screenshot_url) {
      await t.rollback();
      return res.status(400).json({ message: 'At least one of message / files / status / screenshot_url is required' });
    }

    const ticket = await Ticket.findByPk(ticketId, { transaction: t });
    if (!ticket) {
      await t.rollback();
      return res.status(404).json({ message: 'Ticket not found' });
    }

    // permission check: user can reply to their ticket, admins can reply to any
    if (!(await ensureOwnerOrAdmin(req, ticket))) {
      await t.rollback();
      return res.status(403).json({ message: 'Forbidden' });
    }

    const sender_type = (req.user && req.user.role_name === 'admin') ? 'admin' : 'user';
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
      // ensure only admin can change status
      // if (sender_type !== 'admin') {
      //   await t.rollback();
      //   return res.status(403).json({ message: 'Only admin can change ticket status' });
      // }
      if (ticket.status !== newStatus) statusChanged = true;
    }

    const now = new Date();

    // If admin replies for the first time -> set response_at & response_time_seconds
    if (sender_type === 'admin' && !ticket.response_at) {
      ticket.response_at = now;
      ticket.response_time_seconds = secondsBetween(ticket.created_at, now);
      ticket.last_updated_by = req.user.username ?? req.user.id ?? null;
    }

    // Apply status change (admin only)
    if (statusChanged && newStatus) {
      const oldStatus = ticket.status;
      ticket.prev_status = ticket.status;
      ticket.status = newStatus;
      ticket.last_updated_by = req.user.username ?? req.user.id ?? null;
      ticket.updated_at = now;

      // when marking resolved/closed set resolved_at/time if not already set
      if ((newStatus === 'Resolved' || newStatus === 'Closed') && !ticket.resolved_at) {
        ticket.resolved_at = now;
        ticket.resolve_time_seconds = secondsBetween(ticket.created_at, now);
      }
    } else {
      // update last_updated_by for admin replies without status change, or updated_at for user replies
      if (sender_type === 'admin') {
        ticket.last_updated_by = req.user.username ?? req.user.id ?? null;
      }
      ticket.updated_at = now;
    }

    // persist ticket changes
    await ticket.save({ transaction: t });

    // create reply
    const reply = await TicketReply.create({
      ticket_id: ticket.ticket_id ?? ticket.id,
      sender_id: senderId,
      sender_type,
      message: rawMessage ?? ''
    }, { transaction: t });

    // helper to create Document entries from files or base64
    const createdDocsMeta = [];
    // Save multi-file uploads (req.files) => store base64 in doc_base64
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
        const doc = await Document.create({
          linked_id: reply.reply_id,
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
        const replyPlain = reply.toJSON ? reply.toJSON() : reply;
        const sender = { username: req.user.username, email: req.user.email };

        if (sender_type === 'admin') {
          // notify owner
          const owner = await User.findByPk(ticket.user_id, { attributes: ['email', 'username'] });
          if (owner && owner.email) {
            try {
              const { subject, html, text } = ticketReplyTemplate({ ticket: ticketPlain, reply: replyPlain, sender });
              await sendMail({ to: owner.email, subject, html, text });
            } catch (mailErr) {
              console.error('Mail error (reply -> owner):', mailErr && mailErr.message ? mailErr.message : mailErr);
            }

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
          }
        } else {
          // user replied -> notify admins (except replying user if they are admin)
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
        console.error('Mail pipeline error (replyToTicket notifications):', outerMailErr && outerMailErr.message ? outerMailErr.message : outerMailErr);
      }
    })();

    // fetch reply with sender for response
    const replyWithSender = await TicketReply.findByPk(reply.reply_id, {
      include: [{ model: User, as: 'sender', attributes: ['user_id', 'username', 'email'] }]
    });

    // prepare ticket response: include documents metadata for reply and ticket-level docs
    const ticketPlain = ticket.toJSON ? ticket.toJSON() : ticket;
    // attach reply-level created docs metadata (if any)
    const replyDocs = createdDocsMeta;

    // fetch ticket-level documents if any
    const ticketDocs = await Document.findAll({
      where: { linked_id: ticket.ticket_id, table_name: 'ticket' },
      attributes: ['document_id', 'doc_name', 'mime_type', 'created_on']
    });

    const { response_sla_met, resolve_sla_met, sla } = await computeSLACompliance(ticketPlain);

    return res.status(201).json({
      message: 'Reply added',
      reply: replyWithSender,
      documents: replyDocs,
      ticket: {
        ...ticketPlain,
        ticket_documents: ticketDocs.map(d => (d.toJSON ? d.toJSON() : d)),
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




// exports.raiseTicket = async (req, res) => {
//   const t = await sequelize.transaction();
//   try {
//     // files (optional)
//     const files = req.files && Array.isArray(req.files) ? req.files : [];

//     // prefer ids from frontend
//     const category_id = req.body.category_id ? parseInt(req.body.category_id, 10) : null;
//     const subcategory_id = req.body.subcategory_id ? parseInt(req.body.subcategory_id, 10) : null;
//     const issue_type_id = req.body.issue_type_id ? parseInt(req.body.issue_type_id, 10) : null;

//     // fallback to names (if front sends names)
//     const category_name = req.body.category_name ?? req.body.category;
//     const subcategory_name = req.body.subcategory_name ?? req.body.subCategory;
//     const issue_type_name = req.body.issue_type_name ?? req.body.issueType;

//     // If issue type is "Other" allow user-provided issue_name
//     const issue_name = req.body.issue_name ?? req.body.issueName ?? null;

//     // priority may be passed as id or name (if Other)
//     const priority_id_in = req.body.priority_id ? parseInt(req.body.priority_id, 10) : null;
//     const priority_name_in = req.body.priority_name ?? req.body.priority ?? null;

//     // comment required
//     const comment = req.body.comment ?? req.body.comments ?? req.body.description ?? '';
//     if (!comment) { await t.rollback(); return res.status(400).json({ message: 'comment is required' }); }

//     // Resolve category/subcategory/issueType by id or name
//     let resolvedCategoryId = category_id;
//     let resolvedSubCategoryId = subcategory_id;
//     let resolvedIssueTypeId = issue_type_id;
//     let appliedSlaId = null;
//     let appliedPriorityId = null;
//     let appliedPriorityText = 'Medium';

//     // resolve category by name if id missing
//     if (!resolvedCategoryId && category_name) {
//       const cat = await Category.findOne({ where: { name: category_name } });
//       if (cat) resolvedCategoryId = cat.category_id;
//     }

//     // resolve subcategory by id OR name+category
//     if (!resolvedSubCategoryId && subcategory_name && resolvedCategoryId) {
//       const sc = await SubCategory.findOne({ where: { name: subcategory_name, category_id: resolvedCategoryId } });
//       if (sc) resolvedSubCategoryId = sc.subcategory_id;
//     } else if (!resolvedSubCategoryId && subcategory_name) {
//       const sc = await SubCategory.findOne({ where: { name: subcategory_name } });
//       if (sc) resolvedSubCategoryId = sc.subcategory_id;
//     }

//     // resolve issue type by id OR name + subcategory
//     let issueTypeRecord = null;
//     if (resolvedIssueTypeId) {
//       issueTypeRecord = await IssueType.findByPk(resolvedIssueTypeId);
//     } else if (issue_type_name && resolvedSubCategoryId) {
//       issueTypeRecord = await IssueType.findOne({ where: { name: issue_type_name, subcategory_id: resolvedSubCategoryId } });
//     } else if (issue_type_name) {
//       issueTypeRecord = await IssueType.findOne({ where: { name: issue_type_name } });
//     }

//     if (issueTypeRecord) {
//       resolvedIssueTypeId = issueTypeRecord.issue_type_id;
//       appliedSlaId = issueTypeRecord.sla_id ?? null;
//       appliedPriorityId = issueTypeRecord.priority_id ?? null;
//     }

//     // If issue type is "Other" or the resolved issue type has name 'Other' then require issue_name
//     let issueTypeNameResolved = issueTypeRecord ? issueTypeRecord.name : (issue_type_name ?? null);
//     const isOther = issueTypeNameResolved && issueTypeNameResolved.toLowerCase() === 'other';

//     if (isOther && (!issue_name || String(issue_name).trim() === '')) {
//       await t.rollback();
//       return res.status(400).json({ message: 'issue_name is required when issue type is Other' });
//     }

//     // If frontend provided priority explicitly (id) override default
//     if (priority_id_in) {
//       const pr = await Priority.findByPk(priority_id_in);
//       if (!pr) { await t.rollback(); return res.status(400).json({ message: 'priority_id not found' }); }
//       appliedPriorityId = pr.priority_id;
//       appliedPriorityText = pr.name;
//     } else if (priority_name_in) {
//       // try to map by name
//       const pr = await Priority.findOne({ where: { name: priority_name_in } });
//       if (pr) {
//         appliedPriorityId = pr.priority_id;
//         appliedPriorityText = pr.name;
//       } else {
//         // fallback to provided name text
//         appliedPriorityText = priority_name_in;
//       }
//     } else if (appliedPriorityId) {
//       const pr = await Priority.findByPk(appliedPriorityId);
//       appliedPriorityText = pr ? pr.name : appliedPriorityText;
//     }

//     // If SLA not set from IssueType and frontend passed sla_id, accept that
//     if (!appliedSlaId && req.body.sla_id) {
//       const parsed = parseInt(req.body.sla_id, 10);
//       if (!Number.isNaN(parsed)) {
//         const srec = await SLA.findByPk(parsed);
//         if (srec) appliedSlaId = srec.sla_id;
//       }
//     }

//     // Determine user
//     const userId = req.user && (req.user.id ?? req.user.user_id);
//     if (!userId) { await t.rollback(); return res.status(401).json({ message: 'Unauthorized' }); }

//     // CREATE TICKET
//     const ticket = await Ticket.create({
//       user_id: userId,
//       category_id: resolvedCategoryId,
//       subcategory_id: resolvedSubCategoryId,
//       issue_type_id: resolvedIssueTypeId,
//       issue_name: isOther ? issue_name : (issue_name || null),
//       priority_id: appliedPriorityId,
//       priority: appliedPriorityText,
//       comment,
//       status: 'Open',
//       sla_id: appliedSlaId
//     }, { transaction: t });

//     // Save any ticket-level files to Document table with table_name='ticket'
//     const ticketDocsMeta = [];
//     if (files.length > 0) {
//       const docsToCreate = files.map(file => {
//         return {
//           linked_id: ticket.ticket_id,
//           table_name: 'ticket',
//           type: (file.mimetype || '').startsWith('image/') ? 'image' : 'attachment',
//           doc_name: file.originalname || file.filename || 'upload',
//           mime_type: file.mimetype || 'application/octet-stream',
//           doc_base64: file.buffer ? file.buffer.toString('base64') : null,
//           created_by: req.user.username ?? String(userId),
//           status: 'active'
//         };
//       });
//       const created = await Document.bulkCreate(docsToCreate, { transaction: t });
//       created.forEach(d => ticketDocsMeta.push({ document_id: d.document_id, doc_name: d.doc_name, mime_type: d.mime_type, created_on: d.created_on }));
//     }

//     await t.commit();

//     // Respond with ticket and metadata. computeSLACompliance may be used elsewhere
//     const ticketPlain = ticket.toJSON ? ticket.toJSON() : ticket;
//     if (ticketPlain.screenshot_url) delete ticketPlain.screenshot_url;

//     // fetch SLA record if present
//     let slaRecord = null;
//     if (ticketPlain.sla_id) slaRecord = await SLA.findByPk(ticketPlain.sla_id);

//     return res.status(201).json({
//       message: 'Ticket raised',
//       ticket: {
//         ...ticketPlain,
//         ticket_documents: ticketDocsMeta,
//         sla: slaRecord ? (slaRecord.toJSON ? slaRecord.toJSON() : slaRecord) : null
//       }
//     });
//   } catch (err) {
//     console.error('raiseTicket error:', err);
//     try { await t.rollback(); } catch (e) { /* ignore */ }
//     return res.status(500).json({ message: 'Internal server error', error: err.message });
//   }
// };
/* --------------------------
   Admin / other endpoints (using Document for attachments where necessary)
---------------------------*/

// exports.adminGetAllTickets = async (req, res) => {
//   try {
//     const tickets = await Ticket.findAll({
//       include: [
//         {
//           model: TicketReply,
//           as: 'replies',
//           include: [
//             { model: User, as: 'sender', attributes: ['user_id', 'username'] },
//             { model: Document, as: 'documents', attributes: ['document_id', 'doc_name', 'doc_base64', 'mime_type', 'created_on'] }
//           ]
//         },
//         { model: User, as: 'creator', attributes: ['user_id', 'username', 'email'] },
//         { model: Document, as: 'documents', attributes: ['document_id', 'doc_name', 'doc_base64', 'mime_type', 'created_on'] },
//         { model: SLA, as: 'sla' }
//       ],
//       order: [['created_at', 'DESC']]
//     });

//     const ticketsWithSLA = await Promise.all(
//       tickets.map(async (t) => {
//         const plain = t.toJSON ? t.toJSON() : t;
//         const { response_sla_met, resolve_sla_met, sla } = await computeSLACompliance(plain);
//         plain.sla = sla ? (sla.toJSON ? sla.toJSON() : sla) : plain.sla ?? null;
//         plain.response_sla_met = response_sla_met;
//         plain.resolve_sla_met = resolve_sla_met;
//         return plain;
//       })
//     );

//     return res.json({ tickets: ticketsWithSLA });
//   } catch (err) {
//     console.error('adminGetAllTickets', err);
//     return res.status(500).json({ message: 'Internal server error' });
//   }
// };

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
    console.log('raiseTicket - req.files count:', (req.files && req.files.length) || 0);

    // Map frontend field names to backend expected names
    const moduleVal = req.body.category; // frontend sends 'category' as module
    const sub_module = req.body.subCategory; // frontend sends 'subCategory'

    // Handle issue type - if it's "Other", use issueName, otherwise use issueType
    let category = req.body.issueType; // frontend sends 'issueType'
    if (category === 'Other' && req.body.issueName) {
      category = req.body.issueName; // Use custom issue name when issueType is "Other"
    }

    const comment = req.body.comments || req.body.comment || '';

    console.log('Mapped values:', { moduleVal, sub_module, category, comment });

    if (!moduleVal || !category || !comment) {
      await t.rollback();
      return res.status(400).json({
        message: 'Module, category and comments are required',
        received: { moduleVal, category, comment }
      });
    }

    // Determine SLA id - use the final category value for SLA lookup
    let slaId = null;
    if (req.body.sla_id) {
      const parsed = parseInt(req.body.sla_id, 10);
      if (!Number.isNaN(parsed)) slaId = parsed;
    }
    if (!slaId && category) {
      const slaRec = await SLA.findOne({
        where: sequelize.where(sequelize.fn('lower', sequelize.col('issue_type')), sequelize.fn('lower', category))
      });
      if (slaRec && slaRec.is_active) slaId = slaRec.sla_id;
    }

    const userId = req.user && (req.user.id ?? req.user.user_id);
    if (!userId) {
      await t.rollback();
      return res.status(401).json({ message: 'Unauthorized' });
    }

    // Create ticket with mapped fields
    const ticket = await Ticket.create({
      user_id: userId,
      module: moduleVal,
      sub_module: sub_module,
      category: category, // This will be either the selected issueType or custom issueName
      comment: comment,
      status: 'Open',
      sla_id: slaId
    }, { transaction: t });

    // Save any ticket-level attachments (req.files) -> store with table_name 'ticket'
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
    if (ticketPlain.sla_id) slaRecord = await SLA.findByPk(ticketPlain.sla_id);

    const { response_sla_met, resolve_sla_met } = await computeSLACompliance(ticketPlain);
    const responseTicket = {
      ...ticketPlain,
      ticket_documents: ticketDocsMeta,
      sla: slaRecord ? (slaRecord.toJSON ? slaRecord.toJSON() : slaRecord) : null,
      response_sla_met,
      resolve_sla_met
    };

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

    return res.status(201).json({ message: 'Ticket raised successfully', ticket: responseTicket });
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
    console.error('adminGetAllTickets', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};
