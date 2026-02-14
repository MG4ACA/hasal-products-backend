const { sequelize } = require('../models');
const { Payment, PaymentAllocation, SalesInvoice, Outlet, User } = require('../models');
const { successResponse, errorResponse } = require('../utils/response');
const { Op } = require('sequelize');

// Get all payments with filters and pagination
exports.getAllPayments = async (req, res) => {
  try {
    const {
      outlet_id,
      payment_method,
      start_date,
      end_date,
      check_status, // pending, cleared, overdue
      page = 1,
      limit = 50,
    } = req.query;

    const offset = (parseInt(page) - 1) * parseInt(limit);

    const where = {};

    if (outlet_id) {
      where.outlet_id = outlet_id;
    }

    if (payment_method) {
      where.payment_method = payment_method;
    }

    if (start_date && end_date) {
      where.payment_date = {
        [Op.between]: [start_date, end_date],
      };
    } else if (start_date) {
      where.payment_date = {
        [Op.gte]: start_date,
      };
    } else if (end_date) {
      where.payment_date = {
        [Op.lte]: end_date,
      };
    }

    // Filter by check status
    if (check_status) {
      where.payment_method = 'check';

      if (check_status === 'pending') {
        where.clearance_date = null;
      } else if (check_status === 'cleared') {
        where.clearance_date = {
          [Op.ne]: null,
        };
      } else if (check_status === 'overdue') {
        // Checks pending for more than 30 days
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        where.clearance_date = null;
        where.check_date = {
          [Op.lt]: thirtyDaysAgo.toISOString().split('T')[0],
        };
      }
    }

    const { count, rows: payments } = await Payment.findAndCountAll({
      where,
      distinct: true,
      include: [
        {
          model: Outlet,
          as: 'outlet',
          attributes: ['id', 'name', 'address'],
        },
        {
          model: User,
          as: 'createdBy',
          attributes: ['id', 'username', 'full_name'],
        },
        {
          model: PaymentAllocation,
          as: 'allocations',
          include: [
            {
              model: SalesInvoice,
              as: 'invoice',
              attributes: ['id', 'invoice_number', 'total_amount', 'payment_status'],
            },
          ],
        },
      ],
      order: [['payment_date', 'DESC']],
      limit: parseInt(limit),
      offset,
    });

    return successResponse(res, {
      payments,
      pagination: {
        total: count,
        page: parseInt(page),
        pages: Math.ceil(count / parseInt(limit)),
        limit: parseInt(limit),
      },
    });
  } catch (error) {
    console.error('Get all payments error:', error);
    return errorResponse(res, 'Error retrieving payments', 500, error.message);
  }
};

// Get payment by ID
exports.getPaymentById = async (req, res) => {
  try {
    const { id } = req.params;

    const payment = await Payment.findByPk(id, {
      include: [
        {
          model: Outlet,
          as: 'outlet',
          attributes: ['id', 'name', 'address', 'balance'],
        },
        {
          model: User,
          as: 'createdBy',
          attributes: ['id', 'username', 'full_name'],
        },
        {
          model: PaymentAllocation,
          as: 'allocations',
          include: [
            {
              model: SalesInvoice,
              as: 'invoice',
              attributes: [
                'id',
                'invoice_number',
                'invoice_date',
                'total_amount',
                'paid_amount',
                'payment_status',
              ],
            },
          ],
        },
      ],
    });

    if (!payment) {
      return errorResponse(res, 'Payment not found', 404);
    }

    return successResponse(res, payment);
  } catch (error) {
    console.error('Get payment by ID error:', error);
    return errorResponse(res, 'Error retrieving payment', 500, error.message);
  }
};

