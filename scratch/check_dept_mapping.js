const mongoose = require('mongoose');
const User = require('./models/User');
const Member = require('./models/Member');

const checkData = async () => {
  try {
    await mongoose.connect('mongodb://localhost:27017/gbi');
    console.log('Connected to MongoDB');

    const deptHeads = await User.find({ role: { $in: ['timhirt', 'mezmur', 'bach', 'muya', 'lmat', 'kwanqwa', 'abalat_guday'] } });
    console.log('\n--- Department Heads ---');
    deptHeads.forEach(u => {
      console.log(`Name: ${u.name}, Role: ${u.role}, DeptAmharic: "${u.departmentAmharic}"`);
    });

    const memberSample = await Member.find().limit(5);
    console.log('\n--- Member Sample ---');
    memberSample.forEach(m => {
      console.log(`Name: ${m.firstName}, StudentID: ${m.studentId}, ServiceDept: "${m.serviceDepartment}"`);
    });

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

checkData();
