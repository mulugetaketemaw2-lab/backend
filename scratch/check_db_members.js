const mongoose = require('mongoose');
const Member = require('../models/Member');
require('dotenv').config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/gbi';

async function checkMembers() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB');

    const count = await Member.countDocuments();
    console.log(`Total members: ${count}`);

    const sample = await Member.find().limit(5).select('firstName studentId term isApproved serviceDepartment');
    console.log('Sample members:', JSON.stringify(sample, null, 2));

    const User = require('../models/User');
    const user = await User.findOne({ name: /Andarge/i });
    console.log('Current user detected:', JSON.stringify(user, null, 2));

    const terms = await Member.distinct('term');
    console.log('Distinct terms in DB:', terms);

    await mongoose.disconnect();
  } catch (err) {
    console.error('Error:', err);
  }
}

checkMembers();