// Create new payment with allocations
exports.createPayment = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const {
      outlet_id,
      payment_date,
      amount,
      payment_method,
      check_number,
      check_date,
      reference,
      notes,
      allocations, // Array of { invoice_id, allocated_amount }
    } = req.body;

    // Validation
    if (!outlet_id || !payment_date || !amount || !payment_method) {
      await transaction.rollback();
      return errorResponse(
        res,
        'Missing required fields: outlet_id, payment_date, amount, payment_method',
        400
      );
    }

    if (amount <= 0) {
      await transaction.rollback();
      return errorResponse(res, 'Payment amount must be greater than 0', 400);
    }

    if (payment_method === 'check' && (!check_number || !check_date)) {
      await transaction.rollback();
      return errorResponse(res, 'Check payments require check_number and check_date', 400);
    }

    // Verify outlet exists
    const outlet = await Outlet.findByPk(outlet_id, { transaction });
    if (!outlet) {
      await transaction.rollback();
      return errorResponse(res, 'Outlet not found', 404);
    }

    // Validate allocations
    if (!allocations || !Array.isArray(allocations) || allocations.length === 0) {
      await transaction.rollback();
      return errorResponse(res, 'At least one invoice allocation is required', 400);
    }

    // Calculate total allocated amount
    const totalAllocated = allocations.reduce(
      (sum, alloc) => sum + parseFloat(alloc.allocated_amount),
      0
    );

    if (Math.abs(totalAllocated - parseFloat(amount)) > 0.01) {
      await transaction.rollback();
      return errorResponse(res, 'Total allocated amount must equal payment amount', 400);
    }

    // Verify all invoices exist and belong to the outlet
    const invoiceIds = allocations.map(a => a.invoice_id);
    const invoices = await SalesInvoice.findAll({
      where: {
        id: invoiceIds,
        outlet_id,
      },
      transaction,
    });

    if (invoices.length !== invoiceIds.length) {
      await transaction.rollback();
      return errorResponse(
        res,
        'One or more invoices not found or do not belong to the specified outlet',
        404
      );
    }

    // Check if any allocation exceeds outstanding amount
    for (const allocation of allocations) {
      const invoice = invoices.find(inv => inv.id === allocation.invoice_id);
      const outstanding = parseFloat(invoice.total_amount) - parseFloat(invoice.paid_amount || 0);

      if (parseFloat(allocation.allocated_amount) > outstanding + 0.01) {
        await transaction.rollback();
        return errorResponse(
          res,
          `Allocated amount for invoice ${invoice.invoice_number} exceeds outstanding amount`,
          400
        );
      }
    }

    // Create payment record
    const payment = await Payment.create(
      {
        outlet_id,
        payment_date,
        amount: parseFloat(amount),
        payment_method,
        check_number: payment_method === 'check' ? check_number : null,
        check_date: payment_method === 'check' ? check_date : null,
        clearance_date: null, // Set later when check clears
        reference,
        notes,
        created_by: req.user.id,
      },
      { transaction }
    );

    // Create payment allocations
    const allocationPromises = allocations.map(allocation =>
      PaymentAllocation.create(
        {
          payment_id: payment.id,
          invoice_id: allocation.invoice_id,
          allocated_amount: parseFloat(allocation.allocated_amount),
        },
        { transaction }
      )
    );

    await Promise.all(allocationPromises);

    // Update invoice paid amounts and payment status
    for (const allocation of allocations) {
      const invoice = invoices.find(inv => inv.id === allocation.invoice_id);
      const newPaidAmount =
        parseFloat(invoice.paid_amount || 0) + parseFloat(allocation.allocated_amount);

      let paymentStatus = 'unpaid';
      if (Math.abs(newPaidAmount - parseFloat(invoice.total_amount)) < 0.01) {
        paymentStatus = 'paid';
      } else if (newPaidAmount > 0) {
        paymentStatus = 'partial';
      }

      await invoice.update(
        {
          paid_amount: newPaidAmount,
          payment_status: paymentStatus,
        },
        { transaction }
      );
    }

    // Reduce outlet balance
    const newBalance = parseFloat(outlet.balance) - parseFloat(amount);
    await outlet.update({ balance: newBalance }, { transaction });

    await transaction.commit();

    // Fetch complete payment with allocations
    const createdPayment = await Payment.findByPk(payment.id, {
      include: [
        {
          model: Outlet,
          as: 'outlet',
          attributes: ['id', 'name', 'address', 'balance'],
        },
        {
          model: User,
          as: 'createdBy',
          attributes: ['id', 'username', 'full_name'],
        },
        {
          model: PaymentAllocation,
          as: 'allocations',
          include: [
            {
              model: SalesInvoice,
              as: 'invoice',
              attributes: ['id', 'invoice_number', 'total_amount', 'paid_amount', 'payment_status'],
            },
          ],
        },
      ],
    });

    return successResponse(res, createdPayment, 'Payment created successfully', 201);
  } catch (error) {
    await transaction.rollback();
    console.error('Create payment error:', error);
    return errorResponse(res, 'Error creating payment', 500, error.message);
  }
};

