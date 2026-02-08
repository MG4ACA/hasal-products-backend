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
        comment: 'Invoice-level discount percentage applied to net amount',
      },
      discount_amount: {
        type: DataTypes.DECIMAL(15, 2),
        defaultValue: 0,
        comment: 'Sum of all item-level discount amounts',
      },
      invoice_discount_amount: {
        type: DataTypes.DECIMAL(15, 2),
        defaultValue: 0,
        comment: 'Calculated invoice-level discount amount in currency',
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
      // Phase 2: Check status tracking
      check_status: {
        type: DataTypes.ENUM('pending', 'cleared', 'bounced'),
        allowNull: true,
        comment: 'Status of check payment',
      },
      notes: {
        type: DataTypes.TEXT,
      },
      // Credit limit override fields (Phase 1)
      credit_limit_override_reason: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'Reason provided by admin when overriding credit limit',
      },
      credit_limit_override_by: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
          model: 'users',
          key: 'id',
        },
        comment: 'User ID who overrode credit limit',
      },
      // Audit snapshot fields (Phase 1)
      credit_limit_at_time: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: true,
        comment: 'Snapshot of outlet credit limit at invoice creation',
      },
      outlet_balance_at_time: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: true,
        comment: 'Snapshot of outlet balance at invoice creation',
      },
      // Paid amount virtual field (Phase 1)
      paid_amount: {
        type: DataTypes.VIRTUAL,
        get() {
          // Calculate from payment allocations
          if (this.allocations && Array.isArray(this.allocations)) {
            return this.allocations.reduce(
              (sum, alloc) => sum + parseFloat(alloc.allocated_amount || 0),
              0
            );
          }
          return 0;
        },
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
