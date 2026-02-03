const {
  SalesInvoice,
  Payment,
  ProductSku,
  PurchaseOrder,
  Outlet,
  Route,
  sequelize,
} = require('../models');
const { successResponse, errorResponse } = require('../utils/response');
const { Op, fn, col, literal } = require('sequelize');

// Helper function to get date range based on period
const getDateRange = period => {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  switch (period) {
    case 'today':
      return {
        start: today,
        end: new Date(today.getTime() + 24 * 60 * 60 * 1000 - 1),
      };
    case 'week':
      const weekStart = new Date(today);
      weekStart.setDate(today.getDate() - today.getDay()); // Start of week (Sunday)
      return {
        start: weekStart,
        end: new Date(today.getTime() + 24 * 60 * 60 * 1000 - 1),
      };
    case 'month':
      const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
      return {
        start: monthStart,
        end: new Date(today.getTime() + 24 * 60 * 60 * 1000 - 1),
      };
    default:
      return {
        start: today,
        end: new Date(today.getTime() + 24 * 60 * 60 * 1000 - 1),
      };
  }
};

// Get dashboard statistics
exports.getStatistics = async (req, res) => {
  try {
    const { period = 'today' } = req.query;
    const { start, end } = getDateRange(period);

    // Format dates for SQL query
    const startDate = start.toISOString().split('T')[0];
    const endDate = end.toISOString().split('T')[0];

    // 1. Total Sales for period
    const salesResult = await SalesInvoice.findOne({
      attributes: [
        [fn('COALESCE', fn('SUM', col('total_amount')), 0), 'totalSales'],
        [fn('COUNT', col('id')), 'invoiceCount'],
      ],
      where: {
        invoice_date: {
          [Op.between]: [startDate, endDate],
        },
      },
      raw: true,
    });

    // 2. Outstanding Receivables (all unpaid/partial invoices)
    const receivablesResult = await SalesInvoice.findOne({
      attributes: [
        [fn('COALESCE', fn('SUM', col('total_amount')), 0), 'totalOutstanding'],
        [fn('COUNT', col('id')), 'outstandingCount'],
      ],
      where: {
        payment_status: {
          [Op.in]: ['unpaid', 'partial'],
        },
      },
      raw: true,
    });

    // 3. Payments Collected for period
    const paymentsResult = await Payment.findOne({
      attributes: [
        [fn('COALESCE', fn('SUM', col('amount')), 0), 'totalCollected'],
        [fn('COUNT', col('id')), 'paymentCount'],
      ],
      where: {
        payment_date: {
          [Op.between]: [startDate, endDate],
        },
        payment_status: {
          [Op.ne]: 'bounced',
        },
      },
      raw: true,
    });

    // 4. Low Stock Items (products with current_stock below 10)
    const lowStockResult = await ProductSku.count({
      where: {
        current_stock: {
          [Op.lt]: 10,
        },
        status: 'active',
      },
    });

    // 5. Pending Purchase Orders
    const pendingPOResult = await PurchaseOrder.count({
      where: {
        status: {
          [Op.in]: ['pending', 'partial'],
        },
      },
    });

    return successResponse(res, {
      period,
      totalSales: parseFloat(salesResult?.totalSales || 0),
      invoiceCount: parseInt(salesResult?.invoiceCount || 0),
      outstandingReceivables: parseFloat(receivablesResult?.totalOutstanding || 0),
      outstandingCount: parseInt(receivablesResult?.outstandingCount || 0),
      paymentsCollected: parseFloat(paymentsResult?.totalCollected || 0),
      paymentCount: parseInt(paymentsResult?.paymentCount || 0),
      lowStockItems: lowStockResult,
      pendingPurchaseOrders: pendingPOResult,
    });
  } catch (error) {
    console.error('Dashboard statistics error:', error);
    return errorResponse(res, 'Failed to fetch dashboard statistics', 500);
  }
};

// Get sales trend data (last 7 or 30 days)
exports.getSalesTrend = async (req, res) => {
  try {
    const { days = 7 } = req.query;
    const numDays = parseInt(days);

    // Generate date labels for the past N days
    const dates = [];
    const today = new Date();
    for (let i = numDays - 1; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(today.getDate() - i);
      dates.push(date.toISOString().split('T')[0]);
    }

    // Get sales data grouped by date
    const salesData = await SalesInvoice.findAll({
      attributes: [
        'invoice_date',
        [fn('SUM', col('total_amount')), 'total'],
        [fn('COUNT', col('id')), 'count'],
      ],
      where: {
        invoice_date: {
          [Op.gte]: dates[0],
          [Op.lte]: dates[dates.length - 1],
        },
      },
      group: ['invoice_date'],
      order: [['invoice_date', 'ASC']],
      raw: true,
    });

    // Create a map for quick lookup
    const salesMap = {};
    salesData.forEach(item => {
      salesMap[item.invoice_date] = {
        total: parseFloat(item.total || 0),
        count: parseInt(item.count || 0),
      };
    });

    // Build response with all dates (including zeros)
    const trendData = dates.map(date => ({
      date,
      label: new Date(date).toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      }),
      total: salesMap[date]?.total || 0,
      count: salesMap[date]?.count || 0,
    }));

    return successResponse(res, {
      days: numDays,
      trend: trendData,
    });
  } catch (error) {
    console.error('Sales trend error:', error);
    return errorResponse(res, 'Failed to fetch sales trend', 500);
  }
};

