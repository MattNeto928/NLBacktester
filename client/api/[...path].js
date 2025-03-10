// Create a proxy handler for API requests
import axios from 'axios';

export default async function handler(req, res) {
  const path = req.url.split('/api/')[1];
  const apiBaseUrl = 'http://100.27.187.96:5001/api/';

  try {
    // Forward the request to our API server
    const response = await axios({
      method: req.method,
      url: `${apiBaseUrl}${path}`,
      headers: {
        'Content-Type': 'application/json',
        // Forward other needed headers
      },
      data: req.body,
    });

    // Return the API response
    res.status(response.status).json(response.data);
  } catch (error) {
    console.error('API proxy error:', error);
    res.status(error.response?.status || 500).json({
      error: error.response?.data?.error || 'Internal Server Error',
    });
  }
}