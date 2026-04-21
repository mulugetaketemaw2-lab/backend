const jwt = require('jsonwebtoken');

const authMiddleware = (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ message: 'Authentication required' });
    }
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'gbi-secret-key');
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ message: 'Invalid or expired token' });
  }
};

// Role-based authorization
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required' });
    }
    
    // Super Admin has access to everything
    if (req.user.role === 'super_admin') {
      return next();
    }
    
    // Executive committee and Departmental heads
    const executiveRoles = [
      'sebsabi', 'meketel_sebsabi', 'tsehafy', 
      'timhirt', 'abalat_guday', 'mezmur', 'bach', 'muya', 'lmat', 'kwanqwa', 'merja', 'hisab', 'audit',
      'sub_executive'
    ];
    
    const hasAccess = roles.some(role => {
      if (role === 'executive') {
        return executiveRoles.includes(req.user.role);
      }
      if (role === 'admin') {
        return req.user.role === 'admin';
      }
      return req.user.role === role;
    });
    
    if (!hasAccess) {
      return res.status(403).json({ message: 'Access denied' });
    }
    
    next();
  };
};

// Check specific permission
const hasPermission = (permission) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required' });
    }
    
    // Super Admin and Admin have all permissions
    if (['super_admin', 'admin'].includes(req.user.role)) {
      return next();
    }
    
    // Executive committee has view permissions
    const executiveRoles = ['sebsabi', 'meketel_sebsabi', 'tsehafy'];
    if (executiveRoles.includes(req.user.role) && permission.startsWith('view')) {
      return next();
    }
    
    // Check user's permissions array
    if (req.user.permissions && req.user.permissions.includes(permission)) {
      return next();
    }
    
    return res.status(403).json({ message: 'You do not have permission for this action' });
  };
};

module.exports = { authMiddleware, authorize, hasPermission };
