const express = require('express');
const router = express.Router();
const Finance = require('../models/Finance');
const { authMiddleware, authorize } = require('../middleware/auth');
const { createLog } = require('./logs');
const { getCurrentECYear } = require('../utils/dateHelpers');

// ==================== REGISTER TRANSACTION ====================
router.post('/', authMiddleware, authorize('super_admin', 'admin', 'sebsabi', 'meketel_sebsabi', 'tsehafy', 'timhirt', 'abalat_guday', 'mezmur', 'bach', 'muya', 'lmat', 'kwanqwa', 'merja', 'hisab', 'audit'), async (req, res) => {
  try {
    const { type, amount, description, category, date, term } = req.body;

    if (!type || !amount || !description || !category || !term) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    const departmentsMap = {
      super_admin: "ዋና አስተዳዳሪ",
      admin: "አስተዳዳሪ",
      sebsabi: "ዋና ሰብሳቢ",
      meketel_sebsabi: "ምክትል ሰብሳቢ",
      tsehafy: "ዋና ጸሀፊ",
      timhirt: "ትምህርት ክፍል",
      abalat_guday: "አባላት ጉዳይ",
      mezmur: "መዝሙር ክፍል",
      bach: "ባች ክፍል",
      muya: "ሙያ ክፍል",
      lmat: "ልማት ክፍል",
      kwanqwa: "ቋንቋ ክፍል",
      merja: "መረጃ ክፍል",
      hisab: "ሂሳብ ክፍል",
      audit: "ኦዲት እና ቁጥጥር",
      sub_executive: "ንዑስ ተጠሪ"
    };
    
    const assignedDept = req.user.department || departmentsMap[req.user.role] || req.user.role;

    const isOffice = ['super_admin', 'admin', 'sebsabi', 'meketel_sebsabi', 'tsehafy'].includes(req.user.role);
    
    const transaction = new Finance({
      type,
      amount,
      description,
      category,
      date: date || Date.now(),
      term,
      recordedBy: req.user.id,
      recordedByName: req.user.name,
      department: assignedDept,
      departmentRole: req.user.role,
      status: isOffice ? 'approved' : 'pending' // Office roles approve automatically
    });

    await transaction.save();

    await createLog(req.user.id, 'FINANCE_TRANSACTION', transaction._id.toString(), req.user.name, `Recorded ${type}: ${amount} ETB - ${description} (Status: ${transaction.status})`, req);

    res.status(201).json({
      success: true,
      message: isOffice ? 'Transaction recorded successfully' : 'Transaction submitted for approval',
      data: transaction
    });
  } catch (error) {
    console.error('❌ Finance error:', error);
    res.status(500).json({ message: 'Error recording transaction' });
  }
});

// ==================== GET TRANSACTIONS (Filtered by Session/Term) ====================
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { term, type, category, status } = req.query;
    const { role, departmentAmharic } = req.user;
    
    // DEBUG LOGGING
    try {
      require('fs').appendFileSync('debug-finance.log', `[${new Date().toISOString()}] List Request: User=${req.user.name}, Role=${role}, Mode=${req.query.mode}, Status=${status}\n`);
    } catch (e) {}

    const query = {};
    if (term) query.term = term;
    if (type) query.type = type;
    if (category) query.category = category;

    // Restricted access: Department heads only see their own department's finances
    // Admins and Audit see everything
    const departmentsMap = {
      super_admin: "ዋና አስተዳዳሪ",
      admin: "አስተዳዳሪ",
      sebsabi: "ዋና ሰብሳቢ",
      meketel_sebsabi: "ምክትል ሰብሳቢ",
      tsehafy: "ዋና ጸሀፊ",
      timhirt: "ትምህርት ክፍል",
      abalat_guday: "አባላት ጉዳይ ክፍል",
      mezmur: "መዝሙር ክፍል",
      bach: "ባች ክፍል",
      muya: "ሙያ ክፍል",
      lmat: "ልማት ክፍል",
      kwanqwa: "ቋንቋ ክፍል",
      merja: "መረጃ ክፍል",
      hisab: "ሂሳብ ክፍል",
      audit: "ኦዲት እና ቁጥጥር",
      sub_executive: "ንዑስ ተጠሪ"
    };

    const isOffice = ['super_admin', 'admin', 'sebsabi', 'meketel_sebsabi', 'tsehafy'].includes(role);
    const isAuditOrFinance = ['audit', 'hisab'].includes(role);
    const mode = req.query.mode || 'standard';

    if (mode === 'approvals') {
      if (!isOffice) return res.status(403).json({ message: 'Unauthorized for approvals view' });
      query.status = 'pending';
      // No department restriction for approvals
    } else if (mode === 'central') {
      if (!isOffice && !isAuditOrFinance) return res.status(403).json({ message: 'Unauthorized for central view' });
      // Central mode for Finance/Audit sees everything across all departments
      // Optionally filter by status if provided, otherwise show all
      if (status) query.status = status;
    } else {
      // Standard Mode: ALWAYS restrict to own department even for Office users
      query.department = req.user.department || departmentsMap[role] || role;
      
      // In standard mode, users see their own records regardless of status
      // or approved records of their department (if they are just viewing)
      query.$or = [
        { status: 'approved' },
        { recordedBy: req.user.id },
        { department: query.department } // Redundant but safe
      ];
    }

    const transactions = await Finance.find(query).sort({ date: -1 });
    
    // DEBUG LOGGING
    try {
      const totalInDb = await Finance.countDocuments();
      require('fs').appendFileSync('debug-finance.log', `[${new Date().toISOString()}] Result: Found ${transactions.length} matches. Total in DB: ${totalInDb}. Query=${JSON.stringify(query)}\n`);
    } catch (e) {}

    res.json({ success: true, data: transactions });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching transactions' });
  }
});

