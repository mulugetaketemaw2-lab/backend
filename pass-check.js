const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const User = require('./models/User');

const MONGO_URI = process.env.MONGO_URI || "mongodb+srv://mulugetaketemaw2_db_user:pMcLXsSBIUP7PlCT@ac-djrujng.v6u6gau.mongodb.net/gbiDB?retryWrites=true&w=majority";

const checkPassword = async (email, plainPassword) => {
  try {
    await mongoose.connect(MONGO_URI);
    console.log("Connected to DB");
    
    const user = await User.findOne({ email });
    if (!user) {
      console.log(`User ${email} not found`);
      return;
    }
    
    console.log(`User found: ${user.email}, Role: ${user.role}`);
    console.log(`Hashed password in DB: ${user.password}`);
    
    const isMatch = await bcrypt.compare(plainPassword, user.password);
    console.log(`Password match for '${plainPassword}': ${isMatch}`);
    
    await mongoose.connection.close();
  } catch (err) {
    console.error("Error:", err);
  }
};

const email = process.argv[2] || 'mule';
const pass = process.argv[3] || '1234';

checkPassword(email, pass);
