const {
  PurchaseOrder,
  PoItem,
  Supplier,
  RawMaterial,
  RawMaterialBatch,
  SupplierPayment,
  sequelize,
} = require('../models');
const { Op } = require('sequelize');
const { successResponse, errorResponse } = require('../utils/response');

/**
 * Get all purchase orders with pagination, search, and filters
 * GET /api/purchase-orders
 */
exports.getAllPurchaseOrders = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search = '',
      status = '',
      supplier_id = '',
      start_date = '',
      end_date = '',
    } = req.query;

    const offset = (page - 1) * limit;
    const where = {};

    // Search by PO number
    if (search) {
      where.po_number = {
        [Op.like]: `%${search}%`,
      };
    }

    // Filter by status
    if (status) {
      where.status = status;
    }

    // Filter by supplier
    if (supplier_id) {
      where.supplier_id = supplier_id;
    }

    // Filter by date range
    if (start_date && end_date) {
      where.order_date = {
        [Op.between]: [start_date, end_date],
      };
    } else if (start_date) {
      where.order_date = {
        [Op.gte]: start_date,
      };
    } else if (end_date) {
      where.order_date = {
        [Op.lte]: end_date,
      };
    }

    const { count, rows } = await PurchaseOrder.findAndCountAll({
      where,
      limit: parseInt(limit),
      offset: parseInt(offset),
      include: [
        {
          model: Supplier,
          as: 'supplier',
          attributes: ['id', 'code', 'name', 'contact_person', 'phone'],
        },
      ],
      order: [
        ['order_date', 'DESC'],
        ['created_at', 'DESC'],
      ],
      distinct: true,
    });

    return successResponse(res, {
      data: rows,
      total: count,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(count / limit),
    });
  } catch (error) {
    console.error('Error fetching purchase orders:', error);
    return errorResponse(res, 'Failed to fetch purchase orders', 500);
  }
};

/**
 * Get purchase order by ID with items and batches
 * GET /api/purchase-orders/:id
 */
exports.getPurchaseOrderById = async (req, res) => {
  try {
    const { id } = req.params;

    const purchaseOrder = await PurchaseOrder.findByPk(id, {
      include: [
        {
          model: Supplier,
          as: 'supplier',
          attributes: ['id', 'code', 'name', 'contact_person', 'phone', 'email', 'address'],
        },
        {
          model: PoItem,
          as: 'items',
          include: [
            {
              model: RawMaterial,
              as: 'material',
              attributes: ['id', 'code', 'name', 'unit'],
            },
          ],
        },
      ],
    });

    if (!purchaseOrder) {
      return errorResponse(res, 'Purchase order not found', 404);
    }

    // Fetch batches created from THIS specific PO
    const batches = await RawMaterialBatch.findAll({
      where: {
        purchase_order_id: id,
      },
      include: [
        {
          model: RawMaterial,
          as: 'material',
          attributes: ['id', 'code', 'name', 'unit'],
        },
      ],
      order: [['created_at', 'DESC']],
    });

    // Fetch payments made for THIS specific PO
    const payments = await SupplierPayment.findAll({
      where: {
        purchase_order_id: id,
      },
      order: [['payment_date', 'DESC']],
    });

    return successResponse(res, {
      ...purchaseOrder.toJSON(),
      batches,
      payments,
    });
  } catch (error) {
    console.error('Error fetching purchase order:', error);
    return errorResponse(res, 'Failed to fetch purchase order', 500);
  }
};

/**
 * Generate PO number in format: PO-YYYYMMDD-XXX
 */
const generatePoNumber = async () => {
  const today = new Date();
  const dateStr = today.toISOString().slice(0, 10).replace(/-/g, ''); // YYYYMMDD

  // Find the latest PO number for today
  const latestPo = await PurchaseOrder.findOne({
    where: {
      po_number: {
        [Op.like]: `PO-${dateStr}-%`,
      },
    },
    order: [['po_number', 'DESC']],
  });

  let sequence = 1;
  if (latestPo) {
    const lastSequence = parseInt(latestPo.po_number.split('-')[2]);
    sequence = lastSequence + 1;
  }

  return `PO-${dateStr}-${String(sequence).padStart(3, '0')}`;
};

/**
 * Create new purchase order
 * POST /api/purchase-orders
 */
