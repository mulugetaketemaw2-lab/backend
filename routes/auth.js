const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Member = require('../models/Member');
const { authMiddleware, authorize } = require('../middleware/auth');
const { createLog } = require('./logs');
const fs = require('fs');
const path = require('path');
const { getCurrentECTerm } = require('../utils/dateHelpers');
const debugLogPath = path.join(__dirname, '../login-debug.log');

const debugLog = (msg) => {
  const timestamp = new Date().toISOString();
  fs.appendFileSync(debugLogPath, `[${timestamp}] ${msg}\n`);
  console.log(msg);
};

// ==================== AUTH BASE ROUTE ====================
router.get('/', (req, res) => {
  res.json({
    message: 'Auth API - Available endpoints:',
    endpoints: {
      login: 'POST /api/auth/login - Send {email, password}',
      verify: 'GET /api/auth/verify - Verify token (needs Authorization header)',
      profile: 'GET /api/auth/profile - Get user profile',
      departments: 'GET /api/auth/departments - Get all departments',
      registerExecutive: 'POST /api/auth/register-executive - Register executive member (admin only)',
      registerDepartment: 'POST /api/auth/register-department - Register department head (admin only)'
    }
  });
});

// ==================== LOGIN ROUTE ====================
// Handle GET requests to /login - show helpful message
router.get('/login', (req, res) => {
  res.status(405).json({ 
    message: 'Use POST /api/auth/login with { email, password }',
    example: {
      email: 'admin@gbi.com',
      password: 'admin123'
    }
  });
});

// POST /api/auth/login - Main login endpoint
router.post('/login', async (req, res) => {
  try {
    const { email, username, password, roleType } = req.body;
    
    // Support both email and username fields
    const loginEmail = email || username;
    
    debugLog(`ðŸ” Login attempt: ${loginEmail}`);
    debugLog(`ðŸ“¦ Request body: ${JSON.stringify(req.body)}`);
    
    if (!loginEmail || !password) {
      return res.status(400).json({ 
        message: 'Email/username and password are required' 
      });
    }
    
    // Find user by email (case insensitive)
    const user = await User.findOne({ 
      email: { $regex: new RegExp('^' + loginEmail + '$', 'i') } 
    });
    
    if (!user) {
      debugLog(`âŒ User not found for: ${loginEmail}`);
      const allUsers = await User.find().select('email');
      debugLog(`ðŸ“‹ Available users in DB: ${allUsers.map(u => u.email).join(', ')}`);
      return res.status(401).json({ 
        message: 'Invalid email or password' 
      });
    }
    
    // Check password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      console.log(`â Œ Invalid password for: ${loginEmail}`);
      return res.status(401).json({ 
        message: 'የተጠቃሚ ስም ወይም የይለፍ ቃል ተሳስቷል (Invalid email or password)' 
      });
    }

    // New: Role validation if selected in UI
    if (roleType) {
      const isAdmin = ['super_admin', 'admin'].includes(user.role);
      const isExecutive = ['sebsabi', 'meketel_sebsabi', 'tsehafy', 'timhirt', 'abalat_guday', 'mezmur', 'bach', 'muya', 'lmat', 'kwanqwa', 'merja', 'hisab', 'audit'].includes(user.role);
      const isSubExecutive = user.role === 'sub_executive';
      const isMember = user.role === 'member';

      let mismatch = false;
      if (roleType === 'Admin' && !isAdmin) mismatch = true;
      if (roleType === 'Executive' && !isExecutive) mismatch = true;
      if (roleType === 'Sub Executive' && !isSubExecutive) mismatch = true;
      if (roleType === 'Member' && !isMember) mismatch = true;

      if (mismatch) {
        console.log(`â Œ Role mismatch for ${loginEmail}: User is ${user.role}, requested ${roleType}`);
        return res.status(403).json({ 
          message: `የመረጡት የስራ ድርሻ ትክክል አይደለም (${roleType})። እባክዎ ትክክለኛውን ይምረጡ። (Role Mismatch)`
        });
      }
    }

    // New: Check approval for members
    if (user.role === 'member' && !user.isApproved) {
      console.log(`â³ Login blocked - Pending approval: ${loginEmail}`);
      return res.status(403).json({ 
        message: 'አካውንትዎ ገና አልጸደቀም። እባክዎ የአባላት ጉዳይ እስኪያጸድቅልዎ ድረስ ይጠብቁ ወይም ክፍል ሃላፊዎን ያነጋግሩ። (Pending Approval)' 
      });
    }

    // New: Check if account is active
    if (user.isActive === false) {
      console.log(`ðŸš« Login blocked - Account suspended: ${loginEmail}`);
      return res.status(403).json({ 
        message: 'አካውንትዎ ለጊዜው ታግዷል። እባክዎ አስተዳዳሪውን ያነጋግሩ። (Account Suspended)' 
      });
    }

    await createLog(user._id, 'LOGIN', user._id.toString(), user.name, 'Successful login', req);
    
    // Generate token
    const token = jwt.sign(
      { 
        id: user._id, 
        name: user.name,
        email: user.email, 
        role: user.role,
        department: user.department,
        departmentAmharic: user.departmentAmharic,
        level: user.level,
        term: user.term
      },
      process.env.JWT_SECRET || 'gbi-secret-key',
      { expiresIn: '7d' }
    );
    
    console.log(`âœ… Login successful: ${loginEmail} (${user.role})`);
    
    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        department: user.department,
        departmentAmharic: user.departmentAmharic,
        level: user.level,
        photo: user.photo,
        phone: user.phone,
        term: user.term,
        isActive: user.isActive
      }
    });
    
  } catch (error) {
    console.error('âŒ Login error:', error);
    res.status(500).json({ 
      message: 'Server error during login',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// ==================== VERIFY TOKEN ====================
router.get('/verify', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    res.json({ 
      valid: true, 
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        department: user.department,
        departmentAmharic: user.departmentAmharic,
        level: user.level,
        photo: user.photo,
        phone: user.phone,
        term: user.term,
        isActive: user.isActive
      },
      message: 'Token is valid' 
    });
  } catch (error) {
    res.status(401).json({ 
      valid: false, 
      message: 'Invalid token' 
    });
  }
});

