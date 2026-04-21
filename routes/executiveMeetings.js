const express = require('express');
const router = express.Router();
const Meeting = require('../models/Meeting');
const AttendanceRecord = require('../models/AttendanceRecord');
const User = require('../models/User');
const { authMiddleware, authorize } = require('../middleware/auth');
const { createLog } = require('./logs');
const { getCurrentECYear } = require('../utils/dateHelpers');

// Helper to get Ethiopian Calendar year from a Date
const getECYear = (dateInput) => {
  if (!dateInput) return getCurrentECYear();
  const d = new Date(dateInput);
  const isBeforeNewYear = d.getMonth() < 8 || (d.getMonth() === 8 && d.getDate() < 11);
  return (d.getFullYear() - (isBeforeNewYear ? 8 : 7)).toString();
};

// Roles authorized to manage executive meetings
const boardRoles = ['super_admin', 'admin', 'sebsabi', 'meketel_sebsabi', 'tsehafy'];
const deptHeadRoles = ['timhirt', 'abalat_guday', 'mezmur', 'bach', 'muya', 'lmat', 'kwanqwa', 'merja', 'hisab', 'audit'];
const executiveAuthorized = [...boardRoles, ...deptHeadRoles];

// ==================== MEETINGS ====================

// List all meetings (Filtered by type if provided)
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { type, term, date } = req.query;
    const query = {};
    if (type) query.type = type;
    if (date) {
      const d = new Date(date);
      // Set to start and end of day to find meetings on that date
      const startOfDay = new Date(d.setHours(0,0,0,0));
      const endOfDay = new Date(d.setHours(23,59,59,999));
      query.date = { $gte: startOfDay, $lte: endOfDay };
    }
    
    // If it's a department head (not a top admin/secretary), filter by their department
    if (deptHeadRoles.includes(req.user.role) && !boardRoles.includes(req.user.role)) {
      query.department = req.user.department;
    }
    
    // Most users can only see meetings they are relevant to
    // For now, let's allow all staff to see meetings, but only executives to manage
    const meetings = await Meeting.find(query)
      .populate('createdBy', 'name role')
      .sort({ date: -1, time: -1 });

    // Enhancing the list with attendance statistics
    const meetingsWithStats = await Promise.all(meetings.map(async (m) => {
      const presentCount = await AttendanceRecord.countDocuments({ meetingId: m._id, status: 'Present' });
      const absentCount = await AttendanceRecord.countDocuments({ meetingId: m._id, status: 'Absent' });
      return { 
        ...m.toObject(), 
        presentCount, 
        absentCount 
      };
    }));
      
    res.json(meetingsWithStats);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Create a new meeting
router.post('/', authMiddleware, authorize(...executiveAuthorized), async (req, res) => {
  try {
    const { title, agenda, date, time, location, type, department } = req.body;
    
    if (!title || !agenda || !date || !time) {
      return res.status(400).json({ message: 'Missing required meeting fields' });
    }

    let meetingType = type || 'executive';
    let meetingDept = department;

    // Auto-assign department and type for department heads
    if (deptHeadRoles.includes(req.user.role) && !boardRoles.includes(req.user.role)) {
      meetingType = 'department';
      meetingDept = req.user.department;
    }

    const meeting = new Meeting({
      title,
      agenda,
      date,
      time,
      location,
      type: meetingType,
      department: meetingDept,
      createdBy: req.user.id
    });

    await meeting.save();
    
    await createLog(req.user.id, 'CREATE_MEETING', meeting._id, title, `Scheduled ${type} meeting`, req);
    
    res.status(201).json(meeting);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get meeting details with attendance
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const meeting = await Meeting.findById(req.params.id).populate('createdBy', 'name role');
    if (!meeting) return res.status(404).json({ message: 'Meeting not found' });

    const attendanceRecords = await AttendanceRecord.find({ meetingId: req.params.id })
      .populate('userId', 'name role email department');

    res.json({ meeting, attendance: attendanceRecords });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Update meeting
router.put('/:id', authMiddleware, authorize(...executiveAuthorized), async (req, res) => {
  try {
    const meeting = await Meeting.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!meeting) return res.status(404).json({ message: 'Meeting not found' });
    
    await createLog(req.user.id, 'UPDATE_MEETING', meeting._id, meeting.title, 'Updated meeting details', req);
    
    res.json(meeting);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Delete meeting
router.delete('/:id', authMiddleware, authorize(...executiveAuthorized), async (req, res) => {
  try {
    const meeting = await Meeting.findByIdAndDelete(req.params.id);
    if (!meeting) return res.status(404).json({ message: 'Meeting not found' });
    
    // Also cleanup attendance records
    await AttendanceRecord.deleteMany({ meetingId: req.params.id });

    await createLog(req.user.id, 'DELETE_MEETING', meeting._id, meeting.title, 'Deleted meeting and associated attendance', req);
    
    res.json({ message: 'Meeting deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ==================== ATTENDANCE ====================

// Mark attendance for a meeting (bulk)
router.post('/:id/attendance', authMiddleware, authorize(...executiveAuthorized), async (req, res) => {
  try {
    const meetingId = req.params.id;
    const { attendees, term } = req.body; // attendees is array of { userId, status, notes }

    if (!attendees || !Array.isArray(attendees)) {
      return res.status(400).json({ message: 'Invalid attendees data' });
    }

    const meeting = await Meeting.findById(meetingId);
    if (!meeting) return res.status(404).json({ message: 'Meeting not found' });

    const records = [];
    for (const attendee of attendees) {
      const record = await AttendanceRecord.findOneAndUpdate(
        { meetingId, userId: attendee.userId },
        { 
          status: attendee.status, 
          notes: attendee.notes,
          term: term || getECYear(meeting.date)
        },
        { upsert: true, new: true }
      );
      records.push(record);
    }

    await createLog(req.user.id, 'MARK_ATTENDANCE', meeting._id, meeting.title, `Recorded attendance for ${attendees.length} members`, req);

    res.json({ message: 'Attendance recorded successfully', count: records.length });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get absence stats for all users in executive meetings
router.get('/stats/absences', authMiddleware, async (req, res) => {
  try {
    const { term } = req.query;
    const query = { status: 'Absent' };
    if (term) query.term = term;

    // Aggregate to count absences per user
    const stats = await AttendanceRecord.aggregate([
      { $match: query },
      { $group: { _id: '$userId', count: { $sum: 1 } } }
    ]);

    // Convert array to object mapping { userId: count }
    const statsMap = {};
    stats.forEach(s => {
      statsMap[s._id] = s.count;
    });

    res.json(statsMap);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// New feature: Get all executive users for attendance list
router.get('/lists/executives', authMiddleware, authorize(...executiveAuthorized), async (req, res) => {
  try {
    // Return all users who are not regular members (staff/executives)
    const executives = await User.find({ 
      role: { $ne: 'member' },
      isActive: true 
    }).select('name role department departmentAmharic');
    
    res.json(executives);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
