const express = require('express');
const router = express.Router();
const Log = require('../models/Log');
const { authMiddleware, authorize } = require('../middleware/auth');

// Get all logs (Super Admin only)
router.get('/', authMiddleware, authorize('super_admin'), async (req, res) => {
  try {
    const logs = await Log.find()
      .populate('userId', 'name email role')
      .sort({ createdAt: -1 })
      .limit(200);
    res.json(logs);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Create a log entry (Internal utility)
const createLog = async (userId, action, targetId, targetName, details, req) => {
  try {
    const log = new Log({
      userId,
      userName: req.user?.name || 'System',
      action,
      targetId,
      targetName,
      details,
      ipAddress: req.ip || req.connection.remoteAddress
    });
    await log.save();
  } catch (error) {
    console.error('Logging error:', error);
  }
};

module.exports = { router, createLog };
