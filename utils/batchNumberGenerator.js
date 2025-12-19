const { RawMaterialBatch } = require('../models');
const { Op } = require('sequelize');

/**
 * Generate batch number in format: RM-{MATERIAL_CODE}-{YYYYMMDD}-{XXX}
 * Example: RM-MAT001-20251219-001
 *
 * @param {string} materialCode - The raw material code (e.g., MAT001)
 * @returns {Promise<string>} - Generated batch number
 */
const generateBatchNumber = async materialCode => {
  try {
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, ''); // YYYYMMDD

    // Pattern for today's batches for this material
    const pattern = `RM-${materialCode}-${dateStr}-%`;

    // Find the latest batch number for this material today
    const latestBatch = await RawMaterialBatch.findOne({
      where: {
        batch_number: {
          [Op.like]: pattern,
        },
      },
      order: [['batch_number', 'DESC']],
    });

    let sequence = 1;
    if (latestBatch) {
      // Extract the sequence number from the last batch
      const parts = latestBatch.batch_number.split('-');
      const lastSequence = parseInt(parts[3]);
      sequence = lastSequence + 1;
    }

    // Format: RM-{MATERIAL_CODE}-{YYYYMMDD}-{XXX}
    const batchNumber = `RM-${materialCode}-${dateStr}-${String(sequence).padStart(3, '0')}`;

    return batchNumber;
  } catch (error) {
    console.error('Error generating batch number:', error);
    throw new Error('Failed to generate batch number');
  }
};

module.exports = {
  generateBatchNumber,
};
