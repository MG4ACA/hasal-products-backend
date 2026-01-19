const {
  RawMaterialBatch,
  ProductionRun,
  ProductionOutput,
  ProductSku,
  Product,
} = require('../models');
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

    // Add milliseconds timestamp for absolute uniqueness in case of multiple calls
    const now = new Date();
    const timeStr = String(now.getMilliseconds()).padStart(3, '0');

    // Format: RM-{MATERIAL_CODE}-{YYYYMMDD}-{XXX}-{MSEC}
    const batchNumber = `RM-${materialCode}-${dateStr}-${String(sequence).padStart(3, '0')}-${timeStr}`;

    return batchNumber;
  } catch (error) {
    console.error('Error generating batch number:', error);
    throw new Error('Failed to generate batch number');
  }
};

module.exports = {
  generateBatchNumber,
  generateProductionBatchNumber,
  generateFinishedGoodsBatchNumber,
  validateBatchNumberUnique,
};

/**
 * Generate production run batch number
 * Format: PROD-YYYYMMDD-NNN
 * Example: PROD-20260120-001
 *
 * @param {Date} productionDate - The production date
 * @returns {Promise<string>} - Generated batch number
 */
async function generateProductionBatchNumber(productionDate) {
  const date = new Date(productionDate);
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, ''); // YYYYMMDD

  // Find last batch number for this date
  const lastRun = await ProductionRun.findOne({
    where: {
      production_date: date,
      batch_number: {
        [Op.like]: `PROD-${dateStr}-%`,
      },
    },
    order: [['batch_number', 'DESC']],
  });

  let sequence = 1;
  if (lastRun && lastRun.batch_number) {
    // Extract sequence from batch number like PROD-20260120-003
    const parts = lastRun.batch_number.split('-');
    if (parts.length === 3) {
      sequence = parseInt(parts[2]) + 1;
    }
  }

  return `PROD-${dateStr}-${String(sequence).padStart(3, '0')}`;
}

/**
 * Generate finished goods batch number
 * Format: FG-{PRODUCT_CODE}-YYYYMMDD-NNN
 * Example: FG-PROD001-20260120-001
 *
 * @param {number} skuId - The product SKU ID
 * @param {Date} productionDate - The production date
 * @returns {Promise<string>} - Generated batch number
 */
async function generateFinishedGoodsBatchNumber(skuId, productionDate) {
  const date = new Date(productionDate);
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, ''); // YYYYMMDD

  // Get SKU with product code
  const sku = await ProductSku.findByPk(skuId, {
    include: [
      {
        model: Product,
        as: 'product',
        attributes: ['code'],
      },
    ],
  });

  if (!sku) {
    throw new Error('SKU not found');
  }

  const productCode = sku.product.code; // e.g., PROD001

  // Find last batch number for this SKU on this date
  const lastOutput = await ProductionOutput.findOne({
    where: {
      sku_id: skuId,
      production_date: date,
      batch_number: {
        [Op.like]: `FG-${productCode}-${dateStr}-%`,
      },
    },
    order: [['batch_number', 'DESC']],
  });

  let sequence = 1;
  if (lastOutput && lastOutput.batch_number) {
    // Extract sequence from batch number like FG-PROD001-20260120-003
    const parts = lastOutput.batch_number.split('-');
    if (parts.length === 4) {
      sequence = parseInt(parts[3]) + 1;
    }
  }

  return `FG-${productCode}-${dateStr}-${String(sequence).padStart(3, '0')}`;
}

/**
 * Validate batch number uniqueness
 *
 * @param {string} batchNumber - The batch number to validate
 * @param {string} type - Type of batch ('production' or 'finished_goods')
 * @returns {Promise<boolean>} - true if unique, false if exists
 */
async function validateBatchNumberUnique(batchNumber, type = 'production') {
  if (type === 'production') {
    const existing = await ProductionRun.findOne({
      where: { batch_number: batchNumber },
    });
    return !existing;
  } else if (type === 'finished_goods') {
    const existing = await ProductionOutput.findOne({
      where: { batch_number: batchNumber },
    });
    return !existing;
  }
  return false;
}
