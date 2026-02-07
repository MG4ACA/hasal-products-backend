'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Create a special "LEGACY" invoice for reference
    // First, get the first outlet ID to use as reference
    const outlets = await queryInterface.sequelize.query(
      'SELECT id FROM outlets ORDER BY id ASC LIMIT 1',
      { type: queryInterface.sequelize.QueryTypes.SELECT }
    );

    const outletId = outlets.length > 0 ? outlets[0].id : 1;

    await queryInterface.bulkInsert('sales_invoices', [
      {
        invoice_number: 'LEGACY-SYSTEM-SETUP',
        invoice_date: '2000-01-01', // Clearly historical date
        outlet_id: outletId,
        payment_method: 'cash',
        payment_status: 'paid',
        subtotal: 0,
        discount_amount: 0,
        total_amount: 0,
        notes:
          'System placeholder for pre-implementation returns. Do not modify or delete. This is a reference invoice for tracking returns from purchases made before the POS system went live.',
        created_at: new Date(),
        updated_at: new Date(),
      },
    ]);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.bulkDelete('sales_invoices', {
      invoice_number: 'LEGACY-SYSTEM-SETUP',
    });
  },
};
