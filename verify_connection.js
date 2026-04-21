require('dotenv').config();
const mongoose = require('mongoose');

const MONGO_URI = process.env.MONGO_URI;

console.log("🔌 Testing connection to:", MONGO_URI.replace(/:([^:@]+)@/, ':****@'));

async function verify() {
  try {
    await mongoose.connect(MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 10000,
    });
    console.log("✅ SUCCESS: MongoDB connected successfully!");
    console.log("📊 Database Name:", mongoose.connection.name);
    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error("❌ FAILURE: MongoDB connection failed!");
    console.error("Error:", err.message);
    process.exit(1);
  }
}

verify();
