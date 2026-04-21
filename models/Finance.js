const mongoose = require('mongoose');

const financeSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['income', 'expense'],
    required: true
  },
  amount: {
    type: Number,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  category: {
    type: String,
    required: true,
    enum: ['Member Contribution', 'Donation', 'Project', 'Administrative', 'Staff Salary', 'Events', 'Other']
  },
  department: {
    type: String,
    default: 'ልማት ክፍል'
  },
  departmentRole: {
    type: String,
    default: 'lmat'
  },
  date: {
    type: Date,
    default: Date.now
  },
  recordedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  recordedByName: {
    type: String
  },
  term: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  approvedByName: {
    type: String
  },
  approvedAt: {
    type: Date
  },
  rejectionReason: {
    type: String
  },
  isVerifiedByAudit: {
    type: Boolean,
    default: false
  },
  verifiedByAuditAt: {
    type: Date
  },
  verifiedByAuditName: {
    type: String
  },
  verifiedByAuditId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  discrepancyFlag: {
    type: Boolean,
    default: false
  },
  auditComment: {
    type: String
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Finance', financeSchema);
