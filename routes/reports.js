const express = require('express');
const router = express.Router();
const { authMiddleware, authorize } = require('../middleware/auth');
const Member = require('../models/Member');
const Attendance = require('../models/Attendance');
const Subgroup = require('../models/Subgroup');
const User = require('../models/User');
const Meeting = require('../models/Meeting');
const Announcement = require('../models/Announcement');

// ==================== DASHBOARD STATISTICS ====================
router.get('/dashboard', authMiddleware, authorize('admin', 'executive', 'audit'), async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { term } = req.query;
    const { role, departmentAmharic } = req.user;

    // Core roles see everything, department heads see only their department
    const isDeptHead = !['super_admin', 'admin', 'sebsabi', 'meketel_sebsabi', 'tsehafy', 'audit'].includes(role);

    const filter = term ? { term } : {};
    if (isDeptHead && departmentAmharic) {
      filter.serviceDepartment = departmentAmharic;
    }

    const attendanceFilter = { ...filter };
    if (!term) delete attendanceFilter.term; // Keep only department if no term
    attendanceFilter.date = { $gte: today };

    const [
      totalMembers,
      activeMembers,
      totalSubgroups,
      todayAttendance,
      totalUsers,
      recentMembers,
      upcomingMeetings,
      attendanceRate,
      pendingApprovals
    ] = await Promise.all([
      Member.countDocuments(filter),
      Member.countDocuments({ ...filter, active: true }),
      Subgroup.countDocuments(),
      Attendance.countDocuments(attendanceFilter),
      User.countDocuments(term ? { term } : {}),
      Member.find(filter).sort('-createdAt').limit(5).select('firstName fatherName studentId createdAt'),
      Meeting.find({ ...filter, date: { $gte: today } }).sort('date').limit(5).populate('createdBy', 'name'),
      calculateAttendanceRate(thirtyDaysAgo, today, term),
      Member.countDocuments({ ...filter, isApproved: false })
    ]);

    // Get members by department
    const membersByDepartment = await Member.aggregate([
      { $unwind: { path: '$assignedDepartments', preserveNullAndEmptyArrays: true } },
      { 
        $group: { 
          _id: { $ifNull: ['$assignedDepartments', 'Unassigned'] }, 
          count: { $sum: 1 } 
        } 
      },
      { $sort: { count: -1 } }
    ]);

    // Get members by batch
    const membersByBatch = await Member.aggregate([
      { $match: filter },
      {
        $group: {
          _id: '$batch',
          count: { $sum: 1 },
          active: { $sum: { $cond: ['$active', 1, 0] } }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    // Get attendance summary for last 7 days
    const weeklyAttendance = await Attendance.aggregate([
      {
        $match: {
          date: { $gte: thirtyDaysAgo }
        }
      },
      {
        $group: {
          _id: {
            date: { $dateToString: { format: '%Y-%m-%d', date: '$date' } },
            type: '$type'
          },
          present: {
            $sum: { $cond: [{ $eq: ['$status', 'present'] }, 1, 0] }
          },
          absent: {
            $sum: { $cond: [{ $eq: ['$status', 'absent'] }, 1, 0] }
          },
          late: {
            $sum: { $cond: [{ $eq: ['$status', 'late'] }, 1, 0] }
          },
          total: { $sum: 1 }
        }
      },
      { $sort: { '_id.date': -1 } },
      { $limit: 7 }
    ]);

    res.json({
      success: true,
      data: {
        overview: {
          totalMembers,
          activeMembers,
          totalSubgroups,
          todayAttendance,
          totalUsers,
          pendingApprovals,
          attendanceRate: attendanceRate.toFixed(2) + '%'
        },
        membersByDepartment,
        membersByBatch,
        weeklyAttendance,
        recentMembers,
        upcomingMeetings,
        timestamp: new Date()
      }
    });

  } catch (error) {
    console.error('❌ Dashboard stats error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error fetching dashboard statistics',
      error: error.message 
    });
  }
});

// ==================== DEPARTMENT REPORTS ====================
// Get detailed department report
router.get('/department/:dept', authMiddleware, async (req, res) => {
  try {
    const { dept } = req.params;
    const { startDate, endDate } = req.query;

    // Set date range
    const dateFilter = {};
    if (startDate || endDate) {
      dateFilter.date = {};
      if (startDate) dateFilter.date.$gte = new Date(startDate);
      if (endDate) dateFilter.date.$lte = new Date(endDate);
    }

    // Get department members
    const members = await Member.find({ 
      assignedDepartments: dept 
    }).select('firstName fatherName studentId year active createdAt');

    // Get department attendance
    const attendance = await Attendance.aggregate([
      {
        $match: {
          department: dept,
          ...dateFilter
        }
      },
      {
        $group: {
          _id: {
            type: '$type',
            status: '$status'
          },
          count: { $sum: 1 }
        }
      }
    ]);

    // Get department subgroups
    const subgroups = await Subgroup.find({ 
      department: dept 
    }).populate('leader', 'name').select('name members');

    // Calculate attendance rate
    const totalAttendance = attendance.reduce((sum, item) => sum + item.count, 0);
    const presentCount = attendance
      .filter(item => item._id.status === 'present')
      .reduce((sum, item) => sum + item.count, 0);
    const attendanceRate = totalAttendance > 0 ? (presentCount / totalAttendance) * 100 : 0;

    res.json({
      success: true,
      data: {
        department: dept,
        statistics: {
          totalMembers: members.length,
          activeMembers: members.filter(m => m.active).length,
          totalSubgroups: subgroups.length,
          attendanceRate: attendanceRate.toFixed(2) + '%',
          recentMembers: members.filter(m => {
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
            return new Date(m.createdAt) >= thirtyDaysAgo;
          }).length
        },
        members: members.slice(0, 10), // Last 10 members
        attendance: attendance,
        subgroups: subgroups.map(s => ({
          name: s.name,
          memberCount: s.members.length,
          leader: s.leader?.name || 'Not assigned'
        }))
      }
    });

  } catch (error) {
    console.error('Department Report Error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error fetching department report',
      error: error.message 
    });
  }
});

