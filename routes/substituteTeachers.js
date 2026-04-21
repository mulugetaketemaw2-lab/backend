const express = require('express');
const router = express.Router();
const SubstituteTeacher = require('../models/SubstituteTeacher');
const SubstituteSession = require('../models/SubstituteSession');
const { authMiddleware } = require('../middleware/auth');

// GET all substitute teachers
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { term } = req.query;
    let query = {};
    if (term) query.term = term;
    const teachers = await SubstituteTeacher.find(query).sort({ createdAt: -1 });
    res.json(teachers);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST a new substitute teacher
router.post('/', authMiddleware, async (req, res) => {
  try {
    const teacher = new SubstituteTeacher({
      ...req.body,
      addedBy: req.user ? req.user.id : null // req.user.id is set by authMiddleware
    });

    const newTeacher = await teacher.save();
    res.status(201).json(newTeacher);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// PUT (update) a substitute teacher
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const updatedTeacher = await SubstituteTeacher.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );
    if (!updatedTeacher) return res.status(404).json({ message: 'Teacher not found' });
    res.json(updatedTeacher);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// DELETE a substitute teacher
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const teacher = await SubstituteTeacher.findByIdAndDelete(req.params.id);
    if (!teacher) return res.status(404).json({ message: 'Teacher not found' });
    res.json({ message: 'Teacher deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ==================== ATTENDANCE SESSIONS ====================

// Record a new attendance session
router.post('/sessions', authMiddleware, async (req, res) => {
  try {
    const { title, date, category, attendance, term } = req.body;
    const session = new SubstituteSession({
      title,
      date,
      category,
      attendance,
      term,
      addedBy: req.user.id
    });
    await session.save();
    res.status(201).json(session);
  } catch (err) {
    res.status(500).json({ message: 'Failed to save attendance' });
  }
});

// Get all sessions
router.get('/sessions', authMiddleware, async (req, res) => {
  try {
    const { category, term } = req.query;
    let query = {};
    if (category) query.category = category;
    if (term) query.term = term;

    const sessions = await SubstituteSession.find(query)
      .sort({ date: -1 })
      .populate('attendance.teacher', 'name');
    res.json(sessions);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch sessions' });
  }
});

module.exports = router;
