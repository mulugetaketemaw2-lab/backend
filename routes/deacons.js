const express = require('express');
const router = express.Router();
const Deacon = require('../models/Deacon');
const { authMiddleware } = require('../middleware/auth');

// GET all deacons
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { term } = req.query;
    let query = {};
    if (term) query.term = term;
    const deacons = await Deacon.find(query).sort({ createdAt: -1 });
    res.json(deacons);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST a new deacon
router.post('/', authMiddleware, async (req, res) => {
  try {
    const deacon = new Deacon({
      ...req.body,
      addedBy: req.user ? req.user.id : null
    });

    const newDeacon = await deacon.save();
    res.status(201).json(newDeacon);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// PUT (update) a deacon
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const updatedDeacon = await Deacon.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );
    if (!updatedDeacon) return res.status(404).json({ message: 'Deacon not found' });
    res.json(updatedDeacon);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// DELETE a deacon
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const deacon = await Deacon.findByIdAndDelete(req.params.id);
    if (!deacon) return res.status(404).json({ message: 'Deacon not found' });
    res.json({ message: 'Deacon deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