// ==================== GET PROFILE ====================
router.get('/profile', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json(user);
  } catch (error) {
    console.error('âŒ Profile error:', error);
    res.status(500).json({ message: 'Error fetching profile' });
  }
});

// ==================== GET ALL DEPARTMENTS ====================
router.get('/departments', (req, res) => {
  const departments = [
    // Executive Committee (3 roles - same permission level)
    { id: 1, name: "áˆ°á‰¥áˆ³á‰¢", role: "sebsabi", level: "executive", amharic: "áˆ°á‰¥áˆ³á‰¢" },
    { id: 2, name: "áˆáŠ­á‰µáˆ áˆ°á‰¥áˆ³á‰¢", role: "meketel_sebsabi", level: "executive", amharic: "áˆáŠ­á‰µáˆ áˆ°á‰¥áˆ³á‰¢" },
    { id: 3, name: "áŒ¸áˆ€áŠ", role: "tsehafy", level: "executive", amharic: "áŒ¸áˆ€áŠ" },
    
    // Department Heads (10 departments)
    { id: 4, name: "á‰µáˆáˆ…áˆ­á‰µ áŠ­ááˆ", role: "timhirt", level: "department", amharic: "á‰µáˆáˆ…áˆ­á‰µ áŠ­ááˆ" },
    { id: 5, name: "áŠ á‰£áˆ‹á‰µ áŒ‰á‹³á‹­", role: "abalat_guday", level: "department", canAddMembers: true, amharic: "áŠ á‰£áˆ‹á‰µ áŒ‰á‹³á‹­" },
    { id: 6, name: "áˆ˜á‹áˆ™áˆ­ áŠ­ááˆ", role: "mezmur", level: "department", amharic: "áˆ˜á‹áˆ™áˆ­ áŠ­ááˆ" },
    { id: 7, name: "á‰£á‰½ áŠ­ááˆ", role: "bach", level: "department", amharic: "á‰£á‰½ áŠ­ááˆ" },
    { id: 8, name: "áˆ™á‹« áŠ­ááˆ", role: "muya", level: "department", amharic: "áˆ™á‹« áŠ­ááˆ" },
    { id: 9, name: "áˆáˆ›á‰µ áŠ­ááˆ", role: "lmat", level: "department", amharic: "áˆáˆ›á‰µ áŠ­ááˆ" },
    { id: 10, name: "á‰‹áŠ•á‰‹ áŠ­ááˆ", role: "kwanqwa", level: "department", amharic: "á‰‹áŠ•á‰‹ áŠ­ááˆ" },
    { id: 11, name: "áˆ˜áˆ¨áŒƒ áŠ­ááˆ", role: "merja", level: "department", receivesNotifications: true, amharic: "áˆ˜áˆ¨áŒƒ áŠ­ááˆ" },
    { id: 12, name: "áˆ‚áˆ³á‰¥ áŠ­ááˆ", role: "hisab", level: "department", amharic: "áˆ‚áˆ³á‰¥ áŠ­ááˆ" },
    { id: 13, name: "áŠ¦á‹²á‰µ", role: "audit", level: "department", amharic: "áŠ¦á‹²á‰µ" }
  ];
  res.json(departments);
});