// ==================== MEMBER STATISTICS ====================
// Get member statistics
router.get('/members/stats', authMiddleware, async (req, res) => {
  try {
    const stats = await Member.aggregate([
      {
        $facet: {
          byYear: [
            {
              $group: {
                _id: '$year',
                total: { $sum: 1 },
                active: { $sum: { $cond: ['$active', 1, 0] } }
              }
            },
            { $sort: { _id: 1 } }
          ],
          byDepartment: [
            { $unwind: '$assignedDepartments' },
            {
              $group: {
                _id: '$assignedDepartments',
                count: { $sum: 1 }
              }
            },
            { $sort: { count: -1 } }
          ],
          byRegion: [
            {
              $group: {
                _id: '$region',
                count: { $sum: 1 }
              }
            },
            { $sort: { count: -1 } },
            { $limit: 5 }
          ],
          totals: [
            {
              $group: {
                _id: null,
                total: { $sum: 1 },
                active: { $sum: { $cond: ['$active', 1, 0] } },
                withSubgroup: { 
                  $sum: { 
                    $cond: [{ $ne: ['$subgroup', null] }, 1, 0] 
                  } 
                }
              }
            }
          ]
        }
      }
    ]);

    // Get recent registrations
    const recentRegistrations = await Member.find()
      .sort('-createdAt')
      .limit(10)
      .select('firstName fatherName studentId createdAt');

    res.json({
      success: true,
      data: {
        totals: stats[0].totals[0] || { total: 0, active: 0, withSubgroup: 0 },
        byYear: stats[0].byYear,
        byDepartment: stats[0].byDepartment,
        topRegions: stats[0].byRegion,
        recentRegistrations,
        lastUpdated: new Date()
      }
    });

  } catch (error) {
    console.error('Member Stats Error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error fetching member statistics',
      error: error.message 
    });
  }
});

