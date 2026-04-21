const express = require('express');
const router = express.Router();
const MemberMessage = require('../models/MemberMessage');
const Settings = require('../models/Settings');
const User = require('../models/User');
const { authMiddleware, authorize } = require('../middleware/auth');

// Get messaging status for the current user (Global + Dept)
router.get('/status', authMiddleware, async (req, res) => {
  try {
    const settings = await Settings.findOne();
    const allowMemberMessaging = settings ? settings.allowMemberMessaging : false;
    const allowExecutiveMessaging = settings ? settings.allowExecutiveMessaging : false;
    
    let allowDeptMessaging = false;
    if (req.user.role === 'member') {
      const deptToggle = await User.findOne({ 
        department: req.user.department, 
        allowDepartmentMessaging: true,
        isActive: true
      });
      allowDeptMessaging = !!deptToggle;
    } else {
      // For Executives/Admins, return their own current toggle status
      const currentUser = await User.findById(req.user.id);
      allowDeptMessaging = currentUser ? currentUser.allowDepartmentMessaging : false;
    }

    res.json({ success: true, allowMemberMessaging, allowExecutiveMessaging, allowDeptMessaging });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Status error' });
  }
});

// Toggle global office messaging (Office only)
router.patch('/toggle-office-messaging', authMiddleware, authorize('super_admin', 'admin', 'sebsabi', 'meketel_sebsabi', 'tsehafy'), async (req, res) => {
  try {
    const { target } = req.body; // 'member' or 'executive'
    if (!['member', 'executive'].includes(target)) return res.status(400).json({ success: false, message: 'Invalid target' });

    let settings = await Settings.findOne();
    if (!settings) settings = new Settings();

    if (target === 'member') {
      settings.allowMemberMessaging = !settings.allowMemberMessaging;
    } else {
      settings.allowExecutiveMessaging = !settings.allowExecutiveMessaging;
    }

    await settings.save();
    res.json({ 
      success: true, 
      allowMemberMessaging: settings.allowMemberMessaging, 
      allowExecutiveMessaging: settings.allowExecutiveMessaging,
      message: `የ${target === 'member' ? 'አባላት' : 'ስራ አስፈጻሚዎች'} መላኪያ ${target === 'member' ? (settings.allowMemberMessaging ? 'ተከፍቷል' : 'ተዘግቷል') : (settings.allowExecutiveMessaging ? 'ተከፍቷል' : 'ተዘግቷል')}`
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Toggle error' });
  }
});

// Toggle department messaging (Executive only)
router.patch('/toggle-dept', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    
    user.allowDepartmentMessaging = !user.allowDepartmentMessaging;
    await user.save();
    
    res.json({ 
      success: true, 
      allowDeptMessaging: user.allowDepartmentMessaging,
      message: `የክፍሉ መላኪያ ${user.allowDepartmentMessaging ? 'ተከፍቷል (Opened)' : 'ተዘግቷል (Closed)'}`
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Toggle error' });
  }
});

// Send a message (Member only)
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { recipientType, targetDepartment, recipientUser, title, content, attachments } = req.body;
    
    const isMember = req.user.role === 'member';
    const isOffice = ['super_admin', 'admin', 'sebsabi', 'meketel_sebsabi', 'tsehafy'].includes(req.user.role);
    const settings = await Settings.findOne();
    
    if (recipientType === 'leadership') {
      if (isMember) {
        if (!settings || !settings.allowMemberMessaging) {
          return res.status(403).json({ success: false, message: 'ለጽህፈት ቤቱ መልዕክት መላኪያ ለጊዜው ተዘግቷል። (Member-to-Office messaging is closed)' });
        }
      } else if (!isOffice) {
        // Executive sending to office — check allowExecutiveMessaging toggle
        if (settings && settings.allowExecutiveMessaging === false) {
          return res.status(403).json({ success: false, message: 'ለጽህፈት ቤቱ መልዕክት መላኪያ ለጊዜው ተዘግቷል። (Executive-to-Office messaging is closed)' });
        }
      }
    } else if (recipientType === 'department') {
      if (req.user.role === 'member') {
        const deptToggle = await User.findOne({ 
          department: targetDepartment, 
          allowDepartmentMessaging: true,
          isActive: true
        });
        if (!deptToggle) {
          return res.status(403).json({ success: false, message: 'ለክፍል ሃላፊው መልዕክት መላኪያ ለጊዜው ተዘግቷል። (Department messaging is closed)' });
        }
      }
    }

    if (!title || !recipientType) {
      return res.status(400).json({ success: false, message: 'Title and recipient are required.' });
    }

    const message = new MemberMessage({
      sender: req.user.id,
      senderName: req.user.name || 'Student',
      senderRole: req.user.role,
      senderDepartment: req.user.department,
      recipientType,
      targetDepartment: recipientType === 'department' ? targetDepartment : undefined,
      recipientRole: req.body.recipientRole,
      title,
      content,
      attachments: attachments || []
    });

    await message.save();
    res.status(201).json({ success: true, data: message, message: 'Message sent successfully!' });
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({ success: false, message: 'Failed to send message.' });
  }
});