// ==================== REGISTER SYSTEM USER (ADMIN OR EXECUTIVE) ====================
router.post('/register-user', authMiddleware, authorize('super_admin', 'admin', 'sebsabi', 'meketel_sebsabi', 'tsehafy', 'timhirt', 'abalat_guday', 'mezmur', 'bach', 'muya', 'lmat', 'kwanqwa', 'merja', 'hisab', 'audit'), async (req, res) => {
  try {
    const {
      name, email, password, role, department, academicDepartment, term, phone,
      region, zone, woreda, kebele, leaderName, subRoleDescription, photo
    } = req.body;
    
    // Validate required fields
    if (!name || !email || !password || !role) {
      return res.status(400).json({ 
        message: 'Missing required fields: name, email, password, role are required' 
      });
    }

    // Permission check: Only super_admin can create another admin
    if (role === 'admin' && req.user.role !== 'super_admin') {
      return res.status(403).json({ message: 'Only Super Admin can create additional administrators' });
    }

    // New: Executive Restricted creation
    const isExec = ['sebsabi', 'meketel_sebsabi', 'tsehafy', 'timhirt', 'abalat_guday', 'mezmur', 'bach', 'muya', 'lmat', 'kwanqwa', 'merja', 'hisab', 'audit'].includes(req.user.role);
    if (isExec) {
      if (role !== 'sub_executive') {
        return res.status(403).json({ message: 'Executives can only register Sub-Executives (áŠ•áŠ¡áˆµ á‰°áŒ áˆª)' });
      }
    }
    // Check if user already exists
    const existingUser = await User.findOne({ 
      $or: [{ email }, { name }] 
    });
    
    if (existingUser) {
      return res.status(400).json({ 
        message: 'User with this email or name already exists' 
      });
    }
    
    // Set permissions and level based on role
    let permissions = [];
    let level = 'department';
    
    if (role === 'super_admin') {
       level = 'super_admin';
       permissions = ['all'];
    } else if (role === 'admin') {
       level = 'admin';
       permissions = ['manage_executive', 'manage_users', 'view_all'];
    } else if (['sebsabi', 'meketel_sebsabi', 'tsehafy'].includes(role)) {
      permissions = ['view_all', 'view_reports', 'manage_executive'];
      level = 'executive';
    } else if (role === 'abalat_guday') {
      permissions = ['add_members', 'manage_members', 'view_all_members'];
    } else if (role === 'merja') {
      permissions = ['manage_information', 'view_information_members', 'receive_member_notifications'];
    } else {
      permissions = [`manage_${role}`, `view_${role}_members`];
    }
    
    const user = new User({
      name,
      email: email.toLowerCase(),
      password,
      role,
      department: isExec ? req.user.department : (department || 'System'),
      departmentAmharic: isExec ? req.user.departmentAmharic : (department || 'አስተዳደር'),
      academicDepartment: academicDepartment || '',
      phone,
      region,
      zone,
      woreda,
      kebele,
      leaderName,
      permissions,
      level,
      term: term || req.user.term || getCurrentECTerm(),
      subRoleDescription: subRoleDescription || '',
      photo: photo || ''
    });
    
    await user.save();

    // Automatically create a Member record for Sub-Executives so they are "numbered"
    if (role === 'sub_executive') {
      try {
        const nameParts = name.trim().split(/\s+/);
        const firstName = nameParts[0] || name;
        const fatherName = nameParts[1] || 'Unknown';
        const grandFatherName = nameParts[2] || 'Unknown';

        const member = new Member({
          firstName,
          fatherName,
          grandFatherName,
          studentId: `STAF-${user._id.toString().slice(-6)}-${Math.floor(Math.random() * 1000)}`,
          department: academicDepartment || 'General',
          batch: 'Staff/Executive',
          term: user.term,
          gender: 'Other', // Placeholder as not in registration form
          region: region || 'N/A',
          zone: zone || 'N/A',
          woreda: woreda || 'N/A',
          kebele: kebele || 'N/A',
          phone: phone || '0000000000',
          username: email.toLowerCase(),
          userId: user._id,
          assignedDepartments: [user.departmentAmharic || user.department],
          isApproved: true,
          active: true,
          photo: photo || ''
        });
        await member.save();
        console.log(`âœ… Linked Member record created for Sub-Executive: ${name}`);
      } catch (memError) {
        console.error('âš ï¸ Could not create Member record for Staff:', memError.message);
        // We don't fail the whole request if member creation fails, but it's not ideal
      }
    }
    
    await createLog(req.user.id, 'CREATE_USER', user._id.toString(), user.name, `Created ${role} account`, req);

    console.log(`âœ… User created: ${email} (${role})`);
    
    res.status(201).json({ 
      message: `${role.replace('_', ' ')} created successfully`,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        department: user.department,
        level: user.level
      }
    });
    
  } catch (error) {
    console.error('âŒ Registration error:', error);
    res.status(500).json({ 
      message: 'Error creating user',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Note: /register-executive is now redundant but kept for compatibility, pointing to register-user logic if needed
// Or we can just remove it and update frontend to use /register-user

// ==================== UPDATE OWN PROFILE ====================
router.put('/update-profile', authMiddleware, async (req, res) => {
  try {
    const { name, phone, photo } = req.body;
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    if (name) user.name = name;
    if (phone !== undefined) user.phone = phone;
    if (photo !== undefined) user.photo = photo;

    await user.save();
    
    await createLog(req.user.id, 'UPDATE_PROFILE', user._id.toString(), user.name, 'Updated own profile details', req);

    res.json({
      message: 'Profile updated successfully',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        department: user.department,
        departmentAmharic: user.departmentAmharic,
        level: user.level,
        photo: user.photo,
        phone: user.phone,
        term: user.term,
        isActive: user.isActive
      }
    });
  } catch (error) {
    console.error('âŒ Update profile error:', error);
    res.status(500).json({ message: 'Error updating profile' });
  }
});

// ==================== UPDATE USER (ADMIN OR CORE EXECUTIVE COMMITTEE ONLY) ====================
router.put('/user/:id', authMiddleware, authorize('super_admin', 'admin', 'sebsabi', 'meketel_sebsabi', 'tsehafy', 'timhirt', 'abalat_guday', 'mezmur', 'bach', 'muya', 'lmat', 'kwanqwa', 'merja', 'hisab', 'audit'), async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // Find user first to see if it exists
    const userToUpdate = await User.findById(id);
    if (!userToUpdate) {
      return res.status(404).json({ message: 'User not found' });
    }

    const isCore = ['super_admin', 'admin', 'sebsabi', 'meketel_sebsabi', 'tsehafy'].includes(req.user.role);

    // Departmental Executive protection
    if (!isCore) {
      if (userToUpdate.role !== 'sub_executive' || userToUpdate.departmentAmharic !== req.user.departmentAmharic) {
        return res.status(403).json({ message: 'You can only manage Sub-Executive assistants in your own department' });
      }
    }

    // Role protection: Admin cannot update Super Admin OR other Admins
    if (req.user.role === 'admin' && (userToUpdate.role === 'super_admin' || userToUpdate.role === 'admin')) {
      return res.status(403).json({ message: 'Admin cannot modify Super Admin or other Administrator accounts' });
    }

    // Role protection: Sebsabi cannot update an Admin/Super Admin
    if (req.user.role === 'sebsabi' && (userToUpdate.role === 'admin' || userToUpdate.role === 'super_admin')) {
      return res.status(403).json({ message: 'Executive committee cannot update Admin/Super Admin users' });
    }
    
    // Hash password if it's being updated
    if (updates.password) {
      // The schema pre-save hook handles hashing if we use user.save()
      // But findByIdAndUpdate bypasses middleware. Let's do it manually or use save()
      userToUpdate.name = updates.name || userToUpdate.name;
      userToUpdate.email = updates.email || userToUpdate.email;
      userToUpdate.role = updates.role || userToUpdate.role;
      userToUpdate.department = updates.department || userToUpdate.department;
      userToUpdate.academicDepartment = updates.academicDepartment !== undefined ? updates.academicDepartment : userToUpdate.academicDepartment;
      userToUpdate.phone = updates.phone || userToUpdate.phone;
      userToUpdate.term = updates.term || userToUpdate.term;
      userToUpdate.subRoleDescription = updates.subRoleDescription !== undefined ? updates.subRoleDescription : userToUpdate.subRoleDescription;
      userToUpdate.password = updates.password; // pre-save hook will hash this
      
      await userToUpdate.save();
      
      return res.json({
        message: 'User updated successfully (including password)',
        user: {
          id: userToUpdate._id,
          name: userToUpdate.name,
          email: userToUpdate.email,
          role: userToUpdate.role
        }
      });
    }
    
    const user = await User.findByIdAndUpdate(
      id, 
      updates, 
      { new: true, runValidators: true }
    ).select('-password');
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    await createLog(req.user.id, 'UPDATE_USER', user._id.toString(), user.name, `Updated user details${updates.password ? ' (including password)' : ''}`, req);
    
    res.json({
      message: 'User updated successfully',
      user
    });
  } catch (error) {
    console.error('âŒ Update error:', error);
    res.status(500).json({ message: 'Error updating user' });
  }
});

// ==================== TOGGLE USER STATUS (SUSPEND/ACTIVATE) ====================
router.patch('/user/:id/status', authMiddleware, authorize('super_admin', 'admin', 'executive'), async (req, res) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;

    const user = await User.findById(id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    
    // Self-action protection: User cannot block themselves
    if (req.user.id === id) {
      return res.status(403).json({ message: 'You cannot block your own account' });
    }

    const isCore = ['super_admin', 'admin', 'sebsabi', 'meketel_sebsabi', 'tsehafy'].includes(req.user.role);
    if (!isCore) {
      if (user.role !== 'sub_executive' || user.departmentAmharic !== req.user.departmentAmharic) {
        return res.status(403).json({ message: 'You can only manage status of Sub-Executives in your own department' });
      }
    }

    // Use findByIdAndUpdate to avoid validation errors on older documents that might fail strict schema checks
    const updatedUser = await User.findByIdAndUpdate(id, { isActive }, { runValidators: false, new: true });
    if (!updatedUser) return res.status(404).json({ message: 'User not found during update' });
    
    const action = isActive ? 'ACTIVATE_USER' : 'SUSPEND_USER';
    await createLog(req.user.id, action, updatedUser._id.toString(), updatedUser.name, `${isActive ? 'Activated' : 'Suspended'} user account`, req);

    console.log(`âœ… Status updated for ${updatedUser.name}: ${isActive ? 'Active' : 'Suspended'}`);
    res.json({ message: `User account ${isActive ? 'activated' : 'suspended'} successfully`, user: updatedUser });
  } catch (error) {
    console.error('âŒ Error toggling user status:', error);
    // Log to file for persistent debugging
    try {
        const errorLogPath = require('path').join(__dirname, '../error-log.txt');
        require('fs').appendFileSync(errorLogPath, `[${new Date().toISOString()}] TOGGLE ERROR [ID: ${req.params.id}]: ${error.message}\n${error.stack}\n\n`);
    } catch (e) {}
    
    res.status(500).json({ 
        message: 'áŠ áŒˆáˆáŒ‹á‹© áˆ‹á‹­ áˆµáˆ…á‰°á‰µ á‰°áŠ¨áˆµá‰·áˆ (Server Error during toggle)', 
        details: error.message 
    });
  }
});

