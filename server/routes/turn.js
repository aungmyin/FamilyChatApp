const express = require('express');
const router = express.Router();

// Get TURN credentials from Metered.ca
router.get('/credentials', async (req, res) => {
  try {
    const apiKey = process.env.METERED_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'TURN service not configured' });
    }

    const response = await fetch('https://api.metered.ca/api/v1/turn/credentials', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

    if (!response.ok) {
      console.error('Metered.ca API error:', response.status);
      return res.status(500).json({ error: 'Failed to get TURN credentials' });
    }

    const data = await response.json();

    res.json({
      iceServers: data.iceServers || [],
    });
  } catch (error) {
    console.error('Error fetching TURN credentials:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
