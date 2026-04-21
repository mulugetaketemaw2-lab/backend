const mongoose = require('mongoose');

mongoose.connect('mongodb://localhost:27017/gbiDB').then(async () => {
    try {
        console.log("Connected to DB, running updates...");
        const dRes = await mongoose.connection.collection('deacons').updateMany({ active: { $exists: false } }, { $set: { active: true } });
        console.log("Deacons updated:", dRes.modifiedCount);
        
        const mRes = await mongoose.connection.collection('mezemrans').updateMany({ active: { $exists: false } }, { $set: { active: true } });
        console.log("Mezemrans updated:", mRes.modifiedCount);
        
        const tRes = await mongoose.connection.collection('substituteteachers').updateMany({ active: { $exists: false } }, { $set: { active: true } });
        console.log("Substitute Teachers updated:", tRes.modifiedCount);
        
        const lRes = await mongoose.connection.collection('substituteleaders').updateMany({ active: { $exists: false } }, { $set: { active: true } });
        console.log("Substitute Leaders updated:", lRes.modifiedCount);
        
        console.log('Database seeded successfully.');
    } catch (err) {
        console.error("Error seeding DB:", err);
    } finally {
        process.exit(0);
    }
});
