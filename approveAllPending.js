/**
 * One-time script: Approve all pending members & generate Fellowship IDs
 * Run: node approveAllPending.js
 */
const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const Member = require('./models/Member');
const User = require('./models/User');

const MONGO_URI = process.env.MONGO_URI;

async function approveAllPending() {
  await mongoose.connect(MONGO_URI);
  console.log('✅ Connected to MongoDB');

  const pending = await Member.find({ isApproved: false });
  console.log(`📋 Found ${pending.length} pending members`);

  let approved = 0;
  for (const member of pending) {
    try {
      // Generate Fellowship ID
      const currentYear = member.term || new Date().getFullYear();
      const prefix = `GBI/${currentYear}/`;
      const lastMember = await Member.findOne({ fellowshipId: new RegExp(`^${prefix}`) })
        .sort({ fellowshipId: -1 });

      let nextSerial = 1;
      if (lastMember?.fellowshipId) {
        const parts = lastMember.fellowshipId.split('/');
        const lastSerial = parseInt(parts[parts.length - 1]);
        if (!isNaN(lastSerial)) nextSerial = lastSerial + 1;
      }

      member.isApproved = true;
      member.fellowshipId = `${prefix}${nextSerial.toString().padStart(3, '0')}`;
      await member.save();

      // Approve linked user account
      if (member.userId) {
        await User.findByIdAndUpdate(member.userId, {
          isApproved: true,
          departmentAmharic: member.serviceDepartment,
          department: member.serviceDepartment
        });
      }

      console.log(`✅ Approved: ${member.firstName} ${member.fatherName} → ${member.fellowshipId}`);
      approved++;
    } catch (err) {
      console.error(`❌ Failed for ${member.firstName}: ${err.message}`);
    }
  }

  console.log(`\n🎉 Done! ${approved}/${pending.length} members approved`);
  await mongoose.disconnect();
}

approveAllPending().catch(console.error);
