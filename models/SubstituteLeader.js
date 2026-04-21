const mongoose = require('mongoose');

const substituteLeaderSchema = new mongoose.Schema({
  name: { type: String, required: true },
  studentId: { type: String },
  phone: { type: String, required: true },
  department: { type: String },
  batch: { type: String },
  gender: { type: String },
  region: { type: String },
  zone: { type: String },
  woreda: { type: String },
  kebele: { type: String },
  position: { type: String }, // e.g., Department Leader, etc.
  category: {
    type: String,
    enum: ['ተተኪ አመራር 1 የወሰዱ', 'ተተኪ 2 የወሰዱ'],
    default: 'ተተኪ አመራር 1 የወሰዱ'
  },
  availability: { type: String },
  photo: { type: String },
  term: { type: String },
  active: { type: Boolean, default: true },
  addedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, {
  timestamps: true
});

module.exports = mongoose.models.SubstituteLeader || mongoose.model('SubstituteLeader', substituteLeaderSchema);
