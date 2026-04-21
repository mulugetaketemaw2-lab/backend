const mongoose = require('mongoose');
const User = require('./models/User');
require('dotenv').config({ path: './.env' });

// We need the MONGO_URI from server.js
const MONGO_URI = process.env.MONGO_URI || "mongodb+srv://mulugetaketemaw2_db_user:pMcLXsSBIUP7PlCT@ac-djrujng.v6u6gau.mongodb.net/gbiDB?retryWrites=true&w=majority";

mongoose.connect(MONGO_URI)
  .then(async () => {
    try {
      // Find all suspended users
      const suspendedUsers = await User.find({ isActive: false });
      console.log(`Found ${suspendedUsers.length} suspended users.`);
      
      for (const user of suspendedUsers) {
        console.log(`Activating ${user.name} (${user.role})...`);
        await User.findByIdAndUpdate(user._id, { isActive: true }, { runValidators: false });
        console.log(`✅ Activated ${user.name}`);
      }

      console.log('All done!');
    } catch (e) {
      console.error('Main error:', e.message);
    }
    process.exit(0);
  })
  .catch(err => {
    console.error("DB Connect error:", err);
    process.exit(1);
  });