exports.createPurchaseOrder = async (req, res) => {
  const transaction = await sequelize.transaction();
  let purchaseOrder = null;

  try {
    const { supplier_id, order_date, expected_date, notes, items } = req.body;

    console.log('PO Creation Request:', {
      supplier_id,
      order_date,
      expected_date,
      items_count: items?.length,
    });

    // Validate required fields
    if (!supplier_id || !order_date || !items || items.length === 0) {
      await transaction.rollback();
      return errorResponse(res, 'Supplier, order date, and items are required', 400);
    }

    // Verify supplier exists
    const supplier = await Supplier.findByPk(supplier_id);
    if (!supplier) {
      await transaction.rollback();
      return errorResponse(res, 'Supplier not found', 404);
    }

    // Verify all raw materials exist
    for (const item of items) {
      const material = await RawMaterial.findByPk(item.raw_material_id);
      if (!material) {
        await transaction.rollback();
        return errorResponse(res, `Raw material with ID ${item.raw_material_id} not found`, 404);
      }
    }

    // Generate PO number
    const po_number = await generatePoNumber();

    // Calculate total amount
    let total_amount = 0;
    items.forEach(item => {
      const itemTotal = parseFloat(item.quantity) * parseFloat(item.unit_cost);
      total_amount += itemTotal;
    });

    // Create purchase order
    purchaseOrder = await PurchaseOrder.create(
      {
        po_number,
        supplier_id,
        order_date,
        expected_date,
        total_amount: total_amount.toFixed(2),
        status: 'pending',
        notes,
        created_by: req.user.id,
      },
      { transaction }
    );

    // Create PO items
    const poItems = items.map(item => ({
      po_id: purchaseOrder.id,
      material_id: item.raw_material_id,
      quantity: item.quantity,
      unit_cost: item.unit_cost,
      total_amount: (parseFloat(item.quantity) * parseFloat(item.unit_cost)).toFixed(2),
    }));

    await PoItem.bulkCreate(poItems, { transaction });

    await transaction.commit();

    // Note: Supplier balance is NOT updated here during PO creation
    // Balance only changes when payment is made during PO receive
  } catch (error) {
    if (transaction && !transaction.finished) {
      await transaction.rollback();
    }
    console.error('Error creating purchase order:', error.message);
    console.error('Error details:', error);
    return errorResponse(res, 'Failed to create purchase order', 500);
  }

  // Fetch created PO with relations (after transaction is committed)
  try {
    const createdPo = await PurchaseOrder.findByPk(purchaseOrder.id, {
      include: [
        {
          model: Supplier,
          as: 'supplier',
          attributes: [
            'id',
            'code',
            'name',
            'contact_person',
            'phone',
            'email',
            'address',
            'balance',
          ],
        },
        {
          model: PoItem,
          as: 'items',
          include: [
            {
              model: RawMaterial,
              as: 'material',
              attributes: ['id', 'code', 'name', 'unit'],
            },
          ],
        },
      ],
    });

    return successResponse(res, createdPo, 'Purchase order created successfully', 201);
  } catch (error) {
    console.error('Error fetching created purchase order:', error);
    return errorResponse(res, 'Purchase order created but failed to retrieve details', 500);
  }
};

/**
 * Update purchase order
 * PUT /api/purchase-orders/:id
 */
