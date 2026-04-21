const http = require('http');
const req = http.get({ host:'localhost', port:5000, path:'/api/health', timeout:5000 }, res => {
  console.log('status', res.statusCode);
  res.on('data', d => process.stdout.write(d));
});
req.on('error', e => console.error('err', e.message));
req.on('timeout', () => { console.error('timeout'); req.destroy(); });
