const { RawMaterialBatch } = require('../models');
const { Op } = require('sequelize');

// In-memory cache for batch number sequences within transactions
const batchSequenceCache = {};

/**
 * Generate batch number in format: RM-{MATERIAL_CODE}-{YYYYMMDD}-{XXX}
 * Example: RM-MAT001-20251219-001
 *
 * @param {string} materialCode - The raw material code (e.g., MAT001)
 * @param {Object} transaction - Sequelize transaction (optional)
 * @returns {Promise<string>} - Generated batch number
 */
const generateBatchNumber = async (materialCode, transaction = null) => {
  try {
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, ''); // YYYYMMDD

    // Pattern for today's batches for this material
    const pattern = `RM-${materialCode}-${dateStr}-%`;
    const cacheKey = `${materialCode}-${dateStr}`;

    // Check if we've generated a batch number for this material today
    // If so, increment from cache instead of querying DB
    let sequence = 1;
    if (batchSequenceCache[cacheKey]) {
      sequence = batchSequenceCache[cacheKey] + 1;
    } else {
      // Find the latest batch number for this material today
      const latestBatch = await RawMaterialBatch.findOne(
        {
          where: {
            batch_number: {
              [Op.like]: pattern,
            },
          },
          order: [['batch_number', 'DESC']],
        },
        { transaction }
      );

      if (latestBatch) {
        // Extract the sequence number from the last batch
        const parts = latestBatch.batch_number.split('-');
        const lastSequence = parseInt(parts[3]);
        sequence = lastSequence + 1;
      }
    }

    // Cache the sequence number for this material-date combination
    batchSequenceCache[cacheKey] = sequence;

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
