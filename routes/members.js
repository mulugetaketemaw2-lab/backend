const express = require('express');
const router = express.Router();
const Member = require('../models/Member');
const User = require('../models/User');
const Subgroup = require('../models/Subgroup');
const Notification = require('../models/Notification');
const Settings = require('../models/Settings');
const { authMiddleware, authorize } = require('../middleware/auth');
const { getCurrentECYear } = require('../utils/dateHelpers');

// ==================== PUBLIC: SELF REGISTRATION ====================
router.post('/self-register', async (req, res) => {
  try {
    const {
      firstName, fatherName, grandFatherName, christianName, isSundaySchoolServed, studentId,
      department, batch, region, zone, woreda, kebele,
      phone, email, term, gender, ordination, serviceDepartment,
      password, photo, username, isBegena, begenaCycle, spiritualFather
    } = req.body;

    // Validate required fields
    const requiredFields = {
      firstName: 'ስም (First Name)',
      fatherName: 'የአባት ስም (Father\'s Name)',
      grandFatherName: 'የአያት ስም (Grandfather\'s Name)',
      studentId: 'መታወቂያ (Student ID)',
      department: 'ትምህርት ክፍል (University Dept)',
      batch: 'ባች (Batch)',
      region: 'ክልል (Region)',
      zone: 'ዞን (Zone)',
      woreda: 'ወረዳ (Woreda)',
      kebele: 'ቀበሌ (Kebele)',
      phone: 'ስልክ (Phone)',
      gender: 'ጾታ (Gender)',
      serviceDepartment: 'አገልግሎት ክፍል (Service Dept)',
      password: 'የይለፍ ቃል (Password)',
      username: 'የተጠቃሚ ስም (Username)'
    };

    const missingFields = Object.keys(requiredFields).filter(field => !req.body[field]);
    
    // Special check for term - if missing, try to get from settings or fallback to current EC year
    let memberTerm = term;
    if (!memberTerm) {
      try {
        const settings = await Settings.findOne();
        memberTerm = settings?.currentTerm || getCurrentECYear().toString();
      } catch (err) {
        memberTerm = getCurrentECYear().toString();
      }
    }

    if (missingFields.length > 0) {
      const missingLabels = missingFields.map(f => requiredFields[f]).join(', ');
      return res.status(400).json({ 
        message: `እባክዎ የሚከተሉትን መስኮች ይሙሉ (Please fill required fields): ${missingLabels}`
      });
    }

    // Check if student ID, email, or username already registered
    const existingMember = await Member.findOne({ $or: [{ studentId }, { username }] });
    if (existingMember) {
      if (existingMember.studentId === studentId) {
        return res.status(400).json({ message: `መታወቂያ ቁጥር "${studentId}" ቀድሞ ተመዝግቧል። (Student ID already registered)` });
      }
      return res.status(400).json({ message: `የተጠቃሚ ስም "${username}" ቀድሞ ተመዝግቧል። እባኮ "🔄 New" ቁልፍ ይጫኑ። (Username taken, click "New" to generate another)` });
    }

    const existingUser = await User.findOne({ email: username });
    if (existingUser) {
      return res.status(400).json({ message: `የተጠቃሚ ስም "${username}" ቀድሞ ተመዝግቧል። እባኮ "🔄 New" ቁልፍ ይጫኑ። (Username taken, click "New" to generate another)` });
    }

    // 1. Create Member entry
    console.log('📝 Creating Member entry with:', { firstName, studentId, username });
    const newMember = new Member({
      firstName,
      fatherName,
      grandFatherName,
      studentId,
      department,
      batch,
      region,
      zone,
      woreda,
      kebele,
      phone,
      email, // Optional contact email
      username, // Login username
      term: memberTerm,
      gender,
      ordination: ordination || 'የለም',
      serviceDepartment,
      active: true,
      isApproved: false,
      christianName,
      spiritualFather,
      isSundaySchoolServed,
      photo, // Save photo
      isBegena: isBegena === true || isBegena === 'true',
      begenaCycle: begenaCycle ? parseInt(begenaCycle, 10) : undefined
    });

    // 2. Create User account for the student
    console.log('👤 Creating User account for:', username);
    const newUser = new User({
      name: `${firstName} ${fatherName}`,
      email: username, // Use username for login
      password: password,
      role: 'member',
      department: 'ትምህርት ክፍል', // Default or assigned later
      departmentAmharic: serviceDepartment,
      isApproved: false,
      memberId: newMember._id
    });

    newMember.userId = newUser._id;

    console.log('💾 Saving Member and User...');
    try {
      await Promise.all([newMember.save(), newUser.save()]);
      console.log('✅ Member and User saved successfully');
    } catch (saveError) {
      console.error('❌ Mongoose Save Error:', saveError);
      throw saveError;
    }

    // 3. Notify አባላት ጉዳይ department of the new pending registration
    try {
      await Notification.create({
        member: newMember._id,
        department: 'አባላት ጉዳይ',
        title: 'New Member Registration',
        message: `${firstName} ${fatherName} (${studentId}) has registered and is waiting for approval.`,
        type: 'info'
      });
      console.log('🔔 Notification created for አባላት ጉዳይ');
    } catch (notifErr) {
      console.warn('⚠️ Notification creation failed (non-blocking):', notifErr.message);
    }

    res.status(201).json({
      message: 'Registration successful! Your account is pending approval by Abalat Guday.',
      member: {
        name: `${firstName} ${fatherName}`,
        id: newMember._id
      }
    });

  } catch (error) {
    console.error('❌ Self-registration error:', error);
    if (error.name === 'ValidationError') {
      return res.status(400).json({ message: 'Validation Error: ' + error.message });
    }
    if (error.code === 11000) {
      return res.status(400).json({ message: 'Duplicate Key Error: Username or Student ID already exists.' });
    }
    res.status(500).json({ message: 'Error during registration. ' + (error.message || 'Please try again later.') });
  }
});

