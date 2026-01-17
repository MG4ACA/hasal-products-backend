const { SupplierPayment, Supplier, User } = require('../models');
const { successResponse, errorResponse } = require('../utils/response');
const { Op } = require('sequelize');

// Get all supplier payments with filters
exports.getAllSupplierPayments = async (req, res) => {
  try {
    const { supplier_id, payment_method, start_date, end_date, page = 1, limit = 50 } = req.query;

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const where = {};

    if (supplier_id) {
      where.supplier_id = supplier_id;
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

    const { count, rows } = await SupplierPayment.findAndCountAll({
      where,
      include: [
        {
          model: Supplier,
          as: 'supplier',
          attributes: ['id', 'code', 'name'],
        },
        {
          model: User,
          as: 'createdBy',
          attributes: ['id', 'username', 'full_name'],
        },
      ],
      order: [['payment_date', 'DESC']],
      limit: parseInt(limit),
      offset,
    });

    return successResponse(res, {
      payments: rows,
      total: count,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(count / parseInt(limit)),
    });
  } catch (error) {
    console.error('Error fetching supplier payments:', error);
    return errorResponse(res, error.message, 500);
  }
};

// Get supplier payments for a specific supplier
exports.getSupplierPayments = async (req, res) => {
  try {
    const { id: supplierId } = req.params;
    const { page = 1, limit = 20 } = req.query;

    const offset = (parseInt(page) - 1) * parseInt(limit);

    const { count, rows } = await SupplierPayment.findAndCountAll({
      where: { supplier_id: supplierId },
      include: [
        {
          model: User,
          as: 'createdBy',
          attributes: ['id', 'username', 'full_name'],
        },
      ],
      order: [['payment_date', 'DESC']],
      limit: parseInt(limit),
      offset,
    });

    return successResponse(res, {
      payments: rows,
      total: count,
      page: parseInt(page),
      limit: parseInt(limit),
    });
  } catch (error) {
    console.error('Error fetching supplier payments:', error);
    return errorResponse(res, error.message, 500);
  }
};

// Get payment by ID
exports.getPaymentById = async (req, res) => {
  try {
    const { id } = req.params;

    const payment = await SupplierPayment.findByPk(id, {
      include: [
        {
          model: Supplier,
          as: 'supplier',
          attributes: ['id', 'code', 'name'],
        },
        {
          model: User,
          as: 'createdBy',
          attributes: ['id', 'username', 'full_name'],
        },
      ],
    });

    if (!payment) {
      return errorResponse(res, 'Payment not found', 404);
    }

    return successResponse(res, payment);
  } catch (error) {
    console.error('Error fetching payment:', error);
    return errorResponse(res, error.message, 500);
  }
};

// Create supplier payment
exports.createSupplierPayment = async (req, res) => {
  try {
    const {
      supplier_id,
      payment_date,
      amount,
      payment_method,
      purchase_order_id,
      check_number,
      check_date,
      clearance_date,
      reference,
      notes,
    } = req.body;

    const userId = req.user.id;

    // Parse amount as decimal
    const parsedAmount = parseFloat(amount);

    // Validation
    if (!supplier_id || !payment_date || !parsedAmount || !payment_method) {
      return errorResponse(
        res,
        'Missing required fields: supplier_id, payment_date, amount, payment_method',
        400
      );
    }

    if (parsedAmount <= 0) {
      return errorResponse(res, 'Amount must be greater than 0', 400);
    }

    // Verify supplier exists
    const supplier = await Supplier.findByPk(supplier_id);
    if (!supplier) {
      return errorResponse(res, 'Supplier not found', 404);
    }

    // Determine payment status and clearance date based on payment method
    let paymentStatus, clearanceDate, shouldReduceBalance;

    if (payment_method === 'cash' || payment_method === 'bank_transfer') {
      // Immediate payment methods
      paymentStatus = 'cleared';
      clearanceDate = payment_date;
      shouldReduceBalance = true;
    } else if (payment_method === 'check' || payment_method === 'credit') {
      // Deferred payment methods
      paymentStatus = 'pending';
      clearanceDate = null;
      shouldReduceBalance = false;
    } else {
      return errorResponse(res, 'Invalid payment method', 400);
    }

    // Prevent overpayment (only for immediate payments)
    if (shouldReduceBalance) {
      const outstandingBalance = parseFloat(supplier.balance || 0);
      if (parsedAmount > outstandingBalance) {
        let message = '';
        if (outstandingBalance === 0) {
          message = 'This supplier account is fully settled. No payment is required at this time.';
        } else {
          message =
            `Payment amount (Rs. ${parsedAmount}) exceeds outstanding balance (Rs. ${outstandingBalance}). ` +
            `Maximum allowed payment: Rs. ${outstandingBalance}`;
        }
        return errorResponse(res, message, 400);
      }
    }

    // If check, validate check fields
    if (payment_method === 'check') {
      if (!check_number || !check_date) {
        return errorResponse(
          res,
          'Check number and check date are required for check payments',
          400
        );
      }
    }

    // Create payment
    const payment = await SupplierPayment.create({
      supplier_id,
      purchase_order_id: purchase_order_id || null,
      payment_date,
      amount: parsedAmount,
      payment_method,
      payment_status: paymentStatus,
      check_number: payment_method === 'check' ? check_number : null,
      check_date: payment_method === 'check' ? check_date : null,
      clearance_date: clearanceDate,
      reference,
      notes,
      created_by: userId,
    });

    // Update supplier balance only for immediate payment methods
    if (shouldReduceBalance) {
      const newBalance = Math.max(0, parseFloat(supplier.balance || 0) - parsedAmount);

      console.log(`Standalone Payment Update: Supplier ${supplier_id}`);
      console.log(`  Payment Method: ${payment_method} (${paymentStatus})`);
      console.log(`  Old Balance: ${supplier.balance}`);
      console.log(`  Payment Amount: ${parsedAmount}`);
      console.log(`  New Balance: ${newBalance}`);

      await Supplier.update({ balance: newBalance.toFixed(2) }, { where: { id: supplier_id } });
    } else {
      console.log(`Standalone Payment Created: Supplier ${supplier_id}`);
      console.log(`  Payment Method: ${payment_method} (${paymentStatus})`);
      console.log('  Balance unchanged (pending payment)');
    }

    // Fetch updated supplier to return fresh data
    const updatedSupplier = await Supplier.findByPk(supplier_id, {
      attributes: ['id', 'code', 'name', 'balance'],
    });

    // Fetch created payment with relations
    const createdPayment = await SupplierPayment.findByPk(payment.id, {
      include: [
        {
          model: Supplier,
          as: 'supplier',
          attributes: ['id', 'code', 'name', 'balance'],
        },
        {
          model: User,
          as: 'createdBy',
          attributes: ['id', 'username', 'full_name'],
        },
      ],
    });

    return successResponse(res, createdPayment, 'Supplier payment recorded successfully', 201);
  } catch (error) {
    console.error('Error creating supplier payment:', error);
    return errorResponse(res, error.message, 500);
  }
};

// Update payment (mainly for check clearance)
exports.updatePayment = async (req, res) => {
  try {
    const { id, paymentId } = req.params;
    const { clearance_date, notes } = req.body;

    const payment = await SupplierPayment.findByPk(paymentId);
    if (!payment) {
      return errorResponse(res, 'Payment not found', 404);
    }

    // Only checks can be updated for clearance
    if (payment.payment_method !== 'check') {
      return errorResponse(res, 'Only check payments can be updated', 400);
    }

    // Update payment
    await payment.update({
      clearance_date,
      notes: notes || payment.notes,
    });

    const updatedPayment = await SupplierPayment.findByPk(paymentId, {
      include: [
        {
          model: Supplier,
          as: 'supplier',
          attributes: ['id', 'code', 'name'],
        },
        {
          model: User,
          as: 'createdBy',
          attributes: ['id', 'username', 'full_name'],
        },
      ],
    });

    return successResponse(res, updatedPayment, 'Payment updated successfully');
  } catch (error) {
    console.error('Error updating payment:', error);
    return errorResponse(res, error.message, 500);
  }
};

// Delete payment
exports.deletePayment = async (req, res) => {
  try {
    const { id, paymentId } = req.params;

    const payment = await SupplierPayment.findByPk(paymentId);
    if (!payment) {
      return errorResponse(res, 'Payment not found', 404);
    }

    // Reverse the payment from supplier balance ONLY if payment was cleared
    // Pending payments never reduced the balance, so no reversal needed
    if (payment.payment_status === 'cleared') {
      const supplier = await Supplier.findByPk(payment.supplier_id);
      const newBalance = parseFloat(supplier.balance || 0) + parseFloat(payment.amount);

      console.log('Delete Payment - Reversing balance for cleared payment:');
      console.log(`  Old Balance: ${supplier.balance}`);
      console.log(`  Payment Amount: ${payment.amount}`);
      console.log(`  New Balance: ${newBalance}`);

      await Supplier.update(
        { balance: newBalance.toFixed(2) },
        { where: { id: payment.supplier_id } }
      );
    } else {
      console.log(`Delete Payment - No balance change for ${payment.payment_status} payment`);
    }

    // Delete payment
    await payment.destroy();

    return successResponse(res, { message: 'Payment deleted successfully' });
  } catch (error) {
    console.error('Error deleting payment:', error);
    return errorResponse(res, error.message, 500);
  }
};

// Get payment summary for supplier
exports.getSupplierPaymentSummary = async (req, res) => {
  try {
    const { id: supplierId } = req.params;

    const supplier = await Supplier.findByPk(supplierId);
    if (!supplier) {
      return errorResponse(res, 'Supplier not found', 404);
    }

    // Get total payments
    const paymentData = await SupplierPayment.findAll({
      where: { supplier_id: supplierId },
      attributes: [
        [Supplier.sequelize.fn('SUM', Supplier.sequelize.col('amount')), 'total_paid'],
        [Supplier.sequelize.fn('COUNT', Supplier.sequelize.col('id')), 'payment_count'],
      ],
      raw: true,
    });

    const summary = {
      supplier_id: supplierId,
      supplier_name: supplier.name,
      total_paid: parseFloat(paymentData[0]?.total_paid || 0),
      payment_count: parseInt(paymentData[0]?.payment_count || 0),
      current_balance: parseFloat(supplier.balance || 0),
    };

    return successResponse(res, summary);
  } catch (error) {
    console.error('Error fetching payment summary:', error);
    return errorResponse(res, error.message, 500);
  }
};
