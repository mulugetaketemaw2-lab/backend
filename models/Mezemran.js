const mongoose = require('mongoose');

const mezemranSchema = new mongoose.Schema({
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
  role: { type: String }, // specific choir role e.g., Soprano, Alto, Begena etc.
  category: {
    type: String,
    enum: ['መዘምራን 1 የወሰዱ', 'መዘምራን 2 ደርሰዋል'],
    default: 'መዘምራን 1 የወሰዱ'
  },
  availability: { type: String },
  term: { type: String },
  active: { type: Boolean, default: true },
  addedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, {
  timestamps: true
});

module.exports = mongoose.models.Mezemran || mongoose.model('Mezemran', mezemranSchema);
