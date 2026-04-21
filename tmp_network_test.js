
const dns = require('dns');
const net = require('net');

const host = 'ac-djrujng.v6u6gau.mongodb.net';
const legacyHost = 'ac-djrujng-shard-00-00.v6u6gau.mongodb.net';

console.log('--- DNS Check ---');
dns.resolve4(host, (err, addresses) => {
  if (err) {
    console.log(`❌ DNS Resolve (SRV) failed: ${err.message}`);
    // Try legacy
    dns.resolve4(legacyHost, (err2, addresses2) => {
        if (err2) console.log(`❌ DNS Resolve (Legacy) failed: ${err2.message}`);
        else console.log(`✅ DNS Resolve (Legacy) success: ${addresses2[0]}`);
    });
  } else {
    console.log(`✅ DNS Resolve (SRV) success: ${addresses[0]}`);
  }
});

console.log('\n--- Port Check (27017) ---');
const client = new net.Socket();
client.setTimeout(5000);

client.connect(27017, legacyHost, () => {
  console.log('✅ Port 27017 is OPEN on the legacy shard!');
  client.destroy();
});

client.on('error', (err) => {
  console.log(`❌ Port 27017 is CLOSED: ${err.message}`);
});

client.on('timeout', () => {
  console.log('❌ Port 27017 check TIMED OUT');
  client.destroy();
});
