const {
  PurchaseOrder,
  PoItem,
  Supplier,
  RawMaterial,
  RawMaterialBatch,
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
 * Get purchase order by ID with items
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
              attributes: ['id', 'code', 'name', 'unit', 'current_stock'],
            },
          ],
        },
      ],
    });

    if (!purchaseOrder) {
      return errorResponse(res, 'Purchase order not found', 404);
    }

    return successResponse(res, purchaseOrder);
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
    const { supplier_id, order_date, expected_delivery_date, notes, items } = req.body;

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
        expected_delivery_date,
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

    // Update supplier balance
    await Supplier.increment('balance', {
      by: parseFloat(total_amount),
      where: { id: supplier_id },
    });
  } catch (error) {
    if (transaction && !transaction.finished) {
      await transaction.rollback();
    }
    console.error('Error creating purchase order:', error);
    return errorResponse(res, 'Failed to create purchase order', 500);
  }

  // Fetch created PO with relations (after transaction is committed)
  try {
    const createdPo = await PurchaseOrder.findByPk(purchaseOrder.id, {
      include: [
        { model: Supplier, as: 'supplier', attributes: ['id', 'code', 'name'] },
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
    const { supplier_id, order_date, expected_delivery_date, notes, items } = req.body;

    const purchaseOrder = await PurchaseOrder.findByPk(id);
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
      let total_amount = 0;
      items.forEach(item => {
        const itemTotal = parseFloat(item.quantity) * parseFloat(item.unit_cost);
        total_amount += itemTotal;
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
      await purchaseOrder.update({ total_amount: total_amount.toFixed(2) }, { transaction });
    }

    // Update basic fields
    const updateData = {};
    if (supplier_id) updateData.supplier_id = supplier_id;
    if (order_date) updateData.order_date = order_date;
    if (expected_delivery_date) updateData.expected_delivery_date = expected_delivery_date;
    if (notes !== undefined) updateData.notes = notes;

    await purchaseOrder.update(updateData, { transaction });
    await transaction.commit();

    // Fetch updated PO with relations
    const updatedPo = await PurchaseOrder.findByPk(id, {
      include: [
        { model: Supplier, as: 'supplier', attributes: ['id', 'code', 'name'] },
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
    if (purchaseOrder.status !== 'pending') {
      await transaction.rollback();
      return errorResponse(
        res,
        `Cannot delete purchase order with status: ${purchaseOrder.status}`,
        400
      );
    }

    // Delete PO items first
    await PoItem.destroy({ where: { po_id: id }, transaction });

    // Delete purchase order
    await purchaseOrder.destroy({ transaction });

    await transaction.commit();

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
    const { received_date, received_items, return_items } = req.body;

    if (!received_date || !received_items || received_items.length === 0) {
      await transaction.rollback();
      return errorResponse(res, 'Received date and items are required', 400);
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

    if (purchaseOrder.status === 'received') {
      await transaction.rollback();
      return errorResponse(res, 'Purchase order already received', 400);
    }

    // Import batch number generator
    const { generateBatchNumber } = require('../utils/batchNumberGenerator');

    let totalReturnAmount = 0;

    // Process each received item
    for (const receivedItem of received_items) {
      const poItem = purchaseOrder.PoItems.find(
        item => item.raw_material_id === receivedItem.raw_material_id
      );

      if (!poItem) {
        await transaction.rollback();
        return errorResponse(
          res,
          `Raw material ${receivedItem.raw_material_id} not found in PO`,
          400
        );
      }

      const rawMaterial = poItem.RawMaterial;
      const receivedQty = parseFloat(receivedItem.quantity_received);

      // Generate batch number
      const batchNumber = await generateBatchNumber(rawMaterial.code);

      // Create batch
      await RawMaterialBatch.create(
        {
          material_id: receivedItem.raw_material_id,
          supplier_id: purchaseOrder.supplier_id,
          batch_number: batchNumber,
          batch_type: 'receipt',
          received_date: received_date,
          expiry_date: receivedItem.expiry_date,
          initial_quantity: receivedQty,
          current_quantity: receivedQty,
          unit_cost: poItem.unit_cost,
        },
        { transaction }
      );

      // Update raw material stock
      const newStock = parseFloat(rawMaterial.current_stock || 0) + receivedQty;
      await rawMaterial.update({ current_stock: newStock.toFixed(2) }, { transaction });
    }

    // Process return items if provided
    if (return_items && return_items.length > 0) {
      for (const returnItem of return_items) {
        const poItem = purchaseOrder.PoItems.find(
          item => item.raw_material_id === returnItem.raw_material_id
        );

        if (!poItem) {
          await transaction.rollback();
          return errorResponse(
            res,
            `Raw material ${returnItem.raw_material_id} not found in PO`,
            400
          );
        }

        const rawMaterial = poItem.RawMaterial;
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

        // Generate batch number for return
        const returnBatchNumber = await generateBatchNumber(rawMaterial.code);

        // Create negative batch for return
        await RawMaterialBatch.create(
          {
            material_id: returnItem.raw_material_id,
            supplier_id: purchaseOrder.supplier_id,
            batch_number: returnBatchNumber,
            batch_type: 'return',
            return_reason: returnItem.return_reason,
            return_disposition: returnItem.disposition,
            received_date: received_date,
            expiry_date: returnItem.expiry_date || null,
            initial_quantity: -returnQty, // Negative quantity for returns
            current_quantity: -returnQty,
            unit_cost: poItem.unit_cost,
          },
          { transaction }
        );

        // Update stock only if disposition is 'stock' (not dispose)
        if (returnItem.disposition === 'stock') {
          const newStock = parseFloat(rawMaterial.current_stock || 0) - returnQty;
          await rawMaterial.update(
            { current_stock: Math.max(0, newStock).toFixed(2) },
            { transaction }
          );
        }

        // Calculate return amount
        totalReturnAmount += returnQty * parseFloat(poItem.unit_cost);
      }
    }

    // Update supplier balance (add to payable, minus returns)
    const supplier = purchaseOrder.Supplier;
    const netAmount = parseFloat(purchaseOrder.total_amount) - totalReturnAmount;
    const newBalance = parseFloat(supplier.balance || 0) + netAmount;
    await supplier.update({ balance: newBalance.toFixed(2) }, { transaction });

    // Update PO status
    await purchaseOrder.update(
      {
        status: 'received',
        received_date: received_date,
      },
      { transaction }
    );

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

    return successResponse(res, updatedPo, 'Purchase order received successfully');
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
