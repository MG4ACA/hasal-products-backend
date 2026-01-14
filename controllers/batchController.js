const { RawMaterialBatch, PoItem, PurchaseOrder, RawMaterial, sequelize } = require('../models');
const { successResponse, errorResponse } = require('../utils/response');

/**
 * Approve QC inspection for a batch
 * POST /api/raw-material-batches/:id/approve-inspection
 *
 * Request body:
 * {
 *   inspection_status: 'approved' or 'rejected',
 *   accepted_quantity: number (for approved/partial batches),
 *   rejected_quantity: number (for rejected/partial batches),
 *   inspection_notes: string (optional)
 * }
 */
exports.approveInspection = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const { id } = req.params;
    const { inspection_status, accepted_quantity, rejected_quantity, inspection_notes } = req.body;
    const userId = req.user?.id;

    // Validate inspection status
    if (!inspection_status || !['approved', 'rejected'].includes(inspection_status)) {
      await transaction.rollback();
      return errorResponse(res, 'Invalid inspection status. Must be "approved" or "rejected"', 400);
    }

    // Validate quantities
    const parsedAccepted = parseFloat(accepted_quantity || 0);
    const parsedRejected = parseFloat(rejected_quantity || 0);

    if (parsedAccepted < 0 || parsedRejected < 0) {
      await transaction.rollback();
      return errorResponse(res, 'Accepted and rejected quantities must be non-negative', 400);
    }

    const batch = await RawMaterialBatch.findByPk(id, {
      include: [{ model: RawMaterial, as: 'material' }],
      transaction,
    });

    if (!batch) {
      await transaction.rollback();
      return errorResponse(res, 'Batch not found', 404);
    }

    // Only allow inspection approval for receipt batches with pending status
    if (batch.batch_type !== 'receipt' || batch.inspection_status !== 'pending') {
      await transaction.rollback();
      return errorResponse(res, 'Batch is not pending inspection or is not a receipt batch', 400);
    }

    // Validate that accepted + rejected = total quantity (or less if partial acceptance)
    const totalQty = parseFloat(batch.quantity);
    if (parsedAccepted + parsedRejected > totalQty) {
      await transaction.rollback();
      return errorResponse(
        res,
        `Accepted (${parsedAccepted}) + Rejected (${parsedRejected}) cannot exceed total quantity (${totalQty})`,
        400
      );
    }

    // If approved, accepted_quantity must be set
    if (inspection_status === 'approved' && parsedAccepted <= 0) {
      await transaction.rollback();
      return errorResponse(
        res,
        'Accepted quantity must be greater than 0 for approved batches',
        400
      );
    }

    // Update batch with inspection results
    await batch.update(
      {
        inspection_status,
        accepted_quantity: parsedAccepted,
        rejected_quantity: parsedRejected,
        inspection_notes: inspection_notes || null,
        inspection_date: new Date(),
      },
      { transaction }
    );

    // If batch is rejected entirely, prevent production use
    if (inspection_status === 'rejected' && parsedRejected === totalQty) {
      // Batch is fully rejected - quantity effectively becomes 0 for production
      // This is handled at the stock level query time
    }

    // If batch is approved (or partially approved), update related PoItem with accepted_quantity
    if (batch.batch_type === 'receipt') {
      // Find related PoItem for this batch's material and PO
      // This requires finding the PO that this batch was received for
      const poItem = await PoItem.findOne({
        where: {
          material_id: batch.material_id,
          is_return: false,
        },
        include: [
          {
            model: PurchaseOrder,
            as: 'purchaseOrder',
            where: { id: { [require('sequelize').Op.ne]: null } },
          },
        ],
        transaction,
      });

      if (poItem) {
        // Update PoItem's accepted_quantity to match batch's accepted_quantity
        // This ensures the PO tracks how much has been accepted after QC
        await poItem.update({ accepted_quantity: parsedAccepted }, { transaction });
      }
    }

    await transaction.commit();

    // Fetch updated batch
    const updatedBatch = await RawMaterialBatch.findByPk(id, {
      include: [{ model: RawMaterial, as: 'material' }],
    });

    return successResponse(res, updatedBatch, `Batch inspection ${inspection_status} successfully`);
  } catch (error) {
    await transaction.rollback();
    console.error('Error approving batch inspection:', error);
    return errorResponse(res, error.message || 'Failed to approve batch inspection', 500);
  }
};

