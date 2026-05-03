'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // ─── recipe_items: support finished-product ingredients ───────────────────
    await queryInterface.changeColumn('recipe_items', 'material_id', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: { model: 'raw_materials', key: 'id' },
    });

    await queryInterface.addColumn('recipe_items', 'material_type', {
      type: Sequelize.ENUM('raw_material', 'finished_product'),
      allowNull: false,
      defaultValue: 'raw_material',
      after: 'material_id',
    });

    await queryInterface.addColumn('recipe_items', 'product_sku_id', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: { model: 'product_skus', key: 'id' },
      after: 'material_type',
    });

    // unit_cost: for finished-product items this stores the price used for costing
    await queryInterface.addColumn('recipe_items', 'unit_cost', {
      type: Sequelize.DECIMAL(10, 2),
      allowNull: true,
      defaultValue: null,
      after: 'unit',
    });

    // ─── production_materials: support finished-product inputs ────────────────
    await queryInterface.changeColumn('production_materials', 'batch_id', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: { model: 'raw_material_batches', key: 'id' },
    });

    await queryInterface.addColumn('production_materials', 'material_type', {
      type: Sequelize.ENUM('raw_material', 'finished_product'),
      allowNull: false,
      defaultValue: 'raw_material',
      after: 'batch_id',
    });

    await queryInterface.addColumn('production_materials', 'product_sku_id', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: { model: 'product_skus', key: 'id' },
      after: 'material_type',
    });

    // product_output_id: tracks which ProductionOutput batch was consumed (FIFO)
    await queryInterface.addColumn('production_materials', 'product_output_id', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: { model: 'production_output', key: 'id' },
      after: 'product_sku_id',
    });

    await queryInterface.addColumn('production_materials', 'unit_cost', {
      type: Sequelize.DECIMAL(10, 2),
      allowNull: true,
      defaultValue: null,
      after: 'quantity_used',
    });
  },

  down: async (queryInterface, Sequelize) => {
    // production_materials rollback
    await queryInterface.removeColumn('production_materials', 'unit_cost');
    await queryInterface.removeColumn('production_materials', 'product_output_id');
    await queryInterface.removeColumn('production_materials', 'product_sku_id');
    await queryInterface.removeColumn('production_materials', 'material_type');
    await queryInterface.changeColumn('production_materials', 'batch_id', {
      type: Sequelize.INTEGER,
      allowNull: false,
      references: { model: 'raw_material_batches', key: 'id' },
    });

    // recipe_items rollback
    await queryInterface.removeColumn('recipe_items', 'unit_cost');
    await queryInterface.removeColumn('recipe_items', 'product_sku_id');
    await queryInterface.removeColumn('recipe_items', 'material_type');
    await queryInterface.changeColumn('recipe_items', 'material_id', {
      type: Sequelize.INTEGER,
      allowNull: false,
      references: { model: 'raw_materials', key: 'id' },
    });
  },
};
