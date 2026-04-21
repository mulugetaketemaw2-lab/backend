const mongoose = require('mongoose');

const settingsSchema = new mongoose.Schema({
  currentTerm: { 
    type: String, 
    required: true,
    default: "2024/25" 
  },
  lastTermTransition: {
    type: Date,
    default: Date.now
  },
  systemInitialized: {
    type: Boolean,
    default: false
  },
  allowMemberMessaging: {
    type: Boolean,
    default: false
  },
  allowExecutiveMessaging: {
    type: Boolean,
    default: true
  },
  registrationNotice: {
    type: String,
    default: ""
  }
}, {
  timestamps: true
});

module.exports = mongoose.models.Settings || mongoose.model('Settings', settingsSchema);