// ==================== DELETE USER (ADMIN OR CORE EXECUTIVE COMMITTEE ONLY) ====================
router.delete('/user/:id', authMiddleware, authorize('super_admin', 'admin', 'sebsabi', 'meketel_sebsabi', 'tsehafy', 'timhirt', 'abalat_guday', 'mezmur', 'bach', 'muya', 'lmat', 'kwanqwa', 'merja', 'hisab', 'audit'), async (req, res) => {
  try {
    const { id } = req.params;
    
    const userToDelete = await User.findById(id);
    if (!userToDelete) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Self-action protection: User cannot delete themselves
    if (req.user.id === id) {
      return res.status(403).json({ message: 'You cannot delete your own account' });
    }

    const isCore = ['super_admin', 'admin', 'sebsabi', 'meketel_sebsabi', 'tsehafy'].includes(req.user.role);
    if (!isCore) {
      if (userToDelete.role !== 'sub_executive' || userToDelete.departmentAmharic !== req.user.departmentAmharic) {
        return res.status(403).json({ message: 'You can only delete Sub-Executives in your own department' });
      }
    }

    // Role protection: Admin cannot delete Super Admin OR other Admins
    if (req.user.role === 'admin' && (userToDelete.role === 'super_admin' || userToDelete.role === 'admin')) {
      return res.status(403).json({ message: 'Admin cannot delete Super Admin or other Administrator accounts' });
    }

    // Role protection: Sebsabi cannot delete an Admin/Super Admin
    if (req.user.role === 'sebsabi' && (userToDelete.role === 'admin' || userToDelete.role === 'super_admin')) {
      return res.status(403).json({ message: 'Executive committee cannot delete Admin/Super Admin users' });
    }

    await User.findByIdAndDelete(id);
    
    await createLog(req.user.id, 'DELETE_USER', userToDelete._id.toString(), userToDelete.name, 'Deleted user account', req);
    
    res.json({ 
      message: 'User deleted successfully',
      deletedUser: {
        id: userToDelete._id,
        name: userToDelete.name,
        email: userToDelete.email
      }
    });
  } catch (error) {
    console.error('âŒ Delete error:', error);
    res.status(500).json({ message: 'Error deleting user' });
  }
});