// ==================== ATTENDANCE REPORTS ====================
// Get comprehensive attendance report
router.get('/attendance', authMiddleware, async (req, res) => {
  try {
    const { startDate, endDate, department, type } = req.query;
    
    // Build query
    const query = {};
    
    if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        query.date.$lte = end;
      }
    }
    
    if (department && department !== 'all') {
      query.department = department;
    }
    
    if (type && type !== 'all') {
      query.type = type;
    }

    // Get attendance summary
    const summary = await Attendance.aggregate([
      { $match: query },
      {
        $facet: {
          byStatus: [
            {
              $group: {
                _id: '$status',
                count: { $sum: 1 }
              }
            }
          ],
          byType: [
            {
              $group: {
                _id: '$type',
                count: { $sum: 1 }
              }
            }
          ],
          byDepartment: [
            {
              $group: {
                _id: '$department',
                present: {
                  $sum: { $cond: [{ $eq: ['$status', 'present'] }, 1, 0] }
                },
                absent: {
                  $sum: { $cond: [{ $eq: ['$status', 'absent'] }, 1, 0] }
                },
                late: {
                  $sum: { $cond: [{ $eq: ['$status', 'late'] }, 1, 0] }
                },
                total: { $sum: 1 }
              }
            }
          ],
          daily: [
            {
              $group: {
                _id: { $dateToString: { format: '%Y-%m-%d', date: '$date' } },
                present: {
                  $sum: { $cond: [{ $eq: ['$status', 'present'] }, 1, 0] }
                },
                absent: {
                  $sum: { $cond: [{ $eq: ['$status', 'absent'] }, 1, 0] }
                },
                late: {
                  $sum: { $cond: [{ $eq: ['$status', 'late'] }, 1, 0] }
                },
                total: { $sum: 1 }
              }
            },
            { $sort: { '_id': -1 } },
            { $limit: 30 }
          ],
          topMembers: [
            {
              $group: {
                _id: '$member',
                present: {
                  $sum: { $cond: [{ $eq: ['$status', 'present'] }, 1, 0] }
                },
                total: { $sum: 1 }
              }
            },
            {
              $lookup: {
                from: 'members',
                localField: '_id',
                foreignField: '_id',
                as: 'memberInfo'
              }
            },
            { $unwind: '$memberInfo' },
            {
              $project: {
                name: { 
                  $concat: [
                    '$memberInfo.firstName', 
                    ' ', 
                    '$memberInfo.fatherName'
                  ] 
                },
                attendanceRate: { 
                  $multiply: [{ $divide: ['$present', '$total'] }, 100] 
                },
                total: 1,
                present: 1
              }
            },
            { $sort: { attendanceRate: -1 } },
            { $limit: 10 }
          ]
        }
      }
    ]);

    // Calculate overall statistics
    const totalAttendance = summary[0].byStatus.reduce((sum, item) => sum + item.count, 0);
    const presentCount = summary[0].byStatus.find(s => s._id === 'present')?.count || 0;
    const absentCount = summary[0].byStatus.find(s => s._id === 'absent')?.count || 0;
    const lateCount = summary[0].byStatus.find(s => s._id === 'late')?.count || 0;

    res.json({
      success: true,
      data: {
        dateRange: { startDate, endDate },
        totals: {
          total: totalAttendance,
          present: presentCount,
          absent: absentCount,
          late: lateCount,
          attendanceRate: totalAttendance > 0 ? ((presentCount / totalAttendance) * 100).toFixed(2) + '%' : '0%'
        },
        byStatus: summary[0].byStatus,
        byType: summary[0].byType,
        byDepartment: summary[0].byDepartment,
        daily: summary[0].daily,
        topMembers: summary[0].topMembers
      }
    });

  } catch (error) {
    console.error('Attendance Report Error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error fetching attendance report',
      error: error.message 
    });
  }
});

// ==================== SUBGROUP REPORTS ====================
// Get subgroup statistics
router.get('/subgroups', authMiddleware, async (req, res) => {
  try {
    const subgroups = await Subgroup.aggregate([
      {
        $lookup: {
          from: 'members',
          localField: 'members',
          foreignField: '_id',
          as: 'memberDetails'
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: 'leader',
          foreignField: '_id',
          as: 'leaderInfo'
        }
      },
      {
        $project: {
          name: 1,
          department: 1,
          description: 1,
          memberCount: { $size: '$members' },
          activeMembers: {
            $size: {
              $filter: {
                input: '$memberDetails',
                as: 'member',
                cond: '$$member.active'
              }
            }
          },
          leader: { $arrayElemAt: ['$leaderInfo.name', 0] },
          createdAt: 1
        }
      },
      { $sort: { memberCount: -1 } }
    ]);

    const stats = {
      total: subgroups.length,
      totalMembers: subgroups.reduce((sum, s) => sum + s.memberCount, 0),
      averageSize: subgroups.length > 0 
        ? (subgroups.reduce((sum, s) => sum + s.memberCount, 0) / subgroups.length).toFixed(1)
        : 0,
      largest: subgroups[0] || null,
      smallest: subgroups[subgroups.length - 1] || null
    };

    res.json({
      success: true,
      data: {
        statistics: stats,
        subgroups
      }
    });

  } catch (error) {
    console.error('Subgroup Report Error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error fetching subgroup statistics',
      error: error.message 
    });
  }
});

