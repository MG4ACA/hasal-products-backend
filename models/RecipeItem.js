module.exports = (sequelize, DataTypes) => {
  const RecipeItem = sequelize.define(
    'RecipeItem',
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
        onDelete: 'CASCADE',
      },
      material_type: {
        type: DataTypes.ENUM('raw_material', 'finished_product'),
        allowNull: false,
        defaultValue: 'raw_material',
      },
      material_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
          model: 'raw_materials',
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
      quantity: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
      },
      unit: {
        type: DataTypes.STRING(20),
        allowNull: false,
      },
      unit_cost: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
        defaultValue: null,
        comment: 'For finished_product items: price used for costing (editable)',
      },
    },
    {
      tableName: 'recipe_items',
      timestamps: false,
      indexes: [{ fields: ['recipe_id'] }],
    }
  );

  return RecipeItem;
};
