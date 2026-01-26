'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Add return validation fields to invoice_items table
    await queryInterface.addColumn('invoice_items', 'original_invoice_id', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: {
        model: 'sales_invoices',
        key: 'id',
      },
      comment: 'Reference to original purchase invoice for returns',
    });

    await queryInterface.addColumn('invoice_items', 'original_invoice_item_id', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: {
        model: 'invoice_items',
        key: 'id',
      },
      comment: 'Reference to original item being returned',
    });

    await queryInterface.addColumn('invoice_items', 'return_policy_override', {
      type: Sequelize.BOOLEAN,
      defaultValue: false,
      comment: 'Admin override for out-of-policy returns',
    });

    await queryInterface.addColumn('invoice_items', 'return_policy_override_reason', {
      type: Sequelize.TEXT,
      allowNull: true,
      comment: 'Reason for admin override',
    });

    await queryInterface.addColumn('invoice_items', 'return_policy_override_by', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: {
        model: 'users',
        key: 'id',
      },
      comment: 'Admin who approved the override',
    });

    // Add indexes for performance
    await queryInterface.addIndex('invoice_items', ['original_invoice_id']);
    await queryInterface.addIndex('invoice_items', ['original_invoice_item_id']);
  },

  down: async queryInterface => {
    // Remove indexes first
    await queryInterface.removeIndex('invoice_items', ['original_invoice_id']);
    await queryInterface.removeIndex('invoice_items', ['original_invoice_item_id']);

    // Remove columns
    await queryInterface.removeColumn('invoice_items', 'original_invoice_id');
    await queryInterface.removeColumn('invoice_items', 'original_invoice_item_id');
    await queryInterface.removeColumn('invoice_items', 'return_policy_override');
    await queryInterface.removeColumn('invoice_items', 'return_policy_override_reason');
    await queryInterface.removeColumn('invoice_items', 'return_policy_override_by');
  },
};
