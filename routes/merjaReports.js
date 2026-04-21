const express = require('express');
const router = express.Router();
const Member = require('../models/Member');
const { authMiddleware, authorize } = require('../middleware/auth');

// ==================== MERJA: BY SERVICE DEPARTMENT ====================
router.get('/by-service-department', authMiddleware, authorize('admin', 'merja', 'audit'), async (req, res) => {
  try {
    const { startDate, endDate, term } = req.query;
    const matchQuery = { isApproved: true };
    if (term) matchQuery.term = term;
    if (startDate || endDate) {
      matchQuery.createdAt = {};
      if (startDate) matchQuery.createdAt.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        matchQuery.createdAt.$lte = end;
      }
    }

    const byServiceDept = await Member.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: '$serviceDepartment',
          total: { $sum: 1 },
          active: { $sum: { $cond: ['$active', 1, 0] } },
          male: { $sum: { $cond: [{ $eq: ['$gender', 'Male'] }, 1, 0] } },
          female: { $sum: { $cond: [{ $eq: ['$gender', 'Female'] }, 1, 0] } }
        }
      },
      { $sort: { total: -1 } }
    ]);

    res.json({ success: true, data: byServiceDept });
  } catch (error) {
    console.error('❌ Service department report error:', error);
    res.status(500).json({ message: 'Error generating service department report' });
  }
});

// ==================== MERJA: BY BATCH ====================
router.get('/by-batch', authMiddleware, authorize('admin', 'merja', 'audit'), async (req, res) => {
  try {
    const { startDate, endDate, term } = req.query;
    const matchQuery = { isApproved: true };
    if (term) matchQuery.term = term;
    if (startDate || endDate) {
      matchQuery.createdAt = {};
      if (startDate) matchQuery.createdAt.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        matchQuery.createdAt.$lte = end;
      }
    }

    const byBatch = await Member.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: '$batch',
          total: { $sum: 1 },
          active: { $sum: { $cond: ['$active', 1, 0] } },
          male: { $sum: { $cond: [{ $eq: ['$gender', 'Male'] }, 1, 0] } },
          female: { $sum: { $cond: [{ $eq: ['$gender', 'Female'] }, 1, 0] } }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    res.json({ success: true, data: byBatch });
  } catch (error) {
    console.error('❌ Batch report error:', error);
    res.status(500).json({ message: 'Error generating batch report' });
  }
});

// ==================== MERJA: COMBINED DASHBOARD ====================
router.get('/dashboard', authMiddleware, authorize('executive', 'admin'), async (req, res) => {
  try {
    let { startDate, endDate, term, serviceDepartment, batch } = req.query;

    const matchQuery = { isApproved: true };
    if (term) matchQuery.term = term;

    // RBAC: Force department filter for non-global roles
    const globalRoles = ['super_admin', 'admin', 'sebsabi', 'meketel_sebsabi', 'tsehafy', 'merja', 'audit', 'hisab'];
    if (!globalRoles.includes(req.user.role)) {
      const deptMap = {
        'timhirt': 'ትምህርት ክፍል',
        'abalat_guday': 'አባላት ጉዳይ',
        'mezmur': 'መዝሙር ክፍል',
        'bach': 'ባች ክፍል',
        'muya': 'ሙያ ክፍል',
        'lmat': 'ልማት ክፍል',
        'kwanqwa': 'ቋንቋ ክፍል'
      };
      serviceDepartment = req.user.departmentAmharic || deptMap[req.user.role] || 'Unknown';
      
      // Strict Enforcement
      matchQuery.serviceDepartment = serviceDepartment;
    } else {
      // Global roles can use the query param
      if (serviceDepartment && serviceDepartment !== 'all') {
        matchQuery.serviceDepartment = serviceDepartment;
      }
    }
    if (batch && batch !== 'all') matchQuery.batch = batch;
    if (startDate || endDate) {
      matchQuery.createdAt = {};
      if (startDate) matchQuery.createdAt.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        matchQuery.createdAt.$lte = end;
      }
    }

    const [byServiceDept, byBatch, byGender, byRegion, totalStats] = await Promise.all([
      // By Service Department
      Member.aggregate([
        { $match: matchQuery },
        {
          $group: {
            _id: '$serviceDepartment',
            total: { $sum: 1 },
            active: { $sum: { $cond: ['$active', 1, 0] } },
            male: { $sum: { $cond: [{ $eq: ['$gender', 'Male'] }, 1, 0] } },
            female: { $sum: { $cond: [{ $eq: ['$gender', 'Female'] }, 1, 0] } }
          }
        },
        { $sort: { total: -1 } }
      ]),

      // By Batch
      Member.aggregate([
        { $match: matchQuery },
        {
          $group: {
            _id: '$batch',
            total: { $sum: 1 },
            active: { $sum: { $cond: ['$active', 1, 0] } },
            male: { $sum: { $cond: [{ $eq: ['$gender', 'Male'] }, 1, 0] } },
            female: { $sum: { $cond: [{ $eq: ['$gender', 'Female'] }, 1, 0] } }
          }
        },
        { $sort: { _id: 1 } }
      ]),

      // By Gender
      Member.aggregate([
        { $match: matchQuery },
        {
          $group: {
            _id: '$gender',
            count: { $sum: 1 }
          }
        }
      ]),

      // By Region
      Member.aggregate([
        { $match: matchQuery },
        {
          $group: {
            _id: '$region',
            count: { $sum: 1 }
          }
        },
        { $sort: { count: -1 } }
      ]),

      // Total stats
      Member.aggregate([
        { $match: matchQuery },
        {
          $group: {
            _id: null,
            totalMembers: { $sum: 1 },
            activeMembers: { $sum: { $cond: ['$active', 1, 0] } },
            maleMembers: { $sum: { $cond: [{ $eq: ['$gender', 'Male'] }, 1, 0] } },
            femaleMembers: { $sum: { $cond: [{ $eq: ['$gender', 'Female'] }, 1, 0] } }
          }
        }
      ])
    ]);

    const stats = totalStats[0] || { totalMembers: 0, activeMembers: 0, maleMembers: 0, femaleMembers: 0 };

    res.json({
      success: true,
      data: {
        totalMembers: stats.totalMembers,
        activeMembers: stats.activeMembers,
        maleMembers: stats.maleMembers,
        femaleMembers: stats.femaleMembers,
        byServiceDept,
        byBatch,
        byGender,
        byRegion
      }
    });
  } catch (error) {
    console.error('❌ Dashboard error:', error);
    res.status(500).json({ message: 'Error generating dashboard data' });
  }
});

