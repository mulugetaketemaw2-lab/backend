const express = require('express');
const router = express.Router();
const Settings = require('../models/Settings');
const Member = require('../models/Member');
const { authMiddleware, authorize } = require('../middleware/auth');
const User = require('../models/User');
const Attendance = require('../models/Attendance');
const AttendanceRecord = require('../models/AttendanceRecord');
const Log = require('../models/Log');
const Meeting = require('../models/Meeting');
const Notification = require('../models/Notification');
const Subgroup = require('../models/Subgroup');
const SubstituteTeacher = require('../models/SubstituteTeacher');
const SubstituteLeader = require('../models/SubstituteLeader');
const Finance = require('../models/Finance');
const Deacon = require('../models/Deacon');
const { createLog } = require('./logs');
const { getCurrentECTerm } = require('../utils/dateHelpers');

// Public endpoint for registration settings
router.get('/public', async (req, res) => {
  try {
    const settings = await Settings.findOne();
    res.json({
      currentTerm: settings?.currentTerm || "2024/25",
      registrationNotice: settings?.registrationNotice || ""
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching public settings' });
  }
});

// Get current system settings
router.get('/', authMiddleware, async (req, res) => {
  try {
    let settings = await Settings.findOne();
    if (!settings) {
      settings = new Settings({ currentTerm: getCurrentECTerm() });
      await settings.save();
    }
    res.json(settings);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching settings' });
  }
});

// Update current term (Admin/Super Admin only)
router.post('/term', authMiddleware, authorize('super_admin', 'admin'), async (req, res) => {
  try {
    const { term } = req.body;
    if (!term) return res.status(400).json({ message: 'Term is required' });

    let settings = await Settings.findOne();
    if (!settings) {
      settings = new Settings({ currentTerm: term });
    } else {
      settings.currentTerm = term;
      settings.lastTermTransition = Date.now();
    }
    await settings.save();
    
    await createLog(req.user.id, 'UPDATE_SETTINGS', 'SYSTEM', 'Term Settings', `Updated current term to ${term}`, req);

    res.json({ success: true, message: 'Current term updated', settings });
  } catch (error) {
    res.status(500).json({ message: 'Error updating term' });
  }
});

// Yearly Transition Process
router.post('/transition', authMiddleware, authorize('super_admin', 'admin'), async (req, res) => {
  try {
    const { nextTerm } = req.body;
    if (!nextTerm) return res.status(400).json({ message: 'Next term string is required' });

    // 1. Get current settings to know the "Old Term"
    let settings = await Settings.findOne();
    if (!settings) {
      settings = new Settings({ currentTerm: 'Not Set', terms: [] });
    }
    const oldTerm = settings.currentTerm;

    // 2. Archive all Active Members
    await Member.updateMany(
      { active: true },
      { active: false }
    );

    // 3. Archive all Active Users (Executives/Sub-execs)
    await User.updateMany(
      { role: { $nin: ['super_admin', 'admin'] }, isActive: true },
      { isActive: false }
    );

    // 4. Archive Finance records
    await Finance.updateMany(
      { archived: false },
      { archived: true }
    );

    // 5. Archive Subgroups
    await Subgroup.updateMany(
      { active: true },
      { active: false }
    );

    // 6. Update Settings: Set new term and add old term to history
    settings.currentTerm = nextTerm;
    
    // Ensure terms array exists
    if (!settings.terms) settings.terms = [];
    
    if (oldTerm && oldTerm !== 'Not Set' && !settings.terms.includes(oldTerm)) {
      settings.terms.push(oldTerm);
    }
    await settings.save();

    await createLog(
      req.user.id,
      'YEARLY_TRANSITION',
      'SYSTEM',
      'Term Management',
      `System transitioned from ${oldTerm} to ${nextTerm}. Previous data archived.`,
      req
    );

    res.json({
      success: true,
      message: `✅ System successfully transitioned to ${nextTerm}. ${oldTerm} data has been archived to history.`,
      oldTerm,
      nextTerm
    });

  } catch (error) {
    console.error('Transition error:', error);
    res.status(500).json({ message: 'Error during transition: ' + error.message });
  }
});


// ==================== RESTORE ARCHIVED TERM ====================
// Admin can restore any past term back to active
router.post('/restore-term', authMiddleware, authorize('super_admin', 'admin'), async (req, res) => {
  try {
    const { termToRestore, restoreMembers, restoreUsers, restoreSubgroups, restoreFinance, targetDepartment, setAsCurrent } = req.body;

    if (!termToRestore) return res.status(400).json({ message: 'Term to restore is required' });

    const results = {};
    const memberQuery = { term: termToRestore, active: false };
    const financeQuery = { term: termToRestore, archived: true };
    
    // Add department filter if provided
    if (targetDepartment) {
      memberQuery.serviceDepartment = targetDepartment;
      financeQuery.department = targetDepartment;
    }

    // 1. Restore Members
    if (restoreMembers !== false) {
      const result = await Member.updateMany(
        memberQuery,
        { active: true }
      );
      results.members = result.modifiedCount;
    }

    // 2. Restore Users linked to those members
    if (restoreUsers !== false) {
      const termMembers = await Member.find(memberQuery).select('userId');
      const userIds = termMembers.map(m => m.userId).filter(Boolean);
      if (userIds.length > 0) {
        const result = await User.updateMany(
          { _id: { $in: userIds }, isActive: false },
          { isActive: true }
        );
        results.users = result.modifiedCount;
      }
    }

    // 3. Restore Finance records
    if (restoreFinance !== false) {
      const result = await Finance.updateMany(
        financeQuery,
        { archived: false }
      );
      results.finance = result.modifiedCount;
    }

    // 4. Restore Subgroups (Only if not department specific or if logic allows)
    if (restoreSubgroups === true) {
      const subgroupQuery = { active: false };
      if (targetDepartment) subgroupQuery.department = targetDepartment;
      const result = await Subgroup.updateMany(
        subgroupQuery,
        { active: true }
      );
      results.subgroups = result.modifiedCount;
    }

    // 5. Optionally switch current term back
    if (setAsCurrent === true) {
      await Settings.findOneAndUpdate({}, { currentTerm: termToRestore });
      results.currentTermChanged = true;
    }

    await createLog(
      req.user.id,
      'RESTORE_TERM',
      'SYSTEM',
      'Term Management',
      `Restored term ${termToRestore} ${targetDepartment ? `(Dept: ${targetDepartment})` : ''} to active.`,
      req
    );

    res.json({
      success: true,
      message: `✅ ${targetDepartment || termToRestore} data restored successfully`,
      details: results
    });

  } catch (error) {
    console.error('Restore term error:', error);
    res.status(500).json({ message: 'Error restoring term: ' + error.message });
  }
});



// ==================== ARCHIVE/DEACTIVATE TERM ====================
// Admin can bulk deactivate any term/department (Reverse restore)
router.post('/archive-term', authMiddleware, authorize('super_admin', 'admin'), async (req, res) => {
  try {
    const { termToArchive, archiveMembers, archiveUsers, archiveSubgroups, archiveFinance, targetDepartment } = req.body;

    if (!termToArchive) return res.status(400).json({ message: 'Term to archive is required' });

    const results = {};
    const memberQuery = { term: termToArchive, active: true };
    const financeQuery = { term: termToArchive, archived: false };
    
    if (targetDepartment) {
      memberQuery.serviceDepartment = targetDepartment;
      financeQuery.department = targetDepartment;
    }

    // 1. Archive Members
    if (archiveMembers !== false) {
      const result = await Member.updateMany(
        memberQuery,
        { active: false }
      );
      results.members = result.modifiedCount;
    }

    // 2. Archive Users
    if (archiveUsers !== false) {
      const termMembers = await Member.find(memberQuery).select('userId');
      const userIds = termMembers.map(m => m.userId).filter(Boolean);
      if (userIds.length > 0) {
        const result = await User.updateMany(
          { _id: { $in: userIds }, isActive: true },
          { isActive: false }
        );
        results.users = result.modifiedCount;
      }
    }

    // 3. Archive Finance
    if (archiveFinance !== false) {
      const result = await Finance.updateMany(
        financeQuery,
        { archived: true }
      );
      results.finance = result.modifiedCount;
    }

    // 4. Archive Subgroups
    if (archiveSubgroups === true) {
      const subgroupQuery = { active: true };
      if (targetDepartment) subgroupQuery.department = targetDepartment;
      const result = await Subgroup.updateMany(
        subgroupQuery,
        { active: false }
      );
      results.subgroups = result.modifiedCount;
    }

    await createLog(
      req.user.id,
      'ARCHIVE_TERM',
      'SYSTEM',
      'Term Management',
      `Archived term ${termToArchive} ${targetDepartment ? `(Dept: ${targetDepartment})` : ''}.`,
      req
    );

    res.json({
      success: true,
      message: `✅ ${targetDepartment || termToArchive} data archived successfully`,
      details: results
    });

  } catch (error) {
    console.error('Archive term error:', error);
    res.status(500).json({ message: 'Error archiving term: ' + error.message });
  }
});

// Database Backup (Admin only)
router.get('/backup', authMiddleware, authorize('super_admin', 'admin'), async (req, res) => {
  try {
    const backupData = {
      settings: await Settings.find(),
      users: await User.find(),
      members: await Member.find(),
      attendance: await Attendance.find(),
      attendanceRecords: await AttendanceRecord.find(),
      logs: await Log.find(),
      meetings: await Meeting.find(),
      notifications: await Notification.find(),
      subgroups: await Subgroup.find(),
      exportDate: new Date(),
      version: '1.0'
    };

    const fileName = `gbi_backup_${new Date().toISOString().split('T')[0]}.json`;
    res.setHeader('Content-disposition', `attachment; filename=${fileName}`);
    res.setHeader('Content-type', 'application/json');
    res.write(JSON.stringify(backupData, null, 2));
    res.end();
  } catch (error) {
    console.error('Backup error:', error);
    res.status(500).json({ message: 'Error generating backup' });
  }
});

// Database Restore (Admin only)
router.post('/restore', authMiddleware, authorize('super_admin', 'admin'), async (req, res) => {
  try {
    const { data } = req.body;
    if (!data) return res.status(400).json({ message: 'Backup data is required' });

    // Simple validation
    const requiredKeys = ['users', 'members', 'settings'];
    const missingKeys = requiredKeys.filter(key => !data[key]);
    if (missingKeys.length > 0) {
      return res.status(400).json({ message: `Invalid backup format. Missing: ${missingKeys.join(', ')}` });
    }

    console.log('🔄 Starting database restore...');

    // Restore Collections
    if (data.settings) {
      await Settings.deleteMany({});
      await Settings.insertMany(data.settings);
    }
    
    if (data.users) {
      await User.deleteMany({});
      await User.insertMany(data.users);
    }
    
    if (data.members) {
      await Member.deleteMany({});
      await Member.insertMany(data.members);
    }
    
    if (data.attendance) {
      await Attendance.deleteMany({});
      await Attendance.insertMany(data.attendance);
    }
    
    if (data.attendanceRecords) {
      await AttendanceRecord.deleteMany({});
      await AttendanceRecord.insertMany(data.attendanceRecords);
    }
    
    if (data.logs) {
      await Log.deleteMany({});
      await Log.insertMany(data.logs);
    }
    
    if (data.meetings) {
      await Meeting.deleteMany({});
      await Meeting.insertMany(data.meetings);
    }
    
    if (data.notifications) {
      await Notification.deleteMany({});
      await Notification.insertMany(data.notifications);
    }
    
    if (data.subgroups) {
      await Subgroup.deleteMany({});
      await Subgroup.insertMany(data.subgroups);
    }

    await createLog(req.user.id, 'UPDATE_SETTINGS', 'SYSTEM', 'Database Restore', 'Performed a full system restore from backup', req);

    console.log('✅ Database restore completed successfully');
    res.json({ success: true, message: 'Database restored successfully' });
  } catch (error) {
    console.error('Restore error:', error);
    res.status(500).json({ message: 'Error restoring backup: ' + error.message });
  }
});

// Get all unique terms — controlled by admin Settings only
router.get('/terms', authMiddleware, async (req, res) => {
  try {
    const settings = await Settings.findOne();
    if (!settings) {
      return res.json({ success: true, terms: [] });
    }
    
    // Only return terms from the admin-controlled settings.terms array
    // (sorted descending, newest first)
    const terms = (settings.terms || [settings.currentTerm])
      .filter(Boolean)
      .sort((a, b) => b.localeCompare(a));
    
    res.json({ success: true, terms });
  } catch (error) {
    console.error('Error fetching terms:', error);
    res.status(500).json({ message: 'Error fetching terms' });
  }
});

// Update Registration Notice (Leadership/Admin)
router.patch('/registration-notice', authMiddleware, authorize('super_admin', 'admin', 'sebsabi', 'meketel_sebsabi', 'tsehafy'), async (req, res) => {
  try {
    const { notice } = req.body;
    let settings = await Settings.findOne();
    if (!settings) {
      settings = new Settings({ currentTerm: getCurrentECTerm(), registrationNotice: notice });
    } else {
      settings.registrationNotice = notice;
    }
    await settings.save();
    
    await createLog(
      req.user.id, 
      'UPDATE_SETTINGS', 
      'SYSTEM', 
      'Registration Settings', 
      notice ? `Updated registration notice (length: ${notice.length})` : 'Cleared registration notice', 
      req
    );
    
    res.json({ success: true, registrationNotice: settings.registrationNotice, message: 'Registration notice updated successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error updating registration notice' });
  }
});

router.patch('/toggle-messaging', authMiddleware, authorize('super_admin', 'admin', 'sebsabi', 'meketel_sebsabi', 'tsehafy'), async (req, res) => {
  try {
    let settings = await Settings.findOne();
    if (!settings) {
      settings = new Settings({ currentTerm: getCurrentECTerm(), allowMemberMessaging: true });
    } else {
      settings.allowMemberMessaging = !settings.allowMemberMessaging;
    }
    await settings.save();
    
    await createLog(req.user.id, 'UPDATE_SETTINGS', 'SYSTEM', 'Messaging Settings', `Toggled messaging to ${settings.allowMemberMessaging}`, req);
    
    res.json({ success: true, allowMemberMessaging: settings.allowMemberMessaging, message: `Member messaging ${settings.allowMemberMessaging ? 'enabled' : 'disabled'}` });
  } catch (error) {
    res.status(500).json({ message: 'Error toggling messaging' });
  }
});

module.exports = router;