exports.updatePurchaseOrder = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { id } = req.params;
    const { supplier_id, order_date, expected_date, notes, items } = req.body;

    const purchaseOrder = await PurchaseOrder.findByPk(id, {
      include: [{ model: Supplier, as: 'supplier' }],
    });
    if (!purchaseOrder) {
      await transaction.rollback();
      return errorResponse(res, 'Purchase order not found', 404);
    }

    // Only allow updates if PO is pending
    if (purchaseOrder.status !== 'pending') {
      await transaction.rollback();
      return errorResponse(
        res,
        `Cannot update purchase order with status: ${purchaseOrder.status}`,
        400
      );
    }

    // Verify supplier exists if changing
    if (supplier_id && supplier_id !== purchaseOrder.supplier_id) {
      const supplier = await Supplier.findByPk(supplier_id);
      if (!supplier) {
        await transaction.rollback();
        return errorResponse(res, 'Supplier not found', 404);
      }
    }

    // Store old total amount for balance adjustment
    const oldTotalAmount = parseFloat(purchaseOrder.total_amount || 0);
    let newTotalAmount = oldTotalAmount;

    // Update PO items if provided
    if (items && items.length > 0) {
      // Verify all raw materials exist
      for (const item of items) {
        const material = await RawMaterial.findByPk(item.raw_material_id);
        if (!material) {
          await transaction.rollback();
          return errorResponse(res, `Raw material with ID ${item.raw_material_id} not found`, 404);
        }
      }

      // Delete existing items
      await PoItem.destroy({ where: { po_id: id }, transaction });

      // Calculate new total amount
      newTotalAmount = 0;
      items.forEach(item => {
        const itemTotal = parseFloat(item.quantity) * parseFloat(item.unit_cost);
        newTotalAmount += itemTotal;
      });

      // Create new items
      const poItems = items.map(item => ({
        po_id: id,
        material_id: item.raw_material_id,
        quantity: item.quantity,
        unit_cost: item.unit_cost,
        total_amount: (parseFloat(item.quantity) * parseFloat(item.unit_cost)).toFixed(2),
      }));

      await PoItem.bulkCreate(poItems, { transaction });

      // Update total amount
      await purchaseOrder.update({ total_amount: newTotalAmount.toFixed(2) }, { transaction });

      // Adjust supplier balance if total amount changed
      if (newTotalAmount !== oldTotalAmount) {
        const balanceDifference = newTotalAmount - oldTotalAmount;
        const supplier = purchaseOrder.supplier;
        const newBalance = parseFloat(supplier.balance || 0) + balanceDifference;

        await supplier.update({ balance: newBalance.toFixed(2) }, { transaction });

        console.log(
          `Supplier balance adjusted by ${balanceDifference} (from ${oldTotalAmount} to ${newTotalAmount})`
        );
      }
    }

    // Update basic fields
    const updateData = {};
    if (supplier_id) updateData.supplier_id = supplier_id;
    if (order_date) updateData.order_date = order_date;
    if (expected_date) updateData.expected_date = expected_date;
    if (notes !== undefined) updateData.notes = notes;

    await purchaseOrder.update(updateData, { transaction });
    await transaction.commit();

    // Fetch updated PO with relations
    const updatedPo = await PurchaseOrder.findByPk(id, {
      include: [
        { model: Supplier, as: 'supplier', attributes: ['id', 'code', 'name', 'balance'] },
        {
          model: PoItem,
          as: 'items',
          include: [
            {
              model: RawMaterial,
              as: 'material',
              attributes: ['id', 'code', 'name', 'unit'],
            },
          ],
        },
      ],
    });

    return successResponse(res, updatedPo, 'Purchase order updated successfully');
  } catch (error) {
    await transaction.rollback();
    console.error('Error updating purchase order:', error);
    return errorResponse(res, 'Failed to update purchase order', 500);
  }
};

/**
 * Delete purchase order
 * DELETE /api/purchase-orders/:id
 */
exports.deletePurchaseOrder = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { id } = req.params;

    const purchaseOrder = await PurchaseOrder.findByPk(id);
    if (!purchaseOrder) {
      await transaction.rollback();
      return errorResponse(res, 'Purchase order not found', 404);
    }

    // Only allow deletion if PO is pending
    // This prevents deletion of POs that have been received (partial/received status)
    if (purchaseOrder.status !== 'pending') {
      await transaction.rollback();
      return errorResponse(
        res,
        `Cannot delete purchase order with status: ${purchaseOrder.status}. Only pending orders can be deleted.`,
        400
      );
    }

    // Delete PO items first
    await PoItem.destroy({ where: { po_id: id }, transaction });

    // Delete purchase order
    await purchaseOrder.destroy({ transaction });

    await transaction.commit();

    // Note: No balance adjustment needed since pending POs don't affect supplier balance
    return successResponse(res, null, 'Purchase order deleted successfully');
  } catch (error) {
    await transaction.rollback();
    console.error('Error deleting purchase order:', error);
    return errorResponse(res, 'Failed to delete purchase order', 500);
  }
};

/**
 * Receive purchase order (create batches and update stock)
 * POST /api/purchase-orders/:id/receive
 */
