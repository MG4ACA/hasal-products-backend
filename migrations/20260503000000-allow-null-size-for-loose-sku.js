'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Allow NULL for size column to support loose SKUs
    await queryInterface.changeColumn('product_skus', 'size', {
      type: Sequelize.STRING(20),
      allowNull: true,
    });
  },

  down: async queryInterface => {
    // Revert back to NOT NULL
    await queryInterface.changeColumn('product_skus', 'size', {
      type: Sequelize.STRING(20),
      allowNull: false,
    });
  },
};
