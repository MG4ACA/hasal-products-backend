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
    },
    {
      tableName: 'invoice_items',
      timestamps: false,
      indexes: [{ fields: ['invoice_id'] }, { fields: ['is_return'] }],
    }
  );

  return InvoiceItem;
};
