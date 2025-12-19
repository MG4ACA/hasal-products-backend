'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('raw_material_batches', 'batch_type', {
      type: Sequelize.ENUM('receipt', 'return'),
      allowNull: false,
      defaultValue: 'receipt',
      after: 'batch_number',
    });

    await queryInterface.addColumn('raw_material_batches', 'return_reason', {
      type: Sequelize.STRING(255),
      allowNull: true,
      after: 'batch_type',
    });

    await queryInterface.addColumn('raw_material_batches', 'return_disposition', {
      type: Sequelize.ENUM('stock', 'dispose'),
      allowNull: true,
      after: 'return_reason',
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('raw_material_batches', 'return_disposition');
    await queryInterface.removeColumn('raw_material_batches', 'return_reason');
    await queryInterface.removeColumn('raw_material_batches', 'batch_type');
  },
};
