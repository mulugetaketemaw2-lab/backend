const mongoose = require('mongoose');

mongoose.connect('mongodb://localhost:27017/gbiDB').then(async () => {
  try {
    const members = await mongoose.connection.collection('members').find({}, { 
      projection: { firstName: 1, fatherName: 1, studentId: 1, username: 1, isApproved: 1, active: 1 }
    }).toArray();
    
    console.log('=== ALL MEMBERS ===');
    members.forEach(m => {
      console.log(`  ${m.firstName} ${m.fatherName} | StudentID: ${m.studentId} | Username: ${m.username} | Approved: ${m.isApproved} | Active: ${m.active}`);
    });
    console.log(`\nTotal: ${members.length} members`);

    const users = await mongoose.connection.collection('users').find({}, {
      projection: { name: 1, email: 1, role: 1, isApproved: 1, isActive: 1 }
    }).toArray();

    console.log('\n=== ALL USERS ===');
    users.forEach(u => {
      console.log(`  ${u.name} | Email/Username: ${u.email} | Role: ${u.role} | Approved: ${u.isApproved} | Active: ${u.isActive}`);
    });
    console.log(`\nTotal: ${users.length} users`);
  } catch (e) {
    console.error('Error:', e);
  }
  process.exit(0);
});
