const mongoose = require('mongoose');

const meetingSchema = new mongoose.Schema({
  title: { type: String, required: true },
  agenda: { type: String, required: true },
  date: { type: Date, required: true },
  time: { type: String, required: true },
  location: { type: String, default: 'WU Campus' },
  type: { 
    type: String, 
    enum: ['executive', 'general', 'department'], 
    default: 'executive' 
  },
  department: { type: String }, // Optional, if type is department
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  status: { 
    type: String, 
    enum: ['scheduled', 'completed', 'cancelled'], 
    default: 'scheduled' 
  },
  notes: { type: String },
  attendees: [
    {
      member: { type: mongoose.Schema.Types.ObjectId, ref: 'Member' },
      present: { type: Boolean, default: false }
    }
  ]
}, {
  timestamps: true
});

module.exports = mongoose.model('Meeting', meetingSchema);