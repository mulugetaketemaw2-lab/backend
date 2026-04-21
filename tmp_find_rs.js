const mongoose = require('mongoose');

const uri = "mongodb://mulugetaketemaw2_db_user:pMcLXsSBIUP7PlCT@ac-djrujng-shard-00-00.v6u6gau.mongodb.net:27017/gbiDB?ssl=true&authSource=admin";

async function check() {
    try {
        console.log("Connecting to a single node to find replicaSet name...");
        await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
        const isMaster = await mongoose.connection.db.admin().command({ isMaster: 1 });
        console.log("FULL_RS_NAME:" + isMaster.setName + ":END_RS_NAME");
        await mongoose.disconnect();
    } catch (err) {
        console.error("Connection failed:", err.message);
    }
}

check();