// Update payment (mainly for adding clearance date to checks)
exports.updatePayment = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { id } = req.params;
    const { clearance_date, notes } = req.body;

    const payment = await Payment.findByPk(id, { transaction });

    if (!payment) {
      await transaction.rollback();
      return errorResponse(res, 'Payment not found', 404);
    }

    // Only allow updating clearance_date for check payments
    if (payment.payment_method !== 'check') {
      await transaction.rollback();
      return errorResponse(res, 'Only check payments can have clearance date updated', 400);
    }

    if (clearance_date && payment.clearance_date) {
      await transaction.rollback();
      return errorResponse(res, 'Check has already been cleared', 400);
    }

    const updateData = {};
    if (clearance_date) {
      updateData.clearance_date = clearance_date;
    }
    if (notes !== undefined) {
      updateData.notes = notes;
    }

    await payment.update(updateData, { transaction });

    await transaction.commit();

    // Fetch updated payment with associations
    const updatedPayment = await Payment.findByPk(id, {
      include: [
        {
          model: Outlet,
          as: 'outlet',
          attributes: ['id', 'name', 'address'],
        },
        {
          model: User,
          as: 'createdBy',
          attributes: ['id', 'username', 'full_name'],
        },
        {
          model: PaymentAllocation,
          as: 'allocations',
          include: [
            {
              model: SalesInvoice,
              as: 'invoice',
              attributes: ['id', 'invoice_number', 'total_amount', 'payment_status'],
            },
          ],
        },
      ],
    });

    return successResponse(res, updatedPayment, 'Payment updated successfully');
  } catch (error) {
    await transaction.rollback();
    console.error('Update payment error:', error);
    return errorResponse(res, 'Error updating payment', 500, error.message);
  }
};

// Delete payment (restore balances and invoice statuses)
exports.deletePayment = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { id } = req.params;

    const payment = await Payment.findByPk(id, {
      include: [
        {
          model: PaymentAllocation,
          as: 'allocations',
          include: [
            {
              model: SalesInvoice,
              as: 'invoice',
            },
          ],
        },
        {
          model: Outlet,
          as: 'outlet',
        },
      ],
      transaction,
    });

    if (!payment) {
      await transaction.rollback();
      return errorResponse(res, 'Payment not found', 404);
    }

    // Restore invoice paid amounts and payment statuses
    for (const allocation of payment.allocations) {
      const invoice = allocation.invoice;
      const newPaidAmount =
        parseFloat(invoice.paid_amount) - parseFloat(allocation.allocated_amount);

      let paymentStatus = 'unpaid';
      if (Math.abs(newPaidAmount - parseFloat(invoice.total_amount)) < 0.01) {
        paymentStatus = 'paid';
      } else if (newPaidAmount > 0) {
        paymentStatus = 'partial';
      }

      await invoice.update(
        {
          paid_amount: Math.max(0, newPaidAmount),
          payment_status: paymentStatus,
        },
        { transaction }
      );
    }

    // Restore outlet balance
    const newBalance = parseFloat(payment.outlet.balance) + parseFloat(payment.amount);
    await payment.outlet.update({ balance: newBalance }, { transaction });

    // Delete payment (allocations will be cascade deleted)
    await payment.destroy({ transaction });

    await transaction.commit();

    return successResponse(res, null, 'Payment deleted successfully');
  } catch (error) {
    await transaction.rollback();
    console.error('Delete payment error:', error);
    return errorResponse(res, 'Error deleting payment', 500, error.message);
  }
};

