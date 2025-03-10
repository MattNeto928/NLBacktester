const express = require('express');
const router = express.Router();
const yahooFinance = require('yahoo-finance2').default;

/**
 * Get available stock categories
 * @route GET /api/data/categories
 * @returns {object} List of stock categories
 */
router.get('/categories', (req, res) => {
  // For now, return predefined categories
  const categories = [
    { id: 'blue_chip', name: 'Blue Chip Stocks', description: 'Large, well-established companies' },
    { id: 'penny_stock', name: 'Penny Stocks', description: 'Small companies with low stock prices' },
    { id: 'tech', name: 'Technology Stocks', description: 'Companies in the technology sector' },
    { id: 'finance', name: 'Financial Stocks', description: 'Banks and financial institutions' },
    { id: 'healthcare', name: 'Healthcare Stocks', description: 'Medical and healthcare companies' }
  ];
  
  res.status(200).json({ categories });
});

/**
 * Get stock data for a specific symbol
 * @route GET /api/data/stocks/:symbol
 * @param {string} symbol - Stock symbol
 * @returns {object} Historical price data for the stock
 */
router.get('/stocks/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    
    // Use fixed startDate and endDate
    const startDate = '2010-01-01';
    const endDate = new Date().toISOString().split('T')[0]; // Today
    
    // Always use daily interval for consistency
    const interval = '1d';
    console.log(`Fetching ${symbol} data with daily interval from ${startDate} to ${endDate}`);
    
    // Fetch from Yahoo Finance API
    const result = await yahooFinance.historical(symbol, {
      period1: startDate,
      period2: endDate,
      interval: interval
    });
    
    if (result.length > 0) {
      return res.status(200).json({ data: result });
    } else {
      return res.status(404).json({ error: 'No data found for symbol' });
    }
  } catch (error) {
    console.error('Error fetching stock data:', error);
    res.status(500).json({ error: 'Failed to fetch stock data' });
  }
});

/**
 * Get stocks by category
 * @route GET /api/data/category/:categoryId
 * @param {string} categoryId - Category identifier
 * @param {number} limit - Maximum number of stocks to return
 * @returns {object} List of stocks in the category
 */
router.get('/category/:categoryId', (req, res) => {
  try {
    const { categoryId } = req.params;
    const limit = req.query.limit || 10;
    
    // Example implementation - would be database-backed in a real application
    const categoryStocks = {
      'blue_chip': ['AAPL', 'MSFT', 'GOOG', 'AMZN', 'FB', 'BRK-B', 'JNJ', 'WMT', 'PG', 'JPM', 'V', 'UNH', 'HD', 'MA', 'DIS'],
      'penny_stock': ['SNDL', 'CTRM', 'NAKD', 'XSPA', 'JAGX', 'EXPR', 'NBEV', 'CIDM', 'SRNE', 'FCEL', 'GNUS', 'SENS', 'ZOM', 'ACB', 'HEXO'],
      'tech': ['AAPL', 'MSFT', 'GOOG', 'AMZN', 'FB', 'TSLA', 'NVDA', 'PYPL', 'INTC', 'CSCO', 'ADBE', 'CRM', 'NFLX', 'AMD', 'QCOM'],
      'finance': ['JPM', 'BAC', 'WFC', 'C', 'GS', 'MS', 'AXP', 'BLK', 'SCHW', 'USB', 'PNC', 'TFC', 'SPGI', 'CME', 'COF'],
      'healthcare': ['JNJ', 'UNH', 'PFE', 'ABT', 'MRK', 'TMO', 'ABBV', 'DHR', 'BMY', 'MDT', 'AMGN', 'ISRG', 'CVS', 'GILD', 'VRTX']
    };
    
    const stocks = categoryStocks[categoryId] || [];
    
    if (stocks.length === 0) {
      return res.status(404).json({ error: 'Category not found' });
    }
    
    // Return limited number of stocks
    const limitedStocks = stocks.slice(0, limit);
    
    res.status(200).json({ 
      category: categoryId, 
      count: limitedStocks.length,
      stocks: limitedStocks
    });
  } catch (error) {
    console.error('Error fetching category stocks:', error);
    res.status(500).json({ error: 'Failed to fetch category stocks' });
  }
});

module.exports = router;