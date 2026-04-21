const mongoose = require('mongoose');

const memberSchema = new mongoose.Schema({
  // Personal Information
  firstName: { type: String, required: true },
  fatherName: { type: String, required: true },
  grandFatherName: { type: String, required: true },
  christianName: { type: String }, // New Field
  spiritualFather: { type: String }, // Ye niseha abat
  isSundaySchoolServed: { type: String, enum: ['አገለግላለሁ', 'አላገለግልም', 'አላገለገልኩም', 'አገልግያለሁ'], default: 'አላገለግልም' }, // New Field
  fellowshipId: { type: String, unique: true, sparse: true }, // GBI/2026/001

  // University Information
  studentId: { type: String, required: true, unique: true },
  university: { type: String, default: 'Wollo University' },
  department: { type: String, required: true },
  batch: { type: String, required: true }, // Remedial, Fresh, 1st Year, etc.
  semester: { type: Number, min: 1, max: 2 },
  term: { type: String, required: true }, // e.g., "2025" or "2024/25"
  gender: { type: String, required: true }, // Male/Female
  ordination: { type: String, enum: ['ቅስና', 'ድቁና', 'የለም'], default: 'የለም' }, // priesthood
  serviceDepartment: { type: String, required: true }, // Fellowship branch

  // Origin Information
  region: { type: String, required: true },
  zone: { type: String, required: true },
  woreda: { type: String, required: true },
  kebele: { type: String, required: true },

  // Contact
  phone: { type: String, required: true },
  email: String,
  username: { type: String, required: true, unique: true },

  // Fellowship Information - Assigned to both departments
  assignedDepartments: [{
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
      'ኦዲት'
    ]
  }],

  // Record keeping
  addedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  addedAt: { type: Date, default: Date.now },

  // Status
  active: { type: Boolean, default: true },

  // Notifications
  notifiedDepartments: [{
    department: String,
    notifiedAt: Date,
    read: { type: Boolean, default: false }
  }],

  // Approval Flow
  isApproved: { type: Boolean, default: false },
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  photo: String, // Base64 or URL for 3/4 photo
  
  // Begena Abalat (Twice a year registration)
  isBegena: { type: Boolean, default: false },
  begenaCycle: { type: Number, enum: [1, 2] }
}, {
  timestamps: true
});

// Index for faster queries
memberSchema.index({ assignedDepartments: 1 });
memberSchema.index({ studentId: 1 });
memberSchema.index({ addedAt: -1 });

module.exports = mongoose.models.Member || mongoose.model('Member', memberSchema);