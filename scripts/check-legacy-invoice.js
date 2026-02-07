// Script to check if LEGACY-SYSTEM-SETUP invoice exists
const { sequelize, SalesInvoice, Outlet } = require('../models');

async function checkLegacyInvoice() {
  try {
    console.log('\n🔍 Checking for LEGACY-SYSTEM-SETUP invoice...\n');

    // Check if invoice exists
    const legacyInvoice = await SalesInvoice.findOne({
      where: { invoice_number: 'LEGACY-SYSTEM-SETUP' },
      include: [{ model: Outlet, as: 'outlet' }],
    });

    if (legacyInvoice) {
      console.log('✓ LEGACY-SYSTEM-SETUP invoice FOUND:');
      console.log(`  ID: ${legacyInvoice.id}`);
      console.log(`  Invoice Number: ${legacyInvoice.invoice_number}`);
      console.log(`  Date: ${legacyInvoice.invoice_date}`);
      console.log(`  Outlet: ${legacyInvoice.outlet?.name || 'N/A'}`);
      console.log(`  Total Amount: Rs. ${legacyInvoice.total_amount}`);
      console.log(`  Notes: ${legacyInvoice.notes || 'N/A'}`);
    } else {
      console.log('✗ LEGACY-SYSTEM-SETUP invoice NOT FOUND');
      console.log('\nTo create it, run:');
      console.log('  node scripts/create-legacy-invoice.js');
    }

    await sequelize.close();
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

checkLegacyInvoice();
