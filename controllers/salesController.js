const {
  SalesInvoice,
  InvoiceItem,
  Outlet,
  Employee,
  Route,
  ProductSku,
  Product,
  User,
  sequelize,
} = require('../models');
const { successResponse, errorResponse } = require('../utils/response');
const { generateInvoiceNumber } = require('../utils/invoiceNumberGenerator');
const { Op } = require('sequelize');

// Credit limit warning threshold (80%)
const CREDIT_WARNING_THRESHOLD = 0.8;

// Get all sales invoices with pagination, search, and filters
exports.getAllInvoices = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search = '',
      outlet_id = '',
      sales_ref_id = '',
      route_id = '',
      payment_status = '',
      payment_method = '',
      start_date = '',
      end_date = '',
    } = req.query;

    const offset = (page - 1) * limit;
    const where = {};

    // Search by invoice number
    if (search) {
      where.invoice_number = { [Op.like]: `%${search}%` };
    }

    // Filter by outlet
    if (outlet_id) {
      where.outlet_id = outlet_id;
    }

    // Filter by sales ref
    if (sales_ref_id) {
      where.sales_ref_id = sales_ref_id;
    }

    // Filter by route
    if (route_id) {
      where.route_id = route_id;
    }

    // Filter by payment status
    if (payment_status) {
      where.payment_status = payment_status;
    }

    // Filter by payment method
    if (payment_method) {
      where.payment_method = payment_method;
    }

    // Filter by date range
    if (start_date && end_date) {
      where.invoice_date = {
        [Op.between]: [start_date, end_date],
      };
    } else if (start_date) {
      where.invoice_date = { [Op.gte]: start_date };
    } else if (end_date) {
      where.invoice_date = { [Op.lte]: end_date };
    }

    const { count, rows } = await SalesInvoice.findAndCountAll({
      where,
      limit: parseInt(limit),
      offset: parseInt(offset),
      include: [
        {
          model: Outlet,
          as: 'outlet',
          attributes: ['id', 'code', 'name', 'owner_name', 'balance'],
        },
        {
          model: Employee,
          as: 'salesRef',
          attributes: ['id', 'code', 'name', 'type'],
        },
        {
          model: Route,
          as: 'route',
          attributes: ['id', 'code', 'name'],
        },
        {
          model: User,
          as: 'createdBy',
          attributes: ['id', 'username', 'role'],
        },
      ],
      order: [
        ['invoice_date', 'DESC'],
        ['created_at', 'DESC'],
      ],
    });

    return successResponse(res, {
      invoices: rows,
      total: count,
      page: parseInt(page),
      totalPages: Math.ceil(count / limit),
    });
  } catch (error) {
    console.error('Error fetching invoices:', error);
    return errorResponse(res, 'Failed to fetch invoices', 500);
  }
};

// Get single invoice by ID with items
exports.getInvoiceById = async (req, res) => {
  try {
    const { id } = req.params;

    const invoice = await SalesInvoice.findByPk(id, {
      include: [
        {
          model: Outlet,
          as: 'outlet',
          attributes: [
            'id',
            'code',
            'name',
            'owner_name',
            'phone',
            'address',
            'balance',
            'credit_limit',
          ],
        },
        {
          model: Employee,
          as: 'salesRef',
          attributes: ['id', 'code', 'name', 'type'],
        },
        {
          model: Route,
          as: 'route',
          attributes: ['id', 'code', 'name'],
        },
        {
          model: InvoiceItem,
          as: 'items',
          include: [
            {
              model: ProductSku,
              as: 'sku',
              attributes: ['id', 'size', 'unit', 'barcode', 'price'],
              include: [
                {
                  model: Product,
                  as: 'product',
                  attributes: ['id', 'code', 'name', 'category'],
                },
              ],
            },
          ],
        },
        {
          model: User,
          as: 'creator',
          attributes: ['id', 'username', 'role'],
        },
      ],
    });

    if (!invoice) {
      return errorResponse(res, 'Invoice not found', 404);
    }

    return successResponse(res, invoice);
  } catch (error) {
    console.error('Error fetching invoice:', error);
    return errorResponse(res, 'Failed to fetch invoice', 500);
  }
};

