const mongoose = require('mongoose');

mongoose.connect('mongodb://localhost:27017/gbiDB').then(async () => {
  try {
    // Check all distinct values for isSundaySchoolServed
    const distinctValues = await mongoose.connection.collection('members').distinct('isSundaySchoolServed');
    console.log('=== Distinct isSundaySchoolServed values in DB ===');
    console.log(distinctValues);

    // Count records with each value
    for (const val of distinctValues) {
      const count = await mongoose.connection.collection('members').countDocuments({ isSundaySchoolServed: val });
      console.log(`  "${val}" => ${count} records`);
    }

    // Count records with null/undefined
    const nullCount = await mongoose.connection.collection('members').countDocuments({ isSundaySchoolServed: { $in: [null, ''] } });
    console.log(`  null/empty => ${nullCount} records`);

    console.log('\n✅ Check complete. No changes made.');
  } catch (e) {
    console.error('Error:', e);
  }
  process.exit(0);
});
