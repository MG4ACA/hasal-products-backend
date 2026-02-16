const { Op, Sequelize } = require('sequelize');
const {
  SalesInvoice,
  InvoiceItem,
  Payment,
  Outlet,
  Route,
  Product,
  ProductSku,
  PurchaseOrder,
  SupplierPayment,
  Supplier,
  RawMaterial,
  RawMaterialBatch,
  ProductionRun,
  ProductionOutput,
  ProductionMaterial,
  Recipe,
  WastageRecord,
  User,
} = require('../models');
const { successResponse, errorResponse } = require('../utils/response');

/**
 * Get Sales Report
 * Comprehensive sales analysis by outlet, product, route, and time period
 */
exports.getSalesReport = async (req, res) => {
  try {
    const { date_from, date_to, outlet_id, route_id, product_sku_id } = req.query;

    // Build query filters
    const whereClause = {};
    if (date_from) whereClause.invoice_date = { [Op.gte]: date_from };
    if (date_to) {
      whereClause.invoice_date = {
        ...whereClause.invoice_date,
        [Op.lte]: date_to,
      };
    }
    if (outlet_id) whereClause.outlet_id = outlet_id;
    if (route_id) whereClause.route_id = route_id;

    // Get invoices with items
    const invoices = await SalesInvoice.findAll({
      where: whereClause,
      include: [
        {
          model: InvoiceItem,
          as: 'items',
          where: product_sku_id ? { sku_id: product_sku_id } : {},
          required: false,
          include: [
            {
              model: ProductSku,
              as: 'sku',
              attributes: ['id', 'size', 'unit', 'price', 'product_id'],
              include: [
                {
                  model: Product,
                  as: 'product',
                  attributes: ['id', 'code', 'name'],
                },
              ],
            },
          ],
        },
        {
          model: Outlet,
          as: 'outlet',
          attributes: ['id', 'code', 'name', 'address'],
        },
        {
          model: Route,
          as: 'route',
          attributes: ['id', 'code', 'name'],
        },
      ],
    });

    // Calculate summary
    const summary = {
      total_invoices: invoices.length,
      total_sales: 0,
      total_quantity: 0,
      total_discount: 0,
      net_sales: 0,
    };

    // Sales by outlet
    const salesByOutlet = {};
    // Sales by product
    const salesByProduct = {};
    // Sales by route
    const salesByRoute = {};
    // Daily sales
    const dailySales = {};

    invoices.forEach(invoice => {
      const invoiceTotal = parseFloat(invoice.total_amount) || 0;
      const invoiceDiscount = parseFloat(invoice.discount_amount) || 0;

      summary.total_sales += invoiceTotal;
      summary.total_discount += invoiceDiscount;
      summary.net_sales += invoiceTotal - invoiceDiscount;

      // By outlet
      const outletKey = invoice.outlet_id;
      if (!salesByOutlet[outletKey]) {
        salesByOutlet[outletKey] = {
          outlet_id: invoice.outlet_id,
          outlet_name: invoice.outlet?.name || 'Unknown',
          address: invoice.outlet?.address || '',
          invoices: 0,
          total_sales: 0,
          total_discount: 0,
          net_sales: 0,
        };
      }
      salesByOutlet[outletKey].invoices += 1;
      salesByOutlet[outletKey].total_sales += invoiceTotal;
      salesByOutlet[outletKey].total_discount += invoiceDiscount;
      salesByOutlet[outletKey].net_sales += invoiceTotal - invoiceDiscount;

      // By route
      if (invoice.route_id) {
        const routeKey = invoice.route_id;
        if (!salesByRoute[routeKey]) {
          salesByRoute[routeKey] = {
            route_id: invoice.route_id,
            route_name: invoice.route?.name || 'Unknown',
            invoices: 0,
            total_sales: 0,
            net_sales: 0,
          };
        }
        salesByRoute[routeKey].invoices += 1;
        salesByRoute[routeKey].total_sales += invoiceTotal;
        salesByRoute[routeKey].net_sales += invoiceTotal - invoiceDiscount;
      }

      // Daily sales
      const dateKey = invoice.invoice_date?.split('T')[0];
      if (dateKey) {
        if (!dailySales[dateKey]) {
          dailySales[dateKey] = {
            date: dateKey,
            invoices: 0,
            total_sales: 0,
            net_sales: 0,
          };
        }
        dailySales[dateKey].invoices += 1;
        dailySales[dateKey].total_sales += invoiceTotal;
        dailySales[dateKey].net_sales += invoiceTotal - invoiceDiscount;
      }

      // By product
      invoice.items?.forEach(item => {
        const quantity = parseFloat(item.quantity) || 0;
        const itemTotal = parseFloat(item.total_amount) || 0;

        summary.total_quantity += quantity;

        const productKey = item.sku_id;
        if (!salesByProduct[productKey]) {
          salesByProduct[productKey] = {
            sku_id: item.sku_id,
            sku_name: item.sku?.product?.name || 'Unknown Product',
            size: item.sku?.size || '',
            unit: item.sku?.unit || '',
            unit_price: item.sku?.price || 0,
            quantity_sold: 0,
            total_sales: 0,
          };
        }
        salesByProduct[productKey].quantity_sold += quantity;
        salesByProduct[productKey].total_sales += itemTotal;
      });
    });

    return successResponse(
      res,
      {
        summary,
        by_outlet: Object.values(salesByOutlet),
        by_product: Object.values(salesByProduct),
        by_route: Object.values(salesByRoute),
        daily_sales: Object.values(dailySales).sort((a, b) => a.date.localeCompare(b.date)),
      },
      'Sales report generated successfully'
    );
  } catch (error) {
    console.error('Sales Report Error:', error);
    return errorResponse(res, 'Failed to generate sales report', 500);
  }
};

