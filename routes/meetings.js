const express = require('express');
const router = express.Router();
const { authMiddleware, authorize } = require('../middleware/auth');
const Meeting = require('../models/Meeting');

// Get all meetings
router.get('/', authMiddleware, async (req, res) => {
  try {
    let query = {};
    
    if (req.user.level === 'department') {
      query.department = req.user.department;
    }

    const meetings = await Meeting.find(query)
      .populate('createdBy', 'name')
      .populate('attendees.member', 'firstName fatherName')
      .sort('-date');
      
    res.json(meetings);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Create meeting
router.post('/', authMiddleware, async (req, res) => {
  try {
    const meeting = new Meeting({
      ...req.body,
      createdBy: req.user.id
    });
    await meeting.save();
    res.status(201).json(meeting);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get meeting by ID
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const meeting = await Meeting.findById(req.params.id)
      .populate('createdBy', 'name')
      .populate('attendees.member', 'firstName fatherName');
      
    if (!meeting) {
      return res.status(404).json({ message: 'Meeting not found' });
    }
    res.json(meeting);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Update meeting
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const meeting = await Meeting.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );
    res.json(meeting);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Delete meeting
router.delete('/:id', authMiddleware, authorize('admin', 'executive'), async (req, res) => {
  try {
    await Meeting.findByIdAndDelete(req.params.id);
    res.json({ message: 'Meeting deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Add attendee to meeting
router.post('/:id/attendees', authMiddleware, async (req, res) => {
  try {
    const meeting = await Meeting.findById(req.params.id);
    if (!meeting) {
      return res.status(404).json({ message: 'Meeting not found' });
    }

    meeting.attendees.push(req.body);
    await meeting.save();

    res.json(meeting);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;