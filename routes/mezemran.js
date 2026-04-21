const express = require('express');
const router = express.Router();
const Mezemran = require('../models/Mezemran');
const MezemranSession = require('../models/MezemranSession');
const { authMiddleware } = require('../middleware/auth');

// GET all mezemran
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { term } = req.query;
    let query = {};
    if (term) query.term = term;
    const mezemranList = await Mezemran.find(query).sort({ createdAt: -1 });
    res.json(mezemranList);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST a new mezemran
router.post('/', authMiddleware, async (req, res) => {
  try {
    const mezemran = new Mezemran({
      ...req.body,
      addedBy: req.user ? req.user.id : null
    });

    const newMezemran = await mezemran.save();
    res.status(201).json(newMezemran);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// PUT (update) a mezemran
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const updatedMezemran = await Mezemran.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );
    if (!updatedMezemran) return res.status(404).json({ message: 'Mezemran not found' });
    res.json(updatedMezemran);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// DELETE a mezemran
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const mezemran = await Mezemran.findByIdAndDelete(req.params.id);
    if (!mezemran) return res.status(404).json({ message: 'Mezemran not found' });
    res.json({ message: 'Mezemran deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ==================== ATTENDANCE SESSIONS ====================

// Record a new attendance session
router.post('/sessions', authMiddleware, async (req, res) => {
  try {
    const { title, date, category, attendance, term } = req.body;
    const session = new MezemranSession({
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

    const sessions = await MezemranSession.find(query)
      .sort({ date: -1 })
      .populate('attendance.mezemran', 'name');
    res.json(sessions);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch sessions' });
  }
});

module.exports = router;
