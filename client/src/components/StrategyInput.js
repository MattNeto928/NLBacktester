import { useState } from 'react';

const StrategyInput = ({ onSubmit, isLoading }) => {
  const [description, setDescription] = useState('');
  const [showSectors, setShowSectors] = useState(false);
  
  // Array of 20 diverse example strategies
  const exampleStrategies = [
    "For every week a stock goes down 5%, I will buy $5 worth of that stock. And every instance that a stock goes up 10% for a given week, I will sell $10 of that stock. Do this for tech stocks from 2018 to 2023.",
    "Buy $100 when RSI drops below 30 and sell when it goes above 70 for blue chip stocks between 2015-2022.",
    "If a stock goes up consecutively for 3 days in a row, sell the stock. If it goes down for 5 consecutive days, buy $200 worth. Test this on volatile stocks from 2020-2023.",
    "When AAPL drops 3% in a day, invest 5% of my portfolio. Sell when it rises 5% in a week. Backtest from 2019 to 2023.",
    "Buy when MACD shows a bullish crossover and sell when it shows a bearish crossover. Test on dividend stocks between 2017-2022.",
    "Short a stock when it increases by 10% in a week and buy to cover when it decreases by 5%. Use tech and financial stocks from 2010-2020.",
    "When a stock's price is 5% below its 20-day moving average, buy $150. Sell when it's 8% above the moving average. Test on energy stocks from 2016-2023.",
    "Buy $50 of a stock if its volume increases by 200% compared to the 10-day average. Sell when volume drops below the average. Use retail stocks from 2018-2021.",
    "If a stock forms a double bottom pattern, buy $200. Sell if it drops 8% from the purchase price. Backtest on healthcare stocks from 2015-2022.",
    "When the Bollinger Bands width expands by 20%, short the stock. Cover when the width narrows by 15%. Test on index ETFs from 2019-2023.",
    "For TSLA, buy $100 when price crosses above the upper Bollinger Band and sell when it crosses below the middle band. Test from 2018-2023.",
    "Buy when Money Flow Index (MFI) is below 20 and sell when it's above 80. Apply to financial stocks during the 2020-2022 period.",
    "Apply a mean reversion strategy: buy when a stock is down more than 15% in a month and sell when it rebounds 10%. Test on blue chip stocks from 2010-2023.",
    "If a stock's Average True Range (ATR) increases by 50% in a week, buy $75. Sell when ATR returns to normal levels. Use crypto-related stocks from 2021-2023.",
    "Buy $150 when On-Balance Volume (OBV) shows a positive divergence with price. Sell when OBV shows a negative divergence. Test on retail stocks from 2017-2022.",
    "For penny stocks, if the price increases by 20% on high volume (200% above average), short $50. Cover when it drops 10%. Test from 2019-2023.",
    "When a stock price crosses above its 50-day moving average, buy $100. Sell when it crosses below. Apply to tech stocks during 2015-2020.",
    "Buy $200 if a stock gaps down more than 3% at market open and sell at market close the same day. Test this day trading strategy on volatile stocks from 2022-2023.",
    "If the weekly RSI is below 30 and the daily MACD shows a bullish crossover, buy $150. Sell when RSI goes above 70. Test on dividend stocks from 2015-2023.",
    "For NVDA, if goes down by 5%, sell $100, if goes up 5%, buy $200. Backtest this from 2017 to 2023."
  ];

  // Available stock sectors for reference
  const stockSectors = [
    { name: 'Technology', variants: ['tech', 'technology'] },
    { name: 'Blue Chip', variants: ['blue chip', 'blue_chip'] },
    { name: 'Penny Stocks', variants: ['penny stock', 'penny_stock'] },
    { name: 'Finance', variants: ['finance', 'financial', 'banking'] },
    { name: 'Healthcare', variants: ['healthcare', 'health', 'pharma'] },
    { name: 'Energy', variants: ['energy', 'oil'] },
    { name: 'Retail', variants: ['retail', 'consumer', 'ecommerce'] },
    { name: 'ETFs', variants: ['etf', 'etfs', 'index', 'indices'] },
    { name: 'Crypto-related', variants: ['crypto', 'bitcoin'] },
    { name: 'Volatile/Meme', variants: ['volatile', 'meme', 'reddit'] },
    { name: 'Dividend', variants: ['dividend', 'income'] },
    { name: 'Travel', variants: ['travel', 'airline'] },
    { name: 'Real Estate', variants: ['realestate', 'reit'] },
    { name: 'Industrial', variants: ['industrial', 'manufacturing'] },
    { name: 'Electric Vehicles', variants: ['ev', 'electric'] },
    { name: 'Semiconductor', variants: ['semiconductor', 'chip'] },
    { name: 'Cloud', variants: ['cloud', 'saas'] },
  ];
  
  const handleSubmit = (e) => {
    e.preventDefault();
    if (description.trim()) {
      onSubmit(description);
    }
  };
  
  const handleExampleClick = () => {
    // Select a random strategy from the examples
    const randomIndex = Math.floor(Math.random() * exampleStrategies.length);
    setDescription(exampleStrategies[randomIndex]);
  };
  
  const toggleSectors = () => {
    setShowSectors(!showSectors);
  };
  
  return (
    <div className="bg-white shadow-md rounded-lg overflow-hidden">
      <div className="px-6 py-4">
        <h2 className="text-xl font-semibold text-gray-800 mb-2">Strategy Description</h2>
        <p className="text-gray-600 mb-4">
          Describe your trading strategy in natural language. Our AI will interpret your strategy and run a backtest.
        </p>
        
        <div className="bg-blue-50 p-3 rounded-md mb-4 text-sm">
          <p className="font-medium text-blue-800 mb-1">Strategy Ideas:</p>
          <p className="text-blue-700">
            Try including <span className="font-semibold">percent changes</span> (e.g., "buy when down 5%"), 
            <span className="font-semibold"> technical indicators</span> (RSI, MACD, moving averages), 
            <span className="font-semibold"> patterns</span> (consecutive days, double bottom), 
            <span className="font-semibold"> timeframes</span> (daily, weekly), and 
            <span className="font-semibold"> specific amounts</span> (dollars, shares, or percentage of portfolio).
          </p>
          
          <button 
            onClick={toggleSectors}
            className="mt-2 text-indigo-600 hover:text-indigo-800 text-xs flex items-center"
          >
            {showSectors ? 'Hide available stock sectors' : 'Show available stock sectors'} 
            <svg xmlns="http://www.w3.org/2000/svg" className={`h-3 w-3 ml-1 transition-transform ${showSectors ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          
          {showSectors && (
            <div className="mt-2 bg-white rounded-md p-2 border border-blue-100 max-h-40 overflow-y-auto">
              <p className="text-xs text-gray-500 mb-1">By default, 5 stocks from each category will be used unless specified otherwise.</p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                {stockSectors.map((sector, index) => (
                  <div key={index} className="text-xs">
                    <span className="font-medium text-gray-700">{sector.name}:</span>{' '}
                    <span className="text-gray-500">{sector.variants.join(', ')}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label 
              htmlFor="strategy-description" 
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Strategy
            </label>
            <textarea
              id="strategy-description"
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              rows="5"
              placeholder="Example: Buy $100 of a stock whenever it drops 5% in a day, sell when it rises 10%..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={isLoading}
            ></textarea>
          </div>
          
          <div className="flex items-center justify-between">
            <button
              type="button"
              className="text-sm text-indigo-600 hover:text-indigo-900"
              onClick={handleExampleClick}
              disabled={isLoading}
            >
              Use example strategy
            </button>
            
            <button
              type="submit"
              className={`px-4 py-2 rounded-md text-white font-medium ${
                isLoading
                  ? 'bg-indigo-400 cursor-not-allowed'
                  : 'bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500'
              }`}
              disabled={isLoading || !description.trim()}
            >
              {isLoading ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white inline" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Processing...
                </>
              ) : (
                'Run Backtest'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default StrategyInput;