const { ClientSLA, Client, IssueType, Ticket, sequelize } = require('../models');

// Helper function to validate IDs
const validateId = (id) => {
  const parsed = parseInt(id, 10);
  return !isNaN(parsed) && parsed > 0 ? parsed : null;
};

exports.listSLAs = async (req, res) => {
  try {
    const includeInactive = req.query.includeInactive === 'true';
    const where = includeInactive ? {} : { is_active: true };

    const slas = await ClientSLA.findAll({
      where,
      include: [
        {
          model: Client,
          as: 'client',
          attributes: ['client_id', 'company_name', 'contact_person', 'email']
        },
        {
          model: IssueType,
          as: 'issue_type',
          attributes: ['issue_type_id', 'name', 'is_active']
        }
      ],
      order: [['created_on', 'DESC']]
    });

    return res.json({ slas });
  } catch (err) {
    console.error('listSLAs', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

exports.getSLA = async (req, res) => {
  try {
    const id = validateId(req.params.id);
    
    if (!id) {
      return res.status(400).json({ message: 'Invalid SLA ID' });
    }
    
    const sla = await ClientSLA.findByPk(id, {
      include: [
        {
          model: Client,
          as: 'client',
          attributes: ['client_id', 'company_name', 'contact_person', 'email']
        },
        {
          model: IssueType,
          as: 'issue_type',
          attributes: ['issue_type_id', 'name', 'is_active']
        }
      ]
    });
    
    if (!sla) return res.status(404).json({ message: 'SLA not found' });
    return res.json({ sla });
  } catch (err) {
    console.error('getSLA', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

exports.createSLA = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const {
      client_id,
      name,
      issue_type_id,
      response_target_minutes,
      resolve_target_minutes,
      is_active,
      created_by
    } = req.body;

    // Validate client_id
    const clientId = validateId(client_id);
    if (!clientId) {
      await t.rollback();
      return res.status(400).json({ message: 'Valid client_id is required' });
    }

    if (!name || name.trim() === '') {
      await t.rollback();
      return res.status(400).json({ message: 'SLA name is required' });
    }

    // Validate issue_type_id
    const issueTypeId = validateId(issue_type_id);
    if (!issueTypeId) {
      await t.rollback();
      return res.status(400).json({ message: 'Valid issue_type_id is required' });
    }

    // Check if client exists
    const client = await Client.findByPk(clientId);
    if (!client) {
      await t.rollback();
      return res.status(404).json({ message: 'Client not found' });
    }

    // Check if issue type exists and is active
    const issueType = await IssueType.findOne({
      where: { issue_type_id: issueTypeId, is_active: true }
    });
    if (!issueType) {
      await t.rollback();
      return res.status(400).json({ message: 'Issue type not found or inactive' });
    }

    // Check uniqueness (client_id + issue_type_id combination)
    const existingIssueTypeSLA = await ClientSLA.findOne({
      where: { client_id: clientId, issue_type_id: issueTypeId }
    });

    if (existingIssueTypeSLA) {
      await t.rollback();
      return res.status(409).json({ 
        message: 'SLA for this client and issue type already exists' 
      });
    }

    // Check uniqueness (client_id + name combination)
    const existingNameSLA = await ClientSLA.findOne({
      where: { client_id: clientId, name: name.trim() }
    });

    if (existingNameSLA) {
      await t.rollback();
      return res.status(409).json({ 
        message: 'SLA with this name already exists for this client' 
      });
    }

    const sla = await ClientSLA.create({
      client_id: clientId,
      name: name.trim(),
      issue_type_id: issueTypeId,
      response_target_minutes: Number(response_target_minutes) || 60,
      resolve_target_minutes: Number(resolve_target_minutes) || 1440,
      is_active: is_active === undefined ? true : !!is_active,
      created_by: created_by ?? (req.user && req.user.username) ?? null
    }, { transaction: t });

    await t.commit();
    
    // Fetch created SLA with associations
    const createdSLA = await ClientSLA.findByPk(sla.client_sla_id, {
      include: [
        {
          model: Client,
          as: 'client',
          attributes: ['client_id', 'company_name', 'contact_person', 'email']
        },
        {
          model: IssueType,
          as: 'issue_type',
          attributes: ['issue_type_id', 'name', 'is_active']
        }
      ]
    });

    return res.status(201).json({ message: 'SLA created', sla: createdSLA });
  } catch (err) {
    console.error('createSLA', err);
    try { await t.rollback(); } catch (_) {}
    return res.status(500).json({ message: 'Internal server error' });
  }
};

exports.updateSLA = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const id = validateId(req.params.id);
    
    if (!id) {
      return res.status(400).json({ message: 'Invalid SLA ID' });
    }

    const {
      client_id,
      name,
      issue_type_id,
      response_target_minutes,
      resolve_target_minutes,
      is_active,
      updated_by
    } = req.body;

    const sla = await ClientSLA.findByPk(id, { transaction: t });
    if (!sla) {
      await t.rollback();
      return res.status(404).json({ message: 'SLA not found' });
    }

    // If client_id is being updated, verify the client exists
    if (client_id) {
      const clientId = validateId(client_id);
      if (!clientId) {
        await t.rollback();
        return res.status(400).json({ message: 'Valid client_id is required' });
      }
      
      if (clientId !== sla.client_id) {
        const client = await Client.findByPk(clientId);
        if (!client) {
          await t.rollback();
          return res.status(404).json({ message: 'Client not found' });
        }
        sla.client_id = clientId;
      }
    }

    // Check name uniqueness if name is being updated
    if (name && name.trim() !== sla.name) {
      const existingNameSLA = await ClientSLA.findOne({
        where: { 
          client_id: sla.client_id, 
          name: name.trim() 
        },
        transaction: t
      });
      
      if (existingNameSLA && existingNameSLA.client_sla_id !== sla.client_sla_id) {
        await t.rollback();
        return res.status(409).json({ 
          message: 'Another SLA with this name already exists for this client' 
        });
      }
      sla.name = name.trim();
    }

    if (issue_type_id) {
      const issueTypeId = validateId(issue_type_id);
      if (!issueTypeId) {
        await t.rollback();
        return res.status(400).json({ message: 'Valid issue_type_id is required' });
      }

      if (issueTypeId !== sla.issue_type_id) {
        // Check if issue type exists and is active
        const issueType = await IssueType.findOne({
          where: { issue_type_id: issueTypeId, is_active: true },
          transaction: t
        });
        if (!issueType) {
          await t.rollback();
          return res.status(400).json({ message: 'Issue type not found or inactive' });
        }

        // Check uniqueness for new client_id + issue_type_id combination
        const existingIssueTypeSLA = await ClientSLA.findOne({
          where: { 
            client_id: sla.client_id, 
            issue_type_id: issueTypeId 
          },
          transaction: t
        });
        
        if (existingIssueTypeSLA && existingIssueTypeSLA.client_sla_id !== sla.client_sla_id) {
          await t.rollback();
          return res.status(409).json({ 
            message: 'Another SLA with this client and issue type already exists' 
          });
        }
        sla.issue_type_id = issueTypeId;
      }
    }

    if (response_target_minutes !== undefined) {
      sla.response_target_minutes = Number(response_target_minutes);
    }
    if (resolve_target_minutes !== undefined) {
      sla.resolve_target_minutes = Number(resolve_target_minutes);
    }
    if (is_active !== undefined) sla.is_active = !!is_active;
    sla.updated_by = updated_by ?? (req.user && req.user.username) ?? sla.updated_by;
    sla.updated_on = new Date();

    await sla.save({ transaction: t });
    await t.commit();

    // Fetch updated SLA with associations
    const updatedSLA = await ClientSLA.findByPk(id, {
      include: [
        {
          model: Client,
          as: 'client',
          attributes: ['client_id', 'company_name', 'contact_person', 'email']
        },
        {
          model: IssueType,
          as: 'issue_type',
          attributes: ['issue_type_id', 'name', 'is_active']
        }
      ]
    });

    return res.json({ message: 'SLA updated', sla: updatedSLA });
  } catch (err) {
    console.error('updateSLA', err);
    try { await t.rollback(); } catch (_) {}
    return res.status(500).json({ message: 'Internal server error' });
  }
};

exports.deleteSLA = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const id = validateId(req.params.id);
    
    if (!id) {
      return res.status(400).json({ message: 'Invalid SLA ID' });
    }

    const sla = await ClientSLA.findByPk(id, { transaction: t });
    
    if (!sla) {
      await t.rollback();
      return res.status(404).json({ message: 'SLA not found' });
    }

    // Check if SLA is being used by any tickets
    const ticketCount = await Ticket.count({
      where: { client_sla_id: id },
      transaction: t
    });

    if (ticketCount > 0) {
      await t.rollback();
      return res.status(400).json({ 
        message: `Cannot deactivate SLA. It is currently being used by ${ticketCount} ticket(s).`
      });
    }

    // Soft-delete: mark inactive
    sla.is_active = false;
    sla.updated_on = new Date();
    sla.updated_by = req.user && req.user.username ? req.user.username : sla.updated_by;
    await sla.save({ transaction: t });

    await t.commit();
    return res.json({ message: 'SLA deactivated' });
  } catch (err) {
    console.error('deleteSLA', err);
    try { await t.rollback(); } catch (_) {}
    return res.status(500).json({ message: 'Internal server error' });
  }
};