// Create new sales invoice
exports.createInvoice = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const {
      outlet_id,
      sales_ref_id,
      route_id,
      invoice_date,
      items, // Array of { sku_id, quantity, unit_price, discount_percent, is_return, return_reason, return_to_stock }
      payment_method,
      check_number,
      check_date,
      notes,
    } = req.body;

    // Validate outlet exists
    const outlet = await Outlet.findByPk(outlet_id);
    if (!outlet) {
      await transaction.rollback();
      return errorResponse(res, 'Outlet not found', 404);
    }

    // Validate sales ref if provided
    if (sales_ref_id) {
      const salesRef = await Employee.findByPk(sales_ref_id);
      if (!salesRef) {
        await transaction.rollback();
        return errorResponse(res, 'Sales ref not found', 404);
      }
    }

    // Validate items array
    if (!items || items.length === 0) {
      await transaction.rollback();
      return errorResponse(res, 'Invoice must have at least one item', 400);
    }

    // Generate invoice number
    const invoice_number = await generateInvoiceNumber(new Date(invoice_date));

    // Calculate totals
    let subtotal = 0;
    let total_discount_amount = 0;

    const processedItems = [];

    for (const item of items) {
      // Validate SKU exists and has enough stock
      const sku = await ProductSku.findByPk(item.sku_id);
      if (!sku) {
        await transaction.rollback();
        return errorResponse(res, `Product SKU ${item.sku_id} not found`, 404);
      }

      // For sales items (not returns), check stock availability
      if (!item.is_return && sku.current_stock < item.quantity) {
        await transaction.rollback();
        return errorResponse(
          res,
          `Insufficient stock for SKU ${sku.id}. Available: ${sku.current_stock}, Required: ${item.quantity}`,
          400
        );
      }

      // Calculate line item amounts
      const line_subtotal = item.quantity * item.unit_price;
      const discount_percent = item.discount_percent || 0;
      const discount_amount = (line_subtotal * discount_percent) / 100;
      const line_total = line_subtotal - discount_amount;

      // For returns, amounts should be negative
      const finalQuantity = item.is_return ? -Math.abs(item.quantity) : item.quantity;
      const finalTotal = item.is_return ? -Math.abs(line_total) : line_total;

      subtotal += line_subtotal;
      total_discount_amount += discount_amount;

      processedItems.push({
        sku_id: item.sku_id,
        quantity: finalQuantity,
        unit_price: item.unit_price,
        discount_percent,
        discount_amount,
        total_amount: finalTotal,
        is_return: item.is_return || false,
        return_reason: item.return_reason || null,
        return_to_stock: item.return_to_stock || false,
      });
    }

    const total_amount = subtotal - total_discount_amount;

    // **PHASE 1: Credit Limit Enforcement**
    let creditWarning = null;
    if (payment_method === 'credit') {
      const currentBalance = parseFloat(outlet.balance || 0);
      const creditLimit = parseFloat(outlet.credit_limit || 0);
      const potentialBalance = currentBalance + total_amount;
      const utilizationPercent = creditLimit > 0 ? (potentialBalance / creditLimit) * 100 : 0;

      // Hard block at 100% for non-admins
      if (potentialBalance > creditLimit) {
        if (req.user.role !== 'admin') {
          await transaction.rollback();
          return errorResponse(
            res,
            `Credit limit exceeded. Current: Rs. ${currentBalance.toFixed(2)}, Limit: Rs. ${creditLimit.toFixed(2)}, Invoice: Rs. ${total_amount.toFixed(2)}, New Balance: Rs. ${potentialBalance.toFixed(2)} (${utilizationPercent.toFixed(1)}%)`,
            400
          );
        }

        // Admin override - require reason
        if (
          !req.body.credit_limit_override_reason ||
          req.body.credit_limit_override_reason.trim() === ''
        ) {
          await transaction.rollback();
          return errorResponse(
            res,
            'Admin override requires a reason for exceeding credit limit',
            400
          );
        }
      }

      // Warning at 80% (return in response)
      if (potentialBalance >= creditLimit * CREDIT_WARNING_THRESHOLD) {
        creditWarning = {
          message: `Approaching/Exceeding credit limit (${utilizationPercent.toFixed(1)}%)`,
          currentBalance: currentBalance.toFixed(2),
          creditLimit: creditLimit.toFixed(2),
          potentialBalance: potentialBalance.toFixed(2),
          utilizationPercent: utilizationPercent.toFixed(1),
          isExceeded: potentialBalance > creditLimit,
        };
      }
    }

    // Determine payment status
    let payment_status = 'unpaid';
    if (payment_method === 'cash') {
      payment_status = 'paid';
    } else if (payment_method === 'check') {
      payment_status = check_number ? 'unpaid' : 'unpaid'; // Check needs clearance
    }

    // Create invoice
    const invoice = await SalesInvoice.create(
      {
        invoice_number,
        outlet_id,
        sales_ref_id: sales_ref_id || null,
        route_id: route_id || null,
        invoice_date,
        subtotal,
        discount_percent: 0, // Line-level discounts only for now
        discount_amount: total_discount_amount,
        total_amount,
        payment_method,
        payment_status,
        check_number: check_number || null,
        check_date: check_date || null,
        notes: notes || null,
        created_by: req.user.id,
        // Phase 1: Credit limit snapshot and override fields
        credit_limit_at_time: payment_method === 'credit' ? outlet.credit_limit : null,
        outlet_balance_at_time: payment_method === 'credit' ? outlet.balance : null,
        credit_limit_override_reason: req.body.credit_limit_override_reason || null,
        credit_limit_override_by: req.body.credit_limit_override_reason ? req.user.id : null,
      },
      { transaction }
    );

    // Create invoice items and update stock
    for (const item of processedItems) {
      await InvoiceItem.create(
        {
          invoice_id: invoice.id,
          ...item,
        },
        { transaction }
      );

      // Update product SKU stock
      const sku = await ProductSku.findByPk(item.sku_id);

      if (item.is_return) {
        // For returns: if return_to_stock is true, add back to stock; otherwise, don't change stock
        if (item.return_to_stock) {
          sku.current_stock += Math.abs(item.quantity); // Add back (quantity is negative, so use abs)
        }
      } else {
        // For sales: reduce stock
        sku.current_stock -= item.quantity;
      }

      await sku.save({ transaction });
    }

    // Update outlet balance (for credit sales only)
    if (payment_method === 'credit') {
      outlet.balance += total_amount;
      await outlet.save({ transaction });
    }

    await transaction.commit();

    // Fetch the created invoice with associations
    const createdInvoice = await SalesInvoice.findByPk(invoice.id, {
      include: [
        { model: Outlet, as: 'outlet' },
        { model: Employee, as: 'salesRef' },
        { model: Route, as: 'route' },
        { model: InvoiceItem, as: 'items', include: [{ model: ProductSku, as: 'sku' }] },
      ],
    });

    // Phase 1: Include credit warning in response
    const response = {
      invoice: createdInvoice,
      creditWarning,
    };

    return successResponse(res, response, 201);
  } catch (error) {
    await transaction.rollback();
    console.error('Error creating invoice:', error);
    return errorResponse(res, error.message || 'Failed to create invoice', 500);
  }
};