/**
 * Get Payment Collection Report
 * Track payments vs invoices, collection rates, outstanding balances
 */
exports.getPaymentCollectionReport = async (req, res) => {
  try {
    const { date_from, date_to, outlet_id, payment_method } = req.query;

    // Build invoice query
    const invoiceWhere = {};
    if (date_from) invoiceWhere.invoice_date = { [Op.gte]: date_from };
    if (date_to) {
      invoiceWhere.invoice_date = {
        ...invoiceWhere.invoice_date,
        [Op.lte]: date_to,
      };
    }
    if (outlet_id) invoiceWhere.outlet_id = outlet_id;

    // Build payment query
    const paymentWhere = {};
    if (date_from) paymentWhere.payment_date = { [Op.gte]: date_from };
    if (date_to) {
      paymentWhere.payment_date = {
        ...paymentWhere.payment_date,
        [Op.lte]: date_to,
      };
    }
    if (payment_method) paymentWhere.payment_method = payment_method;

    // Get invoices
    const invoices = await SalesInvoice.findAll({
      where: invoiceWhere,
      include: [
        {
          model: Outlet,
          as: 'outlet',
          attributes: ['id', 'name'],
        },
      ],
    });

    // Get payments
    const payments = await Payment.findAll({
      where: paymentWhere,
      include: [
        {
          model: Outlet,
          as: 'outlet',
          attributes: ['id', 'name'],
          where: outlet_id ? { id: outlet_id } : {},
          required: false,
        },
      ],
    });

    // Calculate summary
    const totalInvoiced = invoices.reduce(
      (sum, inv) => sum + (parseFloat(inv.total_amount) || 0),
      0
    );
    const totalCollected = payments.reduce((sum, pay) => sum + (parseFloat(pay.amount) || 0), 0);

    const summary = {
      total_invoiced: totalInvoiced,
      total_collected: totalCollected,
      outstanding_balance: totalInvoiced - totalCollected,
      collection_rate: totalInvoiced > 0 ? ((totalCollected / totalInvoiced) * 100).toFixed(2) : 0,
      total_invoices: invoices.length,
      total_payments: payments.length,
    };

    // By outlet
    const byOutlet = {};
    invoices.forEach(invoice => {
      const outletKey = invoice.outlet_id;
      if (!byOutlet[outletKey]) {
        byOutlet[outletKey] = {
          outlet_id: invoice.outlet_id,
          outlet_name: invoice.outlet?.name || 'Unknown',
          invoiced: 0,
          collected: 0,
          outstanding: 0,
        };
      }
      byOutlet[outletKey].invoiced += parseFloat(invoice.total_amount) || 0;
    });

    payments.forEach(payment => {
      const outletId = payment.outlet_id;
      if (outletId && byOutlet[outletId]) {
        byOutlet[outletId].collected += parseFloat(payment.amount) || 0;
      }
    });

    Object.values(byOutlet).forEach(outlet => {
      outlet.outstanding = outlet.invoiced - outlet.collected;
      outlet.collection_rate =
        outlet.invoiced > 0 ? ((outlet.collected / outlet.invoiced) * 100).toFixed(2) : 0;
    });

    // By payment method
    const byMethod = {};
    payments.forEach(payment => {
      const method = payment.payment_method || 'Unknown';
      if (!byMethod[method]) {
        byMethod[method] = {
          payment_method: method,
          count: 0,
          total_amount: 0,
        };
      }
      byMethod[method].count += 1;
      byMethod[method].total_amount += parseFloat(payment.amount) || 0;
    });

    return successResponse(
      res,
      {
        summary,
        by_outlet: Object.values(byOutlet),
        by_method: Object.values(byMethod),
      },
      'Payment collection report generated successfully'
    );
  } catch (error) {
    console.error('Payment Collection Report Error:', error);
    return errorResponse(res, 'Failed to generate payment collection report', 500);
  }
};