// Get SLAs by client ID
exports.getSLAsByClient = async (req, res) => {
  try {
    const clientId = validateId(req.params.clientId);
    
    if (!clientId) {
      return res.status(400).json({ message: 'Invalid client ID' });
    }
    
    const slas = await ClientSLA.findAll({
      where: { client_id: clientId, is_active: true },
      include: [
        {
          model: Client,
          as: 'client',
          attributes: ['client_id', 'company_name', 'contact_person', 'email']
        },
        {
          model: IssueType,
          as: 'issue_type',
          attributes: ['issue_type_id', 'name']
        }
      ],
      order: [['name', 'ASC']]
    });

    return res.json({ slas });
  } catch (err) {
    console.error('getSLAsByClient', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

// Get active clients for SLA assignment
exports.getClientsForSLA = async (req, res) => {
  try {
    const clients = await Client.findAll({
      where: { is_active: true },
      attributes: ['client_id', 'company_name', 'contact_person', 'email'],
      order: [['client_id', 'ASC']]
    });

    return res.json({ clients });
  } catch (err) {
    console.error('getClientsForSLA', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

// Get issue types for SLA assignment
exports.getIssueTypesForSLA = async (req, res) => {
  try {
    const issueTypes = await IssueType.findAll({
      where: { is_active: true },
      attributes: ['issue_type_id', 'name', 'description'],
      order: [['name', 'ASC']]
    });

    return res.json({ issue_types: issueTypes });
  } catch (err) {
    console.error('getIssueTypesForSLA', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

// Get available SLAs for an issue type and client
exports.getClientSLAsForIssueType = async (req, res) => {
  try {
    const clientId = validateId(req.params.clientId);
    const issueTypeId = validateId(req.params.issueTypeId);
    
    if (!clientId || !issueTypeId) {
      return res.status(400).json({ message: 'Valid Client ID and Issue Type ID are required' });
    }

    const slas = await ClientSLA.findAll({
      where: { 
        client_id: clientId,
        issue_type_id: issueTypeId,
        is_active: true 
      },
      order: [['name', 'ASC']]
    });

    return res.json({ 
      client_id: clientId,
      issue_type_id: issueTypeId,
      slas: slas 
    });
  } catch (err) {
    console.error('getClientSLAsForIssueType', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

// Get primary SLA for client and issue type
exports.getPrimarySLAByClientAndIssueType = async (req, res) => {
  try {
    const clientId = validateId(req.params.clientId);
    const issueTypeId = validateId(req.params.issueTypeId);

    if (!clientId || !issueTypeId) {
      return res.status(400).json({ message: 'Valid Client ID and Issue Type ID are required' });
    }

    // Get the primary SLA
    const sla = await ClientSLA.findOne({
      where: {
        client_id: clientId,
        issue_type_id: issueTypeId,
        is_active: true
      },
      include: [
        {
          model: Client,
          as: 'client',
          attributes: ['client_id', 'company_name', 'contact_person', 'email']
        },
        {
          model: IssueType,
          as: 'issue_type',
          attributes: ['issue_type_id', 'name', 'description']
        }
      ],
      order: [
        ['response_target_minutes', 'ASC'],
        ['resolve_target_minutes', 'ASC']
      ]
    });

    if (!sla) {
      return res.status(404).json({ 
        message: 'No active SLA found for this client and issue type combination',
        client_id: clientId,
        issue_type_id: issueTypeId
      });
    }

    return res.json({
      client: {
        client_id: sla.client.client_id,
        company_name: sla.client.company_name,
        contact_person: sla.client.contact_person,
        email: sla.client.email
      },
      issue_type: {
        issue_type_id: sla.issue_type.issue_type_id,
        name: sla.issue_type.name,
        description: sla.issue_type.description
      },
      sla: {
        client_sla_id: sla.client_sla_id,
        name: sla.name,
        response_target_minutes: sla.response_target_minutes,
        resolve_target_minutes: sla.resolve_target_minutes,
        created_on: sla.created_on,
        created_by: sla.created_by
      }
    });
  } catch (err) {
    console.error('getPrimarySLAByClientAndIssueType', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};