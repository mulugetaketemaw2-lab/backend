
const dns = require('dns');

const hosts = [
  'ac-djrujng-shard-00-00.v6u6gau.mongodb.net',
  'ac-djrujng-shard-00-01.v6u6gau.mongodb.net',
  'ac-djrujng-shard-00-02.v6u6gau.mongodb.net'
];

async function checkDns(host) {
    return new Promise((resolve) => {
        dns.resolve4(host, (err, addresses) => {
            if (err) {
                console.log(`❌ ${host}: FAILED (${err.message})`);
                resolve(false);
            } else {
                console.log(`✅ ${host}: SUCCESS (${addresses[0]})`);
                resolve(true);
            }
        });
    });
}

async function run() {
    console.log('--- Checking DNS ---');
    for (const host of hosts) {
        await checkDns(host);
    }
}

run();
