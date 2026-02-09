const fs = require('fs');
const path = require('path');
const Sequelize = require('sequelize');
const config = require('../config/database');

const sequelize = new Sequelize(
  config[process.env.NODE_ENV || 'development'].database,
  config[process.env.NODE_ENV || 'development'].username,
  config[process.env.NODE_ENV || 'development'].password,
  config[process.env.NODE_ENV || 'development']
);

const db = {};

// Import all models
const files = fs.readdirSync(__dirname).filter(file => {
  return file.endsWith('.js') && file !== 'index.js';
});

files.forEach(file => {
  const model = require(path.join(__dirname, file))(sequelize, Sequelize.DataTypes);
  db[model.name] = model;
});

// Define associations
Object.keys(db).forEach(modelName => {
  if (db[modelName].associate) {
    db[modelName].associate(db);
  }
});

// Manual associations setup
db.sequelize = sequelize;
db.Sequelize = Sequelize;

// User associations
db.User.hasMany(db.PurchaseOrder, { foreignKey: 'created_by', as: 'purchaseOrders' });
db.User.hasMany(db.SalesInvoice, { foreignKey: 'created_by', as: 'salesInvoices' });
db.User.hasMany(db.Payment, { foreignKey: 'created_by', as: 'payments' });
db.User.hasMany(db.SupplierPayment, { foreignKey: 'created_by', as: 'supplierPayments' });
db.User.hasMany(db.StockAdjustment, { foreignKey: 'created_by', as: 'stockAdjustments' });
db.User.hasMany(db.ProductionRun, { foreignKey: 'produced_by', as: 'productionRuns' });

// Supplier associations
db.Supplier.hasMany(db.RawMaterialBatch, { foreignKey: 'supplier_id', as: 'batches' });
db.Supplier.hasMany(db.PurchaseOrder, { foreignKey: 'supplier_id', as: 'purchaseOrders' });
db.Supplier.hasMany(db.SupplierPayment, { foreignKey: 'supplier_id', as: 'payments' });

// RawMaterial associations
db.RawMaterial.hasMany(db.RawMaterialBatch, { foreignKey: 'material_id', as: 'batches' });
db.RawMaterial.hasMany(db.RecipeItem, { foreignKey: 'material_id', as: 'recipeItems' });
db.RawMaterial.hasMany(db.PoItem, { foreignKey: 'material_id', as: 'poItems' });

// RawMaterialBatch associations
db.RawMaterialBatch.belongsTo(db.RawMaterial, { foreignKey: 'material_id', as: 'material' });
db.RawMaterialBatch.belongsTo(db.Supplier, { foreignKey: 'supplier_id', as: 'supplier' });
db.RawMaterialBatch.belongsTo(db.RawMaterialBatch, {
  foreignKey: 'source_batch_id',
  as: 'sourceBatch',
});
db.RawMaterialBatch.hasMany(db.RawMaterialBatch, {
  foreignKey: 'source_batch_id',
  as: 'returnBatches',
});
db.RawMaterialBatch.hasMany(db.ProductionMaterial, {
  foreignKey: 'batch_id',
  as: 'productionMaterials',
});

// Employee associations
db.Employee.hasMany(db.Route, { foreignKey: 'sales_ref_id', as: 'assignedRoutes' });
db.Employee.hasMany(db.SalesInvoice, { foreignKey: 'sales_ref_id', as: 'salesInvoices' });

// Route associations
db.Route.belongsTo(db.Employee, { foreignKey: 'sales_ref_id', as: 'salesRep' });
db.Route.hasMany(db.Outlet, { foreignKey: 'route_id', as: 'outlets' });
db.Route.hasMany(db.RouteVehicleHistory, { foreignKey: 'route_id', as: 'vehicleHistory' });
db.Route.hasMany(db.SalesInvoice, { foreignKey: 'route_id', as: 'salesInvoices' });

// Outlet associations
db.Outlet.belongsTo(db.Route, { foreignKey: 'route_id', as: 'route' });
db.Outlet.hasMany(db.SalesInvoice, { foreignKey: 'outlet_id', as: 'invoices' });
db.Outlet.hasMany(db.Payment, { foreignKey: 'outlet_id', as: 'payments' });

// Vehicle associations
db.Vehicle.hasMany(db.RouteVehicleHistory, { foreignKey: 'vehicle_id', as: 'routeHistory' });

// RouteVehicleHistory associations
db.RouteVehicleHistory.belongsTo(db.Route, { foreignKey: 'route_id', as: 'route' });
db.RouteVehicleHistory.belongsTo(db.Vehicle, { foreignKey: 'vehicle_id', as: 'vehicle' });

// Recipe associations
db.Recipe.hasMany(db.RecipeItem, { foreignKey: 'recipe_id', as: 'items' });
db.Recipe.hasMany(db.ProductionRun, { foreignKey: 'recipe_id', as: 'productionRuns' });
db.Recipe.belongsTo(db.Product, { foreignKey: 'product_id', as: 'product' });
db.Recipe.belongsTo(db.ProductSku, { foreignKey: 'product_sku_id', as: 'productSku' });