// Get messages (Recipients only)
router.get('/', authMiddleware, async (req, res) => {
  try {
    const role = req.user.role;
    const isOffice = ['super_admin', 'admin', 'sebsabi', 'meketel_sebsabi', 'tsehafy'].includes(role);
    
    // Universal query logic for all message roles
    const query = {
      $or: [
        // 1. Messages sent by the current user (Always visible to sender)
        { sender: req.user.id },
        // 2. Received messages (Only if active)
        { 
          isActive: { $ne: false },
          $or: [
            { recipientUser: req.user.id, recipientType: 'individual' },
            ...(isOffice ? [{ recipientType: 'leadership' }] : []),
            ...(role !== 'member' ? [{ recipientType: 'department', targetDepartment: req.user.department }] : [])
          ]
        }
      ]
    };

    const messages = await MemberMessage.find(query)
      .sort({ createdAt: -1 })
      .limit(50);

    res.json({ success: true, data: messages });
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch messages.' });
  }
});

// Mark as read
router.patch('/:id/read', authMiddleware, async (req, res) => {
  try {
    await MemberMessage.findByIdAndUpdate(req.params.id, { isRead: true });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to mark as read.' });
  }
});

// Delete message
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const message = await MemberMessage.findById(req.params.id);
    if (!message) {
      return res.status(404).json({ success: false, message: 'Message not found' });
    }
    
    // Authorization check
    const isOffice = ['super_admin', 'admin', 'sebsabi', 'meketel_sebsabi', 'tsehafy'].includes(req.user.role);
    const isRecipientExec = (req.user.role !== 'member' && message.recipientType === 'department' && message.targetDepartment === req.user.department);
    const isRecipientIndividual = (message.recipientType === 'individual' && message.recipientUser?.toString() === req.user.id);
    const isSender = message.sender?.toString() === req.user.id;

    if (!isOffice && !isRecipientExec && !isRecipientIndividual && !isSender) {
      return res.status(403).json({ success: false, message: 'Not authorized to delete this message' });
    }
    
    await MemberMessage.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Message deleted successfully' });
  } catch (error) {
    console.error('Error deleting message:', error);
    res.status(500).json({ success: false, message: 'Failed to delete message.' });
  }
});

// Toggle active status (Sender, Leadership or Admin only)
router.patch('/:id/toggle-status', authMiddleware, async (req, res) => {
  try {
    const message = await MemberMessage.findById(req.params.id);
    if (!message) return res.status(404).json({ success: false, message: 'Message not found' });
    
    const isOffice = ['super_admin', 'admin', 'sebsabi', 'meketel_sebsabi', 'tsehafy'].includes(req.user.role);
    const isRecipientExec = (req.user.role !== 'member' && message.recipientType === 'department' && message.targetDepartment === req.user.department);
    const isRecipientIndividual = (message.recipientType === 'individual' && message.recipientUser?.toString() === req.user.id);
    const isSender = message.sender?.toString() === req.user.id;

    if (!isOffice && !isRecipientExec && !isRecipientIndividual && !isSender) {
      return res.status(403).json({ success: false, message: 'Not authorized to modify this message' });
    }

    message.isActive = !message.isActive;
    await message.save();
    
    res.json({ success: true, isActive: message.isActive, message: `Message ${message.isActive ? 'unhidden' : 'hidden'}` });
  } catch (error) {
    console.error('Error toggling status:', error);
    res.status(500).json({ success: false, message: 'Failed to toggle status' });
  }
});

module.exports = router;