exports.receivePurchaseOrder = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { id } = req.params;
    const { received_date, received_items, return_items, payment } = req.body;

    // Phase 2: Allow return-only transactions (no new received items)
    if (!received_date) {
      await transaction.rollback();
      return errorResponse(res, 'Received date is required', 400);
    }

    // Phase 2: Need at least one return item or at least one received item with > 0 quantity
    const hasReturnItems = return_items && return_items.length > 0;
    const hasReceivedItems =
      received_items && received_items.some(item => parseFloat(item.quantity_received) > 0);

    if (!hasReturnItems && !hasReceivedItems) {
      await transaction.rollback();
      return errorResponse(
        res,
        'Either received items (with quantity > 0) or return items are required',
        400
      );
    }

    const purchaseOrder = await PurchaseOrder.findByPk(id, {
      include: [
        {
          model: PoItem,
          as: 'items',
          include: [{ model: RawMaterial, as: 'material' }],
        },
        {
          model: Supplier,
          as: 'supplier',
        },
      ],
    });

    if (!purchaseOrder) {
      await transaction.rollback();
      return errorResponse(res, 'Purchase order not found', 404);
    }

    // Phase 2: Allow returns on received POs (but no new received items)
    // Phase 1.3: Allow multiple receipts for pending or partial POs (not for fully received)
    if (purchaseOrder.status === 'received' && !hasReturnItems) {
      await transaction.rollback();
      return errorResponse(
        res,
        'Cannot receive additional items for an already fully received purchase order. Use return transaction if needed.',
        400
      );
    }

    if (purchaseOrder.status === 'cancelled') {
      await transaction.rollback();
      return errorResponse(res, 'Cannot receive a cancelled purchase order', 400);
    }

    // Import batch number generator
    const { generateBatchNumber } = require('../utils/batchNumberGenerator');

    let totalReceivedAmount = 0;
    let totalReturnAmount = 0;
    const createdBatches = []; // Track created batches for response

    // Process each received item (may be empty for return-only transactions)
    for (const receivedItem of received_items || []) {
      const poItem = purchaseOrder.items.find(
        item => item.material_id === receivedItem.raw_material_id
      );

      if (!poItem) {
        await transaction.rollback();
        return errorResponse(
          res,
          `Raw material ${receivedItem.raw_material_id} not found in PO`,
          400
        );
      }

      const rawMaterial = poItem.material;
      const receivedQty = parseFloat(receivedItem.quantity_received);
      const poQuantity = parseFloat(poItem.quantity);
      const currentlyReceived = parseFloat(poItem.received_quantity || 0);

      // Phase 1.3: Validate no over-receipt (cumulative check)
      if (currentlyReceived + receivedQty > poQuantity) {
        await transaction.rollback();
        return errorResponse(
          res,
          `Cannot receive ${receivedQty}kg for material ${rawMaterial.code}. Already received ${currentlyReceived}kg of ${poQuantity}kg ordered.`,
          400
        );
      }

      // Generate batch number
      const batchNumber = await generateBatchNumber(rawMaterial.code, transaction);

      // Create batch with inspection_status = 'pending' (Phase 1 QC workflow)
      const batch = await RawMaterialBatch.create(
        {
          material_id: receivedItem.raw_material_id,
          supplier_id: purchaseOrder.supplier_id,
          purchase_order_id: purchaseOrder.id,
          batch_number: batchNumber,
          batch_type: 'receipt',
          quantity: receivedQty,
          unit_cost: poItem.unit_cost,
          purchase_date: received_date,
          expiry_date: receivedItem.expiry_date,
          inspection_status: 'pending',
          accepted_quantity: 0,
          rejected_quantity: 0,
        },
        { transaction }
      );
      createdBatches.push(batch);

      // Update PO item received quantity (cumulative for multiple receipts)
      // received_quantity is updated cumulatively, accepted_quantity is set to current receipt
      const newReceivedQty = currentlyReceived + receivedQty;
      await poItem.update(
        { received_quantity: newReceivedQty, accepted_quantity: newReceivedQty },
        { transaction }
      );

      // Add to total received amount for balance update
      totalReceivedAmount += receivedQty * parseFloat(poItem.unit_cost);
    }

    // Process return items if provided
    if (return_items && return_items.length > 0) {
      for (const returnItem of return_items) {
        const poItem = purchaseOrder.items.find(
          item => item.material_id === returnItem.raw_material_id
        );

        if (!poItem) {
          await transaction.rollback();
          return errorResponse(
            res,
            `Raw material ${returnItem.raw_material_id} not found in PO`,
            400
          );
        }

        const rawMaterial = poItem.material;
        const returnQty = parseFloat(returnItem.quantity_returned);

        // Validate return reason and disposition
        if (!returnItem.return_reason || !returnItem.disposition) {
          await transaction.rollback();
          return errorResponse(
            res,
            'Return reason and disposition are required for return items',
            400
          );
        }

        // Phase 2: Validate source_batch_id if provided
        let sourceBatchId = null;
        if (returnItem.source_batch_id) {
          console.log('Validating source_batch_id:', returnItem.source_batch_id);

          try {
            const sourceBatch = await RawMaterialBatch.findByPk(returnItem.source_batch_id, {
              transaction,
            });

            if (!sourceBatch) {
              await transaction.rollback();
              return errorResponse(
                res,
                `Source batch ${returnItem.source_batch_id} not found`,
                404
              );
            }

            // Validate source batch belongs to same material
            if (sourceBatch.material_id !== returnItem.raw_material_id) {
              await transaction.rollback();
              return errorResponse(
                res,
                `Source batch belongs to different material (${sourceBatch.material_id} vs ${returnItem.raw_material_id})`,
                400
              );
            }

            // Validate source batch is a receipt batch (not another return)
            if (sourceBatch.batch_type !== 'receipt') {
              await transaction.rollback();
              return errorResponse(
                res,
                'Can only return from receipt batches, not from other return batches',
                400
              );
            }

            sourceBatchId = returnItem.source_batch_id;
          } catch (validationError) {
            console.error('Source batch validation error:', validationError);
            await transaction.rollback();
            return errorResponse(res, `Batch validation error: ${validationError.message}`, 500);
          }
        }

        // Generate batch number for return
        const returnBatchNumber = await generateBatchNumber(rawMaterial.code, transaction);

        // Create negative batch for return with source_batch_id tracking (Phase 2)
        const returnBatch = await RawMaterialBatch.create(
          {
            material_id: returnItem.raw_material_id,
            supplier_id: purchaseOrder.supplier_id,
            purchase_order_id: purchaseOrder.id,
            batch_number: returnBatchNumber,
            batch_type: 'return',
            return_reason: returnItem.return_reason,
            return_disposition: returnItem.disposition,
            quantity: -returnQty,
            unit_cost: poItem.unit_cost,
            purchase_date: received_date,
            expiry_date: returnItem.expiry_date || null,
            inspection_status: 'approved',
            accepted_quantity: 0,
            rejected_quantity: returnQty,
            source_batch_id: sourceBatchId,
          },
          { transaction }
        );
        createdBatches.push(returnBatch);

        // Calculate return amount
        totalReturnAmount += returnQty * parseFloat(poItem.unit_cost);
      }
    }

    // Update supplier balance
    // Balance Direction: +Balance = we owe supplier (liability/payable)
    // Business Logic:
    //   - FIRST receive from a PO (status = 'pending'): Add FULL PO amount to balance
    //   - SUBSEQUENT receives (status = 'partial'): Don't add anything (PO amount already added)
    //   - Payment: Always reduces balance
    // Note: PO creation doesn't affect balance, only the FIRST receive does
    const supplier = purchaseOrder.supplier;
    const isFirstReceive = purchaseOrder.status === 'pending';
    let paymentAmount = 0;
    let shouldReduceBalance = false; // Default: don't reduce balance (for no payment or pending payments)

    // Create supplier payment if provided
    let createdPayment = null;
    if (payment && payment.amount) {
      paymentAmount = parseFloat(payment.amount);

      // Validate payment amount is not negative
      if (paymentAmount < 0) {
        await transaction.rollback();
        return errorResponse(res, 'Payment amount cannot be negative', 400);
      }

      // Determine payment status and clearance based on payment method
      const paymentMethod = payment.payment_method || 'cash';
      let paymentStatus, clearanceDate;

      if (paymentMethod === 'cash' || paymentMethod === 'bank_transfer') {
        paymentStatus = 'cleared';
        clearanceDate = new Date();
        shouldReduceBalance = true;
      } else if (paymentMethod === 'check' || paymentMethod === 'credit') {
        paymentStatus = 'pending';
        clearanceDate = null;
        shouldReduceBalance = false;
      } else {
        await transaction.rollback();
        return errorResponse(res, 'Invalid payment method', 400);
      }

      // Prevent overpayment validation (only for immediate payments)
      const outstandingBalance = parseFloat(supplier.balance || 0);
      const poTotalAmount = parseFloat(purchaseOrder.total_amount || 0);

      if (shouldReduceBalance) {
        // Calculate max allowable payment based on whether this is first or subsequent receive
        const maxAllowablePayment = isFirstReceive
          ? outstandingBalance + poTotalAmount // First receive: can pay up to old balance + full PO amount
          : outstandingBalance; // Subsequent receive: can only pay current balance

        if (paymentAmount > maxAllowablePayment) {
          await transaction.rollback();
          const message = isFirstReceive
            ? `Payment amount (Rs. ${paymentAmount}) exceeds total payable amount (Rs. ${maxAllowablePayment.toFixed(2)}). ` +
              `Current balance: Rs. ${outstandingBalance.toFixed(2)}, PO total: Rs. ${poTotalAmount.toFixed(2)}`
            : `Payment amount (Rs. ${paymentAmount}) exceeds outstanding balance (Rs. ${outstandingBalance.toFixed(2)})`;
          return errorResponse(res, message, 400);
        }
      }

      // Create payment record
      createdPayment = await SupplierPayment.create(
        {
          supplier_id: purchaseOrder.supplier_id,
          purchase_order_id: purchaseOrder.id,
          amount: paymentAmount,
          payment_date: new Date(),
          payment_method: paymentMethod,
          payment_status: paymentStatus,
          check_number: paymentMethod === 'check' ? payment.check_number : null,
          check_date: paymentMethod === 'check' ? payment.check_date : null,
          clearance_date: clearanceDate,
          reference: payment.reference || null,
          notes: payment.notes || `Payment during PO #${purchaseOrder.po_number} receive`,
          created_by: req.user?.id || null,
        },
        { transaction }
      );
    }

    // Calculate new balance based on whether this is first receive or not
    // - First receive (status was 'pending'): Add FULL PO amount, then subtract payment (if cleared)
    // - Subsequent receive (status was 'partial'): Only subtract payment (if cleared)
    // - Check/Credit payments: Don't reduce balance until cleared

    // Fetch fresh supplier balance before updating (not the one from PO association which might be stale)
    const freshSupplier = await Supplier.findByPk(purchaseOrder.supplier_id, { transaction });
    const oldBalance = parseFloat(freshSupplier.balance || 0);

    // Use isFirstReceive already calculated above (line 746)
    const poTotalAmount = parseFloat(purchaseOrder.total_amount || 0);

    // If first receive: add full PO amount. If subsequent: add nothing
    const amountToAdd = isFirstReceive ? poTotalAmount : 0;

    // Only deduct payment if it's an immediate payment (cash/bank)
    // Check/credit payments don't reduce balance until cleared
    const paymentToDeduct = createdPayment && shouldReduceBalance ? paymentAmount : 0;
    const newBalance = Math.max(0, oldBalance + amountToAdd - paymentToDeduct);

    console.log(
      `PO Receive Balance Update: Supplier ${purchaseOrder.supplier_id}, PO #${purchaseOrder.po_number}`
    );
    console.log(`  First Receive: ${isFirstReceive}`);
    console.log(`  Old Balance: Rs. ${oldBalance.toFixed(2)}`);
    console.log(`  Amount to Add (PO): Rs. ${amountToAdd.toFixed(2)}`);
    console.log(`  Payment Amount: Rs. ${paymentAmount.toFixed(2)}`);
    console.log(
      `  Payment Method: ${createdPayment?.payment_method || 'none'} (${createdPayment?.payment_status || 'n/a'})`
    );
    console.log(`  Payment to Deduct: Rs. ${paymentToDeduct.toFixed(2)}`);
    console.log(`  New Balance: Rs. ${newBalance.toFixed(2)}`);

    // Update supplier balance using Supplier model directly with transaction
    const updateResult = await Supplier.update(
      { balance: newBalance.toFixed(2) },
      {
        where: { id: purchaseOrder.supplier_id },
        transaction: transaction,
      }
    );

    console.log(`  Update Result: ${updateResult[0]} row(s) affected`);

    // Determine new status: "received" if all items received, "partial" if some, "cancelled" stays as is
    let newStatus = 'partial';
    const allItemsReceived = purchaseOrder.items.every(item => {
      const totalReceived = parseFloat(item.received_quantity || 0);
      const totalOrdered = parseFloat(item.quantity);
      return totalReceived >= totalOrdered;
    });

    if (allItemsReceived) {
      newStatus = 'received';
    }

    // Update PO status
    await purchaseOrder.update({ status: newStatus }, { transaction });

    await transaction.commit();

    // Fetch updated PO
    const updatedPo = await PurchaseOrder.findByPk(id, {
      include: [
        { model: Supplier, as: 'supplier' },
        {
          model: PoItem,
          as: 'items',
          include: [{ model: RawMaterial, as: 'material' }],
        },
      ],
    });

    return successResponse(
      res,
      {
        po: updatedPo,
        batches: createdBatches,
        payment: createdPayment,
      },
      'Purchase order received successfully' + (createdPayment ? ' and payment recorded' : '')
    );
  } catch (error) {
    await transaction.rollback();
    console.error('Error receiving purchase order:', error);
    return errorResponse(res, error.message || 'Failed to receive purchase order', 500);
  }
};

