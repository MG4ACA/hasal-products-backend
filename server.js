require('dotenv').config();
const app = require('./app');

const PORT = process.env.PORT || 5000;

// Start server
app.listen(PORT, () => {
  console.log('='.repeat(50));
  console.log(`🚀 Server running in ${process.env.NODE_ENV} mode`);
  console.log(`📡 Listening on port ${PORT}`);
  console.log(`🏥 Health check: http://localhost:${PORT}/health`);
  console.log(`🔗 API Base URL: http://localhost:${PORT}/api`);
  console.log('='.repeat(50));
});

// Handle unhandled promise rejections
process.on('unhandledRejection', err => {
  console.error('Unhandled Promise Rejection:', err);
  // Close server & exit process
  process.exit(1);
});
