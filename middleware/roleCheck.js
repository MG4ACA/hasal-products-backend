/**
 * Role-based authorization middleware
 * Usage: app.post('/api/admin-only', roleCheck('admin'), controller.method)
 * Usage: app.post('/api/admin-or-cashier', roleCheck(['admin', 'cashier']), controller.method)
 */

const roleCheck = allowedRoles => {
  return (req, res, next) => {
    try {
      // Check if user is authenticated (authMiddleware should run first)
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required',
        });
      }

      // Convert single role to array
      const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];

      // Check if user's role is in allowed roles
      if (!roles.includes(req.user.role)) {
        return res.status(403).json({
          success: false,
          message: 'Insufficient permissions. Required role(s): ' + roles.join(', '),
        });
      }

      next();
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: 'Authorization check failed',
        error: error.message,
      });
    }
  };
};

module.exports = roleCheck;
