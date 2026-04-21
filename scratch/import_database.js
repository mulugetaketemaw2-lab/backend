const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const IMPORT_DIR = path.join(__dirname, '../import_data');
const MONGO_URI = process.env.MONGO_URI;

async function importDatabase() {
  if (!MONGO_URI) {
    console.error('❌ MONGO_URI not found in .env');
    process.exit(1);
  }

  try {
    console.log('🔌 Connecting to MongoDB Atlas...');
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected successfully.');

    const files = fs.readdirSync(IMPORT_DIR).filter(f => f.endsWith('.json'));

    if (files.length === 0) {
      console.log('📂 No JSON files found in import_data/ folder.');
      process.exit(0);
    }

    for (const file of files) {
      let collectionName = path.parse(file).name;
      
      // If filename is "dbName.collectionName", extract the collectionName
      if (collectionName.includes('.')) {
        const parts = collectionName.split('.');
        collectionName = parts[parts.length - 1];
      }

      const filePath = path.join(IMPORT_DIR, file);
      
      console.log(`\n📦 Processing collection: [${collectionName}]`);
      
      const rawData = fs.readFileSync(filePath, 'utf8');
      let jsonData;
      
      try {
        jsonData = JSON.parse(rawData);
      } catch (e) {
        console.error(`❌ Error parsing ${file}:`, e.message);
        continue;
      }

      // Ensure data is an array
      const dataArray = Array.isArray(jsonData) ? jsonData : [jsonData];

      if (dataArray.length === 0) {
        console.log(`⚠️  File ${file} is empty. Skipping.`);
        continue;
      }

      // Convert MongoDB Extended JSON types (especially for IDs and Dates)
      const cleanedData = dataArray.map(doc => {
        const cleaned = { ...doc };
        
        // Handle _id
        if (cleaned._id && cleaned._id.$oid) {
          cleaned._id = new mongoose.Types.ObjectId(cleaned._id.$oid);
        }

        // Recursively handle Dates ($date) and other OIDs
        function processNested(obj) {
          for (let key in obj) {
            if (obj[key] && typeof obj[key] === 'object') {
              if (obj[key].$date) {
                obj[key] = new Date(obj[key].$date);
              } else if (obj[key].$oid) {
                obj[key] = new mongoose.Types.ObjectId(obj[key].$oid);
              } else {
                processNested(obj[key]);
              }
            }
          }
        }
        processNested(cleaned);
        
        return cleaned;
      });

      console.log(`🗑️  Clearing existing data in [${collectionName}]...`);
      await mongoose.connection.collection(collectionName).deleteMany({});

      console.log(`📤 Importing ${cleanedData.length} documents...`);
      await mongoose.connection.collection(collectionName).insertMany(cleanedData);
      
      console.log(`✅ [${collectionName}] imported successfully.`);
    }

    console.log('\n✨ Database import completed!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Critical Error:', error);
    process.exit(1);
  }
}

importDatabase();
