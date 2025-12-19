const express = require('express');
const cors = require('cors');
const { errorHandler, notFound } = require('./middleware/errorHandler');
const db = require('./models');

const app = express();

// Initialize database
const initializeDatabase = async () => {
  try {
    if (process.env.NODE_ENV === 'development') {
      console.log('Syncing database...');
      await db.sequelize.sync();
      console.log('Database synchronized successfully');
    } else {
      await db.sequelize.authenticate();
      console.log('Database connection authenticated');
    }
  } catch (error) {
    console.error('Database initialization error:', error);
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

// 404 handler (must be after all routes)
app.use(notFound);

// Error handler (must be last)
app.use(errorHandler);

module.exports = app;
