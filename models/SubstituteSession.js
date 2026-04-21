const mongoose = require('mongoose');

const substituteSessionSchema = new mongoose.Schema({
  title: { type: String, required: true },
  date: { type: Date, required: true, default: Date.now },
  category: { 
    type: String, 
    enum: ['ተተኪ 1 የወሰዱ', 'ተተኪ 2'], 
    required: true 
  },
  attendance: [
    {
      teacher: { type: mongoose.Schema.Types.ObjectId, ref: 'SubstituteTeacher', required: true },
      present: { type: Boolean, default: false }
    }
  ],
  term: { type: String, required: true },
  addedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, {
  timestamps: true
});

module.exports = mongoose.model('SubstituteSession', substituteSessionSchema);
