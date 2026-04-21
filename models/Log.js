const mongoose = require('mongoose');

const logSchema = new mongoose.Schema({
  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User',
    required: true 
  },
  userName: { type: String },
  action: { 
    type: String, 
    required: true,
    enum: ['LOGIN', 'LOGOUT', 'CREATE_USER', 'UPDATE_USER', 'DELETE_USER', 'SUSPEND_USER', 'ACTIVATE_USER', 'UPDATE_SETTINGS', 'YEARLY_TRANSITION']
  },
  targetId: { type: String }, // ID of the user or entity being acted upon
  targetName: { type: String },
  details: { type: String },
  ipAddress: { type: String },
  timestamp: { type: Date, default: Date.now }
}, {
  timestamps: true
});

module.exports = mongoose.model('Log', logSchema);
