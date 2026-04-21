const mongoose = require('mongoose');
const User = require('./models/User');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const MONGO_URI = process.env.MONGO_URI || "mongodb+srv://mulugetaketemaw2_db_user:pMcLXsSBIUP7PlCT@cluster0.v6u6gau.mongodb.net/gbiDB?retryWrites=true&w=majority";

async function restoreSuperAdmin() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log("Connected to MongoDB");

    const username = 'mule1';
    const password = '1234';
    const role = 'super_admin';

    let user = await User.findOne({ email: username });

    if (user) {
      console.log(`User ${username} already exists. Updating to Super Admin...`);
      user.role = role;
      user.password = password; // Pre-save hook hashes it
      user.isActive = true;
      user.isApproved = true;
      await user.save();
    } else {
      console.log(`Creating new Super Admin: ${username}`);
      user = new User({
        name: 'Mulugeta Ketemaw (Super Admin)',
        email: username,
        password: password,
        role: role,
        isActive: true,
        isApproved: true,
        department: 'አስተዳደር',
        phone: '+251915942488',
        term: '2017' // Default term or current
      });
      await user.save();
    }

    console.log("✅ Super Admin account restored successfully!");
    console.log(`Username: ${username}`);
    console.log(`Password: ${password}`);
    console.log(`Role: ${role}`);
    
    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error("❌ Error restoring Super Admin:", error);
    process.exit(1);
  }
}

restoreSuperAdmin();
