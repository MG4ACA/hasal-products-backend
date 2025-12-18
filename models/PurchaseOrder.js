module.exports = (sequelize, DataTypes) => {
  const PurchaseOrder = sequelize.define(
    'PurchaseOrder',
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      po_number: {
        type: DataTypes.STRING(20),
        unique: true,
        allowNull: false,
      },
      supplier_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: 'suppliers',
          key: 'id',
        },
      },
      order_date: {
        type: DataTypes.DATEONLY,
        allowNull: false,
      },
      expected_date: {
        type: DataTypes.DATEONLY,
      },
      total_amount: {
        type: DataTypes.DECIMAL(15, 2),
        defaultValue: 0,
      },
      status: {
        type: DataTypes.ENUM('pending', 'partial', 'received', 'cancelled'),
        defaultValue: 'pending',
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
      tableName: 'purchase_orders',
      timestamps: true,
      updatedAt: 'updated_at',
      createdAt: 'created_at',
      indexes: [
        { fields: ['po_number'] },
        { fields: ['supplier_id'] },
        { fields: ['status'] },
        { fields: ['order_date'] },
      ],
    }
  );

  return PurchaseOrder;
};
