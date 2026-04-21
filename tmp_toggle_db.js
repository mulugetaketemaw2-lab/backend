const mongoose = require('mongoose');
const User = require('./models/User');
require('dotenv').config();

mongoose.connect(process.env.MONGODB_URI)
  .then(async () => {
    try {
      // Find a suspended executive
      const users = await User.find({ isActive: false });
      if (users.length === 0) {
        console.log('No suspended users');
        process.exit(0);
      }
      const user = users[0];
      console.log('Found user:', user.name, 'Role:', user.role);

      // Try findByIdAndUpdate first
      console.log('--- Testing findByIdAndUpdate ---');
      try {
        const updateRes = await User.findByIdAndUpdate(user._id, { isActive: true }, { runValidators: false, new: true });
        console.log('findByIdAndUpdate successful:', updateRes.isActive);
      } catch (err1) {
        console.error('findByIdAndUpdate failed:', err1.message);
      }

    } catch (e) {
      console.error('Main error:', e.message);
    }
    process.exit(0);
  })
  .catch(err => {
    console.error("DB Connect error:", err);
    process.exit(1);
  });