// ==================== PROTECTED: GET PENDING APPROVALS ====================
// Only Abalat Guday or Admin can see pending registrations
router.get('/pending', authMiddleware, authorize('admin', 'abalat_guday'), async (req, res) => {
  try {
    const { batch, department, gender, search } = req.query;
    let query = { isApproved: false, active: { $ne: false } };

    if (batch && batch !== 'all') query.batch = batch;
    if (department && department !== 'all') query.serviceDepartment = department;
    if (gender && gender !== 'all') query.gender = gender;
    if (search) {
      query.$or = [
        { firstName: new RegExp(search, 'i') },
        { fatherName: new RegExp(search, 'i') },
        { studentId: new RegExp(search, 'i') }
      ];
    }

    const pendingMembers = await Member.find(query).sort({ createdAt: -1 });
    res.json(pendingMembers);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching pending members' });
  }
});

// ==================== PROTECTED: APPROVE MEMBER ====================
router.put('/approve/:id', authMiddleware, authorize('admin', 'abalat_guday'), async (req, res) => {
  try {
    const { serviceDepartment } = req.body;
    const member = await Member.findById(req.params.id);
    if (!member) return res.status(404).json({ message: 'Member not found' });

    // 1. Update basic info
    member.isApproved = true;
    member.approvedBy = req.user.id;
    if (serviceDepartment) {
      member.serviceDepartment = serviceDepartment;
    }

    // 2. Generate Fellowship ID (GBI/Year/Serial)
    const currentYear = member.term || getCurrentECYear();
    const prefix = `GBI/${currentYear}/`;

    // Find the latest member for this year to get the next serial
    const lastMember = await Member.findOne({ fellowshipId: new RegExp(`^${prefix}`) })
      .sort({ fellowshipId: -1 });

    let nextSerial = 1;
    if (lastMember && lastMember.fellowshipId) {
      const parts = lastMember.fellowshipId.split('/');
      const lastSerial = parseInt(parts[parts.length - 1]);
      if (!isNaN(lastSerial)) nextSerial = lastSerial + 1;
    }

    member.fellowshipId = `${prefix}${nextSerial.toString().padStart(3, '0')}`;

    // 3. Update associated User account
    if (member.userId) {
      await User.findByIdAndUpdate(member.userId, {
        isApproved: true,
        departmentAmharic: member.serviceDepartment,
        // Sync department text if possible
        department: member.serviceDepartment
      });
    }

    await member.save();
    res.json({
      message: `Member approved successfully! Assigned ID: ${member.fellowshipId}`,
      member
    });
  } catch (error) {
    console.error('❌ Approval error:', error);
    res.status(500).json({ message: 'Error approving member: ' + error.message });
  }
});

