
const dns = require('dns');
const net = require('net');

async function checkDns(host) {
    return new Promise((resolve) => {
        dns.lookup(host, (err, address, family) => {
            if (err) {
                console.log(`❌ DNS Lookup ${host}: FAILED (${err.message})`);
                resolve(null);
            } else {
                console.log(`✅ DNS Lookup ${host}: SUCCESS (${address})`);
                resolve(address);
            }
        });
    });
}

async function checkPort(host, port = 27017) {
    return new Promise((resolve) => {
        const socket = new net.Socket();
        socket.setTimeout(3000);
        socket.on('connect', () => {
            console.log(`✅ Port ${port} on ${host}: OPEN`);
            socket.destroy();
            resolve(true);
        });
        socket.on('error', (err) => {
            console.log(`❌ Port ${port} on ${host}: CLOSED (${err.message})`);
            socket.destroy();
            resolve(false);
        });
        socket.on('timeout', () => {
            console.log(`❌ Port ${port} on ${host}: TIMEOUT`);
            socket.destroy();
            resolve(false);
        });
        socket.connect(port, host);
    });
}

async function run() {
    console.log('--- Network Connectivity Check ---');
    
    // Test a common site for internet check
    await checkDns('google.com');

    const shards = [
        'ac-djrujng-shard-00-00.v6u6gau.mongodb.net',
        'ac-djrujng-shard-00-01.v6u6gau.mongodb.net',
        'ac-djrujng-shard-00-02.v6u6gau.mongodb.net'
    ];

    for (const host of shards) {
        const ip = await checkDns(host);
        if (ip) {
            await checkPort(host);
        }
    }
}

run();
