'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('payment_allocations', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      payment_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'payments',
          key: 'id',
        },
        onDelete: 'CASCADE',
      },
      invoice_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'sales_invoices',
          key: 'id',
        },
        onDelete: 'CASCADE',
      },
      allocated_amount: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
      },
      created_at: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
    });

    // Add indexes for better query performance
    await queryInterface.addIndex('payment_allocations', ['payment_id']);
    await queryInterface.addIndex('payment_allocations', ['invoice_id']);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('payment_allocations');
  },
};