// ==================== EXPORT REPORTS ====================
// Export data as CSV
router.get('/export/:type', authMiddleware, authorize('admin', 'audit'), async (req, res) => {
  try {
    const { type } = req.params;
    const { format = 'json' } = req.query;

    let data = [];
    let filename = '';

    switch (type) {
      case 'members':
        data = await Member.find().populate('subgroup', 'name');
        filename = 'members_export';
        break;
      case 'attendance':
        data = await Attendance.find()
          .populate('member', 'firstName fatherName studentId')
          .sort('-date');
        filename = 'attendance_export';
        break;
      case 'subgroups':
        data = await Subgroup.find().populate('leader', 'name');
        filename = 'subgroups_export';
        break;
      default:
        return res.status(400).json({ message: 'Invalid export type' });
    }

    if (format === 'csv') {
      // Convert to CSV
      const fields = Object.keys(data[0]?.toObject() || {}).filter(f => !f.startsWith('_'));
      const csv = [
        fields.join(','),
        ...data.map(item => 
          fields.map(f => JSON.stringify(item[f] || '')).join(',')
        )
      ].join('\n');

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=${filename}_${Date.now()}.csv`);
      return res.send(csv);
    }

    // Default JSON response
    res.json({
      success: true,
      count: data.length,
      data
    });

  } catch (error) {
    console.error('Export Error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error exporting data',
      error: error.message 
    });
  }
});

// ==================== STAFF REPORTS (MERJA) ====================
router.get('/merja/staff', authMiddleware, authorize('admin', 'merja', 'audit'), async (req, res) => {
  try {
    const allUsers = await User.find({ role: { $ne: 'member' } })
      .select('-password')
      .sort('name');

    const admins = allUsers.filter(u => ['super_admin', 'admin'].includes(u.role));
    const executives = allUsers.filter(u => ![ 'super_admin', 'admin', 'sub_executive', 'member'].includes(u.role));
    const subExecutives = allUsers.filter(u => u.role === 'sub_executive');

    res.json({
      success: true,
      data: {
        admins,
        executives,
        subExecutives,
        summary: {
          totalStaff: allUsers.length,
          adminCount: admins.length,
          executiveCount: executives.length,
          subExecCount: subExecutives.length
        }
      }
    });
  } catch (error) {
    console.error('Merja Staff Report Error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error fetching staff records',
      error: error.message 
    });
  }
});

// ==================== MEMBER PERSONAL OVERVIEW ====================
router.get('/member/overview', authMiddleware, authorize('member', 'sub_executive'), async (req, res) => {
  try {
    const userId = req.user.id;
    
    // 1. Fetch the Member document associated with this user
    const member = await Member.findOne({ userId }).select('serviceDepartment active isApproved _id term');
    
    if (!member) {
      return res.status(404).json({
        success: false,
        message: 'Member record not found for this user'
      });
    }

    // 2. Announcements Count (Targeted at members and active)
    const announcementCount = await Announcement.countDocuments({
      targetGroup: 'member',
      isActive: true
    });

    // 3. Personal Attendance (Total presents)
    // We look for attendance records where member ID matches
    const attendanceRecords = await Attendance.find({
      member: member._id,
      onModel: 'Member'
    });

    const totalPresent = attendanceRecords.filter(a => a.status === 'present').length;
    const totalSessions = attendanceRecords.length;

    // 4. Engagement Analysis
    // Criteria: "ንቁ" (Active) if approved.
    const engagementStatus = member.isApproved ? 'ንቁ አሳታፊ' : 'በዝግጅት ላይ (Pending)';
    const engagementDetail = member.isApproved ? 'የአባልነትዎ ሁኔታ ትክክል ነው (Approved)' : 'አካውንትዎ እስኪጸድቅ ይጠብቁ';

    res.json({
      success: true,
      data: {
        department: member.serviceDepartment || 'ያልተመደበ',
        engagement: engagementStatus,
        engagementDetail: engagementDetail,
        announcementCount,
        personalAttendance: totalPresent,
        attendanceRate: totalSessions > 0 ? ((totalPresent / totalSessions) * 100).toFixed(1) + '%' : '0%'
      }
    });

  } catch (error) {
    console.error('Member Overview Error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error fetching member overview',
      error: error.message 
    });
  }
});

// ==================== HELPER FUNCTIONS ====================
async function calculateAttendanceRate(startDate, endDate, term) {
  try {
    const match = {
      date: { $gte: startDate, $lte: endDate }
    };
    if (term) match.term = term;

    const attendance = await Attendance.aggregate([
      {
        $match: match
      },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          present: {
            $sum: { $cond: [{ $eq: ['$status', 'present'] }, 1, 0] }
          }
        }
      }
    ]);

    if (attendance.length === 0 || attendance[0].total === 0) {
      return 0;
    }

    return (attendance[0].present / attendance[0].total) * 100;
  } catch (error) {
    console.error('Error calculating attendance rate:', error);
    return 0;
  }
}

module.exports = router;