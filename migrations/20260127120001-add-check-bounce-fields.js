'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Add check bounce handling fields to payments table
    await queryInterface.addColumn('payments', 'payment_status', {
      type: Sequelize.ENUM('pending', 'cleared', 'bounced'),
      defaultValue: 'pending',
      comment: 'Check payment status lifecycle',
    });

    await queryInterface.addColumn('payments', 'bounce_date', {
      type: Sequelize.DATEONLY,
      allowNull: true,
      comment: 'Date when check bounced',
    });

    await queryInterface.addColumn('payments', 'bounce_fee', {
      type: Sequelize.DECIMAL(10, 2),
      defaultValue: 0,
      comment: 'Fee charged for bounced check',
    });

    await queryInterface.addColumn('payments', 'bounce_reason', {
      type: Sequelize.TEXT,
      allowNull: true,
      comment: 'Reason for check bounce',
    });

    await queryInterface.addColumn('payments', 'reversed_by', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: {
        model: 'users',
        key: 'id',
      },
      comment: 'User who processed the bounce reversal',
    });

    // Add check status to sales_invoices table
    await queryInterface.addColumn('sales_invoices', 'check_status', {
      type: Sequelize.ENUM('pending', 'cleared', 'bounced'),
      allowNull: true,
      comment: 'Status of check payment',
    });

    // Add index for payment_status for better query performance
    await queryInterface.addIndex('payments', ['payment_status']);
  },

  down: async queryInterface => {
    // Remove index first
    await queryInterface.removeIndex('payments', ['payment_status']);

    // Remove columns
    await queryInterface.removeColumn('payments', 'payment_status');
    await queryInterface.removeColumn('payments', 'bounce_date');
    await queryInterface.removeColumn('payments', 'bounce_fee');
    await queryInterface.removeColumn('payments', 'bounce_reason');
    await queryInterface.removeColumn('payments', 'reversed_by');
    await queryInterface.removeColumn('sales_invoices', 'check_status');
  },
};
