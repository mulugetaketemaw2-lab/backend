const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  member: { type: mongoose.Schema.Types.ObjectId, ref: 'Member', required: true },
  department: { 
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
    ],
    required: true
  },
  title: { type: String, required: true },
  message: { type: String, required: true },
  type: { 
    type: String, 
    enum: ['info', 'success', 'warning', 'error'],
    default: 'info'
  },
  read: { type: Boolean, default: false },
  readAt: Date,
  createdAt: { type: Date, default: Date.now }
}, {
  timestamps: true
});

// Index for faster queries
notificationSchema.index({ department: 1, read: 1 });
notificationSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);