// Update sales invoice
exports.updateInvoice = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { id } = req.params;
    const { notes, payment_status } = req.body;

    const invoice = await SalesInvoice.findByPk(id);
    if (!invoice) {
      await transaction.rollback();
      return errorResponse(res, 'Invoice not found', 404);
    }

    // Only allow updating notes and payment status (not items or amounts)
    if (notes !== undefined) invoice.notes = notes;
    if (payment_status !== undefined) invoice.payment_status = payment_status;

    await invoice.save({ transaction });
    await transaction.commit();

    const updatedInvoice = await SalesInvoice.findByPk(id, {
      include: [
        { model: Outlet, as: 'outlet' },
        { model: Employee, as: 'salesRef' },
        { model: Route, as: 'route' },
        { model: InvoiceItem, as: 'items' },
      ],
    });

    return successResponse(res, updatedInvoice);
  } catch (error) {
    await transaction.rollback();
    console.error('Error updating invoice:', error);
    return errorResponse(res, 'Failed to update invoice', 500);
  }
};

// Delete sales invoice (soft delete - reverse stock movements)
exports.deleteInvoice = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { id } = req.params;

    const invoice = await SalesInvoice.findByPk(id, {
      include: [{ model: InvoiceItem, as: 'items' }],
    });

    if (!invoice) {
      await transaction.rollback();
      return errorResponse(res, 'Invoice not found', 404);
    }

    // Reverse stock movements
    for (const item of invoice.items) {
      const sku = await ProductSku.findByPk(item.sku_id);

      if (item.is_return) {
        // Reverse return: if was returned to stock, remove it again
        if (item.return_to_stock) {
          sku.current_stock -= Math.abs(item.quantity);
        }
      } else {
        // Reverse sale: add stock back
        sku.current_stock += Math.abs(item.quantity);
      }

      await sku.save({ transaction });
    }

    // Reverse outlet balance (for credit sales)
    if (invoice.payment_method === 'credit') {
      const outlet = await Outlet.findByPk(invoice.outlet_id);
      outlet.balance -= invoice.total_amount;
      await outlet.save({ transaction });
    }

    // Delete invoice (cascade will delete items)
    await invoice.destroy({ transaction });

    await transaction.commit();

    return successResponse(res, { message: 'Invoice deleted successfully' });
  } catch (error) {
    await transaction.rollback();
    console.error('Error deleting invoice:', error);
    return errorResponse(res, 'Failed to delete invoice', 500);
  }
};

