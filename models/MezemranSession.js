const mongoose = require('mongoose');

const mezemranSessionSchema = new mongoose.Schema({
  title: { type: String, required: true },
  date: { type: Date, required: true, default: Date.now },
  category: { 
    type: String, 
    enum: ['መዘምራን 1 የወሰዱ', 'መዘምራን 2 ደርሰዋል'], 
    required: true 
  },
  attendance: [
    {
      mezemran: { type: mongoose.Schema.Types.ObjectId, ref: 'Mezemran', required: true },
      present: { type: Boolean, default: false }
    }
  ],
  term: { type: String, required: true },
  addedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, {
  timestamps: true
});

module.exports = mongoose.model('MezemranSession', mezemranSessionSchema);
