const mongoose = require('mongoose');

const leaderSessionSchema = new mongoose.Schema({
  title: { type: String, required: true },
  date: { type: Date, default: Date.now },
  category: { 
    type: String, 
    enum: ['ተተኪ አመራር 1 የወሰዱ', 'ተተኪ 2 የወሰዱ'],
    required: true 
  },
  attendance: [{
    leader: { type: mongoose.Schema.Types.ObjectId, ref: 'SubstituteLeader' },
    present: { type: Boolean, default: false }
  }],
  term: { type: String, required: true }, // Academic year
  addedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, {
  timestamps: true
});

module.exports = mongoose.models.LeaderSession || mongoose.model('LeaderSession', leaderSessionSchema);
