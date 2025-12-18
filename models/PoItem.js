module.exports = (sequelize, DataTypes) => {
  const PoItem = sequelize.define(
    'PoItem',
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      po_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: 'purchase_orders',
          key: 'id',
        },
        onDelete: 'CASCADE',
      },
      material_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: 'raw_materials',
          key: 'id',
        },
      },
      quantity: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
      },
      unit_cost: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
      },
      total_amount: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: false,
      },
      received_quantity: {
        type: DataTypes.DECIMAL(10, 2),
        defaultValue: 0,
      },
      is_return: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
      },
      return_reason: {
        type: DataTypes.STRING(200),
      },
    },
    {
      tableName: 'po_items',
      timestamps: false,
      indexes: [{ fields: ['po_id'] }, { fields: ['is_return'] }],
    }
  );

  return PoItem;
};
