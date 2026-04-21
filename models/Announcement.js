const mongoose = require('mongoose');

const announcementSchema = new mongoose.Schema({
  sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  senderName: { type: String, required: true },
  senderRole: { type: String, required: true },
  senderDepartmentAmharic: { type: String },
  title: { type: String, required: true },
  message: { type: String, required: false }, // Optional if there are attachments
  targetGroup: { 
    type: String, 
    enum: ['member', 'executive'], 
    required: true 
  },
  attachments: [{
    type: { type: String, enum: ['photo', 'pdf'] },
    data: String, // Base64 or URL
    fileName: String
  }],
  isActive: { type: Boolean, default: true },
  displayDate: { type: Date, default: Date.now },
  readBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  createdAt: { type: Date, default: Date.now }
}, {
  timestamps: true
});

announcementSchema.index({ targetGroup: 1, createdAt: -1 });

module.exports = mongoose.model('Announcement', announcementSchema);
