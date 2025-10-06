// models/document.js
module.exports = (sequelize, DataTypes) => {
  const Document = sequelize.define(
    'Document',
    {
      document_id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      linked_id: {
        type: DataTypes.INTEGER,
        allowNull: true
      },
      table_name: {
        type: DataTypes.STRING(50),
        allowNull: true
      },
      type: {
        type: DataTypes.STRING(50),
        allowNull: true
      },
      doc_name: {
        type: DataTypes.STRING(155),
        allowNull: true
      },
      mime_type: {
        type: DataTypes.STRING(255),
        allowNull: true
      },
      // store base64 as LONG TEXT (safer for very large base64 strings than TEXT default)
      doc_base64: {
        type: DataTypes.TEXT('long'),
        allowNull: true
      },
      created_on: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
      },
      created_by: {
        type: DataTypes.STRING(50),
        allowNull: true
      },
      updated_on: {
        type: DataTypes.DATE,
        allowNull: true
      },
      updated_by: {
        type: DataTypes.STRING(50),
        allowNull: true
      },
      status: {
        type: DataTypes.STRING(50),
        allowNull: true,
        defaultValue: 'active'
      }
    },
    {
      tableName: 'document',
      timestamps: false
    }
  );

  Document.associate = (models) => {
    // Polymorphic-ish associations: scope by table_name
    Document.belongsTo(models.Ticket, {
      foreignKey: 'linked_id',
      as: 'ticket',
      constraints: false,
      scope: { table_name: 'ticket' }
    });

    Document.belongsTo(models.TicketReply, {
      foreignKey: 'linked_id',
      as: 'reply',
      constraints: false,
      scope: { table_name: 'ticket_reply' }
    });

    // optional: uploader relation (created_by stores username)
    if (models.User) {
      Document.belongsTo(models.User, { foreignKey: 'created_by', targetKey: 'username', as: 'uploader', constraints: false });
    }
  };

  return Document;
};
