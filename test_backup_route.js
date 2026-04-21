const http = require('http');

function testBackup() {
  console.log("Testing backup route accessibility...");
  const req = http.get('http://localhost:5001/api/settings/backup', (res) => {
    console.log(`Response status: ${res.statusCode}`);
    if (res.statusCode === 401) {
      console.log("✅ Backup route is protected (401 Unauthorized as expected).");
    } else if (res.statusCode === 404) {
      console.log("❌ Backup route not found (404).");
    }
  });

  req.on('error', (err) => {
    console.error("Error:", err.message);
  });
}

testBackup();
