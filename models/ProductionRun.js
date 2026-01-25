module.exports = (sequelize, DataTypes) => {
  const ProductionRun = sequelize.define(
    'ProductionRun',
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      recipe_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: 'recipes',
          key: 'id',
        },
      },
      production_date: {
        type: DataTypes.DATEONLY,
        allowNull: false,
      },
      batch_number: {
        type: DataTypes.STRING(50),
        allowNull: false,
      },
      produced_by: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id',
        },
      },
      status: {
        type: DataTypes.ENUM('planned', 'in_progress', 'completed', 'cancelled'),
        defaultValue: 'planned',
      },
      notes: {
        type: DataTypes.TEXT,
      },
      expected_quantity: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
        comment: 'Expected output quantity based on recipe',
      },
      actual_quantity: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
        comment: 'Actual output quantity produced',
      },
      waste_quantity: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
        defaultValue: 0,
        comment: 'Waste/loss quantity',
      },
      waste_reason: {
        type: DataTypes.STRING(200),
        allowNull: true,
        comment: 'Reason for waste/loss',
      },
      yield_efficiency: {
        type: DataTypes.DECIMAL(5, 2),
        allowNull: true,
        comment: 'Yield efficiency % (actual/expected * 100)',
      },
    },
    {
      tableName: 'production_runs',
      timestamps: false,
      createdAt: 'created_at',
      indexes: [
        { fields: ['recipe_id'] },
        { fields: ['production_date'] },
        { fields: ['batch_number'] },
      ],
    }
  );

  return ProductionRun;
};