// ==================== PROTECTED: BATCH APPROVE MEMBERS ====================
router.post('/approve-batch', authMiddleware, authorize('admin', 'abalat_guday'), async (req, res) => {
  try {
    const { ids, serviceDepartment } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ message: 'No member IDs provided' });
    }

    const results = [];
    const errors = [];

    // Process each member
    for (const id of ids) {
      try {
        const member = await Member.findById(id);
        if (!member || member.isApproved) continue;

        member.isApproved = true;
        member.approvedBy = req.user.id;
        if (serviceDepartment) member.serviceDepartment = serviceDepartment;

        // Generate ID
        const currentYear = member.term || getCurrentECYear();
        const prefix = `GBI/${currentYear}/`;
        const lastMember = await Member.findOne({ fellowshipId: new RegExp(`^${prefix}`) }).sort({ fellowshipId: -1 });

        let nextSerial = 1;
        if (lastMember && lastMember.fellowshipId) {
          const parts = lastMember.fellowshipId.split('/');
          const lastSerial = parseInt(parts[parts.length - 1]);
          if (!isNaN(lastSerial)) nextSerial = lastSerial + 1;
        }
        member.fellowshipId = `${prefix}${nextSerial.toString().padStart(3, '0')}`;

        // Update User
        if (member.userId) {
          await User.findByIdAndUpdate(member.userId, {
            isApproved: true,
            departmentAmharic: member.serviceDepartment,
            department: member.serviceDepartment
          });
        }

        await member.save();
        results.push(member.fellowshipId);
      } catch (err) {
        errors.push({ id, error: err.message });
      }
    }

    res.json({
      message: `Batch processing complete. ${results.length} approved, ${errors.length} failed.`,
      approvedCount: results.length,
      failedCount: errors.length,
      errors: errors.length > 0 ? errors : undefined
    });

  } catch (error) {
    console.error('❌ Batch approval error:', error);
    res.status(500).json({ message: 'Error in batch approval: ' + error.message });
  }
});

// ==================== PROTECTED: GET MEMBER BY STUDENT ID ====================
router.get('/by-student-id/:studentId', authMiddleware, async (req, res) => {
  try {
    const member = await Member.findOne({ studentId: req.params.studentId });
    if (!member) return res.status(404).json({ message: 'Member not found' });
    res.json(member);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching member by Student ID' });
  }
});

// ==================== PROTECTED: GET ALL MEMBERS (FILTERED BY ROLE) ====================
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { term, isBegena } = req.query;
    const { role, departmentAmharic } = req.user;

    let query = {};
    if (term) query.term = term;
    if (isBegena === 'true') query.isBegena = true;
    // 1. Super Admin, Admin, Sebsabi, Miktil Sebsabi, Tsehafi, or Abalat Guday: Full visibility
    if (['super_admin', 'admin', 'sebsabi', 'miktil_sebsabi', 'tsehafi', 'abalat_guday'].includes(role)) {
      // No extra filters
    }
    // 2. Merja: Full visibility for master list if specifically requested
    else if (role === 'merja' && req.query.fullList === 'true') {
      query.isApproved = true;
    }
    // 4. Sub-Executives (ንዑስ ተጠሪ): See only their assigned subgroups (Enforced)
    else if (role === 'sub_executive') {
      const managedSubgroups = await Subgroup.find({ leader: req.user.id });
      if (managedSubgroups.length > 0) {
        const subgroupMemberIds = managedSubgroups.flatMap(sg => sg.members);
        query._id = { $in: subgroupMemberIds };
        console.log(`🎯 Sub-Executive ${req.user.name} viewing subgroup (${subgroupMemberIds.length} members)`);
      } else {
        query._id = { $in: [] }; 
      }
    }
    // 5. Department Heads: See only their registered members
    else {
      const deptMap = {
        'timhirt': 'ትምህርት ክፍል',
        'abalat_guday': 'አባላት ጉዳይ',
        'mezmur': 'መዝሙር ክፍል',
        'bach': 'ባች ክፍል',
        'muya': 'ሙያ ክፍል',
        'lmat': 'ልማት ክፍል',
        'kwanqwa': 'ቋንቋ ክፍል',
        'merja': 'መረጃ ክፍል'
      };
      const userDept = departmentAmharic || deptMap[role];
      if (userDept) {
        query.serviceDepartment = userDept;
        console.log(`✅ Dept Head ${req.user.name} viewing department: ${userDept}`);
      } else {
        query._id = { $in: [] }; 
        console.log(`🚫 Dept Head ${req.user.name} restricted (No department found)`);
      }
    }

    console.log(`🔍 Member search for ${role} (${departmentAmharic}):`, query);

    const members = await Member.find(query).select('-photo').sort({ firstName: 1 });
    res.json(members);
  } catch (error) {
    console.error('❌ Error fetching members:', error);
    res.status(500).json({ message: 'Error fetching members' });
  }
});

