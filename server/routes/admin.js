const express = require('express');
const router = express.Router();
const User = require('../models/User');
const FamilyGroup = require('../models/FamilyGroup');

// GET all users
router.get('/users', async (req, res) => {
  try {
    const users = await User.find().select('_id username email familyCode isAdmin isBlocked createdAt');
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching users', error: err.message });
  }
});

// Toggle block status for a user
router.put('/users/:id/block', async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    user.isBlocked = !user.isBlocked;
    await user.save();
    res.json({ message: `User ${user.isBlocked ? 'blocked' : 'unblocked'}`, user });
  } catch (err) {
    res.status(500).json({ message: 'Error updating user', error: err.message });
  }
});

// Reassign user to different family
router.put('/users/:id/family', async (req, res) => {
  try {
    const { familyCode } = req.body;
    if (!familyCode) {
      return res.status(400).json({ message: 'familyCode required' });
    }
    const family = await FamilyGroup.findOne({ code: familyCode });
    if (!family) {
      return res.status(404).json({ message: 'Family group not found' });
    }
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    user.familyCode = familyCode;
    await user.save();
    res.json({ message: 'User reassigned to family', user });
  } catch (err) {
    res.status(500).json({ message: 'Error updating user', error: err.message });
  }
});

// GET all family groups
router.get('/families', async (req, res) => {
  try {
    const families = await FamilyGroup.find();
    res.json(families);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching families', error: err.message });
  }
});

// Create new family group
router.post('/families', async (req, res) => {
  try {
    const { name, code } = req.body;
    if (!name || !code) {
      return res.status(400).json({ message: 'name and code required' });
    }
    const existing = await FamilyGroup.findOne({ code: code.toLowerCase() });
    if (existing) {
      return res.status(400).json({ message: 'Family code already exists' });
    }
    const family = new FamilyGroup({ name, code: code.toLowerCase() });
    await family.save();
    res.json({ message: 'Family group created', family });
  } catch (err) {
    res.status(500).json({ message: 'Error creating family', error: err.message });
  }
});

// Delete family group (only if no users assigned)
router.delete('/families/:id', async (req, res) => {
  try {
    const family = await FamilyGroup.findById(req.params.id);
    if (!family) {
      return res.status(404).json({ message: 'Family group not found' });
    }

    const userCount = await User.countDocuments({ familyCode: family.code });
    if (userCount > 0) {
      return res.status(400).json({
        message: `Cannot delete family with ${userCount} assigned user(s). Reassign users first.`
      });
    }

    await FamilyGroup.findByIdAndDelete(req.params.id);
    res.json({ message: 'Family group deleted', family });
  } catch (err) {
    res.status(500).json({ message: 'Error deleting family', error: err.message });
  }
});

module.exports = router;