/**
 * Get Supplier Payment Report
 * Track supplier payables and payment history
 */
exports.getSupplierPaymentReport = async (req, res) => {
  try {
    const { date_from, date_to, supplier_id } = req.query;

    // Build query
    const whereClause = {};
    if (date_from) whereClause.payment_date = { [Op.gte]: date_from };
    if (date_to) {
      whereClause.payment_date = {
        ...whereClause.payment_date,
        [Op.lte]: date_to,
      };
    }
    if (supplier_id) whereClause.supplier_id = supplier_id;

    const payments = await SupplierPayment.findAll({
      where: whereClause,
      include: [
        {
          model: Supplier,
          as: 'supplier',
          attributes: ['id', 'name', 'code'],
        },
      ],
    });

    // Get all purchase orders in period
    const poWhere = {};
    if (date_from) poWhere.order_date = { [Op.gte]: date_from };
    if (date_to) {
      poWhere.order_date = {
        ...poWhere.order_date,
        [Op.lte]: date_to,
      };
    }
    if (supplier_id) poWhere.supplier_id = supplier_id;

    const purchaseOrders = await PurchaseOrder.findAll({
      where: poWhere,
      include: [
        {
          model: Supplier,
          as: 'supplier',
          attributes: ['id', 'name', 'code'],
        },
      ],
    });

    // Calculate summary
    const totalPurchased = purchaseOrders.reduce(
      (sum, po) => sum + (parseFloat(po.total_cost) || 0),
      0
    );
    const totalPaid = payments.reduce((sum, pay) => sum + (parseFloat(pay.amount) || 0), 0);

    const summary = {
      total_purchased: totalPurchased,
      total_paid: totalPaid,
      outstanding_payables: totalPurchased - totalPaid,
      payment_count: payments.length,
      purchase_order_count: purchaseOrders.length,
    };

    // By supplier
    const bySupplier = {};
    purchaseOrders.forEach(po => {
      const suppKey = po.supplier_id;
      if (!bySupplier[suppKey]) {
        bySupplier[suppKey] = {
          supplier_id: po.supplier_id,
          supplier_name: po.supplier?.name || 'Unknown',
          purchased: 0,
          paid: 0,
          outstanding: 0,
        };
      }
      bySupplier[suppKey].purchased += parseFloat(po.total_cost) || 0;
    });

    payments.forEach(payment => {
      const suppKey = payment.supplier_id;
      if (bySupplier[suppKey]) {
        bySupplier[suppKey].paid += parseFloat(payment.amount) || 0;
      }
    });

    Object.values(bySupplier).forEach(supplier => {
      supplier.outstanding = supplier.purchased - supplier.paid;
    });

    return successResponse(
      res,
      {
        summary,
        by_supplier: Object.values(bySupplier),
        recent_payments: payments.slice(0, 50),
      },
      'Supplier payment report generated successfully'
    );
  } catch (error) {
    console.error('Supplier Payment Report Error:', error);
    return errorResponse(res, 'Failed to generate supplier payment report', 500);
  }
};

