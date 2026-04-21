const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { 
    type: String, 
    enum: [
      'super_admin',
      'admin',
      'sebsabi',           // ሰብሳቢ
      'meketel_sebsabi',    // ምክትል ሰብሳቢ
      'tsehafy',            // ጸሀፊ
      'timhirt',            // ትምህርት ክፍል
      'abalat_guday',       // አባላት ጉዳይ
      'mezmur',             // መዝሙር ክፍል
      'bach',               // ባች ክፍል
      'muya',               // ሙያ ክፍል
      'lmat',               // ልማት ክፍል
      'kwanqwa',            // ቋንቋ ክፍል
      'merja',              // መረጃ ክፍል
      'hisab',              // ሂሳብ ክፍል
      'audit',               // ኦዲት
      'sub_executive',       // ንኡስ ተጠሪ
      'member'              // መደበኛ አባል
    ],
    required: true 
  },
  department: { 
    type: String,
    enum: [
      'ሰብሳቢ',
      'ምክትል ሰብሳቢ',
      'ጸሀፊ',
      'ትምህርት ክፍል',
      'አባላት ጉዳይ',
      'መዝሙር ክፍል',
      'ባች ክፍል',
      'ሙያ ክፍል',
      'ልማት ክፍል',
      'ቋንቋ ክፍል',
      'መረጃ ክፍል',
      'ሂሳብ ክፍል',
      'ኦዲት',
      'አስተዳደር'
    ],
    required: true
  },
  departmentAmharic: { type: String },
  term: { type: String }, // e.g., "2024/25" or "2025"
  phone: String,
  region: String,
  zone: String,
  woreda: String,
  kebele: String,
  leaderName: String,
  permissions: {
    type: [String],
    default: []
  },
  level: {
    type: String,
    enum: ['super_admin', 'admin', 'executive', 'department', 'member'],
    default: function() {
      if (this.role === 'super_admin') return 'super_admin';
      if (this.role === 'admin') return 'admin';
      if (['sebsabi', 'meketel_sebsabi', 'tsehafy'].includes(this.role)) return 'executive';
      if (this.role === 'sub_executive') return 'department';
      if (this.role === 'member') return 'member';
      return 'department';
    }
  },
  isActive: { type: Boolean, default: true },
  isApproved: { type: Boolean, default: false },
  academicDepartment: { type: String }, // Field of study (e.g. Software Engineering)
  subRoleDescription: { type: String, default: '' },
  photo: { type: String }, // Base64 profile image
  allowDepartmentMessaging: { type: Boolean, default: false },
  memberId: { type: mongoose.Schema.Types.ObjectId, ref: 'Member' },
  createdAt: { type: Date, default: Date.now }
}, {
  timestamps: true
});

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

// Compare password method
userSchema.methods.comparePassword = async function(password) {
  return await bcrypt.compare(password, this.password);
};

module.exports = mongoose.models.User || mongoose.model('User', userSchema);