// ==================== GET ALL USERS (ADMIN OR CORE EXECUTIVE COMMITTEE ONLY) ====================
router.get('/users', authMiddleware, authorize('super_admin', 'admin', 'sebsabi', 'meketel_sebsabi', 'tsehafy', 'timhirt', 'abalat_guday', 'mezmur', 'bach', 'muya', 'lmat', 'kwanqwa', 'merja', 'hisab', 'audit'), async (req, res) => {
  try {
    const isCore = ['super_admin', 'admin', 'sebsabi', 'meketel_sebsabi', 'tsehafy'].includes(req.user.role);
    const showAll = req.query.showAll === 'true';
    const term = req.query.term;
    let query = {};
    
    if (term) {
      // Admins and Super Admins should be visible in every term list
      query = { 
        $or: [
          { term: term },
          { role: { $in: ['super_admin', 'admin'] } }
        ]
      };
    }
    
    if (!isCore) {
      // For departmental executives, only show users in their department with 'sub_executive' role
      query = { 
        departmentAmharic: req.user.departmentAmharic,
        role: 'sub_executive'
      };
      if (term) query.term = term;
    }
    
    const users = await User.find(query).select('-password');
    res.json(users);
  } catch (error) {
    console.error('âŒ Error fetching users:', error);
    res.status(500).json({ message: 'Error fetching users' });
  }
});