// Get invoice PDF (placeholder for future implementation)
exports.getInvoicePDF = async (req, res) => {
  try {
    return errorResponse(res, 'PDF generation not yet implemented', 501);
  } catch (error) {
    console.error('Error generating PDF:', error);
    return errorResponse(res, 'Failed to generate PDF', 500);
  }
};

/**
 * Get profit per sale (from sales invoices)
 * GET /api/sales/invoices/:invoiceId/profit
 */
exports.getSaleProfit = async (req, res) => {
  try {
    const { invoiceId } = req.params;

    const invoice = await SalesInvoice.findByPk(invoiceId, {
      include: [
        {
          model: InvoiceItem,
          as: 'items',
          include: [
            {
              model: ProductSku,
              as: 'sku',
              attributes: ['id', 'size', 'unit', 'average_cost'],
              include: [
                {
                  model: Product,
                  as: 'product',
                  attributes: ['code', 'name'],
                },
              ],
            },
          ],
        },
      ],
    });

    if (!invoice) {
      return errorResponse(res, 'Invoice not found', 404);
    }

    const itemProfits = invoice.items.map(item => {
      const unitPrice = parseFloat(item.unit_price || 0); // PHASE 1 FIX: was item.price
      const unitCost = parseFloat(item.sku.average_cost || 0);
      const quantity = parseFloat(item.quantity || 0);

      const revenue = unitPrice * quantity;
      const cost = unitCost * quantity;
      const profit = revenue - cost;
      const margin = revenue > 0 ? (profit / revenue) * 100 : 0;

      return {
        product: item.sku.product.name,
        sku: `${item.sku.size} ${item.sku.unit}`,
        quantity: quantity,
        unit_price: unitPrice.toFixed(2),
        unit_cost: unitCost.toFixed(2),
        revenue: revenue.toFixed(2),
        cost: cost.toFixed(2),
        profit: profit.toFixed(2),
        margin: margin.toFixed(2),
      };
    });

    const totalRevenue = itemProfits.reduce((sum, item) => sum + parseFloat(item.revenue), 0);
    const totalCost = itemProfits.reduce((sum, item) => sum + parseFloat(item.cost), 0);
    const totalProfit = totalRevenue - totalCost;
    const overallMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;

    return successResponse(res, {
      invoice_number: invoice.invoice_number,
      invoice_date: invoice.invoice_date,
      summary: {
        total_revenue: totalRevenue.toFixed(2),
        total_cost: totalCost.toFixed(2),
        total_profit: totalProfit.toFixed(2),
        profit_margin: overallMargin.toFixed(2),
      },
      items: itemProfits,
    });
  } catch (error) {
    console.error('Error calculating sale profit:', error);
    return errorResponse(res, 'Failed to calculate sale profit', 500);
  }
};