// ==================== GET SUMMARY REPORTS ====================
router.get('/summary', authMiddleware, async (req, res) => {
  try {
    const { term } = req.query;
    const { role } = req.user;
    
    // DEBUG LOGGING
    try {
      require('fs').appendFileSync('debug-finance.log', `[${new Date().toISOString()}] Summary Request: User=${req.user.name}, Role=${role}, Mode=${req.query.mode}, Term=${term}\n`);
    } catch (e) {}

    const matchQuery = {};
    if (term) matchQuery.term = term;

    const departmentsMap = {
      super_admin: "ዋና አስተዳዳሪ",
      admin: "አስተዳዳሪ",
      sebsabi: "ዋና ሰብሳቢ",
      meketel_sebsabi: "ምክትል ሰብሳቢ",
      tsehafy: "ዋና ጸሀፊ",
      timhirt: "ትምህርት ክፍል",
      abalat_guday: "አባላት ጉዳይ",
      mezmur: "መዝሙር ክፍል",
      bach: "ባች ክፍል",
      muya: "ሙያ ክፍል",
      lmat: "ልማት ክፍል",
      kwanqwa: "ቋንቋ ክፍል",
      merja: "መረጃ ክፍል",
      hisab: "ሂሳብ ክፍል",
      audit: "ኦዲት እና ቁጥጥር",
      sub_executive: "ንዑስ ተጠሪ"
    };

    const isOffice = ['super_admin', 'admin', 'sebsabi', 'meketel_sebsabi', 'tsehafy'].includes(role);
    const isAuditOrFinance = ['audit', 'hisab'].includes(role);
    const mode = req.query.mode || 'standard';

    if (mode === 'approvals') {
      if (!isOffice) return res.status(403).json({ message: 'Unauthorized' });
      matchQuery.status = 'pending';
    } else if (mode === 'central') {
      if (!isOffice && !isAuditOrFinance) return res.status(403).json({ message: 'Unauthorized' });
      // No department or status restriction for central summary
    } else {
      // Standard mode
      matchQuery.department = req.user.department || departmentsMap[role] || role;
      matchQuery.status = 'approved';
    }

    const summary = await Finance.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: '$type',
          total: { $sum: '$amount' },
          count: { $sum: 1 }
        }
      }
    ]);

    // Period aggregations - Only relevant for current term or if no term specified
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay());

    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    // Start of Year based on Ethiopian Calendar (Meskerem 1st = Sept 11/12)
    const currentECYear = parseInt(getCurrentECYear());
    const startOfYear = today.getMonth() < 8 || (today.getMonth() === 8 && today.getDate() < 11) 
      ? new Date(today.getFullYear() - 1, 8, 11) 
      : new Date(today.getFullYear(), 8, 11);

    const periodStats = await Promise.all([
      // Daily
      Finance.aggregate([
        { $match: { ...matchQuery, date: { $gte: today } } },
        { $group: { _id: '$type', total: { $sum: '$amount' } } }
      ]),
      // Weekly
      Finance.aggregate([
        { $match: { ...matchQuery, date: { $gte: startOfWeek } } },
        { $group: { _id: '$type', total: { $sum: '$amount' } } }
      ]),
      // Monthly
      Finance.aggregate([
        { $match: { ...matchQuery, date: { $gte: startOfMonth } } },
        { $group: { _id: '$type', total: { $sum: '$amount' } } }
      ]),
      // Annual
      Finance.aggregate([
        { $match: { ...matchQuery, date: { $gte: startOfYear } } },
        { $group: { _id: '$type', total: { $sum: '$amount' } } }
      ]),
      // By Department
      Finance.aggregate([
        { $match: matchQuery },
        { 
          $group: { 
            _id: { department: '$department', type: '$type' }, 
            total: { $sum: '$amount' } 
          } 
        }
      ])
    ]);

    const formatResult = (arr) => {
      const result = { income: 0, expense: 0 };
      arr.forEach(item => {
        result[item._id] = item.total;
      });
      return result;
    };

    // Format By Department
    const byDepartmentMap = {};
    periodStats[4].forEach(item => {
      const dept = item._id.department || 'Unknown';
      const type = item._id.type;
      if (!byDepartmentMap[dept]) {
        byDepartmentMap[dept] = { department: dept, income: 0, expense: 0, balance: 0 };
      }
      byDepartmentMap[dept][type] = item.total;
    });
    
    // Calculate balance for each department
    const byDepartment = Object.values(byDepartmentMap).map(dept => {
      dept.balance = (dept.income || 0) - (dept.expense || 0);
      return dept;
    });

    res.json({
      success: true,
      data: {
        overall: formatResult(summary),
        daily: formatResult(periodStats[0]),
        weekly: formatResult(periodStats[1]),
        monthly: formatResult(periodStats[2]),
        annual: formatResult(periodStats[3]),
        byDepartment
      }
    });
  } catch (error) {
    console.error('❌ Summary error:', error);
    res.status(500).json({ 
      message: 'Error generating finance summary', 
      details: error.message 
    });
  }
});

