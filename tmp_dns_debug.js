const dns = require('dns');

dns.resolveSrv('_mongodb._tcp.cluster0.v6u6gau.mongodb.net', (err, addresses) => {
  if (err) {
    console.error('DNS SRV Resolution failed:', err);
    return;
  }
  console.log('Resolved SRV addresses:', addresses);
  
  addresses.forEach(addr => {
      dns.resolve4(addr.name, (err, ips) => {
          if (err) {
              console.error(`Failed to resolve IP for ${addr.name}:`, err);
          } else {
              console.log(`IPs for ${addr.name}:`, ips);
          }
      });
  });
});
