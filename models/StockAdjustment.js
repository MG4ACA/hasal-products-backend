module.exports = (sequelize, DataTypes) => {
  const StockAdjustment = sequelize.define(
    'StockAdjustment',
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      adjustment_type: {
        type: DataTypes.ENUM('add', 'reduce'),
        allowNull: false,
      },
      item_type: {
        type: DataTypes.ENUM('raw_material', 'finished_goods'),
        allowNull: false,
      },
      item_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      quantity: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
      },
      reason: {
        type: DataTypes.STRING(100),
        allowNull: false,
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
      tableName: 'stock_adjustments',
      timestamps: false,
      indexes: [{ fields: ['item_type', 'item_id'] }],
    }
  );

  return StockAdjustment;
};
