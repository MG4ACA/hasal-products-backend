module.exports = (sequelize, DataTypes) => {
  const InvoiceItem = sequelize.define(
    'InvoiceItem',
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      invoice_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: 'sales_invoices',
          key: 'id',
        },
        onDelete: 'CASCADE',
      },
      sku_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: 'product_skus',
          key: 'id',
        },
      },
      quantity: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
      },
      unit_price: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
      },
      discount_percent: {
        type: DataTypes.DECIMAL(5, 2),
        defaultValue: 0,
      },
      discount_amount: {
        type: DataTypes.DECIMAL(10, 2),
        defaultValue: 0,
      },
      total_amount: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: false,
      },
      is_return: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
      },
      return_reason: {
        type: DataTypes.ENUM('damaged', 'expired', 'excess', 'quality_issue', 'other'),
      },
      return_to_stock: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
      },
      // Phase 2: Return validation fields
      original_invoice_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
          model: 'sales_invoices',
          key: 'id',
        },
        comment: 'Reference to original purchase invoice for returns',
      },
      original_invoice_item_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
          model: 'invoice_items',
          key: 'id',
        },
        comment: 'Reference to original item being returned',
      },
      return_policy_override: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        comment: 'Admin override for out-of-policy returns',
      },
      return_policy_override_reason: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'Reason for admin override',
      },
      return_policy_override_by: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
          model: 'users',
          key: 'id',
        },
        comment: 'Admin who approved the override',
      },
    },
    {
      tableName: 'invoice_items',
      timestamps: false,
      indexes: [
        { fields: ['invoice_id'] },
        { fields: ['is_return'] },
        { fields: ['original_invoice_id'] },
        { fields: ['original_invoice_item_id'] },
      ],
    }
  );

  return InvoiceItem;
};