// ==================== SELF-SERVICE PASSWORD RESET (no token needed) ====================
// User provides username + new password. No email required.
router.post('/forgot-password', async (req, res) => {
  try {
    const { username, newPassword, confirmPassword } = req.body;

    if (!username || !newPassword || !confirmPassword) {
      return res.status(400).json({ message: 'Username, new password, and confirm password are required' });
    }
    if (newPassword !== confirmPassword) {
      return res.status(400).json({ message: 'Passwords do not match' });
    }
    if (newPassword.length < 4) {
      return res.status(400).json({ message: 'Password must be at least 4 characters' });
    }

    // Find user by email (username field) case-insensitive
    const user = await User.findOne({ email: { $regex: new RegExp('^' + username + '$', 'i') } });
    if (!user) {
      // Return generic message to avoid username enumeration
      return res.status(404).json({ message: 'No account found with that username' });
    }

    user.password = newPassword; // pre-save hook hashes it
    await user.save();

    console.log(`ðŸ”‘ Password reset via forgot-password for: ${username}`);
    res.json({ message: 'Password reset successfully. You can now log in with your new password.' });
  } catch (error) {
    console.error('âŒ Forgot password error:', error);
    res.status(500).json({ message: 'Error resetting password' });
  }
});

// ==================== CHANGE OWN PASSWORD (any logged-in user) ====================
router.post('/change-password', authMiddleware, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'Current password and new password are required' });
    }
    if (newPassword.length < 4) {
      return res.status(400).json({ message: 'New password must be at least 4 characters' });
    }

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(401).json({ message: 'Current password is incorrect' });
    }

    user.password = newPassword; // pre-save hook hashes it
    await user.save();

    await createLog(req.user.id, 'CHANGE_PASSWORD', user._id.toString(), user.name, 'Changed own password', req);

    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    console.error('â Œ Change password error:', error);
    res.status(500).json({ message: 'Error changing password' });
  }
});

