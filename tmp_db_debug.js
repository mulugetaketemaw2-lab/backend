
const mongoose = require('mongoose');
require('dotenv').config();

const uri = "mongodb+srv://mulugetaketemaw2_db_user:pMcLXsSBIUP7PlCT@ac-djrujng.v6u6gau.mongodb.net/gbiDB?retryWrites=true&w=majority";
console.log('Testing SRV connection to cluster ac-djrujng...');

mongoose.connect(uri, {
  serverSelectionTimeoutMS: 15000,
  connectTimeoutMS: 15000,
  family: 4, // Force IPv4
})
.then(() => {
  console.log('✅ Connected successfully!');
  process.exit(0);
})
.catch(err => {
  console.error('❌ Connection failed:');
  console.error(err.message);
  if (err.reason) {
     console.error('Reason:', JSON.stringify(err.reason, null, 2));
  }
  process.exit(1);
});
