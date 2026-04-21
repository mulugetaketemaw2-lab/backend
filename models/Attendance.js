const mongoose = require("mongoose");

const attendanceSchema = new mongoose.Schema({
    member: { 
        type: mongoose.Schema.Types.ObjectId, 
        required: true,
        refPath: 'onModel' 
    },
    onModel: { 
        type: String, 
        enum: ["Member", "User"], 
        default: "Member" 
    },
    date: { type: Date, default: Date.now },
    type: { type: String, enum: ["learning", "meeting"], required: true },
    status: { type: String, enum: ["present", "absent"], required: true },
    term: { type: String, required: true }
});

module.exports = mongoose.models.Attendance || mongoose.model("Attendance", attendanceSchema);