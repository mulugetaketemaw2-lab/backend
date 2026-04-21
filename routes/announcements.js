const express = require('express');
const router = express.Router();
const Announcement = require('../models/Announcement');
const { authMiddleware, authorize } = require('../middleware/auth');

// Create a new announcement (Leadership/Executive only)
router.post('/', authMiddleware, authorize('super_admin', 'admin', 'sebsabi', 'meketel_sebsabi', 'tsehafy', 'timhirt', 'abalat_guday', 'mezmur', 'bach', 'muya', 'lmat', 'kwanqwa', 'merja', 'hisab', 'audit', 'sub_executive'), async (req, res) => {
  try {
    const { title, message, targetGroup, attachments, displayDate } = req.body;
    
    if (!title || !targetGroup) {
      return res.status(400).json({ success: false, message: 'Title and target group are required' });
    }
    
    // Check if there is either a message OR an attachment
    if (!message && (!attachments || attachments.length === 0)) {
      return res.status(400).json({ success: false, message: 'Please provide either a message or an attachment' });
    }

    const announcement = new Announcement({
      sender: req.user.id,
      senderName: req.user.name || 'Leadership', // Fallback
      senderRole: req.user.role,
      title,
      message,
      targetGroup,
      senderDepartmentAmharic: req.user.departmentAmharic,
      attachments: attachments || [],
      displayDate: displayDate || Date.now()
    });

    // If name is missing from token (older tokens), try to fetch from User model
    if (!req.user.name) {
      const User = require('../models/User');
      const user = await User.findById(req.user.id);
      if (user) announcement.senderName = user.name;
    }

    await announcement.save();
    res.status(201).json({ success: true, data: announcement });
  } catch (error) {
    console.error('Error creating announcement:', error);
    res.status(500).json({ success: false, message: 'Failed to create announcement', error: error.message });
  }
});

// Get announcements for current user
router.get('/', authMiddleware, async (req, res) => {
  try {
    const role = req.user.role;
    let query = {};

    if (role === 'member') {
      // Members only see their group's active announcements
      // Either from Office (all members) or from their specific department executive
      query = { 
        targetGroup: 'member', 
        isActive: { $ne: false },
        $or: [
          { senderRole: { $in: ['super_admin', 'admin', 'sebsabi', 'meketel_sebsabi', 'tsehafy'] } },
          { senderDepartmentAmharic: req.user.departmentAmharic }
        ]
      };
    } else if (['super_admin', 'admin', 'sebsabi', 'meketel_sebsabi', 'tsehafy'].includes(role)) {
      // Leadership/Admins see EVERYTHING (active, inactive, member, and executive)
      query = {};
      // Executives/Dept Heads see their own department's member news, plus executive news
      query = { 
        $or: [
          { sender: req.user.id },
          {
            isActive: { $ne: false },
            $or: [
              { targetGroup: 'executive' },
              { 
                targetGroup: 'member',
                $or: [
                  { senderRole: { $in: ['super_admin', 'admin', 'sebsabi', 'meketel_sebsabi', 'tsehafy'] } },
                  { senderDepartmentAmharic: req.user.departmentAmharic }
                ]
              }
            ]
          }
        ]
      };
    }

    const announcements = await Announcement.find(query)
      .sort({ displayDate: -1, createdAt: -1 })
      .limit(20);

    res.json({ success: true, data: announcements });
  } catch (error) {
    console.error('Error fetching announcements:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch announcements' });
  }
});

// Mark as read
router.put('/:id/read', authMiddleware, async (req, res) => {
  try {
    await Announcement.findByIdAndUpdate(req.params.id, {
      $addToSet: { readBy: req.user.id }
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to mark as read' });
  }
});

// Delete an announcement (Sender, Leadership or Admin only)
router.delete('/:id', authMiddleware, authorize('sebsabi', 'meketel_sebsabi', 'tsehafy', 'admin', 'super_admin', 'timhirt', 'abalat_guday', 'mezmur', 'bach', 'muya', 'lmat', 'kwanqwa', 'merja', 'hisab', 'audit', 'sub_executive'), async (req, res) => {
  try {
    const announcement = await Announcement.findById(req.params.id);
    if (!announcement) return res.status(404).json({ success: false, message: 'Announcement not found' });
    
    // Check if the user is the sender OR an admin/sebsabi
    const isOffice = ['super_admin', 'admin', 'sebsabi', 'meketel_sebsabi', 'tsehafy'].includes(req.user.role);
    if (!isOffice && announcement.sender.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Not authorized to delete this announcement' });
    }
    
    await Announcement.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Announcement deleted successfully' });
  } catch (error) {
    console.error('Error deleting announcement:', error);
    res.status(500).json({ success: false, message: 'Failed to delete announcement' });
  }
});

// Toggle active status (Sender, Leadership or Admin only)
router.patch('/:id/toggle-status', authMiddleware, authorize('sebsabi', 'meketel_sebsabi', 'tsehafy', 'admin', 'super_admin', 'timhirt', 'abalat_guday', 'mezmur', 'bach', 'muya', 'lmat', 'kwanqwa', 'merja', 'hisab', 'audit', 'sub_executive'), async (req, res) => {
  try {
    const announcement = await Announcement.findById(req.params.id);
    if (!announcement) return res.status(404).json({ success: false, message: 'Announcement not found' });
    
    const isOffice = ['super_admin', 'admin', 'sebsabi', 'meketel_sebsabi', 'tsehafy'].includes(req.user.role);
    if (!isOffice && announcement.sender.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Not authorized to modify this announcement' });
    }

    announcement.isActive = !announcement.isActive;
    await announcement.save();
    
    res.json({ success: true, isActive: announcement.isActive, message: `Announcement ${announcement.isActive ? 'activated' : 'deactivated'}` });
  } catch (error) {
    console.error('Error toggling status:', error);
    res.status(500).json({ success: false, message: 'Failed to toggle status' });
  }
});

module.exports = router;