/**
 * Update purchase order status
 * PUT /api/purchase-orders/:id/status
 */
exports.updatePurchaseOrderStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const validStatuses = ['pending', 'approved', 'received', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return errorResponse(res, `Invalid status. Must be one of: ${validStatuses.join(', ')}`, 400);
    }

    const purchaseOrder = await PurchaseOrder.findByPk(id);
    if (!purchaseOrder) {
      return errorResponse(res, 'Purchase order not found', 404);
    }

    // Prevent certain status transitions
    if (purchaseOrder.status === 'received' && status !== 'received') {
      return errorResponse(res, 'Cannot change status of received purchase order', 400);
    }

    await purchaseOrder.update({ status });

    const updatedPo = await PurchaseOrder.findByPk(id, {
      include: [{ model: Supplier, as: 'supplier', attributes: ['id', 'code', 'name'] }],
    });

    return successResponse(res, updatedPo, 'Purchase order status updated successfully');
  } catch (error) {
    console.error('Error updating purchase order status:', error);
    return errorResponse(res, 'Failed to update purchase order status', 500);
  }
};
/**
 * Cancel a purchase order
 * PUT /api/purchase-orders/:id/cancel
 *
 * Only pending POs can be cancelled. Reverses supplier balance.
 */
exports.cancelPurchaseOrder = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { id } = req.params;
    const { cancellation_reason } = req.body;

    if (!cancellation_reason) {
      await transaction.rollback();
      return errorResponse(res, 'Cancellation reason is required', 400);
    }

    const purchaseOrder = await PurchaseOrder.findByPk(id, {
      include: [
        { model: Supplier, as: 'supplier' },
        { model: PoItem, as: 'items' },
      ],
      transaction,
    });

    if (!purchaseOrder) {
      await transaction.rollback();
      return errorResponse(res, 'Purchase order not found', 404);
    }

    // Only allow cancellation of pending POs
    if (purchaseOrder.status !== 'pending') {
      await transaction.rollback();
      return errorResponse(
        res,
        `Cannot cancel purchase order with status: ${purchaseOrder.status}. Only pending POs can be cancelled.`,
        400
      );
    }

    // Reverse supplier balance
    const supplier = purchaseOrder.supplier;
    if (supplier) {
      const newBalance = parseFloat(supplier.balance || 0) - parseFloat(purchaseOrder.total_amount);
      await supplier.update({ balance: newBalance.toFixed(2) }, { transaction });
    }

    // Update PO with cancellation details
    await purchaseOrder.update(
      {
        status: 'cancelled',
        cancellation_reason,
        cancelled_at: new Date(),
        cancelled_by: req.user.id,
      },
      { transaction }
    );

    await transaction.commit();

    // Fetch updated PO
    const cancelledPo = await PurchaseOrder.findByPk(id, {
      include: [
        { model: Supplier, as: 'supplier', attributes: ['id', 'code', 'name', 'balance'] },
        {
          model: PoItem,
          as: 'items',
          include: [{ model: RawMaterial, as: 'material' }],
        },
      ],
    });

    return successResponse(res, cancelledPo, 'Purchase order cancelled successfully');
  } catch (error) {
    await transaction.rollback();
    console.error('Error cancelling purchase order:', error);
    return errorResponse(res, error.message || 'Failed to cancel purchase order', 500);
  }
};