// ==================== EDIT TRANSACTION ====================
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const transaction = await Finance.findById(req.params.id);
    if (!transaction) return res.status(404).json({ message: 'Transaction not found' });

    const isAdmin = ['super_admin', 'admin'].includes(req.user.role);
    const isOwner = transaction.recordedBy?.toString() === req.user.id;
    if (!isAdmin && !isOwner) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const { type, amount, description, category } = req.body;
    if (type) transaction.type = type;
    if (amount !== undefined) transaction.amount = amount;
    if (description) transaction.description = description;
    if (category) transaction.category = category;

    await transaction.save();
    await createLog(req.user.id, 'FINANCE_EDIT', transaction._id.toString(), req.user.name, `Edited ${transaction.type}: ${transaction.amount} ETB`, req);

    res.json({ success: true, message: 'Transaction updated', data: transaction });
  } catch (error) {
    console.error('Finance edit error:', error);
    res.status(500).json({ message: 'Error updating transaction' });
  }
});

// ==================== SUBMIT TO AUDIT ====================
router.put('/:id/submit-audit', authMiddleware, async (req, res) => {
  try {
    const transaction = await Finance.findById(req.params.id);
    if (!transaction) return res.status(404).json({ message: 'Transaction not found' });

    transaction.auditSubmitted = true;
    transaction.auditSubmittedAt = new Date();
    await transaction.save();

    await createLog(req.user.id, 'FINANCE_AUDIT_SUBMIT', transaction._id.toString(), req.user.name, `Submitted to audit: ${transaction.type} ${transaction.amount} ETB`, req);
    res.json({ success: true, message: 'Transaction submitted to audit' });
  } catch (error) {
    res.status(500).json({ message: 'Error submitting to audit' });
  }
});

// ==================== DELETE TRANSACTION (Admin only) ====================
router.delete('/:id', authMiddleware, authorize('super_admin', 'admin'), async (req, res) => {
  try {
    const transaction = await Finance.findByIdAndDelete(req.params.id);
    if (!transaction) return res.status(404).json({ message: 'Transaction not found' });
    
    await createLog(req.user.id, 'FINANCE_DELETE', transaction._id.toString(), req.user.name, `Deleted ${transaction.type}: ${transaction.amount} ETB`, req);
    
    res.json({ success: true, message: 'Transaction deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting transaction' });
  }
});

