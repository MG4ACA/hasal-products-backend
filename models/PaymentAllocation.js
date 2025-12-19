module.exports = (sequelize, DataTypes) => {
  const PaymentAllocation = sequelize.define(
    'PaymentAllocation',
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      payment_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: 'payments',
          key: 'id',
        },
      },
      invoice_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: 'sales_invoices',
          key: 'id',
        },
      },
      allocated_amount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        validate: {
          min: 0.01,
        },
      },
    },
    {
      tableName: 'payment_allocations',
      timestamps: true,
      createdAt: 'created_at',
      updatedAt: false,
    }
  );

  return PaymentAllocation;
};
