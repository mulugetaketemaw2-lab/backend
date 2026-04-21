const mongoose = require('mongoose');

const deaconSchema = new mongoose.Schema({
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
  studyField: { 
    type: String, 
    enum: ['ቁጥር', 'ቅዳሴ', 'ዳዊት', 'ዜማ', 'ሰአታት', 'መዝገብ', 'ቅኔ', 'ሌላ'],
    required: true 
  },
  studyFieldOther: { type: String },
  deaconshipStatus: { 
    type: String, 
    enum: ['የተቀበሉ', 'የሚቀበሉ', 'ያልተቀበሉ'],
    required: true,
    default: 'ያልተቀበሉ'
  },
  photo: { type: String },
  term: { type: String },
  active: { type: Boolean, default: true },
  addedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, {
  timestamps: true
});

module.exports = mongoose.models.Deacon || mongoose.model('Deacon', deaconSchema);
