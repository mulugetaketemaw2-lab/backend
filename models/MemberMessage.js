const mongoose = require('mongoose');

const memberMessageSchema = new mongoose.Schema({
  sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  senderName: { type: String, required: true },
  senderRole: { type: String, required: true },
  senderDepartment: { type: String },
  recipientType: { 
    type: String, 
    enum: ['leadership', 'department', 'individual'], 
    required: true 
  },
  targetDepartment: { type: String }, // Required if recipientType is 'department'
  recipientUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // Required if recipientType is 'individual'
  recipientRole: { type: String, enum: ['member', 'executive'] }, // Optional categorization for sent messages
  title: { type: String, required: true },
  content: { type: String },
  attachments: [{
    type: { type: String, enum: ['photo', 'pdf'] },
    data: String,
    fileName: String
  }],
  isRead: { type: Boolean, default: false },
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now }
}, {
  timestamps: true
});

module.exports = mongoose.model('MemberMessage', memberMessageSchema);
