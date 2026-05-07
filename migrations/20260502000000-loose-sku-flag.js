'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Add is_loose flag to product_skus
    await queryInterface.addColumn('product_skus', 'is_loose', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      after: 'status',
    });
  },

  down: async queryInterface => {
    await queryInterface.removeColumn('product_skus', 'is_loose');
  },
};
