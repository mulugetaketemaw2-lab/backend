const mongoose = require('mongoose');

const attendanceRecordSchema = new mongoose.Schema({
  meetingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Meeting', required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  status: { 
    type: String, 
    enum: ['Present', 'Absent', 'Late', 'Excused'], 
    default: 'Present' 
  },
  arrivalTime: { type: String },
  notes: { type: String },
  term: { type: String, required: true }
}, {
  timestamps: true
});

// Index to prevent duplicate attendance for same user in same meeting
attendanceRecordSchema.index({ meetingId: 1, userId: 1 }, { unique: true });

module.exports = mongoose.model('AttendanceRecord', attendanceRecordSchema);
