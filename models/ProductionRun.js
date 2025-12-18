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
        type: DataTypes.ENUM('completed', 'cancelled'),
        defaultValue: 'completed',
      },
      notes: {
        type: DataTypes.TEXT,
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
