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
      batch_number: {
        type: DataTypes.STRING(50),
        allowNull: true,
        comment: 'Finished goods batch number for traceability',
      },
      production_date: {
        type: DataTypes.DATEONLY,
        allowNull: true,
        comment: 'Production date from parent run',
      },
      unit_cost: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
        defaultValue: 0,
        comment: 'Actual cost per unit',
      },
      total_cost: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: true,
        defaultValue: 0,
        comment: 'Total material cost for this batch',
      },
      waste_cost: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: true,
        defaultValue: 0,
        comment: 'Cost of wasted materials (separate allocation)',
      },
    },
    {
      tableName: 'production_output',
      timestamps: false,
      indexes: [{ fields: ['production_run_id'] }, { fields: ['batch_number'] }],
    }
  );

  return ProductionOutput;
};