// ==================== PROTECTED: GET SINGLE MEMBER DETAIL ====================
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const member = await Member.findById(req.params.id);
    if (!member) return res.status(404).json({ message: 'Member not found' });
    res.json(member);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching member details' });
  }
});

// ==================== PROTECTED: UPDATE MEMBER ====================
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const member = await Member.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!member) return res.status(404).json({ message: 'Member not found' });
    
    // Sync active status to User account to revoke/restore login
    if (req.body.active !== undefined && member.userId) {
      await User.findByIdAndUpdate(member.userId, { isActive: req.body.active });
    }
    
    res.json(member);
  } catch (error) {
    res.status(500).json({ message: 'Error updating member' });
  }
});

// ==================== PROTECTED: DELETE MEMBER ====================
router.delete('/:id', authMiddleware, authorize('super_admin', 'admin', 'abalat_guday'), async (req, res) => {
  try {
    const member = await Member.findById(req.params.id);
    if (!member) {
      return res.status(404).json({ message: 'Member not found' });
    }
    await Member.findByIdAndDelete(req.params.id);
    if (member.userId) {
      await User.findByIdAndDelete(member.userId);
    }
    res.json({ message: 'Member deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting member' });
  }
});

// ==================== PROTECTED: MEMBER STATS BY BATCH & DEPT ====================
// Only Abalat Guday and Admin can access
router.get('/stats/summary', authMiddleware, authorize('admin', 'super_admin', 'abalat_guday', 'merja'), async (req, res) => {
  try {
    const { term } = req.query;
    const matchQuery = {};
    if (term) matchQuery.term = term;

    // Group by batch
    const byBatch = await Member.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: '$batch',
          total: { $sum: 1 },
          approved: { $sum: { $cond: ['$isApproved', 1, 0] } },
          pending: { $sum: { $cond: ['$isApproved', 0, 1] } }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    // Group by service department
    const byDepartment = await Member.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: '$serviceDepartment',
          total: { $sum: 1 },
          approved: { $sum: { $cond: ['$isApproved', 1, 0] } },
          pending: { $sum: { $cond: ['$isApproved', 0, 1] } }
        }
      },
      { $sort: { total: -1 } }
    ]);

    // Group by gender
    const byGender = await Member.aggregate([
      { $match: matchQuery },
      { $group: { _id: '$gender', count: { $sum: 1 } } }
    ]);

    // Overall totals
    const totalAll = await Member.countDocuments(matchQuery);
    const totalApproved = await Member.countDocuments({ ...matchQuery, isApproved: true });
    const totalPending = await Member.countDocuments({ ...matchQuery, isApproved: false });

    res.json({
      overview: { total: totalAll, approved: totalApproved, pending: totalPending },
      byBatch,
      byDepartment,
      byGender
    });
  } catch (error) {
    console.error('❌ Stats error:', error);
    res.status(500).json({ message: 'Error generating statistics' });
  }
});

module.exports = router;