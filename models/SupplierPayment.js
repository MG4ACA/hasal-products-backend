module.exports = (sequelize, DataTypes) => {
  const SupplierPayment = sequelize.define(
    'SupplierPayment',
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      supplier_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: 'suppliers',
          key: 'id',
        },
      },
      purchase_order_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
          model: 'purchase_orders',
          key: 'id',
        },
      },
      payment_date: {
        type: DataTypes.DATEONLY,
        allowNull: false,
      },
      amount: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: false,
      },
      payment_method: {
        type: DataTypes.ENUM('cash', 'credit', 'bank_transfer', 'check'),
        allowNull: false,
      },
      payment_status: {
        type: DataTypes.ENUM('pending', 'cleared', 'cancelled', 'bounced'),
        allowNull: false,
        defaultValue: 'cleared',
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
      reference: {
        type: DataTypes.STRING(100),
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
      tableName: 'supplier_payments',
      timestamps: false,
      createdAt: 'created_at',
      indexes: [
        { fields: ['supplier_id'] },
        { fields: ['purchase_order_id'] },
        { fields: ['payment_date'] },
        { fields: ['payment_status'] },
        { fields: ['check_number'] },
      ],
    }
  );

  return SupplierPayment;
};
