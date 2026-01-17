'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Add payment_status column
    await queryInterface.addColumn('supplier_payments', 'payment_status', {
      type: Sequelize.ENUM('pending', 'cleared', 'cancelled', 'bounced'),
      allowNull: false,
      defaultValue: 'cleared', // Default for existing records
      after: 'payment_method',
    });

    // Add index for payment_status
    await queryInterface.addIndex('supplier_payments', ['payment_status'], {
      name: 'idx_supplier_payments_payment_status',
    });

    console.log('✅ Added payment_status column with index');
  },

  down: async (queryInterface, Sequelize) => {
    // Remove index
    await queryInterface.removeIndex('supplier_payments', 'idx_supplier_payments_payment_status');

    // Remove column
    await queryInterface.removeColumn('supplier_payments', 'payment_status');

    console.log('✅ Removed payment_status column and index');
  },
};
