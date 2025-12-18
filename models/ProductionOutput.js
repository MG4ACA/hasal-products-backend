module.exports = (sequelize, DataTypes) => {
  const ProductionOutput = sequelize.define(
    'ProductionOutput',
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      production_run_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: 'production_runs',
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
      quantity_produced: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
      },
    },
    {
      tableName: 'production_output',
      timestamps: false,
      indexes: [{ fields: ['production_run_id'] }],
    }
  );

  return ProductionOutput;
};
