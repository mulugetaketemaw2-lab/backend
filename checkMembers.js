const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const Member = require('./models/Member');

async function check() {
  await mongoose.connect(process.env.MONGO_URI);
  const total = await Member.countDocuments();
  const approved = await Member.countDocuments({ isApproved: true });
  const pending = await Member.countDocuments({ isApproved: false });
  const sample = await Member.find().select('firstName fatherName isApproved serviceDepartment term fellowshipId').limit(10);
  
  console.log(`\n📊 Total: ${total} | Approved: ${approved} | Pending: ${pending}\n`);
  sample.forEach(m => {
    console.log(`  ${m.isApproved ? '✅' : '⏳'} ${m.firstName} ${m.fatherName} | Dept: ${m.serviceDepartment} | Term: ${m.term} | ID: ${m.fellowshipId || 'N/A'}`);
  });
  await mongoose.disconnect();
}
check().catch(console.error);
