const express = require('express');
const router = express.Router();
const SubstituteLeader = require('../models/SubstituteLeader');
const LeaderSession = require('../models/LeaderSession');
const { authMiddleware: auth } = require('../middleware/auth');

// @route   GET /api/substitute-leaders
// @desc    Get all substitute leaders
router.get('/', auth, async (req, res) => {
  try {
    const { category, term } = req.query;
    let query = {};
    if (category) query.category = category;
    if (term) query.term = term;
    
    const leaders = await SubstituteLeader.find(query).sort({ createdAt: -1 });
    res.json(leaders);
  } catch (err) {
    res.status(500).send('Server Error');
  }
});

// @route   POST /api/substitute-leaders
// @desc    Add a substitute leader
router.post('/', auth, async (req, res) => {
  try {
    const newLeader = new SubstituteLeader({
      ...req.body,
      addedBy: req.user.id
    });
    const leader = await newLeader.save();
    res.json(leader);
  } catch (err) {
    res.status(500).send('Server Error');
  }
});

// @route   PUT /api/substitute-leaders/:id
// @desc    Update a substitute leader
router.put('/:id', auth, async (req, res) => {
  try {
    const leader = await SubstituteLeader.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { new: true }
    );
    res.json(leader);
  } catch (err) {
    res.status(500).send('Server Error');
  }
});

// @route   DELETE /api/substitute-leaders/:id
// @desc    Delete a substitute leader
router.delete('/:id', auth, async (req, res) => {
  try {
    await SubstituteLeader.findByIdAndDelete(req.params.id);
    res.json({ msg: 'Leader removed' });
  } catch (err) {
    res.status(500).send('Server Error');
  }
});

// Attendance Session Routes
// @route   POST /api/substitute-leaders/sessions
// @desc    Create an attendance session
router.post('/sessions', auth, async (req, res) => {
  try {
    const newSession = new LeaderSession({
      ...req.body,
      addedBy: req.user.id
    });
    const session = await newSession.save();
    res.json(session);
  } catch (err) {
    res.status(500).send('Server Error');
  }
});

// @route   GET /api/substitute-leaders/sessions
// @desc    Get attendance sessions
router.get('/sessions', auth, async (req, res) => {
  try {
    const { category, term } = req.query;
    const query = {};
    if (category) query.category = category;
    if (term) query.term = term;
    const sessions = await LeaderSession.find(query)
      .populate('attendance.leader', 'name')
      .sort({ date: -1 });
    res.json(sessions);
  } catch (err) {
    res.status(500).send('Server Error');
  }
});

module.exports = router;
