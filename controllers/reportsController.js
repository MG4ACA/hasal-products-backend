const { Op, Sequelize } = require('sequelize');
const {
  SalesInvoice,
  InvoiceItem,
  Payment,
  Outlet,
  Route,
  ProductSku,
  PurchaseOrder,
  SupplierPayment,
  Supplier,
  RawMaterial,
  ProductionRun,
  Batch,
  Recipe,
  Wastage,
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
            size: item.sku?.size || '',
            unit: item.sku?.unit || '',
            price: item.sku?.price || 0,
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
          attributes: ['supplier_id', 'supplier_name'],
        },
        {
          model: PurchaseOrder,
          as: 'purchase_order',
          attributes: ['po_number', 'total_cost', 'order_date'],
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
          attributes: ['supplier_id', 'supplier_name'],
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
          supplier_name: po.supplier?.supplier_name || 'Unknown',
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
        credit_utilization: creditLimit > 0 ? ((currentBalance / creditLimit) * 100).toFixed(2) : 0,
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
      payment_method: { [Op.in]: ['check', 'cheque'] },
    };

    if (date_from) whereClause.payment_date = { [Op.gte]: date_from };
    if (date_to) {
      whereClause.payment_date = {
        ...whereClause.payment_date,
        [Op.lte]: date_to,
      };
    }
    if (status) whereClause.payment_status = status;

    const checks = await Payment.findAll({
      where: whereClause,
      include: [
        {
          model: Outlet,
          as: 'outlet',
          attributes: ['id', 'name'],
        },
      ],
      order: [['payment_date', 'DESC']],
    });

    // Calculate aging and status
    const now = new Date();
    const reportData = checks.map(check => {
      const checkDate = new Date(check.check_date || check.payment_date);
      const daysPending = Math.floor((now - checkDate) / (1000 * 60 * 60 * 24));

      return {
        payment_id: check.id,
        check_number: check.check_number,
        check_date: check.check_date,
        amount: check.amount,
        payment_status: check.payment_status || 'pending',
        days_pending: daysPending,
        outlet_name: check.outlet?.name || 'Unknown',
        outlet_id: check.outlet_id,
      };
    });

    // Calculate summary
    const summary = {
      total_checks: reportData.length,
      pending: reportData.filter(c => c.payment_status === 'pending').length,
      cleared: reportData.filter(c => c.payment_status === 'cleared').length,
      bounced: reportData.filter(c => c.payment_status === 'bounced').length,
      total_amount: reportData.reduce((sum, c) => sum + (parseFloat(c.amount) || 0), 0),
      overdue_30: reportData.filter(c => c.days_pending > 30 && c.payment_status === 'pending')
        .length,
      overdue_60: reportData.filter(c => c.days_pending > 60 && c.check_status === 'pending')
        .length,
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
    // Get raw materials inventory
    const rawMaterials = await RawMaterial.findAll({
      attributes: [
        'raw_material_id',
        'material_name',
        'current_stock',
        'unit',
        'unit_cost',
        'reorder_level',
        'supplier_id',
      ],
      include: [
        {
          model: Supplier,
          as: 'supplier',
          attributes: ['supplier_name'],
        },
      ],
    });

    const rawMaterialsData = rawMaterials.map(rm => {
      const currentStock = parseFloat(rm.current_stock) || 0;
      const unitCost = parseFloat(rm.unit_cost) || 0;
      const reorderLevel = parseFloat(rm.reorder_level) || 0;

      return {
        material_id: rm.raw_material_id,
        material_name: rm.material_name,
        current_stock: currentStock,
        unit: rm.unit,
        unit_cost: unitCost,
        total_value: currentStock * unitCost,
        reorder_level: reorderLevel,
        is_low_stock: currentStock <= reorderLevel,
        supplier_name: rm.supplier?.supplier_name || 'Unknown',
      };
    });

    // Get finished goods inventory
    const finishedGoods = await ProductSku.findAll({
      attributes: ['id', 'size', 'unit', 'current_stock', 'price', 'average_cost'],
    });

    const finishedGoodsData = finishedGoods.map(sku => {
      const currentStock = parseFloat(sku.current_stock) || 0;
      const unitPrice = parseFloat(sku.price) || 0;
      const costPerUnit = parseFloat(sku.average_cost) || 0;

      return {
        sku_id: sku.id,
        size: sku.size,
        unit: sku.unit,
        current_stock: currentStock,
        price: unitPrice,
        average_cost: costPerUnit,
        total_value: currentStock * costPerUnit,
        potential_revenue: currentStock * unitPrice,
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
    const { date_from, date_to, recipe_id } = req.query;

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
          attributes: ['recipe_name', 'expected_yield', 'expected_yield_unit'],
        },
        {
          model: Batch,
          as: 'batch',
          attributes: ['batch_number', 'quantity_produced'],
        },
      ],
    });

    // Get wastage data
    const wastageData = await Wastage.findAll({
      where: whereClause,
      include: [
        {
          model: ProductionRun,
          as: 'production_run',
          include: [
            {
              model: Recipe,
              as: 'recipe',
              attributes: ['recipe_name'],
            },
          ],
        },
      ],
    });

    const reportData = productionRuns.map(run => {
      const actualYield = parseFloat(run.actual_yield) || 0;
      const expectedYield = parseFloat(run.recipe?.expected_yield) || 0;
      const totalCost = parseFloat(run.total_cost) || 0;

      const efficiency = expectedYield > 0 ? ((actualYield / expectedYield) * 100).toFixed(2) : 0;

      // Find related wastage
      const runWastage = wastageData.filter(w => w.production_run_id === run.production_run_id);
      const wasteCost = runWastage.reduce((sum, w) => sum + (parseFloat(w.cost_impact) || 0), 0);

      return {
        production_run_id: run.production_run_id,
        production_date: run.production_date,
        recipe_name: run.recipe?.recipe_name || 'Unknown',
        batch_number: run.batch?.batch_number || '',
        expected_yield: expectedYield,
        actual_yield: actualYield,
        efficiency_percentage: efficiency,
        total_cost: totalCost,
        waste_cost: wasteCost,
        net_cost: totalCost + wasteCost,
      };
    });

    // Calculate summary
    const summary = {
      total_production_runs: reportData.length,
      total_cost: reportData.reduce((sum, r) => sum + r.total_cost, 0),
      total_waste_cost: reportData.reduce((sum, r) => sum + r.waste_cost, 0),
      average_efficiency: reportData.length
        ? (
            reportData.reduce((sum, r) => sum + parseFloat(r.efficiency_percentage), 0) /
            reportData.length
          ).toFixed(2)
        : 0,
      total_wastage_incidents: wastageData.length,
    };

    return successResponse(
      res,
      {
        summary,
        production_runs: reportData,
        wastage_details: wastageData.slice(0, 50),
      },
      'Production report generated successfully'
    );
  } catch (error) {
    console.error('Production Report Error:', error);
    return errorResponse(res, 'Failed to generate production report', 500);
  }
};
