const express = require('express');
const jwt = require('jsonwebtoken');
const validator = require('validator');
const User = require('../models/User');

const router = express.Router();

const validateEmail = (email) => {
  return validator.isEmail(email);
};

const validateUsername = (username) => {
  return username && username.trim().length >= 2 && username.trim().length <= 30;
};

const validatePassword = (password) => {
  return password && password.length >= 8;
};

router.post('/register', async (req, res) => {
  try {
    const { username, email, password, inviteCode } = req.body;

    // Validate invite code
    if (inviteCode !== process.env.FAMILY_INVITE_CODE) {
      return res.status(403).json({ error: 'Invalid invite code' });
    }

    // Validate input
    if (!validateUsername(username)) {
      return res.status(400).json({ error: 'Username must be 2-30 characters' });
    }

    if (!validateEmail(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    if (!validatePassword(password)) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    // Check if user already exists
    const existingUser = await User.findOne({
      $or: [{ email: email.toLowerCase() }, { username: username.trim() }],
    });

    if (existingUser) {
      return res.status(400).json({ error: 'Username or email already exists' });
    }

    // Create new user
    const newUser = new User({
      username: username.trim(),
      email: email.toLowerCase(),
      password,
    });

    await newUser.save();

    // Create JWT token
    const token = jwt.sign(
      { id: newUser._id, username: newUser.username },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(200).json({
      token,
      username: newUser.username,
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate input
    if (!validateEmail(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    if (!password) {
      return res.status(400).json({ error: 'Password is required' });
    }

    // Find user
    const user = await User.findOne({ email: email.toLowerCase() }).select('+password');

    if (!user) {
      return res.status(400).json({ error: 'User not found' });
    }

    // Compare password
    const passwordMatch = await user.comparePassword(password);

    if (!passwordMatch) {
      return res.status(400).json({ error: 'Wrong password' });
    }

    // Create JWT token
    const token = jwt.sign(
      { id: user._id, username: user.username },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(200).json({
      token,
      username: user.username,
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