/**
 * Get batch details with full inspection information
 * GET /api/raw-material-batches/:id
 */
exports.getBatchById = async (req, res) => {
  try {
    const { id } = req.params;

    const batch = await RawMaterialBatch.findByPk(id, {
      include: [{ model: RawMaterial, as: 'material' }],
    });

    if (!batch) {
      return errorResponse(res, 'Batch not found', 404);
    }

    return successResponse(res, batch, 'Batch retrieved successfully');
  } catch (error) {
    console.error('Error retrieving batch:', error);
    return errorResponse(res, error.message || 'Failed to retrieve batch', 500);
  }
};

/**
 * Get all batches for a material with inspection status
 * GET /api/raw-material-batches/material/:materialId
 */
exports.getBatchesByMaterial = async (req, res) => {
  try {
    const { materialId } = req.params;
    const { inspection_status = '', batch_type = '' } = req.query;

    const where = { material_id: materialId };

    if (inspection_status) {
      where.inspection_status = inspection_status;
    }

    if (batch_type) {
      where.batch_type = batch_type;
    }

    const batches = await RawMaterialBatch.findAll({
      where,
      include: [{ model: RawMaterial, as: 'material' }],
      order: [['created_at', 'DESC']],
    });

    return successResponse(res, batches, 'Batches retrieved successfully');
  } catch (error) {
    console.error('Error retrieving batches:', error);
    return errorResponse(res, error.message || 'Failed to retrieve batches', 500);
  }
};

/**
 * Get pending inspection batches (QC queue)
 * GET /api/raw-material-batches/inspection/pending
 */
exports.getPendingInspectionBatches = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;

    const { count, rows } = await RawMaterialBatch.findAndCountAll({
      where: {
        batch_type: 'receipt',
        inspection_status: 'pending',
      },
      include: [{ model: RawMaterial, as: 'material' }],
      order: [['created_at', 'ASC']],
      limit: parseInt(limit),
      offset: parseInt(offset),
    });

    return successResponse(
      res,
      {
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
        batches: rows,
      },
      'Pending inspection batches retrieved successfully'
    );
  } catch (error) {
    console.error('Error retrieving pending inspection batches:', error);
    return errorResponse(res, error.message || 'Failed to retrieve pending batches', 500);
  }
};

/**
 * Reject batch during inspection
 * POST /api/raw-material-batches/:id/reject-inspection
 */
exports.rejectInspection = async (req, res) => {
  try {
    const { id } = req.params;
    const { inspection_notes, rejection_reason } = req.body;

    const batch = await RawMaterialBatch.findByPk(id);

    if (!batch) {
      return errorResponse(res, 'Batch not found', 404);
    }

    if (batch.inspection_status !== 'pending') {
      return errorResponse(res, 'Batch is not pending inspection', 400);
    }

    // Use approveInspection with rejected status and all quantity as rejected
    const { approveInspection } = require('./batchController');

    // Call the approval method directly with rejection parameters
    return approveInspection.__proto__.call(
      this,
      {
        params: { id },
        body: {
          inspection_status: 'rejected',
          accepted_quantity: 0,
          rejected_quantity: parseFloat(batch.quantity),
          inspection_notes:
            inspection_notes || rejection_reason || 'Batch rejected during QC inspection',
        },
        user: req.user,
      },
      res
    );
  } catch (error) {
    console.error('Error rejecting batch inspection:', error);
    return errorResponse(res, error.message || 'Failed to reject batch', 500);
  }
};
