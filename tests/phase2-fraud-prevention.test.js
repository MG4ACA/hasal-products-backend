/**
 * Phase 2: Fraud Prevention - Test Suite
 * Tests for Return Validation and Check Bounce Handling
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:5000/api';

// Test credentials
let adminToken = '';
let cashierToken = '';
let testOutletId = null;
let testProductSkuId = null;
let testOriginalInvoiceId = null;
let testCheckPaymentId = null;

// Login helper
async function login(username, password) {
  const response = await axios.post(`${BASE_URL}/auth/login`, {
    username,
    password,
  });
  return response.data.data.token; // Fixed: was response.data.token
}

// Color output helpers
const green = text => `\x1b[32m${text}\x1b[0m`;
const red = text => `\x1b[31m${text}\x1b[0m`;
const yellow = text => `\x1b[33m${text}\x1b[0m`;
const blue = text => `\x1b[34m${text}\x1b[0m`;

// Test runner
async function runTest(testName, testFn) {
  try {
    await testFn();
    console.log(green(`✓ ${testName}`));
    return true;
  } catch (error) {
    console.log(red(`✗ ${testName}`));
    console.log(red(`  Error: ${error.message}`));
    if (error.response?.data) {
      console.log(red(`  Response: ${JSON.stringify(error.response.data, null, 2)}`));
    }
    return false;
  }
}

// Setup test data
async function setup() {
  console.log(blue('\n=== Phase 2: Fraud Prevention Tests ===\n'));
  console.log(yellow('Setting up test data...'));

  try {
    // Login as admin and cashier
    adminToken = await login('admin', 'admin123');
    console.log(green('✓ Admin login successful'));

    cashierToken = await login('cashier1', 'cashier123'); // Changed from 'cashier' to 'cashier1'
    console.log(green('✓ Cashier login successful'));

    // Get a test outlet
    const outletResponse = await axios.get(`${BASE_URL}/outlets?limit=1`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    if (!outletResponse.data.data.outlets || outletResponse.data.data.outlets.length === 0) {
      throw new Error(
        'No outlets found in database. Please run seeders first: node scripts/seeders.js'
      );
    }

    testOutletId = outletResponse.data.data.outlets[0].id;
    console.log(green(`✓ Found test outlet (ID: ${testOutletId})`));

    // Get a test product with SKUs
    const productsResponse = await axios.get(`${BASE_URL}/products?page=1&limit=1`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    if (!productsResponse.data.data.data || productsResponse.data.data.data.length === 0) {
      throw new Error(
        'No products found in database. Please run seeders first: node scripts/seeders.js'
      );
    }

    const product = productsResponse.data.data.data[0];
    if (!product.skus || product.skus.length === 0) {
      throw new Error('Product has no SKUs. Please ensure seeders create products with SKUs.');
    }

    testProductSkuId = product.skus[0].id;
    console.log(green(`✓ Found test product SKU (ID: ${testProductSkuId})`));

    console.log(green('\n✓ Setup complete\n'));
  } catch (error) {
    console.error(red('\n✗ Setup failed:'));
    if (error.response) {
      console.error(red(`  Status: ${error.response.status}`));
      console.error(red(`  Message: ${JSON.stringify(error.response.data, null, 2)}`));
    } else {
      console.error(red(`  ${error.message}`));
    }
    throw error;
  }
}

// ==================== PART 1: RETURN VALIDATION TESTS ====================

async function testCreateOriginalPurchase() {
  // Create an original purchase invoice to test returns against
  const response = await axios.post(
    `${BASE_URL}/sales-invoices`,
    {
      outlet_id: testOutletId,
      invoice_date: '2026-01-20', // 7 days ago
      items: [
        {
          sku_id: testProductSkuId,
          quantity: 5, // Reduced from 10 to work with available stock
          unit_price: 100,
          discount_percent: 0,
        },
      ],
      payment_method: 'cash',
    },
    { headers: { Authorization: `Bearer ${cashierToken}` } }
  );

  testOriginalInvoiceId = response.data.data.invoice.id;
  console.log(`  Original Invoice ID: ${testOriginalInvoiceId}`);

  if (!testOriginalInvoiceId) throw new Error('Failed to create original invoice');
}

async function testReturnWithinPolicy() {
  // Test return within 7 days for damaged goods
  const response = await axios.post(
    `${BASE_URL}/sales-invoices`,
    {
      outlet_id: testOutletId,
      invoice_date: '2026-01-27', // Today
      items: [
        {
          sku_id: testProductSkuId,
          quantity: 2,
          unit_price: 100,
          is_return: true,
          return_reason: 'damaged',
          return_to_stock: false,
          original_invoice_id: testOriginalInvoiceId,
        },
      ],
      payment_method: 'cash',
    },
    { headers: { Authorization: `Bearer ${cashierToken}` } }
  );

  const returnedItem = response.data.data.invoice.items[0];
  if (!returnedItem || parseFloat(returnedItem.quantity) !== -2) {
    console.log('  Response:', JSON.stringify(response.data.data.invoice, null, 2));
    throw new Error(`Return quantity should be negative. Got: ${returnedItem?.quantity}`);
  }
}

async function testReturnWithoutOriginalInvoice() {
  // Should fail - returns require original invoice reference
  try {
    await axios.post(
      `${BASE_URL}/sales-invoices`,
      {
        outlet_id: testOutletId,
        invoice_date: '2026-01-27',
        items: [
          {
            sku_id: testProductSkuId,
            quantity: 1,
            unit_price: 100,
            is_return: true,
            return_reason: 'damaged',
          },
        ],
        payment_method: 'cash',
      },
      { headers: { Authorization: `Bearer ${cashierToken}` } }
    );
    throw new Error('Should have failed - missing original invoice reference');
  } catch (error) {
    if (error.response?.status === 400 && error.response.data.message.includes('original')) {
      return; // Expected error
    }
    throw error;
  }
}

async function testReturnExceedingTimeLimit() {
  // Create old invoice (40 days ago)
  const oldInvoice = await axios.post(
    `${BASE_URL}/sales-invoices`,
    {
      outlet_id: testOutletId,
      invoice_date: '2025-12-18', // 40 days ago - exceeds 30 day limit for expired
      items: [
        {
          sku_id: testProductSkuId,
          quantity: 5,
          unit_price: 100,
        },
      ],
      payment_method: 'cash',
    },
    { headers: { Authorization: `Bearer ${cashierToken}` } }
  );

  const oldInvoiceId = oldInvoice.data.data.invoice.id;

  // Try to return as cashier - should fail
  try {
    await axios.post(
      `${BASE_URL}/sales-invoices`,
      {
        outlet_id: testOutletId,
        invoice_date: '2026-01-27',
        items: [
          {
            sku_id: testProductSkuId,
            quantity: 1,
            unit_price: 100,
            is_return: true,
            return_reason: 'expired',
            original_invoice_id: oldInvoiceId,
          },
        ],
        payment_method: 'cash',
      },
      { headers: { Authorization: `Bearer ${cashierToken}` } }
    );
    throw new Error('Should have failed - exceeds time limit');
  } catch (error) {
    if (error.response?.status === 400 && error.response.data.message.includes('policy')) {
      return; // Expected error
    }
    throw error;
  }
}

async function testAdminOverrideReturn() {
  // Create old invoice
  const oldInvoice = await axios.post(
    `${BASE_URL}/sales-invoices`,
    {
      outlet_id: testOutletId,
      invoice_date: '2025-12-10', // 48 days ago
      items: [
        {
          sku_id: testProductSkuId,
          quantity: 5,
          unit_price: 100,
        },
      ],
      payment_method: 'cash',
    },
    { headers: { Authorization: `Bearer ${adminToken}` } }
  );

  const oldInvoiceId = oldInvoice.data.data.invoice.id;

  // Admin can override with reason
  const response = await axios.post(
    `${BASE_URL}/sales-invoices`,
    {
      outlet_id: testOutletId,
      invoice_date: '2026-01-27',
      items: [
        {
          sku_id: testProductSkuId,
          quantity: 1,
          unit_price: 100,
          is_return: true,
          return_reason: 'quality_issue',
          original_invoice_id: oldInvoiceId,
          return_policy_override: true,
          return_policy_override_reason: 'Customer is VIP, exceptional circumstance',
        },
      ],
      payment_method: 'cash',
    },
    { headers: { Authorization: `Bearer ${adminToken}` } }
  );

  if (!response.data.data.invoice.items[0].return_policy_override) {
    throw new Error('Override flag not set');
  }
}

async function testAdminOverrideWithoutReason() {
  // Admin override requires reason
  const oldInvoice = await axios.post(
    `${BASE_URL}/sales-invoices`,
    {
      outlet_id: testOutletId,
      invoice_date: '2025-12-01',
      items: [
        {
          sku_id: testProductSkuId,
          quantity: 5,
          unit_price: 100,
        },
      ],
      payment_method: 'cash',
    },
    { headers: { Authorization: `Bearer ${adminToken}` } }
  );

  const oldInvoiceId = oldInvoice.data.data.invoice.id;

  try {
    await axios.post(
      `${BASE_URL}/sales-invoices`,
      {
        outlet_id: testOutletId,
        invoice_date: '2026-01-27',
        items: [
          {
            sku_id: testProductSkuId,
            quantity: 1,
            unit_price: 100,
            is_return: true,
            return_reason: 'other',
            original_invoice_id: oldInvoiceId,
            return_policy_override: true,
            // Missing return_policy_override_reason
          },
        ],
        payment_method: 'cash',
      },
      { headers: { Authorization: `Bearer ${adminToken}` } }
    );
    throw new Error('Should have failed - override requires reason');
  } catch (error) {
    if (error.response?.status === 400 && error.response.data.message.includes('reason')) {
      return; // Expected
    }
    throw error;
  }
}

async function testReturnExceedingQuantity() {
  // Try to return more than purchased
  try {
    await axios.post(
      `${BASE_URL}/sales-invoices`,
      {
        outlet_id: testOutletId,
        invoice_date: '2026-01-27',
        items: [
          {
            sku_id: testProductSkuId,
            quantity: 20, // More than original 10
            unit_price: 100,
            is_return: true,
            return_reason: 'excess',
            original_invoice_id: testOriginalInvoiceId,
          },
        ],
        payment_method: 'cash',
      },
      { headers: { Authorization: `Bearer ${cashierToken}` } }
    );
    throw new Error('Should have failed - exceeds purchased quantity');
  } catch (error) {
    if (error.response?.status === 400 && error.response.data.message.includes('exceeds')) {
      return; // Expected
    }
    throw error;
  }
}

async function testGetPurchaseHistory() {
  const response = await axios.get(
    `${BASE_URL}/sales-invoices/purchase-history?outlet_id=${testOutletId}&sku_id=${testProductSkuId}`,
    { headers: { Authorization: `Bearer ${cashierToken}` } }
  );

  if (!response.data.data.purchases || response.data.data.purchases.length === 0) {
    throw new Error('No purchase history found');
  }

  console.log(`  Found ${response.data.data.purchases.length} purchases in history`);
}

// ==================== PART 2: CHECK BOUNCE HANDLING TESTS ====================

async function testCreateCheckInvoice() {
  // Create invoice with check payment
  const response = await axios.post(
    `${BASE_URL}/sales-invoices`,
    {
      outlet_id: testOutletId,
      invoice_date: '2026-01-27',
      items: [
        {
          sku_id: testProductSkuId,
          quantity: 1, // Reduced to 1 to avoid stock issues
          unit_price: 100,
        },
      ],
      payment_method: 'credit', // Change to credit first, then pay with check
    },
    { headers: { Authorization: `Bearer ${cashierToken}` } }
  );

  const invoiceId = response.data.data.invoice.id;
  const invoiceAmount = response.data.data.invoice.total_amount;

  // Create payment record for this invoice with check
  const paymentResponse = await axios.post(
    `${BASE_URL}/payments`,
    {
      outlet_id: testOutletId,
      payment_date: '2026-01-27',
      amount: invoiceAmount,
      payment_method: 'check',
      check_number: 'CHK-TEST-001',
      check_date: '2026-01-27',
      allocations: [
        {
          invoice_id: invoiceId,
          allocated_amount: invoiceAmount,
        },
      ],
    },
    { headers: { Authorization: `Bearer ${adminToken}` } }
  );

  testCheckPaymentId = paymentResponse.data.data.id;
  console.log(`  Check Payment ID: ${testCheckPaymentId}`);

  if (!testCheckPaymentId) throw new Error('Failed to create check payment');
  if (paymentResponse.data.data.payment_status !== 'pending') {
    throw new Error('Check payment status should be pending');
  }
}

async function testClearCheck() {
  // Clear the check
  const response = await axios.post(
    `${BASE_URL}/payments/${testCheckPaymentId}/clear`,
    {
      clearance_date: '2026-01-28',
    },
    { headers: { Authorization: `Bearer ${adminToken}` } }
  );

  if (response.data.data.payment.payment_status !== 'cleared') {
    throw new Error('Payment status should be cleared');
  }
}

async function testBounceCheckWithoutReason() {
  // Create invoice for check payment
  const invoiceResponse = await axios.post(
    `${BASE_URL}/sales-invoices`,
    {
      outlet_id: testOutletId,
      invoice_date: '2026-01-27',
      items: [
        {
          sku_id: testProductSkuId,
          quantity: 1,
          unit_price: 500,
        },
      ],
      payment_method: 'credit',
    },
    { headers: { Authorization: `Bearer ${cashierToken}` } }
  );

  const invoiceId = invoiceResponse.data.data.invoice.id;

  // Create check payment with allocation
  const paymentResponse = await axios.post(
    `${BASE_URL}/payments`,
    {
      outlet_id: testOutletId,
      payment_date: '2026-01-27',
      amount: 500,
      payment_method: 'check',
      check_number: 'CHK-TEST-002',
      check_date: '2026-01-27',
      allocations: [
        {
          invoice_id: invoiceId,
          allocated_amount: 500,
        },
      ],
    },
    { headers: { Authorization: `Bearer ${adminToken}` } }
  );

  const paymentId = paymentResponse.data.data.id;

  // Try to bounce without reason - should fail
  try {
    await axios.post(
      `${BASE_URL}/payments/${paymentId}/bounce`,
      {},
      { headers: { Authorization: `Bearer ${adminToken}` } }
    );
    throw new Error('Should have failed - bounce requires reason');
  } catch (error) {
    if (error.response?.status === 400 && error.response.data.message.includes('reason')) {
      return; // Expected
    }
    throw error;
  }
}

async function testBounceCheckAsNonAdmin() {
  // Create invoice for check payment
  const invoiceResponse = await axios.post(
    `${BASE_URL}/sales-invoices`,
    {
      outlet_id: testOutletId,
      invoice_date: '2026-01-27',
      items: [
        {
          sku_id: testProductSkuId,
          quantity: 1,
          unit_price: 500,
        },
      ],
      payment_method: 'credit',
    },
    { headers: { Authorization: `Bearer ${cashierToken}` } }
  );

  const invoiceId = invoiceResponse.data.data.invoice.id;

  // Create check payment with allocation
  const paymentResponse = await axios.post(
    `${BASE_URL}/payments`,
    {
      outlet_id: testOutletId,
      payment_date: '2026-01-27',
      amount: 500,
      payment_method: 'check',
      check_number: 'CHK-TEST-003',
      check_date: '2026-01-27',
      allocations: [
        {
          invoice_id: invoiceId,
          allocated_amount: 500,
        },
      ],
    },
    { headers: { Authorization: `Bearer ${adminToken}` } }
  );

  const paymentId = paymentResponse.data.data.id;

  // Try to bounce as cashier - should fail
  try {
    await axios.post(
      `${BASE_URL}/payments/${paymentId}/bounce`,
      {
        bounce_reason: 'Insufficient funds',
      },
      { headers: { Authorization: `Bearer ${cashierToken}` } }
    );
    throw new Error('Should have failed - only admins can bounce checks');
  } catch (error) {
    if (error.response?.status === 403) {
      return; // Expected
    }
    throw error;
  }
}

async function testBounceCheckSuccess() {
  // Create invoice with credit payment
  const invoiceResponse = await axios.post(
    `${BASE_URL}/sales-invoices`,
    {
      outlet_id: testOutletId,
      invoice_date: '2026-01-27',
      items: [
        {
          sku_id: testProductSkuId,
          quantity: 1,
          unit_price: 500,
        },
      ],
      payment_method: 'credit',
    },
    { headers: { Authorization: `Bearer ${cashierToken}` } }
  );

  const invoiceId = invoiceResponse.data.data.invoice.id;

  // Create payment with allocation
  const paymentResponse = await axios.post(
    `${BASE_URL}/payments`,
    {
      outlet_id: testOutletId,
      payment_date: '2026-01-27',
      amount: 500,
      payment_method: 'check',
      check_number: 'CHK-TEST-BOUNCE',
      check_date: '2026-01-27',
      allocations: [
        {
          invoice_id: invoiceId,
          allocated_amount: 500,
        },
      ],
    },
    { headers: { Authorization: `Bearer ${adminToken}` } }
  );

  testBouncedPaymentId = paymentResponse.data.data.id;

  // Get outlet balance before bounce
  const outletBefore = await axios.get(`${BASE_URL}/outlets/${testOutletId}`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const balanceBefore = parseFloat(outletBefore.data.data.balance);

  // Bounce the check with fee
  const bounceResponse = await axios.post(
    `${BASE_URL}/payments/${testBouncedPaymentId}/bounce`,
    {
      bounce_reason: 'Insufficient funds - check returned by bank',
      bounce_fee: 50,
    },
    { headers: { Authorization: `Bearer ${adminToken}` } }
  );

  if (bounceResponse.data.data.payment.payment_status !== 'bounced') {
    throw new Error('Payment status should be bounced');
  }

  if (bounceResponse.data.data.reversed_allocations !== 1) {
    throw new Error('Should have reversed 1 allocation');
  }

  // Verify outlet balance restored + bounce fee
  const outletAfter = await axios.get(`${BASE_URL}/outlets/${testOutletId}`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const balanceAfter = parseFloat(outletAfter.data.data.balance);

  // Balance should increase by payment amount (500) + bounce fee (50)
  const expectedIncrease = 500 + 50;
  const actualIncrease = balanceAfter - balanceBefore;

  if (Math.abs(actualIncrease - expectedIncrease) > 0.01) {
    throw new Error(
      `Balance not restored correctly. Expected increase: ${expectedIncrease}, Actual: ${actualIncrease}`
    );
  }
}

async function testClearAlreadyBouncedCheck() {
  // Create invoice for check payment
  const invoiceResponse = await axios.post(
    `${BASE_URL}/sales-invoices`,
    {
      outlet_id: testOutletId,
      invoice_date: '2026-01-27',
      items: [
        {
          sku_id: testProductSkuId,
          quantity: 1,
          unit_price: 300,
        },
      ],
      payment_method: 'credit',
    },
    { headers: { Authorization: `Bearer ${cashierToken}` } }
  );

  const invoiceId = invoiceResponse.data.data.invoice.id;

  // Create payment with allocation and bounce it
  const paymentResponse = await axios.post(
    `${BASE_URL}/payments`,
    {
      outlet_id: testOutletId,
      payment_date: '2026-01-27',
      amount: 300,
      payment_method: 'check',
      check_number: 'CHK-TEST-BOUNCED',
      check_date: '2026-01-27',
      allocations: [
        {
          invoice_id: invoiceId,
          allocated_amount: 300,
        },
      ],
    },
    { headers: { Authorization: `Bearer ${adminToken}` } }
  );

  const paymentId = paymentResponse.data.data.id;

  // Bounce it
  await axios.post(
    `${BASE_URL}/payments/${paymentId}/bounce`,
    {
      bounce_reason: 'Test bounce',
    },
    { headers: { Authorization: `Bearer ${adminToken}` } }
  );

  // Try to clear it - should fail
  try {
    await axios.post(
      `${BASE_URL}/payments/${paymentId}/clear`,
      {
        clearance_date: '2026-01-28',
      },
      { headers: { Authorization: `Bearer ${adminToken}` } }
    );
    throw new Error('Should have failed - bounced checks cannot be cleared');
  } catch (error) {
    if (error.response?.status === 400 && error.response.data.message.includes('Bounced')) {
      return; // Expected
    }
    throw error;
  }
}

// ==================== RUN ALL TESTS ====================

async function runAllTests() {
  await setup();

  const tests = [
    // Return Validation Tests
    { name: 'Create original purchase invoice', fn: testCreateOriginalPurchase },
    { name: 'Return within policy (7 days for damaged)', fn: testReturnWithinPolicy },
    { name: 'Return without original invoice (should fail)', fn: testReturnWithoutOriginalInvoice },
    { name: 'Return exceeding time limit (should fail)', fn: testReturnExceedingTimeLimit },
    { name: 'Admin override for out-of-policy return', fn: testAdminOverrideReturn },
    { name: 'Admin override without reason (should fail)', fn: testAdminOverrideWithoutReason },
    { name: 'Return exceeding quantity (should fail)', fn: testReturnExceedingQuantity },
    { name: 'Get purchase history', fn: testGetPurchaseHistory },

    // Check Bounce Tests
    { name: 'Create invoice with check payment', fn: testCreateCheckInvoice },
    { name: 'Clear check successfully', fn: testClearCheck },
    { name: 'Bounce check without reason (should fail)', fn: testBounceCheckWithoutReason },
    { name: 'Bounce check as non-admin (should fail)', fn: testBounceCheckAsNonAdmin },
    { name: 'Bounce check with balance reversal', fn: testBounceCheckSuccess },
    { name: 'Clear already bounced check (should fail)', fn: testClearAlreadyBouncedCheck },
  ];

  console.log(yellow(`\nRunning ${tests.length} tests...\n`));

  let passed = 0;
  let failed = 0;

  for (const test of tests) {
    const result = await runTest(test.name, test.fn);
    if (result) {
      passed++;
    } else {
      failed++;
    }
  }

  console.log(blue('\n=== Test Summary ==='));
  console.log(green(`Passed: ${passed}`));
  if (failed > 0) {
    console.log(red(`Failed: ${failed}`));
  }
  console.log(blue(`Total: ${tests.length}\n`));

  process.exit(failed > 0 ? 1 : 0);
}

// Run tests
runAllTests().catch(error => {
  console.error(red(`\nFatal error: ${error.message}`));
  if (error.stack) {
    console.error(red('\nStack trace:'));
    console.error(error.stack);
  }
  process.exit(1);
});
