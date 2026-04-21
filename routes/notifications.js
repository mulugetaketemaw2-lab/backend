const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const Notification = require('../models/Notification');

// Get notifications for current user's department
router.get('/', authMiddleware, async (req, res) => {
  try {
    const notifications = await Notification.find({ 
      department: req.user.department 
    })
    .populate('member', 'firstName fatherName studentId')
    .sort('-createdAt')
    .limit(50);
    
    // Get unread count
    const unreadCount = await Notification.countDocuments({
      department: req.user.department,
      read: false
    });
    
    res.json({
      total: notifications.length,
      unread: unreadCount,
      notifications
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Mark notification as read
router.put('/:id/read', authMiddleware, async (req, res) => {
  try {
    const notification = await Notification.findByIdAndUpdate(
      req.params.id,
      { 
        read: true,
        readAt: new Date()
      },
      { new: true }
    );
    
    res.json(notification);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Mark all as read
router.put('/read-all', authMiddleware, async (req, res) => {
  try {
    await Notification.updateMany(
      { 
        department: req.user.department,
        read: false 
      },
      { 
        read: true,
        readAt: new Date()
      }
    );
    
    res.json({ message: 'All notifications marked as read' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get unread count
router.get('/unread-count', authMiddleware, async (req, res) => {
  try {
    const count = await Notification.countDocuments({
      department: req.user.department,
      read: false
    });
    
    res.json({ count });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;