// ==================== MERJA: MEMBERS LIST WITH PAGINATION & FILTERS ====================
router.get('/members', authMiddleware, authorize('executive', 'admin'), async (req, res) => {
  try {
    let { startDate, endDate, term, serviceDepartment, batch, gender, page = 1, limit = 50 } = req.query;

    const matchQuery = { isApproved: true };
    if (term) matchQuery.term = term;

    // RBAC: Force department filter for non-global roles
    const globalRoles = ['super_admin', 'admin', 'sebsabi', 'meketel_sebsabi', 'tsehafy', 'merja', 'audit', 'hisab'];
    if (!globalRoles.includes(req.user.role)) {
      const deptMap = {
        'timhirt': 'ትምህርት ክፍል',
        'abalat_guday': 'አባላት ጉዳይ',
        'mezmur': 'መዝሙር ክፍል',
        'bach': 'ባች ክፍል',
        'muya': 'ሙያ ክፍል',
        'lmat': 'ልማት ክፍል',
        'kwanqwa': 'ቋንቋ ክፍል'
      };
      serviceDepartment = req.user.departmentAmharic || deptMap[req.user.role] || 'Unknown';
      
      // Strict Enforcement
      matchQuery.serviceDepartment = serviceDepartment;
    } else {
      // Global roles can use the query param
      if (serviceDepartment && serviceDepartment !== 'all') {
        matchQuery.serviceDepartment = serviceDepartment;
      }
    }
    if (batch && batch !== 'all') matchQuery.batch = batch;
    if (gender && gender !== 'all') matchQuery.gender = gender === 'male' ? 'Male' : 'Female';
    if (startDate || endDate) {
      matchQuery.createdAt = {};
      if (startDate) matchQuery.createdAt.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        matchQuery.createdAt.$lte = end;
      }
    }

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    const [members, totalCount] = await Promise.all([
      Member.find(matchQuery)
        .select('firstName fatherName grandFatherName christianName gender serviceDepartment batch region zone woreda kebele term active studentId university department semester ordination phone email fellowshipId isSundaySchoolServed isApproved')
        .sort({ firstName: 1 })
        .skip(skip)
        .limit(limitNum),
      Member.countDocuments(matchQuery)
    ]);

    // Map to a consistent name field for the frontend
    const mappedMembers = members.map(m => ({
      ...m._doc,
      name: `${m.firstName} ${m.fatherName}`
    }));

    res.json({
      success: true,
      data: {
        members: mappedMembers,
        totalCount,
        totalPages: Math.ceil(totalCount / limitNum),
        currentPage: pageNum
      }
    });
  } catch (error) {
    console.error('❌ Members list error:', error);
    res.status(500).json({ message: 'Error fetching members' });
  }
});

module.exports = router;