/**
 * Get Outlet Balance & Aging Report
 * Track outlet credit balances and aging analysis
 */
exports.getOutletBalanceReport = async (req, res) => {
  try {
    const { outlet_id } = req.query;

    // Get all outlets or specific outlet
    const outletWhere = outlet_id ? { id: outlet_id } : {};
    const outlets = await Outlet.findAll({
      where: outletWhere,
      attributes: ['id', 'name', 'credit_limit', 'balance', 'address'],
    });

    const reportData = [];

    for (const outlet of outlets) {
      // Get outstanding invoices
      const outstandingInvoices = await SalesInvoice.findAll({
        where: {
          outlet_id: outlet.id,
          payment_status: { [Op.in]: ['unpaid', 'partial'] },
        },
        attributes: ['id', 'invoice_number', 'invoice_date', 'total_amount'],
      });

      // Calculate aging
      const aging = {
        current: 0,
        days_30: 0,
        days_60: 0,
        days_90: 0,
        days_over_90: 0,
      };

      const now = new Date();
      outstandingInvoices.forEach(invoice => {
        const invoiceDate = new Date(invoice.invoice_date);
        const daysDiff = Math.floor((now - invoiceDate) / (1000 * 60 * 60 * 24));
        const amount = parseFloat(invoice.total_amount) || 0;

        if (daysDiff <= 30) aging.current += amount;
        else if (daysDiff <= 60) aging.days_30 += amount;
        else if (daysDiff <= 90) aging.days_60 += amount;
        else aging.days_over_90 += amount;
      });

      const currentBalance = parseFloat(outlet.balance) || 0;
      const creditLimit = parseFloat(outlet.credit_limit) || 0;

      reportData.push({
        outlet_id: outlet.id,
        outlet_name: outlet.name,
        address: outlet.address,
        current_balance: currentBalance,
        credit_limit: creditLimit,
        available_credit: creditLimit - currentBalance,
        credit_utilization:
          creditLimit > 0 ? parseFloat(((currentBalance / creditLimit) * 100).toFixed(2)) : 0,
        aging,
        outstanding_invoices: outstandingInvoices.length,
      });
    }

    // Calculate summary
    const summary = {
      total_outlets: reportData.length,
      total_outstanding: reportData.reduce((sum, o) => sum + o.current_balance, 0),
      total_credit_limit: reportData.reduce((sum, o) => sum + o.credit_limit, 0),
      outlets_over_limit: reportData.filter(o => o.current_balance > o.credit_limit).length,
    };

    return successResponse(
      res,
      {
        summary,
        outlets: reportData,
      },
      'Outlet balance report generated successfully'
    );
  } catch (error) {
    console.error('Outlet Balance Report Error:', error);
    return errorResponse(res, 'Failed to generate outlet balance report', 500);
  }
};

/**
 * Get Check Status Report
 * Track pending, cleared, and overdue checks
 */
