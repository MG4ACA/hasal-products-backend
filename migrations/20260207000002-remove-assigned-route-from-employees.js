'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Remove assigned_route_id from employees table
    await queryInterface.removeColumn('employees', 'assigned_route_id');
  },

  down: async (queryInterface, Sequelize) => {
    // Add back assigned_route_id column
    await queryInterface.addColumn('employees', 'assigned_route_id', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: {
        model: 'routes',
        key: 'id',
      },
    });

    // Add index
    await queryInterface.addIndex('employees', ['assigned_route_id']);
  },
};
