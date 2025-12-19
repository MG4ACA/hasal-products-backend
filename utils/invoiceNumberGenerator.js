/**
 * Invoice Number Generator
 * Generates unique invoice numbers in format: INV-YYYYMMDD-XXX
 * Example: INV-20251220-001
 */

const { SalesInvoice } = require('../models');
const { Op } = require('sequelize');

/**
 * Generate the next invoice number for the given date
 * @param {Date} invoiceDate - The date of the invoice
 * @returns {Promise<string>} - The generated invoice number
 */
async function generateInvoiceNumber(invoiceDate = new Date()) {
  // Format date as YYYYMMDD
  const year = invoiceDate.getFullYear();
  const month = String(invoiceDate.getMonth() + 1).padStart(2, '0');
  const day = String(invoiceDate.getDate()).padStart(2, '0');
  const dateStr = `${year}${month}${day}`;

  const prefix = `INV-${dateStr}-`;

  // Find the last invoice number for this date
  const lastInvoice = await SalesInvoice.findOne({
    where: {
      invoice_number: {
        [Op.like]: `${prefix}%`,
      },
    },
    order: [['invoice_number', 'DESC']],
  });

  if (!lastInvoice) {
    // First invoice of the day
    return `${prefix}001`;
  }

  // Extract sequence number and increment
  const lastNumber = lastInvoice.invoice_number;
  const lastSequence = parseInt(lastNumber.split('-')[2]);
  const nextSequence = lastSequence + 1;

  return `${prefix}${String(nextSequence).padStart(3, '0')}`;
}

module.exports = { generateInvoiceNumber };