exports.getCheckStatusReport = async (req, res) => {
  try {
    const { date_from, date_to, status } = req.query;

    const whereClause = {
      payment_method: 'check',
    };

    // Date filtering: use check_date if available, otherwise payment_date
    if (date_from || date_to) {
      const dateConditions = [];

      if (date_from && date_to) {
        dateConditions.push({
          [Op.or]: [
            { check_date: { [Op.between]: [date_from, date_to] } },
            {
              [Op.and]: [
                { check_date: null },
                { payment_date: { [Op.between]: [date_from, date_to] } },
              ],
            },
          ],
        });
      } else if (date_from) {
        dateConditions.push({
          [Op.or]: [
            { check_date: { [Op.gte]: date_from } },
            {
              [Op.and]: [{ check_date: null }, { payment_date: { [Op.gte]: date_from } }],
            },
          ],
        });
      } else if (date_to) {
        dateConditions.push({
          [Op.or]: [
            { check_date: { [Op.lte]: date_to } },
            {
              [Op.and]: [{ check_date: null }, { payment_date: { [Op.lte]: date_to } }],
            },
          ],
        });
      }

      if (dateConditions.length > 0) {
        Object.assign(whereClause, ...dateConditions);
      }
    }

    if (status) whereClause.payment_status = status;

    const checks = await Payment.findAll({
      where: whereClause,
      include: [
        {
          model: Outlet,
          as: 'outlet',
          attributes: ['id', 'name', 'code'],
        },
      ],
      order: [[Sequelize.literal('COALESCE(check_date, payment_date)'), 'DESC']],
    });

    // Calculate aging and status
    const now = new Date();
    now.setHours(0, 0, 0, 0); // Normalize to start of day

    const reportData = checks.map(check => {
      const checkDate = new Date(check.check_date || check.payment_date);
      checkDate.setHours(0, 0, 0, 0); // Normalize to start of day

      const daysPending = Math.floor((now - checkDate) / (1000 * 60 * 60 * 24));
      const checkStatus = check.payment_status || 'pending';

      return {
        payment_id: check.id,
        check_number: check.check_number || 'N/A',
        check_date: check.check_date || check.payment_date,
        payment_date: check.payment_date,
        clearance_date: check.clearance_date,
        bounce_date: check.bounce_date,
        amount: parseFloat(check.amount || 0),
        status: checkStatus,
        days_pending: checkStatus === 'pending' ? daysPending : 0,
        outlet: {
          outlet_name: check.outlet?.name || 'Unknown',
          outlet_code: check.outlet?.code || '',
        },
        outlet_id: check.outlet_id,
      };
    });

    // Calculate summary
    const pendingChecks = reportData.filter(c => c.status === 'pending');
    const clearedChecks = reportData.filter(c => c.status === 'cleared');
    const bouncedChecks = reportData.filter(c => c.status === 'bounced');
    const overdueChecks = reportData.filter(c => c.status === 'pending' && c.days_pending > 30);

    const summary = {
      total_checks: reportData.length,
      pending_checks: pendingChecks.length,
      cleared_checks: clearedChecks.length,
      bounced_checks: bouncedChecks.length,
      overdue_checks: overdueChecks.length,
      pending_amount: pendingChecks.reduce((sum, c) => sum + c.amount, 0),
      cleared_amount: clearedChecks.reduce((sum, c) => sum + c.amount, 0),
      bounced_amount: bouncedChecks.reduce((sum, c) => sum + c.amount, 0),
      overdue_amount: overdueChecks.reduce((sum, c) => sum + c.amount, 0),
      total_amount: reportData.reduce((sum, c) => sum + c.amount, 0),
    };

    return successResponse(
      res,
      {
        summary,
        checks: reportData,
      },
      'Check status report generated successfully'
    );
  } catch (error) {
    console.error('Check Status Report Error:', error);
    return errorResponse(res, 'Failed to generate check status report', 500);
  }
};

/**
 * Get Inventory Valuation Report
 * Complete inventory valuation including raw materials and finished goods
 */