// Get payment method breakdown
exports.getPaymentBreakdown = async (req, res) => {
  try {
    const { period = 'month' } = req.query;
    const { start, end } = getDateRange(period);

    const startDate = start.toISOString().split('T')[0];
    const endDate = end.toISOString().split('T')[0];

    // Get payment breakdown by method from invoices
    const invoicePayments = await SalesInvoice.findAll({
      attributes: [
        'payment_method',
        [fn('SUM', col('total_amount')), 'total'],
        [fn('COUNT', col('id')), 'count'],
      ],
      where: {
        invoice_date: {
          [Op.between]: [startDate, endDate],
        },
      },
      group: ['payment_method'],
      raw: true,
    });

    // Format the data
    const breakdown = invoicePayments.map(item => ({
      method: item.payment_method,
      label: item.payment_method.charAt(0).toUpperCase() + item.payment_method.slice(1),
      total: parseFloat(item.total || 0),
      count: parseInt(item.count || 0),
    }));

    // Calculate total for percentage
    const grandTotal = breakdown.reduce((sum, item) => sum + item.total, 0);

    // Add percentage to each item
    breakdown.forEach(item => {
      item.percentage = grandTotal > 0 ? ((item.total / grandTotal) * 100).toFixed(1) : 0;
    });

    return successResponse(res, {
      period,
      breakdown,
      grandTotal,
    });
  } catch (error) {
    console.error('Payment breakdown error:', error);
    return errorResponse(res, 'Failed to fetch payment breakdown', 500);
  }
};

// Get top selling products
exports.getTopProducts = async (req, res) => {
  try {
    const { period = 'month', limit = 5 } = req.query;
    const { start, end } = getDateRange(period);

    const startDate = start.toISOString().split('T')[0];
    const endDate = end.toISOString().split('T')[0];

    // This would require a join with InvoiceItems
    // For now, let's get recent sales with their items
    const topProducts = await sequelize.query(
      `
      SELECT 
        ps.id,
        p.name as product_name,
        ps.size,
        ps.unit,
        SUM(ii.quantity) as total_quantity,
        SUM(ii.total_amount) as total_revenue
      FROM invoice_items ii
      INNER JOIN sales_invoices si ON ii.invoice_id = si.id
      INNER JOIN product_skus ps ON ii.sku_id = ps.id
      INNER JOIN products p ON ps.product_id = p.id
      WHERE si.invoice_date BETWEEN :startDate AND :endDate
      GROUP BY ps.id, p.name, ps.size, ps.unit
      ORDER BY total_revenue DESC
      LIMIT :limit
    `,
      {
        replacements: { startDate, endDate, limit: parseInt(limit) },
        type: sequelize.QueryTypes.SELECT,
      }
    );

    return successResponse(res, {
      period,
      products: topProducts.map(p => ({
        id: p.id,
        name: `${p.product_name} (${p.size}${p.unit})`,
        quantity: parseFloat(p.total_quantity || 0),
        revenue: parseFloat(p.total_revenue || 0),
      })),
    });
  } catch (error) {
    console.error('Top products error:', error);
    return errorResponse(res, 'Failed to fetch top products', 500);
  }
};

// Get route-wise sales performance
exports.getRouteSales = async (req, res) => {
  try {
    const { period = 'month' } = req.query;
    const { start, end } = getDateRange(period);

    const startDate = start.toISOString().split('T')[0];
    const endDate = end.toISOString().split('T')[0];

    const routeSales = await SalesInvoice.findAll({
      attributes: [
        'route_id',
        [fn('SUM', col('SalesInvoice.total_amount')), 'total'],
        [fn('COUNT', col('SalesInvoice.id')), 'count'],
      ],
      include: [
        {
          model: Route,
          as: 'route',
          attributes: ['name', 'code'],
        },
      ],
      where: {
        invoice_date: {
          [Op.between]: [startDate, endDate],
        },
        route_id: {
          [Op.ne]: null,
        },
      },
      group: ['route_id', 'route.id', 'route.name', 'route.code'],
      order: [[literal('total'), 'DESC']],
      raw: true,
      nest: true,
    });

    return successResponse(res, {
      period,
      routes: routeSales.map(r => ({
        id: r.route_id,
        name: r.route?.name || 'Unknown',
        code: r.route?.code || '',
        total: parseFloat(r.total || 0),
        count: parseInt(r.count || 0),
      })),
    });
  } catch (error) {
    console.error('Route sales error:', error);
    return errorResponse(res, 'Failed to fetch route sales', 500);
  }
};
