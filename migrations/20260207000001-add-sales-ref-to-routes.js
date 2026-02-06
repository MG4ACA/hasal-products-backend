'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Add sales_ref_id to routes table (nullable initially to allow existing data)
    await queryInterface.addColumn('routes', 'sales_ref_id', {
      type: Sequelize.INTEGER,
      allowNull: true, // Nullable to allow existing routes
      references: {
        model: 'employees',
        key: 'id',
      },
      comment: 'Sales representative assigned to this route/territory',
    });

    // Add index for better query performance
    await queryInterface.addIndex('routes', ['sales_ref_id']);

    // Add foreign key constraint
    await queryInterface.addConstraint('routes', {
      fields: ['sales_ref_id'],
      type: 'foreign key',
      name: 'fk_routes_sales_ref',
      references: {
        table: 'employees',
        field: 'id',
      },
      onDelete: 'RESTRICT',
      onUpdate: 'CASCADE',
    });
  },

  down: async (queryInterface, Sequelize) => {
    // Remove foreign key constraint
    await queryInterface.removeConstraint('routes', 'fk_routes_sales_ref');
    // Remove index
    await queryInterface.removeIndex('routes', ['sales_ref_id']);
    // Remove column
    await queryInterface.removeColumn('routes', 'sales_ref_id');
  },
};
