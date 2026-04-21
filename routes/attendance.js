const express = require("express");
const Attendance = require("../models/Attendance");
const Member = require("../models/Member");
const { authMiddleware } = require("../middleware/auth");

const router = express.Router();


// Get attendance for a date and term
router.get("/:date", authMiddleware, async (req, res) => {
    try {
        const { term } = req.query;
        const date = new Date(req.params.date);
        const query = { date };
        if (term) query.term = term;
        
        const attendances = await Attendance.find(query).populate("member");
        res.json(attendances);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Mark attendance
router.post("/", authMiddleware, async (req, res) => {
    const { memberId, date, type, status, term, onModel } = req.body;
    try {
        const attendance = new Attendance({
            member: memberId,
            onModel: onModel || "Member",
            date,
            type,
            status,
            term
        });
        await attendance.save();
        res.status(201).json(attendance);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// Update attendance
router.put("/:id", authMiddleware, async (req, res) => {
    try {
        const attendance = await Attendance.findByIdAndUpdate(req.params.id, req.body, { new: true });
        res.json(attendance);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// Get attendance report
router.get("/report/:memberId", authMiddleware, async (req, res) => {
    try {
        const attendances = await Attendance.find({ member: req.params.memberId }).sort({ date: -1 });
        res.json(attendances);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;