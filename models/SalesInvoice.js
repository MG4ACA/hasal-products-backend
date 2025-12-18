module.exports = (sequelize, DataTypes) => {
  const SalesInvoice = sequelize.define(
    'SalesInvoice',
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      invoice_number: {
        type: DataTypes.STRING(20),
        unique: true,
        allowNull: false,
      },
      outlet_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: 'outlets',
          key: 'id',
        },
      },
      sales_ref_id: {
        type: DataTypes.INTEGER,
        references: {
          model: 'employees',
          key: 'id',
        },
      },
      route_id: {
        type: DataTypes.INTEGER,
        references: {
          model: 'routes',
          key: 'id',
        },
      },
      invoice_date: {
        type: DataTypes.DATEONLY,
        allowNull: false,
      },
      subtotal: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: false,
      },
      discount_percent: {
        type: DataTypes.DECIMAL(5, 2),
        defaultValue: 0,
      },
      discount_amount: {
        type: DataTypes.DECIMAL(15, 2),
        defaultValue: 0,
      },
      total_amount: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: false,
      },
      payment_method: {
        type: DataTypes.ENUM('cash', 'credit', 'check'),
        allowNull: false,
      },
      payment_status: {
        type: DataTypes.ENUM('paid', 'unpaid', 'partial'),
        defaultValue: 'unpaid',
      },
      check_number: {
        type: DataTypes.STRING(50),
      },
      check_date: {
        type: DataTypes.DATEONLY,
      },
      clearance_date: {
        type: DataTypes.DATEONLY,
      },
      notes: {
        type: DataTypes.TEXT,
      },
      created_by: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id',
        },
      },
    },
    {
      tableName: 'sales_invoices',
      timestamps: true,
      updatedAt: 'updated_at',
      createdAt: 'created_at',
      indexes: [
        { fields: ['invoice_number'] },
        { fields: ['outlet_id'] },
        { fields: ['sales_ref_id'] },
        { fields: ['route_id'] },
        { fields: ['invoice_date'] },
        { fields: ['payment_status'] },
        { fields: ['check_number'] },
      ],
    }
  );

  return SalesInvoice;
};