exports.getInventoryReport = async (req, res) => {
  try {
    // Get raw materials with their batches
    const rawMaterials = await RawMaterial.findAll({
      where: { status: 'active' },
      attributes: ['id', 'code', 'name', 'unit', 'reorder_level'],
      include: [
        {
          model: RawMaterialBatch,
          as: 'batches',
          attributes: ['id', 'batch_number', 'quantity', 'unit_cost', 'supplier_id'],
          include: [
            {
              model: Supplier,
              as: 'supplier',
              attributes: ['id', 'name'],
            },
          ],
        },
      ],
    });

    const rawMaterialsData = rawMaterials.map(rm => {
      // Calculate total stock from all batches
      const totalStock = rm.batches.reduce(
        (sum, batch) => sum + parseFloat(batch.quantity || 0),
        0
      );

      // Calculate weighted average cost
      let totalValue = 0;
      rm.batches.forEach(batch => {
        totalValue += parseFloat(batch.quantity || 0) * parseFloat(batch.unit_cost || 0);
      });
      const avgCost = totalStock > 0 ? totalValue / totalStock : 0;

      const reorderLevel = parseFloat(rm.reorder_level) || 0;

      // Get unique suppliers
      const suppliers = [...new Set(rm.batches.map(b => b.supplier?.name).filter(Boolean))];

      return {
        material_id: rm.id,
        material_code: rm.code,
        material_name: rm.name,
        current_stock: totalStock,
        unit: rm.unit,
        average_cost: avgCost,
        total_value: totalValue,
        reorder_level: reorderLevel,
        is_low_stock: totalStock <= reorderLevel,
        suppliers: suppliers.join(', ') || 'Unknown',
        batch_count: rm.batches.length,
      };
    });

    // Get finished goods inventory
    const finishedGoods = await ProductSku.findAll({
      where: { status: 'active' },
      attributes: ['id', 'size', 'unit', 'current_stock', 'price', 'average_cost', 'product_id'],
      include: [
        {
          model: Product,
          as: 'product',
          attributes: ['id', 'code', 'name'],
        },
      ],
    });

    const finishedGoodsData = finishedGoods.map(sku => {
      const currentStock = parseFloat(sku.current_stock) || 0;
      const unitPrice = parseFloat(sku.price) || 0;
      const costPerUnit = parseFloat(sku.average_cost) || 0;

      return {
        sku_id: sku.id,
        product_code: sku.product?.code || '',
        product_name: sku.product?.name || '',
        size: sku.size,
        unit: sku.unit,
        current_stock: currentStock,
        price: unitPrice,
        average_cost: costPerUnit,
        total_value: currentStock * costPerUnit,
        potential_revenue: currentStock * unitPrice,
        potential_profit: currentStock * (unitPrice - costPerUnit),
      };
    });

    // Calculate summary
    const summary = {
      raw_materials: {
        count: rawMaterialsData.length,
        total_value: rawMaterialsData.reduce((sum, rm) => sum + rm.total_value, 0),
        low_stock_items: rawMaterialsData.filter(rm => rm.is_low_stock).length,
      },
      finished_goods: {
        count: finishedGoodsData.length,
        total_value: finishedGoodsData.reduce((sum, fg) => sum + fg.total_value, 0),
        potential_revenue: finishedGoodsData.reduce((sum, fg) => sum + fg.potential_revenue, 0),
        potential_profit: finishedGoodsData.reduce((sum, fg) => sum + fg.potential_profit, 0),
      },
      grand_total: 0,
    };

    summary.grand_total = summary.raw_materials.total_value + summary.finished_goods.total_value;

    return successResponse(
      res,
      {
        summary,
        raw_materials: rawMaterialsData,
        finished_goods: finishedGoodsData,
      },
      'Inventory report generated successfully'
    );
  } catch (error) {
    console.error('Inventory Report Error:', error);
    return errorResponse(res, 'Failed to generate inventory report', 500);
  }
};

/**
 * Get Production Report
 * Comprehensive production analysis including efficiency and waste
 */
