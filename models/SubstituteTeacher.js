const mongoose = require('mongoose');

const substituteTeacherSchema = new mongoose.Schema({
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
  subject: { type: String },
  category: {
    type: String,
    enum: ['ተተኪ 1 የወሰዱ', 'ተተኪ 2'],
    default: 'ተተኪ 1 የወሰዱ'
  },
  availability: { type: String },
  photo: { type: String },
  term: { type: String },
  active: { type: Boolean, default: true },
  addedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, {
  timestamps: true
});

module.exports = mongoose.models.SubstituteTeacher || mongoose.model('SubstituteTeacher', substituteTeacherSchema);
