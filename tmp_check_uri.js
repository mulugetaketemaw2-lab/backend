const uri = 'mongodb+srv://mulugetaketemaw2_db_user:pMcLXsSBIUP7PlCT@cluster0.v6u6gau.mongodb.net/?appName=Cluster0';
const parsed = new URL(uri);
console.log('parsed', parsed.toString());
if (!parsed.pathname || parsed.pathname === '/') parsed.pathname = '/gbiDB';
console.log('fixed', parsed.toString());