// RecipeItem associations
db.RecipeItem.belongsTo(db.Recipe, { foreignKey: 'recipe_id', as: 'recipe' });
db.RecipeItem.belongsTo(db.RawMaterial, { foreignKey: 'material_id', as: 'material' });

// Product associations
db.Product.hasMany(db.ProductSku, { foreignKey: 'product_id', as: 'skus' });
db.Product.hasMany(db.Recipe, { foreignKey: 'product_id', as: 'recipes' });

// ProductSku associations
db.ProductSku.belongsTo(db.Product, { foreignKey: 'product_id', as: 'product' });
db.ProductSku.hasMany(db.InvoiceItem, { foreignKey: 'sku_id', as: 'invoiceItems' });
db.ProductSku.hasMany(db.ProductionOutput, { foreignKey: 'sku_id', as: 'productionOutputs' });
db.ProductSku.hasMany(db.Recipe, { foreignKey: 'product_sku_id', as: 'recipes' });

// ProductionRun associations
db.ProductionRun.belongsTo(db.Recipe, { foreignKey: 'recipe_id', as: 'recipe' });
db.ProductionRun.belongsTo(db.User, { foreignKey: 'produced_by', as: 'producedBy' });
db.ProductionRun.hasMany(db.ProductionMaterial, {
  foreignKey: 'production_run_id',
  as: 'materials',
});
db.ProductionRun.hasMany(db.ProductionOutput, { foreignKey: 'production_run_id', as: 'outputs' });

// ProductionMaterial associations
db.ProductionMaterial.belongsTo(db.ProductionRun, {
  foreignKey: 'production_run_id',
  as: 'productionRun',
});
db.ProductionMaterial.belongsTo(db.RawMaterialBatch, { foreignKey: 'batch_id', as: 'batch' });

// ProductionOutput associations
db.ProductionOutput.belongsTo(db.ProductionRun, {
  foreignKey: 'production_run_id',
  as: 'productionRun',
});
db.ProductionOutput.belongsTo(db.ProductSku, { foreignKey: 'sku_id', as: 'sku' });

// PurchaseOrder associations
db.PurchaseOrder.belongsTo(db.Supplier, { foreignKey: 'supplier_id', as: 'supplier' });
db.PurchaseOrder.belongsTo(db.User, { foreignKey: 'created_by', as: 'createdBy' });
db.PurchaseOrder.hasMany(db.PoItem, { foreignKey: 'po_id', as: 'items' });

// PoItem associations
db.PoItem.belongsTo(db.PurchaseOrder, { foreignKey: 'po_id', as: 'purchaseOrder' });
db.PoItem.belongsTo(db.RawMaterial, { foreignKey: 'material_id', as: 'material' });

// SalesInvoice associations
db.SalesInvoice.belongsTo(db.Outlet, { foreignKey: 'outlet_id', as: 'outlet' });
db.SalesInvoice.belongsTo(db.Employee, { foreignKey: 'sales_ref_id', as: 'salesRef' });
db.SalesInvoice.belongsTo(db.Route, { foreignKey: 'route_id', as: 'route' });
db.SalesInvoice.belongsTo(db.User, { foreignKey: 'created_by', as: 'createdBy' });
db.SalesInvoice.hasMany(db.InvoiceItem, { foreignKey: 'invoice_id', as: 'items' });

// InvoiceItem associations
db.InvoiceItem.belongsTo(db.SalesInvoice, { foreignKey: 'invoice_id', as: 'invoice' });
db.InvoiceItem.belongsTo(db.ProductSku, { foreignKey: 'sku_id', as: 'sku' });

// Payment associations
db.Payment.belongsTo(db.Outlet, { foreignKey: 'outlet_id', as: 'outlet' });
db.Payment.belongsTo(db.User, { foreignKey: 'created_by', as: 'createdBy' });
db.Payment.hasMany(db.PaymentAllocation, { foreignKey: 'payment_id', as: 'allocations' });

// PaymentAllocation associations
db.PaymentAllocation.belongsTo(db.Payment, { foreignKey: 'payment_id', as: 'payment' });
db.PaymentAllocation.belongsTo(db.SalesInvoice, { foreignKey: 'invoice_id', as: 'invoice' });

// SalesInvoice payment allocations
db.SalesInvoice.hasMany(db.PaymentAllocation, { foreignKey: 'invoice_id', as: 'allocations' });

// SupplierPayment associations
db.SupplierPayment.belongsTo(db.Supplier, { foreignKey: 'supplier_id', as: 'supplier' });
db.SupplierPayment.belongsTo(db.User, { foreignKey: 'created_by', as: 'createdBy' });

// StockAdjustment associations
db.StockAdjustment.belongsTo(db.User, { foreignKey: 'created_by', as: 'createdBy' });

// WastageRecord associations
db.WastageRecord.belongsTo(db.User, { foreignKey: 'recorded_by', as: 'recordedBy' });
db.User.hasMany(db.WastageRecord, { foreignKey: 'recorded_by', as: 'wastageRecords' });

module.exports = db;
