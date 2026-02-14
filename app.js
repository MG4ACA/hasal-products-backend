const express = require('express');
const cors = require('cors');
const { errorHandler, notFound } = require('./middleware/errorHandler');
const db = require('./models');

const app = express();

// Initialize database - just authenticate connection
const initializeDatabase = async () => {
  try {
    console.log('Authenticating database connection...');
    await db.sequelize.authenticate();
    console.log('✓ Database connection authenticated');
  } catch (error) {
    console.error('Database connection error:', error);
    throw error;
  }
};

app.initializeDatabase = initializeDatabase;

// CORS Configuration
const corsOptions = {
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  credentials: true,
  optionsSuccessStatus: 200,
};

// Middleware
app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging middleware (development only)
if (process.env.NODE_ENV === 'development') {
  app.use((req, res, next) => {
    console.log(`${req.method} ${req.path}`);
    next();
  });
}

// Health check route
app.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Server is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
  });
});

// API Routes
app.get('/api', (req, res) => {
  res.json({
    success: true,
    message: 'Hasal Products POS API',
    version: '1.0.0',
  });
});

// Authentication Routes
const authRoutes = require('./routes/authRoutes');
app.use('/api/auth', authRoutes);

// Supplier Routes
const supplierRoutes = require('./routes/supplierRoutes');
app.use('/api/suppliers', supplierRoutes);

// Raw Material Routes
const rawMaterialRoutes = require('./routes/rawMaterialRoutes');
app.use('/api/raw-materials', rawMaterialRoutes);

// Purchase Order Routes
const purchaseOrderRoutes = require('./routes/purchaseOrderRoutes');
app.use('/api/purchase-orders', purchaseOrderRoutes);

// Batch Routes (QC Inspection)
const batchRoutes = require('./routes/batchRoutes');
app.use('/api/raw-material-batches', batchRoutes);

// Batch Traceability Routes (Phase 2)
const traceabilityRoutes = require('./routes/traceabilityRoutes');
app.use('/api/batches', traceabilityRoutes);

// Product Routes
const productRoutes = require('./routes/productRoutes');
app.use('/api/products', productRoutes);

// Recipe Routes
const recipeRoutes = require('./routes/recipeRoutes');
app.use('/api/recipes', recipeRoutes);

// Production Routes
const productionRoutes = require('./routes/productionRoutes');
app.use('/api/production-runs', productionRoutes);

// Route Routes
const routeRoutes = require('./routes/routeRoutes');
app.use('/api/routes', routeRoutes);

// Outlet Routes
const outletRoutes = require('./routes/outletRoutes');
app.use('/api/outlets', outletRoutes);

// Employee Routes
const employeeRoutes = require('./routes/employeeRoutes');
app.use('/api/employees', employeeRoutes);

// Vehicle Routes
const vehicleRoutes = require('./routes/vehicleRoutes');
app.use('/api/vehicles', vehicleRoutes);

// Sales Invoice Routes
const salesRoutes = require('./routes/salesRoutes');
app.use('/api/sales-invoices', salesRoutes);

// Payment Routes
const paymentRoutes = require('./routes/paymentRoutes');
app.use('/api/payments', paymentRoutes);

// Expense Routes
const expenseRoutes = require('./routes/expenseRoutes');
app.use('/api/expenses', expenseRoutes);

// Dashboard Routes
const dashboardRoutes = require('./routes/dashboardRoutes');
app.use('/api/dashboard', dashboardRoutes);

// Reports Routes
const reportsRoutes = require('./routes/reportsRoutes');
app.use('/api/reports', reportsRoutes);

// Wastage Routes
const wastageRoutes = require('./routes/wastageRoutes');
app.use('/api/wastage', wastageRoutes);

// 404 handler (must be after all routes)
app.use(notFound);

// Error handler (must be last)
app.use(errorHandler);

module.exports = app;
