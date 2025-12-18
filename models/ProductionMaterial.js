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
        allowNull: false,
        references: {
          model: 'raw_material_batches',
          key: 'id',
        },
      },
      quantity_used: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
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
