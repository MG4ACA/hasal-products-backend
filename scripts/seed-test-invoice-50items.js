/**
 * seed-test-invoice-50items.js
 *
 * Creates ONE test invoice with up to 50 line items using real SKUs and the
 * first available outlet in the database.  Run once:
 *
 *   node scripts/seed-test-invoice-50items.js
 *
 * The script is idempotent: it checks whether a TEST-50-ITEMS invoice already
 * exists and skips creation if found.
 */

require('dotenv').config();
const db = require('../models');
const { generateInvoiceNumber } = require('../utils/invoiceNumberGenerator');

const run = async () => {
  try {
    await db.sequelize.authenticate();
    console.log('✅ DB connected');

    /* ── 1. Check idempotency ─────────────────────────────────────── */
    const existing = await db.SalesInvoice.findOne({
      where: { notes: 'TEST-50-ITEMS' },
    });

    if (existing) {
      console.log(`ℹ️  Test invoice already exists: ${existing.invoice_number}`);
      console.log('   Find it in the app → Sales → Invoices and click Print.');
      process.exit(0);
    }

    /* ── 2. Resolve outlet ────────────────────────────────────────── */
    const outlet = await db.Outlet.findOne({ order: [['id', 'ASC']] });
    if (!outlet) {
      console.error('❌ No outlets found. Please seed outlets first.');
      process.exit(1);
    }
    console.log(`📦 Using outlet: ${outlet.name} (id=${outlet.id})`);

    /* ── 3. Resolve admin user (created_by) ───────────────────────── */
    const user = await db.User.findOne({ order: [['id', 'ASC']] });
    if (!user) {
      console.error('❌ No users found. Please seed the database first.');
      process.exit(1);
    }
    console.log(`👤 Using user: ${user.username} (id=${user.id})`);

    /* ── 4. Fetch up to 50 SKUs with their products ───────────────── */
    const skus = await db.ProductSku.findAll({
      where: { status: 'active' },
      include: [{ model: db.Product, as: 'product', where: { status: 'active' } }],
      order: [['id', 'ASC']],
      limit: 50,
    });

    if (skus.length === 0) {
      console.error('❌ No active SKUs found. Please seed products first.');
      process.exit(1);
    }
    console.log(`🛒 Found ${skus.length} SKUs`);

    /* ── 5. Build invoice items ───────────────────────────────────── */
    const items = skus.map((sku, index) => {
      const qty = (index % 3) + 1; // cycles 1, 2, 3
      // Use DB price when set; fall back to a sample price for test purposes
      const samplePrices = [250, 180, 320, 450, 520, 380, 220, 290, 310, 280];
      const price =
        parseFloat(sku.price) > 0
          ? parseFloat(sku.price)
          : samplePrices[index % samplePrices.length];
      const discPct = index % 5 === 0 ? 5 : 0; // every 5th item gets 5% disc
      const lineTotal = qty * price * (1 - discPct / 100);
      return {
        sku_id: sku.id,
        quantity: qty,
        unit_price: price,
        discount_percent: discPct,
        discount_amount: qty * price * (discPct / 100),
        total_amount: lineTotal,
        is_return: false,
      };
    });

    /* ── 6. Calculate invoice totals ──────────────────────────────── */
    const subtotal = items.reduce((s, i) => s + i.quantity * i.unit_price, 0);
    const discountAmount = items.reduce((s, i) => s + i.discount_amount, 0);
    const totalAmount = items.reduce((s, i) => s + i.total_amount, 0);

    /* ── 7. Generate invoice number ───────────────────────────────── */
    const invoiceDate = new Date();
    const invoiceNumber = await generateInvoiceNumber(invoiceDate);

    /* ── 8. Persist inside a transaction ─────────────────────────── */
    const t = await db.sequelize.transaction();

    try {
      const invoice = await db.SalesInvoice.create(
        {
          invoice_number: invoiceNumber,
          outlet_id: outlet.id,
          invoice_date: invoiceDate.toISOString().split('T')[0],
          subtotal: subtotal.toFixed(2),
          discount_amount: discountAmount.toFixed(2),
          invoice_discount_amount: 0,
          discount_percent: 0,
          total_amount: totalAmount.toFixed(2),
          payment_method: 'cash',
          payment_status: 'paid',
          notes: 'TEST-50-ITEMS',
          created_by: user.id,
        },
        { transaction: t }
      );

      // Attach invoice_id to each item row
      const itemRows = items.map(i => ({ ...i, invoice_id: invoice.id }));
      await db.InvoiceItem.bulkCreate(itemRows, { transaction: t });

      await t.commit();

      console.log('');
      console.log('╔══════════════════════════════════════════════════╗');
      console.log(`║  ✅  Test invoice created: ${invoiceNumber.padEnd(22)}║`);
      console.log(`║  📋  Items: ${String(items.length).padEnd(39)}║`);
      console.log(`║  💰  Total: Rs.${totalAmount.toFixed(2).padEnd(34)}║`);
      console.log('╠══════════════════════════════════════════════════╣');
      console.log('║  Open the app → Sales → Invoices                ║');
      console.log(`║  Search for: ${invoiceNumber.padEnd(37)}║`);
      console.log('║  Then click the Print button.                   ║');
      console.log('╚══════════════════════════════════════════════════╝');
    } catch (err) {
      await t.rollback();
      throw err;
    }
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  } finally {
    await db.sequelize.close();
  }
};

run();