// Get outstanding invoices for an outlet
exports.getOutstandingInvoices = async (req, res) => {
  try {
    const { outlet_id } = req.params;

    if (!outlet_id) {
      return errorResponse(res, 'outlet_id is required', 400);
    }

    const invoices = await SalesInvoice.findAll({
      where: {
        outlet_id,
        payment_status: ['unpaid', 'partial'],
      },
      attributes: ['id', 'invoice_number', 'invoice_date', 'total_amount', 'payment_status'],
      include: [
        {
          model: PaymentAllocation,
          as: 'allocations',
          attributes: ['allocated_amount'],
          required: false,
        },
      ],
      order: [['invoice_date', 'ASC']],
    });

    // Calculate outstanding amounts in JavaScript using the virtual field
    const invoicesWithOutstanding = invoices.map(inv => {
      const paidAmount = inv.paid_amount || 0; // Virtual field calculation
      const outstandingAmount = parseFloat(inv.total_amount) - parseFloat(paidAmount);

      return {
        id: inv.id,
        invoice_number: inv.invoice_number,
        invoice_date: inv.invoice_date,
        total_amount: parseFloat(inv.total_amount),
        paid_amount: parseFloat(paidAmount),
        payment_status: inv.payment_status,
        outstanding_amount: outstandingAmount,
      };
    });

    const totalOutstanding = invoicesWithOutstanding.reduce(
      (sum, inv) => sum + inv.outstanding_amount,
      0
    );

    return successResponse(res, {
      invoices: invoicesWithOutstanding,
      total_outstanding: totalOutstanding,
    });
  } catch (error) {
    console.error('Get outstanding invoices error:', error);
    return errorResponse(res, 'Error retrieving outstanding invoices', 500, error.message);
  }
};

// Get pending checks (checks without clearance_date)
exports.getPendingChecks = async (req, res) => {
  try {
    const { overdue_only } = req.query;

    const where = {
      payment_method: 'check',
      clearance_date: null,
    };

    // If overdue_only, filter checks older than 30 days
    if (overdue_only === 'true') {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      where.check_date = {
        [Op.lt]: thirtyDaysAgo.toISOString().split('T')[0],
      };
    }

    const checks = await Payment.findAll({
      where,
      include: [
        {
          model: Outlet,
          as: 'outlet',
          attributes: ['id', 'name', 'address'],
        },
        {
          model: User,
          as: 'createdBy',
          attributes: ['id', 'username', 'full_name'],
        },
        {
          model: PaymentAllocation,
          as: 'allocations',
          include: [
            {
              model: SalesInvoice,
              as: 'invoice',
              attributes: ['id', 'invoice_number'],
            },
          ],
        },
      ],
      order: [['check_date', 'ASC']],
    });

    // Calculate days pending for each check
    const checksWithStatus = checks.map(check => {
      const checkDate = new Date(check.check_date);
      const today = new Date();
      const daysPending = Math.floor((today - checkDate) / (1000 * 60 * 60 * 24));

      return {
        ...check.toJSON(),
        days_pending: daysPending,
        is_overdue: daysPending > 30,
      };
    });

    return successResponse(res, checksWithStatus);
  } catch (error) {
    console.error('Get pending checks error:', error);
    return errorResponse(res, 'Error retrieving pending checks', 500, error.message);
  }
};

/**
 * Bounce a check payment and reverse all allocations
 * POST /api/payments/:payment_id/bounce
 * Phase 2: Check bounce handling
 */
