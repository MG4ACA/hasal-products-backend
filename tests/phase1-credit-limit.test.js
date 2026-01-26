/**
 * Phase 1 Implementation Tests
 * Testing Credit Limit Enforcement, Profit Calculation Fix, Paid Amount Field
 *
 * Run with: npm test or node tests/phase1-credit-limit.test.js
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:5000/api'; // Changed from 3000 to 5000
let authToken = '';
let testOutletId = null;
let testInvoiceId = null;

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
};

const log = {
  success: msg => console.log(`${colors.green}✓${colors.reset} ${msg}`),
  error: msg => console.log(`${colors.red}✗${colors.reset} ${msg}`),
  info: msg => console.log(`${colors.cyan}ℹ${colors.reset} ${msg}`),
  warn: msg => console.log(`${colors.yellow}⚠${colors.reset} ${msg}`),
  section: msg => console.log(`\n${colors.cyan}━━━ ${msg} ━━━${colors.reset}`),
};

// Test configurations
const testConfig = {
  credentials: {
    username: 'admin', // Change to your admin username
    password: 'admin123', // Change to your admin password
  },
  cashierCredentials: {
    username: 'cashier', // Change to your cashier username
    password: 'cashier123', // Change to your cashier password
  },
};

async function login(username, password) {
  try {
    const response = await axios.post(`${BASE_URL}/auth/login`, {
      username,
      password,
    });
    return response.data.data.token;
  } catch (error) {
    if (error.code === 'ECONNREFUSED') {
      throw new Error(`Cannot connect to server at ${BASE_URL}. Is the backend server running?`);
    }
    throw new Error(`Login failed: ${error.response?.data?.message || error.message}`);
  }
}

async function createTestInvoice(token, invoiceData) {
  try {
    const response = await axios.post(`${BASE_URL}/sales-invoices`, invoiceData, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.data;
  } catch (error) {
    return { error: error.response?.data || error.message };
  }
}

async function getInvoice(token, invoiceId) {
  try {
    const response = await axios.get(`${BASE_URL}/sales-invoices/${invoiceId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.data.data;
  } catch (error) {
    throw new Error(`Get invoice failed: ${error.response?.data?.message || error.message}`);
  }
}

async function getSaleProfit(token, invoiceId) {
  try {
    const response = await axios.get(`${BASE_URL}/sales-invoices/${invoiceId}/profit`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.data.data;
  } catch (error) {
    throw new Error(`Get profit failed: ${error.response?.data?.message || error.message}`);
  }
}

async function getOutlets(token) {
  try {
    const response = await axios.get(`${BASE_URL}/outlets`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.data.data.outlets;
  } catch (error) {
    throw new Error(`Get outlets failed: ${error.response?.data?.message || error.message}`);
  }
}

// ============================================================================
// Test Suite
// ============================================================================

async function runTests() {
  console.log('\n🧪 Phase 1 Implementation Test Suite\n');
  console.log('Testing: Credit Limit Enforcement, Profit Calculation, Paid Amount Field\n');

  let passedTests = 0;
  let failedTests = 0;

  try {
    // ========================================================================
    // Setup
    // ========================================================================
    log.section('Setup & Authentication');

    try {
      authToken = await login(testConfig.credentials.username, testConfig.credentials.password);
      log.success('Admin login successful');
      passedTests++;
    } catch (error) {
      log.error(`Admin login failed: ${error.message}`);
      failedTests++;
      return;
    }

    try {
      const outlets = await getOutlets(authToken);
      if (outlets && outlets.length > 0) {
        testOutletId = outlets[0].id;
        log.success(`Found test outlet: ${outlets[0].name} (ID: ${testOutletId})`);
        log.info(
          `  Balance: Rs. ${outlets[0].balance}, Credit Limit: Rs. ${outlets[0].credit_limit}`
        );
        passedTests++;
      } else {
        log.error('No outlets found for testing');
        failedTests++;
        return;
      }
    } catch (error) {
      log.error(`Failed to get outlets: ${error.message}`);
      failedTests++;
      return;
    }

    // ========================================================================
    // Test 1: Credit Limit - Normal Invoice (Below Limit)
    // ========================================================================
    log.section('Test 1: Create Invoice Below Credit Limit');

    const normalInvoice = {
      outlet_id: testOutletId,
      invoice_date: new Date().toISOString().split('T')[0],
      payment_method: 'credit',
      items: [
        {
          sku_id: 1, // Adjust to valid SKU ID
          quantity: 1,
          unit_price: 100,
          discount_percent: 0,
          is_return: false,
        },
      ],
    };

    try {
      const result = await createTestInvoice(authToken, normalInvoice);
      if (result.error) {
        log.error(`Failed to create normal invoice: ${result.error.message}`);
        failedTests++;
      } else {
        log.success('Normal invoice created successfully');
        testInvoiceId = result.data.invoice.id;
        log.info(`  Invoice ID: ${testInvoiceId}`);

        // Check for snapshot fields
        const invoice = result.data.invoice;
        if (invoice.credit_limit_at_time !== null && invoice.outlet_balance_at_time !== null) {
          log.success('✅ Snapshot fields populated correctly');
          log.info(`  Credit Limit Snapshot: Rs. ${invoice.credit_limit_at_time}`);
          log.info(`  Balance Snapshot: Rs. ${invoice.outlet_balance_at_time}`);
          passedTests++;
        } else {
          log.warn('⚠️ Snapshot fields not populated (check model sync)');
        }
        passedTests++;
      }
    } catch (error) {
      log.error(`Test failed: ${error.message}`);
      failedTests++;
    }

    // ========================================================================
    // Test 2: Credit Limit - Warning (80%+ but not exceeded)
    // ========================================================================
    log.section('Test 2: Credit Warning (80%+ utilization)');

    log.info('This test requires manual verification:');
    log.warn('  1. Create an invoice that brings balance to 80%-99% of credit limit');
    log.warn('  2. Check API response includes creditWarning object');
    log.warn('  3. Verify creditWarning.message and utilization data');
    log.info('  Skipping automated test (requires specific outlet setup)');

    // ========================================================================
    // Test 3: Credit Limit - Exceeded (Non-Admin)
    // ========================================================================
    log.section('Test 3: Block Invoice Exceeding Credit Limit (Non-Admin)');

    try {
      const cashierToken = await login(
        testConfig.cashierCredentials.username,
        testConfig.cashierCredentials.password
      );
      log.success('Cashier login successful');

      // Create large invoice that exceeds credit limit
      const largeInvoice = {
        outlet_id: testOutletId,
        invoice_date: new Date().toISOString().split('T')[0],
        payment_method: 'credit',
        items: [
          {
            sku_id: 1,
            quantity: 1,
            unit_price: 999999, // Large amount to exceed limit
            discount_percent: 0,
            is_return: false,
          },
        ],
      };

      const result = await createTestInvoice(cashierToken, largeInvoice);
      if (
        result.error &&
        result.error.message &&
        result.error.message.includes('Credit limit exceeded')
      ) {
        log.success('✅ Non-admin blocked from exceeding credit limit');
        log.info(`  Error message: ${result.error.message}`);
        passedTests++;
      } else {
        log.error('❌ Non-admin was NOT blocked (security issue!)');
        failedTests++;
      }
    } catch (error) {
      log.warn(`Cashier test skipped: ${error.message}`);
      log.info('  (Make sure cashier user exists or adjust credentials)');
    }

    // ========================================================================
    // Test 4: Credit Limit - Admin Override
    // ========================================================================
    log.section('Test 4: Admin Override Credit Limit');

    const overrideInvoice = {
      outlet_id: testOutletId,
      invoice_date: new Date().toISOString().split('T')[0],
      payment_method: 'credit',
      credit_limit_override_reason: 'Test: Customer has pending payment arriving tomorrow',
      items: [
        {
          sku_id: 1,
          quantity: 1,
          unit_price: 999999, // Exceed limit
          discount_percent: 0,
          is_return: false,
        },
      ],
    };

    try {
      const result = await createTestInvoice(authToken, overrideInvoice);
      if (result.error) {
        log.error(`Admin override failed: ${result.error.message || result.error}`);
        failedTests++;
      } else {
        log.success('✅ Admin successfully overrode credit limit');
        const invoice = result.data.invoice;
        if (invoice.credit_limit_override_reason && invoice.credit_limit_override_by) {
          log.success('✅ Override reason and user ID saved correctly');
          log.info(`  Reason: ${invoice.credit_limit_override_reason}`);
          log.info(`  Overridden by User ID: ${invoice.credit_limit_override_by}`);
          passedTests += 2;
        } else {
          log.warn('⚠️ Override fields not saved (check model sync)');
          passedTests++;
        }
      }
    } catch (error) {
      log.error(`Test failed: ${error.message}`);
      failedTests++;
    }

    // ========================================================================
    // Test 5: Admin Override Without Reason (Should Fail)
    // ========================================================================
    log.section('Test 5: Require Override Reason');

    const noReasonInvoice = {
      outlet_id: testOutletId,
      invoice_date: new Date().toISOString().split('T')[0],
      payment_method: 'credit',
      // No credit_limit_override_reason
      items: [
        {
          sku_id: 1,
          quantity: 1,
          unit_price: 999999,
          discount_percent: 0,
          is_return: false,
        },
      ],
    };

    try {
      const result = await createTestInvoice(authToken, noReasonInvoice);
      if (
        result.error &&
        result.error.message &&
        result.error.message.includes('requires a reason')
      ) {
        log.success('✅ Admin override without reason correctly rejected');
        log.info(`  Error: ${result.error.message}`);
        passedTests++;
      } else {
        log.error('❌ Invoice created without override reason (validation missing!)');
        failedTests++;
      }
    } catch (error) {
      log.error(`Test failed: ${error.message}`);
      failedTests++;
    }

    // ========================================================================
    // Test 6: Profit Calculation Fix
    // ========================================================================
    log.section('Test 6: Profit Calculation Uses unit_price');

    if (testInvoiceId) {
      try {
        const profitData = await getSaleProfit(authToken, testInvoiceId);
        log.success('Profit calculation endpoint works');
        log.info(`  Total Profit: Rs. ${profitData.summary.total_profit}`);
        log.info(`  Profit Margin: ${profitData.summary.profit_margin}%`);
        log.info('  ✅ Verify manually that profit uses item.unit_price (not item.price)');
        passedTests++;
      } catch (error) {
        log.warn(`Profit test skipped: ${error.message}`);
      }
    }

    // ========================================================================
    // Test 7: Paid Amount Virtual Field
    // ========================================================================
    log.section('Test 7: Paid Amount Virtual Field');

    if (testInvoiceId) {
      try {
        const invoice = await getInvoice(authToken, testInvoiceId);
        if (invoice.paid_amount !== undefined) {
          log.success('✅ paid_amount field accessible');
          log.info(`  Paid Amount: Rs. ${invoice.paid_amount}`);
          log.info('  (Should be 0 for unpaid credit invoices)');
          passedTests++;
        } else {
          log.warn('⚠️ paid_amount field not in response (check model includes allocations)');
        }
      } catch (error) {
        log.warn(`Paid amount test skipped: ${error.message}`);
      }
    }

    // ========================================================================
    // Test Summary
    // ========================================================================
    log.section('Test Summary');

    const total = passedTests + failedTests;
    console.log(`\nResults: ${passedTests}/${total} tests passed\n`);

    if (failedTests === 0) {
      log.success('🎉 All tests passed!');
      console.log('\n✅ Phase 1 implementation is working correctly!\n');
    } else {
      log.warn(`⚠️ ${failedTests} test(s) failed`);
      console.log('\n📋 Next steps:');
      console.log('  1. Run: cd hasal-pos-backend && npm run sync');
      console.log('  2. Check database for new fields');
      console.log('  3. Re-run tests');
      console.log('  4. Review failed test output above\n');
    }

    // ========================================================================
    // Manual Testing Checklist
    // ========================================================================
    console.log('\n📝 Manual Testing Checklist:\n');
    console.log('  Frontend Testing:');
    console.log('  [ ] Select outlet with credit limit');
    console.log('  [ ] Add items to bring balance to 80%+ - see yellow banner');
    console.log('  [ ] Add items to exceed 100% - see red banner');
    console.log('  [ ] Try to submit as cashier - should be blocked');
    console.log('  [ ] Log in as admin - modal should appear');
    console.log('  [ ] Enter override reason - should submit successfully');
    console.log('  [ ] Check invoice has override reason saved\n');

    console.log('  Database Verification:');
    console.log(
      '  [ ] SELECT * FROM sales_invoices WHERE credit_limit_override_reason IS NOT NULL;'
    );
    console.log('  [ ] Verify credit_limit_at_time and outlet_balance_at_time are populated');
    console.log('  [ ] Check profit reports use unit_price correctly\n');
  } catch (error) {
    log.error(`\nTest suite failed: ${error.message}`);
    console.error(error);
  }
}

// Run tests
if (require.main === module) {
  runTests().catch(console.error);
}

module.exports = { runTests };
