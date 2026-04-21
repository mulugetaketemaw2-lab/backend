const mongoose = require('mongoose');
const path = require('path');
const https = require('https');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const MONGO_URI = process.env.MONGO_URI || "mongodb+srv://mulugetaketemaw2_db_user:pMcLXsSBIUP7PlCT@ac-djrujng.v6u6gau.mongodb.net/gbiDB?retryWrites=true&w=majority";

async function getPublicIP() {
  return new Promise((resolve) => {
    https.get('https://api.ipify.org?format=json', (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data).ip);
        } catch (e) {
          resolve('Unknown');
        }
      });
    }).on('error', () => resolve('Error fetching IP'));
  });
}

async function diagnose() {
  const ip = await getPublicIP();
  console.log(`🔍 Current Public IP: ${ip}`);
  console.log(`🔌 Attempting to connect to: ${MONGO_URI.replace(/:([^@]+)@/, ':****@')}`);
  
  try {
    const start = Date.now();
    await mongoose.connect(MONGO_URI, {
      serverSelectionTimeoutMS: 5000,
    });
    console.log(`✅ Connection successful in ${Date.now() - start}ms`);
    await mongoose.connection.close();
  } catch (err) {
    console.error(`❌ Connection failed: ${err.message}`);
    if (err.message.includes('Could not connect to any servers') || err.message.includes('MongooseServerSelectionError')) {
      console.log('\nPossible causes:');
      console.log('1. IP Address not whitelisted on MongoDB Atlas.');
      console.log('2. Network firewall/proxy blocking port 27017.');
      console.log('3. MongoDB Atlas cluster is paused or down.');
      console.log(`\nAction: Please ensure IP ${ip} is whitelisted in your MongoDB Atlas Network Access settings.`);
    }
  }
}

diagnose();
