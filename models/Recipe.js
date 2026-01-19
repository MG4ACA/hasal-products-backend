module.exports = (sequelize, DataTypes) => {
  const Recipe = sequelize.define(
    'Recipe',
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      code: {
        type: DataTypes.STRING(20),
        allowNull: false,
      },
      name: {
        type: DataTypes.STRING(100),
        allowNull: false,
      },
      product_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
          model: 'products',
          key: 'id',
        },
      },
      product_sku_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
          model: 'product_skus',
          key: 'id',
        },
      },
      version: {
        type: DataTypes.INTEGER,
        defaultValue: 1,
      },
      expected_yield: {
        type: DataTypes.DECIMAL(10, 2),
      },
      yield_unit: {
        type: DataTypes.STRING(20),
      },
      is_active: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
      },
      notes: {
        type: DataTypes.TEXT,
      },
    },
    {
      tableName: 'recipes',
      timestamps: true,
      updatedAt: 'updated_at',
      createdAt: 'created_at',
      indexes: [
        { fields: ['code'] },
        { fields: ['is_active'] },
        { fields: ['code', 'version'], unique: true },
        { fields: ['product_id'] },
        { fields: ['product_sku_id'] },
      ],
    }
  );

  return Recipe;
};