// ==================== APPROVE TRANSACTION (Office only) ====================
router.put('/:id/approve', authMiddleware, authorize('super_admin', 'admin', 'sebsabi', 'meketel_sebsabi', 'tsehafy'), async (req, res) => {
  try {
    const transaction = await Finance.findById(req.params.id);
    if (!transaction) return res.status(404).json({ message: 'Transaction not found' });

    if (transaction.status === 'approved') {
      return res.status(400).json({ message: 'Already approved' });
    }

    transaction.status = 'approved';
    transaction.approvedBy = req.user.id;
    transaction.approvedByName = req.user.name;
    transaction.approvedAt = new Date();
    await transaction.save();

    await createLog(req.user.id, 'FINANCE_APPROVE', transaction._id.toString(), req.user.name, `Approved ${transaction.type}: ${transaction.amount} ETB`, req);

    res.json({ success: true, message: 'Transaction approved successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error approving transaction' });
  }
});

// ==================== REJECT TRANSACTION (Office only) ====================
router.put('/:id/reject', authMiddleware, authorize('super_admin', 'admin', 'sebsabi', 'meketel_sebsabi', 'tsehafy'), async (req, res) => {
  try {
    const { reason } = req.body;
    const transaction = await Finance.findById(req.params.id);
    if (!transaction) return res.status(404).json({ message: 'Transaction not found' });

    transaction.status = 'rejected';
    transaction.rejectionReason = reason;
    await transaction.save();

    await createLog(req.user.id, 'FINANCE_REJECT', transaction._id.toString(), req.user.name, `Rejected ${transaction.type}: ${transaction.amount} ETB. Reason: ${reason}`, req);

    res.json({ success: true, message: 'Transaction rejected' });
  } catch (error) {
    res.status(500).json({ message: 'Error rejecting transaction' });
  }
});

// ==================== VERIFY TRANSACTION (Audit only) ====================
router.put('/:id/verify', authMiddleware, authorize('super_admin', 'admin', 'audit'), async (req, res) => {
  try {
    const transaction = await Finance.findById(req.params.id);
    if (!transaction) return res.status(404).json({ message: 'Transaction not found' });

    if (transaction.status !== 'approved') {
      return res.status(400).json({ message: 'Only approved transactions can be verified' });
    }

    transaction.isVerifiedByAudit = true;
    transaction.verifiedByAuditAt = new Date();
    transaction.verifiedByAuditName = req.user.name;
    transaction.verifiedByAuditId = req.user.id;
    await transaction.save();

    await createLog(req.user.id, 'FINANCE_VERIFY', transaction._id.toString(), req.user.name, `Verified ${transaction.type}: ${transaction.amount} ETB`, req);

    res.json({ success: true, message: 'Transaction verified by Audit' });
  } catch (error) {
    res.status(500).json({ message: 'Error verifying transaction' });
  }
});

// ==================== FLAG DISCREPANCY (Audit only) ====================
router.put('/:id/flag', authMiddleware, authorize('super_admin', 'admin', 'audit'), async (req, res) => {
  try {
    const { comment } = req.body;
    const transaction = await Finance.findById(req.params.id);
    if (!transaction) return res.status(404).json({ message: 'Transaction not found' });

    transaction.discrepancyFlag = true;
    transaction.auditComment = comment;
    await transaction.save();

    await createLog(req.user.id, 'FINANCE_FLAG', transaction._id.toString(), req.user.name, `Flagged discrepancy in ${transaction.type}: ${transaction.amount} ETB. Comment: ${comment}`, req);

    res.json({ success: true, message: 'Transaction flagged for discrepancy' });
  } catch (error) {
    res.status(500).json({ message: 'Error flagging transaction' });
  }
});

// ==================== BULK APPROVE TRANSACTIONS ====================
router.put('/bulk-approve', authMiddleware, authorize('super_admin', 'admin', 'sebsabi', 'meketel_sebsabi', 'tsehafy'), async (req, res) => {
  try {
    const { ids } = req.body;
    if (!ids || !Array.isArray(ids)) {
      return res.status(400).json({ message: 'Invalid IDs provided' });
    }

    const result = await Finance.updateMany(
      { _id: { $in: ids }, status: 'pending' },
      { 
        $set: { 
          status: 'approved',
          approvedBy: req.user.id,
          approvedByName: req.user.name,
          approvedAt: Date.now()
        } 
      }
    );

    await createLog(req.user.id, 'FINANCE_BULK_APPROVE', 'multiple', req.user.name, `Bulk approved ${result.modifiedCount} transactions`, req);

    res.json({ success: true, message: `Successfully approved ${result.modifiedCount} transactions` });
  } catch (error) {
    console.error('❌ Finance bulk error:', error);
    res.status(500).json({ message: 'Error processing bulk approval' });
  }
});

module.exports = router;
