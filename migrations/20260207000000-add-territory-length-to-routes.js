'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Add territory_length field to routes table
    await queryInterface.addColumn('routes', 'territory_length', {
      type: Sequelize.DECIMAL(10, 2),
      allowNull: true,
      defaultValue: null,
      comment: 'Length of the route/territory in kilometers (km)',
      validate: {
        min: 0,
        max: 150,
      },
    });

    // Add index for better query performance
    await queryInterface.addIndex('routes', ['territory_length']);
  },

  down: async (queryInterface, Sequelize) => {
    // Remove the index
    await queryInterface.removeIndex('routes', ['territory_length']);
    // Remove the column
    await queryInterface.removeColumn('routes', 'territory_length');
  },
};
