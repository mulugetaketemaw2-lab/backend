const express = require("express");
const Subgroup = require("../models/Subgroup");
const { authMiddleware } = require("../middleware/auth");

const router = express.Router();

// Get all subgroups
router.get("/", authMiddleware, async (req, res) => {
    try {
        const subgroups = await Subgroup.find().populate("leader").populate("members");
        res.json(subgroups);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Add subgroup
router.post("/", authMiddleware, async (req, res) => {
    const { name, department, leader } = req.body;
    try {
        const subgroup = new Subgroup({ name, department, leader, members: [] });
        await subgroup.save();
        res.status(201).json(subgroup);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// Update subgroup
router.put("/:id", authMiddleware, async (req, res) => {
    try {
        const subgroup = await Subgroup.findByIdAndUpdate(req.params.id, req.body, { new: true });
        res.json(subgroup);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// Delete subgroup
router.delete("/:id", authMiddleware, async (req, res) => {
    try {
        await Subgroup.findByIdAndDelete(req.params.id);
        res.json({ message: "Subgroup deleted" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Add member to subgroup
router.post("/:id/members", authMiddleware, async (req, res) => {
    const { memberId } = req.body;
    try {
        const subgroup = await Subgroup.findById(req.params.id);
        if (!subgroup.members.includes(memberId)) {
            subgroup.members.push(memberId);
            await subgroup.save();
        }
        res.json(subgroup);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// Remove member from subgroup
router.delete("/:id/members/:memberId", authMiddleware, async (req, res) => {
    try {
        const subgroup = await Subgroup.findById(req.params.id);
        subgroup.members = subgroup.members.filter(m => m.toString() !== req.params.memberId);
        await subgroup.save();
        res.json(subgroup);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;