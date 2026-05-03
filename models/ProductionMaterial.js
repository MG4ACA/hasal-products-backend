module.exports = (sequelize, DataTypes) => {
  const ProductionMaterial = sequelize.define(
    'ProductionMaterial',
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
      batch_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
          model: 'raw_material_batches',
          key: 'id',
        },
      },
      material_type: {
        type: DataTypes.ENUM('raw_material', 'finished_product'),
        allowNull: false,
        defaultValue: 'raw_material',
      },
      product_sku_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
          model: 'product_skus',
          key: 'id',
        },
      },
      product_output_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
          model: 'production_output',
          key: 'id',
        },
        comment: 'Which ProductionOutput batch was consumed (FIFO)',
      },
      quantity_used: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
      },
      unit_cost: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
        defaultValue: null,
        comment: 'Unit cost at time of consumption (selling price for finished products)',
      },
    },
    {
      tableName: 'production_materials',
      timestamps: false,
      indexes: [{ fields: ['production_run_id'] }],
    }
  );

  return ProductionMaterial;
};
