const { MongoMemoryServer } = require('mongodb-memory-server');

async function test() {
  console.log("Starting test...");
  try {
    const mongoServer = await MongoMemoryServer.create({
      binary: {
        version: '6.0.12', // Let's try to specify a version
      }
    });
    console.log("Memory Server URI:", mongoServer.getUri());
    await mongoServer.stop();
    console.log("Test successful!");
  } catch (err) {
    console.error("Test failed:", err);
  }
}

test();