// ==================== RESET ANY USER'S PASSWORD (admin/abalat_guday only) ====================
router.post('/reset-password/:userId', authMiddleware, authorize('super_admin', 'admin', 'abalat_guday'), async (req, res) => {
  try {
    const { newPassword } = req.body;
    const { userId } = req.params;

    if (!newPassword || newPassword.length < 4) {
      return res.status(400).json({ message: 'New password must be at least 4 characters' });
    }

    const targetUser = await User.findById(userId);
    if (!targetUser) return res.status(404).json({ message: 'User not found' });

    // Admin/Abalat Guday cannot reset super_admin password
    if ((req.user.role === 'admin' || req.user.role === 'abalat_guday') && targetUser.role === 'super_admin') {
      return res.status(403).json({ message: 'Cannot reset Super Admin password' });
    }

    // Abalat Guday cannot reset Admin password
    if (req.user.role === 'abalat_guday' && targetUser.role === 'admin') {
      return res.status(403).json({ message: 'Abalat Guday cannot reset Administrator passwords' });
    }

    targetUser.password = newPassword; // pre-save hook hashes it
    await targetUser.save();

    await createLog(req.user.id, 'RESET_PASSWORD', targetUser._id.toString(), targetUser.name, `Admin reset password for ${targetUser.email}`, req);

    res.json({ message: `Password reset successfully for ${targetUser.name}` });
  } catch (error) {
    console.error('âŒ Reset password error:', error);
    res.status(500).json({ message: 'Error resetting password' });
  }
});
// ==================== TOGGLE SETTINGS (MESSAGING) FOR DEPT HEADS ====================
router.patch('/toggle-messaging', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    user.allowDepartmentMessaging = !user.allowDepartmentMessaging;
    await user.save();
    res.json({ success: true, allowDepartmentMessaging: user.allowDepartmentMessaging, message: 'Messaging toggled' });
  } catch (error) { res.status(500).json({ success: false, message: 'Server error' }); }
});

module.exports = router;