exports.getProductionReport = async (req, res) => {
  try {
    const { date_from, date_to, recipe_id, product_id } = req.query;

    const whereClause = {};
    if (date_from) whereClause.production_date = { [Op.gte]: date_from };
    if (date_to) {
      whereClause.production_date = {
        ...whereClause.production_date,
        [Op.lte]: date_to,
      };
    }
    if (recipe_id) whereClause.recipe_id = recipe_id;

    const productionRuns = await ProductionRun.findAll({
      where: whereClause,
      include: [
        {
          model: Recipe,
          as: 'recipe',
          attributes: ['id', 'code', 'name', 'expected_yield', 'yield_unit'],
          include: product_id
            ? [
                {
                  model: Product,
                  as: 'product',
                  where: { id: product_id },
                  attributes: ['id', 'code', 'name'],
                },
              ]
            : [
                {
                  model: Product,
                  as: 'product',
                  required: false,
                  attributes: ['id', 'code', 'name'],
                },
              ],
        },
        {
          model: ProductionOutput,
          as: 'outputs',
          attributes: [
            'id',
            'sku_id',
            'quantity_produced',
            'batch_number',
            'unit_cost',
            'total_cost',
            'waste_cost',
          ],
          include: [
            {
              model: ProductSku,
              as: 'sku',
              attributes: ['id', 'size', 'unit', 'price'],
            },
          ],
        },
        {
          model: User,
          as: 'producedBy',
          attributes: ['id', 'full_name', 'email', 'username'],
        },
      ],
      order: [['production_date', 'DESC']],
    });

    // Get wastage data for the same period
    const wastageWhere = {};
    if (date_from) wastageWhere.wastage_date = { [Op.gte]: date_from };
    if (date_to) {
      wastageWhere.wastage_date = {
        ...wastageWhere.wastage_date,
        [Op.lte]: date_to,
      };
    }
    wastageWhere.wastage_type = 'production';

    const wastageRecords = await WastageRecord.findAll({
      where: wastageWhere,
    });

    const reportData = productionRuns.map(run => {
      const actualQuantity = parseFloat(run.actual_quantity) || 0;
      const expectedQuantity = parseFloat(run.expected_quantity) || 0;
      const wasteQuantity = parseFloat(run.waste_quantity) || 0;

      let efficiency = 0;
      if (expectedQuantity > 0) {
        efficiency = ((actualQuantity / expectedQuantity) * 100).toFixed(2);
      } else if (actualQuantity > 0) {
        efficiency = 100;
      }

      // Calculate total costs from outputs
      const totalCost = run.outputs.reduce(
        (sum, output) => sum + (parseFloat(output.total_cost) || 0),
        0
      );
      const wasteCost = run.outputs.reduce(
        (sum, output) => sum + (parseFloat(output.waste_cost) || 0),
        0
      );

      // Get output details
      const outputs = run.outputs.map(output => ({
        sku_id: output.sku_id,
        size: output.sku?.size || '',
        quantity: parseFloat(output.quantity_produced) || 0,
        unit: output.sku?.unit || '',
        batch_number: output.batch_number,
        unit_cost: parseFloat(output.unit_cost) || 0,
        total_cost: parseFloat(output.total_cost) || 0,
      }));

      return {
        production_run_id: run.id,
        production_date: run.production_date,
        batch_number: run.batch_number,
        recipe_id: run.recipe?.id,
        recipe_code: run.recipe?.code || '',
        recipe_name: run.recipe?.name || 'Unknown',
        product_name: run.recipe?.product?.name || '',
        expected_quantity: expectedQuantity,
        actual_quantity: actualQuantity,
        waste_quantity: wasteQuantity,
        yield_efficiency: parseFloat(run.yield_efficiency) || parseFloat(efficiency),
        efficiency_percentage: efficiency,
        total_cost: totalCost,
        waste_cost: wasteCost,
        net_cost: totalCost + wasteCost,
        status: run.status,
        produced_by: run.producedBy?.full_name || '',
        outputs: outputs,
        notes: run.notes || '',
        waste_reason: run.waste_reason || '',
      };
    });

    // Calculate summary
    const summary = {
      total_production_runs: reportData.length,
      completed_runs: reportData.filter(r => r.status === 'completed').length,
      total_quantity_produced: reportData.reduce((sum, r) => sum + r.actual_quantity, 0),
      total_waste_quantity: reportData.reduce((sum, r) => sum + r.waste_quantity, 0),
      total_cost: reportData.reduce((sum, r) => sum + r.total_cost, 0),
      total_waste_cost: reportData.reduce((sum, r) => sum + r.waste_cost, 0),
      average_efficiency:
        reportData.length > 0
          ? parseFloat(
              (
                reportData.reduce((sum, r) => sum + parseFloat(r.efficiency_percentage), 0) /
                reportData.length
              ).toFixed(2)
            )
          : 0,
      total_wastage_records: wastageRecords.length,
      total_wastage_cost: wastageRecords.reduce(
        (sum, w) => sum + (parseFloat(w.total_cost) || 0),
        0
      ),
    };

    // Group wastage by type
    const wastageByType = {};
    wastageRecords.forEach(record => {
      const type = record.wastage_type;
      if (!wastageByType[type]) {
        wastageByType[type] = {
          type: type,
          count: 0,
          total_cost: 0,
        };
      }
      wastageByType[type].count++;
      wastageByType[type].total_cost += parseFloat(record.total_cost) || 0;
    });

    return successResponse(
      res,
      {
        summary,
        production_runs: reportData,
        wastage_by_type: Object.values(wastageByType),
        recent_wastage: wastageRecords.slice(0, 20).map(w => ({
          id: w.id,
          date: w.wastage_date,
          type: w.wastage_type,
          item_name: w.item_name,
          quantity: parseFloat(w.quantity),
          unit: w.unit,
          total_cost: parseFloat(w.total_cost) || 0,
          reason: w.reason,
        })),
      },
      'Production report generated successfully'
    );
  } catch (error) {
    console.error('Production Report Error:', error);
    return errorResponse(res, 'Failed to generate production report', 500);
  }
};