exports.bounceCheck = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { payment_id } = req.params;
    const { bounce_reason, bounce_fee = 0 } = req.body;

    // Authorization check - only admins can bounce checks
    if (req.user.role !== 'admin') {
      await transaction.rollback();
      return errorResponse(res, 'Only admins can process check bounces', 403);
    }

    // Validate bounce_reason is provided
    if (!bounce_reason || bounce_reason.trim() === '') {
      await transaction.rollback();
      return errorResponse(res, 'Bounce reason is required', 400);
    }

    // 1. Fetch payment with allocations
    const payment = await Payment.findByPk(payment_id, {
      include: [
        {
          model: PaymentAllocation,
          as: 'allocations',
          include: [
            {
              model: SalesInvoice,
              as: 'invoice',
            },
          ],
        },
      ],
    });

    if (!payment) {
      await transaction.rollback();
      return errorResponse(res, 'Payment not found', 404);
    }

    // 2. Validation checks
    if (payment.payment_method !== 'check') {
      await transaction.rollback();
      return errorResponse(res, 'Only check payments can be bounced', 400);
    }

    if (payment.payment_status === 'bounced') {
      await transaction.rollback();
      return errorResponse(res, 'Payment has already been bounced', 400);
    }

    // 3. Reverse all payment allocations
    let reversedCount = 0;
    let totalReversedAmount = 0; // Track total amount to restore

    for (const allocation of payment.allocations) {
      const invoice = allocation.invoice;
      const allocatedAmount = parseFloat(allocation.allocated_amount);
      totalReversedAmount += allocatedAmount;

      // Update invoice check_status
      if (invoice.payment_method === 'check' && invoice.check_number === payment.check_number) {
        invoice.check_status = 'bounced';
      }

      // Recalculate invoice payment status after removing this allocation
      const remainingAllocations = await PaymentAllocation.findAll({
        where: {
          invoice_id: invoice.id,
          payment_id: { [Op.ne]: payment_id }, // Exclude current payment
        },
        transaction,
      });

      const paidAfterBounce = remainingAllocations.reduce(
        (sum, alloc) => sum + parseFloat(alloc.allocated_amount),
        0
      );

      if (paidAfterBounce <= 0) {
        invoice.payment_status = 'unpaid';
      } else if (paidAfterBounce < parseFloat(invoice.total_amount)) {
        invoice.payment_status = 'partial';
      } else {
        invoice.payment_status = 'paid';
      }

      await invoice.save({ transaction });

      // Delete the allocation
      await allocation.destroy({ transaction });
      reversedCount++;
    }

    // Restore outlet balance (payment amount + bounce fee)
    const outlet = await Outlet.findByPk(payment.outlet_id, { transaction });
    const currentBalance = parseFloat(outlet.balance);
    const newBalance = currentBalance + totalReversedAmount + parseFloat(bounce_fee || 0);
    outlet.balance = newBalance;
    await outlet.save({ transaction });

    // 4. Update payment status to bounced
    payment.payment_status = 'bounced';
    payment.bounce_date = new Date();
    payment.bounce_reason = bounce_reason;
    payment.bounce_fee = bounce_fee;
    payment.reversed_by = req.user.id;
    await payment.save({ transaction });

    await transaction.commit();

    return successResponse(res, {
      message: 'Check bounced successfully',
      payment: {
        id: payment.id,
        check_number: payment.check_number,
        amount: payment.amount,
        payment_status: payment.payment_status,
        bounce_date: payment.bounce_date,
        bounce_reason: payment.bounce_reason,
        bounce_fee: payment.bounce_fee,
      },
      reversed_allocations: reversedCount,
      bounce_fee_applied: parseFloat(bounce_fee).toFixed(2),
    });
  } catch (error) {
    await transaction.rollback();
    console.error('Error bouncing check:', error);
    return errorResponse(res, 'Failed to bounce check', 500);
  }
};

/**
 * Clear a check payment (mark as cleared)
 * POST /api/payments/:payment_id/clear
 * Phase 2: Check lifecycle management
 */
exports.clearCheck = async (req, res) => {
  try {
    const { payment_id } = req.params;
    const { clearance_date } = req.body;

    // Fetch payment
    const payment = await Payment.findByPk(payment_id, {
      include: [
        {
          model: PaymentAllocation,
          as: 'allocations',
          include: [
            {
              model: SalesInvoice,
              as: 'invoice',
            },
          ],
        },
      ],
    });

    if (!payment) {
      return errorResponse(res, 'Payment not found', 404);
    }

    // Validation
    if (payment.payment_method !== 'check') {
      return errorResponse(res, 'Only check payments can be cleared', 400);
    }

    if (payment.payment_status === 'bounced') {
      return errorResponse(res, 'Bounced checks cannot be cleared', 400);
    }

    if (payment.payment_status === 'cleared') {
      return errorResponse(res, 'Payment has already been cleared', 400);
    }

    // Update payment status
    payment.payment_status = 'cleared';
    payment.clearance_date = clearance_date || new Date();
    await payment.save();

    // Update related invoices' check_status
    for (const allocation of payment.allocations) {
      const invoice = allocation.invoice;
      if (invoice.payment_method === 'check' && invoice.check_number === payment.check_number) {
        invoice.check_status = 'cleared';
        invoice.clearance_date = payment.clearance_date;
        await invoice.save();
      }
    }

    return successResponse(res, {
      message: 'Check cleared successfully',
      payment: {
        id: payment.id,
        check_number: payment.check_number,
        amount: payment.amount,
        payment_status: payment.payment_status,
        clearance_date: payment.clearance_date,
      },
    });
  } catch (error) {
    console.error('Error clearing check:', error);
    return errorResponse(res, 'Failed to clear check', 500);
  }
};
