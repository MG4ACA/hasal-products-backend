module.exports = (sequelize, DataTypes) => {
  const Payment = sequelize.define(
    'Payment',
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      outlet_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: 'outlets',
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
        type: DataTypes.ENUM('cash', 'bank_transfer', 'check'),
        allowNull: false,
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
      tableName: 'payments',
      timestamps: false,
      createdAt: 'created_at',
      indexes: [
        { fields: ['outlet_id'] },
        { fields: ['payment_date'] },
        { fields: ['check_number'] },
      ],
    }
  );

  return Payment;
};
