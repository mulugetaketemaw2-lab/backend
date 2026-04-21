// reset-passwords.js
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./models/User');
require('dotenv').config();

async function resetPasswords() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');
    console.log('📊 Database:', mongoose.connection.name);

    // Define users with correct passwords
    const users = [
      { email: 'admin@gbi.com', password: 'admin123', name: 'Admin User', role: 'admin' },
      { email: 'sebsabi@gbi.com', password: 'sebsabi123', name: 'ሰብሳቢ', role: 'sebsabi' },
      { email: 'meketel@gbi.com', password: 'meketel123', name: 'ምክትል ሰብሳቢ', role: 'meketel_sebsabi' },
      { email: 'tsehafy@gbi.com', password: 'tsehafy123', name: 'ጸሀፊ', role: 'tsehafy' },
      { email: 'timhirt@gbi.com', password: 'timhirt123', name: 'ትምህርት ክፍል', role: 'timhirt' }
    ];

    for (const userData of users) {
      // Hash the password
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(userData.password, salt);
      
      // Update or create user
      const user = await User.findOneAndUpdate(
        { email: userData.email },
        {
          $set: {
            password: hashedPassword,
            name: userData.name,
            role: userData.role
          }
        },
        { upsert: true, new: true }
      );

      // Verify the password works
      const isMatch = await bcrypt.compare(userData.password, user.password);
      console.log(`\n📧 ${userData.email}:`);
      console.log(`   Password set to: ${userData.password}`);
      console.log(`   Verification: ${isMatch ? '✅ CORRECT' : '❌ FAILED'}`);
    }

    // List all users to confirm
    const allUsers = await User.find().select('email role');
    console.log('\n📋 All users in database:');
    allUsers.forEach(u => console.log(`   - ${u.email} (${u.role})`));

    await mongoose.connection.close();
    console.log('\n✅ Password reset complete!');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

resetPasswords();