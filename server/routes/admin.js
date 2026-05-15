const express = require('express');
const User = require('../models/User');

const router = express.Router();

// GET all users
router.get('/users', async (req, res) => {
  try {
    const users = await User.find({}, '_id username email groups isAdmin');
    res.status(200).json(users);
  } catch (err) {
    console.error('Get users error:', err);
    res.status(500).json({ message: 'Failed to fetch users' });
  }
});

// UPDATE user's groups
router.put('/users/:id/groups', async (req, res) => {
  try {
    const { groups } = req.body;

    if (!Array.isArray(groups)) {
      return res.status(400).json({ message: 'groups must be an array' });
    }

    // Validate groups
    const validGroups = ['yangon-family', 'native-family'];
    for (const group of groups) {
      if (!validGroups.includes(group)) {
        return res.status(400).json({ message: `Invalid group: ${group}` });
      }
    }

    const user = await User.findByIdAndUpdate(req.params.id, { groups }, { new: true });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.status(200).json(user);
  } catch (err) {
    console.error('Update user groups error:', err);
    res.status(500).json({ message: 'Failed to update user' });
  }
});

module.exports = router;
