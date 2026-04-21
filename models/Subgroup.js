const mongoose = require("mongoose");

const subgroupSchema = new mongoose.Schema({
    name: String,
    department: String,
    leader: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    members: [{ type: mongoose.Schema.Types.ObjectId, ref: "Member" }]
});

module.exports = mongoose.models.Subgroup || mongoose.model("Subgroup", subgroupSchema);