/**
 * Get daily/monthly profit summary
 * GET /api/sales/profit-summary?period=daily&date_from=2026-01-01&date_to=2026-01-31
 */
exports.getDailyMonthlyProfitSummary = async (req, res) => {
  try {
    const { period = 'daily', date_from, date_to } = req.query;

    const where = {};

    if (date_from) {
      where.invoice_date = {
        ...where.invoice_date,
        [Op.gte]: new Date(date_from),
      };
    }
    if (date_to) {
      where.invoice_date = {
        ...where.invoice_date,
        [Op.lte]: new Date(date_to),
      };
    }

    const invoices = await SalesInvoice.findAll({
      where,
      include: [
        {
          model: InvoiceItem,
          as: 'items',
          include: [
            {
              model: ProductSku,
              as: 'sku',
              attributes: ['average_cost'],
            },
          ],
        },
      ],
      order: [['invoice_date', 'ASC']],
    });

    // Group by period
    const profitByPeriod = {};

    invoices.forEach(invoice => {
      const date = new Date(invoice.invoice_date);
      let periodKey;

      if (period === 'daily') {
        periodKey = date.toISOString().slice(0, 10); // YYYY-MM-DD
      } else {
        periodKey = date.toISOString().slice(0, 7); // YYYY-MM
      }

      if (!profitByPeriod[periodKey]) {
        profitByPeriod[periodKey] = {
          revenue: 0,
          cost: 0,
          profit: 0,
          invoice_count: 0,
        };
      }

      let invoiceRevenue = 0;
      let invoiceCost = 0;

      invoice.items.forEach(item => {
        const quantity = parseFloat(item.quantity || 0);
        const price = parseFloat(item.unit_price || 0); // PHASE 1 FIX: was item.price
        const cost = parseFloat(item.sku.average_cost || 0);

        invoiceRevenue += quantity * price;
        invoiceCost += quantity * cost;
      });

      profitByPeriod[periodKey].revenue += invoiceRevenue;
      profitByPeriod[periodKey].cost += invoiceCost;
      profitByPeriod[periodKey].profit += invoiceRevenue - invoiceCost;
      profitByPeriod[periodKey].invoice_count += 1;
    });

    // Format results
    const summary = Object.keys(profitByPeriod)
      .sort()
      .map(periodKey => {
        const data = profitByPeriod[periodKey];
        const margin = data.revenue > 0 ? (data.profit / data.revenue) * 100 : 0;

        return {
          period: periodKey,
          revenue: data.revenue.toFixed(2),
          cost: data.cost.toFixed(2),
          profit: data.profit.toFixed(2),
          margin: margin.toFixed(2),
          invoice_count: data.invoice_count,
        };
      });

    const totals = summary.reduce(
      (acc, item) => ({
        revenue: acc.revenue + parseFloat(item.revenue),
        cost: acc.cost + parseFloat(item.cost),
        profit: acc.profit + parseFloat(item.profit),
        invoices: acc.invoices + item.invoice_count,
      }),
      { revenue: 0, cost: 0, profit: 0, invoices: 0 }
    );

    const overallMargin = totals.revenue > 0 ? (totals.profit / totals.revenue) * 100 : 0;

    return successResponse(res, {
      period_type: period,
      totals: {
        total_revenue: totals.revenue.toFixed(2),
        total_cost: totals.cost.toFixed(2),
        total_profit: totals.profit.toFixed(2),
        overall_margin: overallMargin.toFixed(2),
        total_invoices: totals.invoices,
      },
      breakdown: summary,
    });
  } catch (error) {
    console.error('Error generating profit summary:', error);
    return errorResponse(res, 'Failed to generate profit summary', 500);
  }
};
