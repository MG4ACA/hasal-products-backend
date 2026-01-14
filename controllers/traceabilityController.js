const { RawMaterialBatch, RawMaterial, Supplier } = require('../models');
const { successResponse, errorResponse } = require('../utils/response');

/**
 * Get batch genealogy - full history of a batch including returns
 * GET /api/batches/:id/genealogy
 *
 * Returns:
 * - Original receipt batch
 * - All return batches from this batch
 * - Return details (reason, disposition, returned quantity)
 */
exports.getBatchGenealogy = async (req, res) => {
  try {
    const { id } = req.params;

    const batch = await RawMaterialBatch.findByPk(id, {
      include: [
        { model: RawMaterial, as: 'material' },
        { model: Supplier, as: 'supplier' },
        {
          model: RawMaterialBatch,
          as: 'returnBatches',
          include: [{ model: Supplier, as: 'supplier' }],
        },
      ],
    });

    if (!batch) {
      return errorResponse(res, 'Batch not found', 404);
    }

    // Ensure this is a receipt batch (not trying to get genealogy of return)
    if (batch.batch_type !== 'receipt') {
      return errorResponse(
        res,
        'Can only get genealogy for receipt batches. Use source_batch_id to find origin of return batches.',
        400
      );
    }

    // Format response
    const genealogy = {
      receipt_batch: {
        id: batch.id,
        batch_number: batch.batch_number,
        material: batch.material,
        quantity: batch.quantity,
        unit_cost: batch.unit_cost,
        purchase_date: batch.purchase_date,
        expiry_date: batch.expiry_date,
        inspection_status: batch.inspection_status,
        accepted_quantity: batch.accepted_quantity,
        created_at: batch.created_at,
      },
      returns: batch.returnBatches.map(returnBatch => ({
        id: returnBatch.id,
        batch_number: returnBatch.batch_number,
        quantity_returned: Math.abs(parseFloat(returnBatch.quantity)),
        return_reason: returnBatch.return_reason,
        disposition: returnBatch.return_disposition,
        supplier: returnBatch.supplier,
        created_at: returnBatch.created_at,
      })),
      summary: {
        total_received: parseFloat(batch.quantity),
        total_returned: Math.abs(
          batch.returnBatches.reduce((sum, rb) => sum + parseFloat(rb.quantity), 0)
        ),
        net_available:
          parseFloat(batch.quantity) +
          batch.returnBatches.reduce((sum, rb) => sum + parseFloat(rb.quantity), 0),
      },
    };

    return successResponse(res, genealogy, 'Batch genealogy retrieved successfully');
  } catch (error) {
    console.error('Error fetching batch genealogy:', error);
    return errorResponse(res, error.message || 'Failed to fetch batch genealogy', 500);
  }
};

/**
 * Get return origin - trace a return batch back to its source
 * GET /api/batches/:id/origin
 *
 * Returns:
 * - Return batch details
 * - Source receipt batch details
 * - Full return chain if there are multiple levels
 */
exports.getReturnOrigin = async (req, res) => {
  try {
    const { id } = req.params;

    const batch = await RawMaterialBatch.findByPk(id, {
      include: [
        { model: RawMaterial, as: 'material' },
        { model: Supplier, as: 'supplier' },
        {
          model: RawMaterialBatch,
          as: 'sourceBatch',
          include: [{ model: Supplier, as: 'supplier' }],
        },
      ],
    });

    if (!batch) {
      return errorResponse(res, 'Batch not found', 404);
    }

    // Ensure this is a return batch
    if (batch.batch_type !== 'return') {
      return errorResponse(
        res,
        'Can only get origin for return batches. Use genealogy for receipt batches.',
        400
      );
    }

    // Build response
    const origin = {
      return_batch: {
        id: batch.id,
        batch_number: batch.batch_number,
        quantity_returned: Math.abs(parseFloat(batch.quantity)),
        return_reason: batch.return_reason,
        disposition: batch.return_disposition,
        created_at: batch.created_at,
      },
    };

    // Include source batch if tracked
    if (batch.sourceBatch) {
      origin.source_batch = {
        id: batch.sourceBatch.id,
        batch_number: batch.sourceBatch.batch_number,
        quantity_received: parseFloat(batch.sourceBatch.quantity),
        inspection_status: batch.sourceBatch.inspection_status,
        purchase_date: batch.sourceBatch.purchase_date,
        created_at: batch.sourceBatch.created_at,
      };
    }

    return successResponse(res, origin, 'Return origin retrieved successfully');
  } catch (error) {
    console.error('Error fetching return origin:', error);
    return errorResponse(res, error.message || 'Failed to fetch return origin', 500);
  }
};

/**
 * Get batch returns summary
 * GET /api/materials/:materialId/batches/returns-summary
 *
 * Returns total received and returned quantities per material
 */
exports.getMaterialReturnsSummary = async (req, res) => {
  try {
    const { materialId } = req.params;

    // Verify material exists
    const material = await RawMaterial.findByPk(materialId);
    if (!material) {
      return errorResponse(res, 'Material not found', 404);
    }

    // Get all batches for this material
    const batches = await RawMaterialBatch.findAll({
      where: { material_id: materialId },
      order: [['purchase_date', 'DESC']],
      include: [{ model: Supplier, as: 'supplier' }],
    });

    // Separate receipts and returns
    const receipts = batches.filter(b => b.batch_type === 'receipt');
    const returns = batches.filter(b => b.batch_type === 'return');

    // Calculate totals
    const totalReceived = receipts.reduce((sum, b) => sum + parseFloat(b.quantity), 0);
    const totalReturned = returns.reduce((sum, b) => sum + Math.abs(parseFloat(b.quantity)), 0);
    const netAvailable = totalReceived - totalReturned;

    // Group returns by reason
    const returnsByReason = {};
    returns.forEach(r => {
      const reason = r.return_reason || 'Unspecified';
      if (!returnsByReason[reason]) {
        returnsByReason[reason] = { count: 0, quantity: 0, disposition: {} };
      }
      returnsByReason[reason].count += 1;
      returnsByReason[reason].quantity += Math.abs(parseFloat(r.quantity));

      const disp = r.return_disposition || 'unknown';
      returnsByReason[reason].disposition[disp] =
        (returnsByReason[reason].disposition[disp] || 0) + Math.abs(parseFloat(r.quantity));
    });

    const summary = {
      material,
      totals: {
        total_received: totalReceived,
        total_returned: totalReturned,
        net_available: netAvailable,
        return_percentage:
          totalReceived > 0 ? ((totalReturned / totalReceived) * 100).toFixed(2) : '0.00',
      },
      batch_counts: {
        total_receipt_batches: receipts.length,
        total_return_batches: returns.length,
      },
      returns_by_reason: returnsByReason,
      recent_batches: batches.slice(0, 10).map(b => ({
        id: b.id,
        batch_number: b.batch_number,
        batch_type: b.batch_type,
        quantity: parseFloat(b.quantity),
        purchase_date: b.purchase_date,
        ...(b.batch_type === 'return' && {
          return_reason: b.return_reason,
          disposition: b.return_disposition,
        }),
      })),
    };

    return successResponse(res, summary, 'Returns summary retrieved successfully');
  } catch (error) {
    console.error('Error fetching returns summary:', error);
    return errorResponse(res, error.message || 'Failed to fetch returns summary', 500);
  }
};
