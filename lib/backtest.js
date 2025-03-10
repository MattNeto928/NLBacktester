/**
 * Backtesting engine for executing trading strategies on historical data
 */

/**
 * Calculate percent change between two values
 * @param {number} current - Current value
 * @param {number} previous - Previous value
 * @returns {number} Percent change
 */
function calculatePercentChange(current, previous) {
  if (previous === 0) return 0;
  return ((current - previous) / previous) * 100;
}

/**
 * Check if a simple condition is met
 * @param {number} value - Value to check
 * @param {string} operator - Comparison operator (e.g., "greater_than", "less_than")
 * @param {number} threshold - Threshold value for comparison
 * @returns {boolean} Whether the condition is met
 */
function checkSimpleCondition(value, operator, threshold) {
  switch (operator) {
    case 'greater_than':
      return value > threshold;
    case 'greater_than_equal':
      return value >= threshold;
    case 'less_than':
      return value < threshold;
    case 'less_than_equal':
      return value <= threshold;
    case 'equal':
      return value === threshold;
    default:
      return false;
  }
}

/**
 * Check if a consecutive pattern condition is met
 * @param {Array} priceHistory - Array of price data, oldest to newest
 * @param {number} days - Number of consecutive days required
 * @param {string} direction - Direction of the pattern ('up', 'down', 'unchanged')
 * @returns {boolean} Whether the condition is met
 */
function checkConsecutiveCondition(priceHistory, days, direction) {
  // Need at least 'days' elements in history
  if (priceHistory.length < days) {
    console.log(`[CONSECUTIVE CHECK] Insufficient price history: ${priceHistory.length} days available, ${days} required`);
    return false;
  }
  
  // Get the last 'days' elements
  const recentPrices = priceHistory.slice(-days);
  
  console.log(`[CONSECUTIVE CHECK] Checking ${days} consecutive days with direction '${direction}'`);
  console.log(`[CONSECUTIVE CHECK] Recent prices: ${recentPrices.map(p => p.close).join(' -> ')}`);
  
  // Check if the pattern matches the specified direction
  let consecutiveCount = 1; // Start with 1 because we need n-1 comparisons for n days
  
  for (let i = 1; i < recentPrices.length; i++) {
    const current = recentPrices[i].close;
    const previous = recentPrices[i-1].close;
    const changePercent = ((current - previous) / previous) * 100;
    
    console.log(`[CONSECUTIVE CHECK] Day ${i}: ${previous} -> ${current} (${changePercent.toFixed(2)}%)`);
    
    if (direction === 'up' && current <= previous) {
      console.log(`[CONSECUTIVE CHECK] Failed: Not consecutive UP at day ${i}`);
      return false; // Not consecutive up
    } else if (direction === 'down' && current >= previous) {
      console.log(`[CONSECUTIVE CHECK] Failed: Not consecutive DOWN at day ${i}`);
      return false; // Not consecutive down
    } else if (direction === 'unchanged' && current !== previous) {
      console.log(`[CONSECUTIVE CHECK] Failed: Not UNCHANGED at day ${i}`);
      return false; // Not unchanged
    }
    
    consecutiveCount++;
  }
  
  console.log(`[CONSECUTIVE CHECK] Success: Found ${consecutiveCount} consecutive ${direction} days`);
  return true; // All checks passed
}

// Import technical indicators
const indicators = require('./indicators');

/**
 * Checks if a technical indicator condition is met
 * @param {object} condition - The technical indicator condition
 * @param {object} data - Data needed to evaluate the condition
 * @returns {boolean} Whether the condition is met
 */
function checkTechnicalCondition(condition, data) {
  const { priceHistory } = data;
  const indicatorType = condition.indicator;
  const params = condition.params || {};
  let indicatorValue = null;
  
  console.log(`[TECHNICAL] Checking ${indicatorType} indicator with params:`, JSON.stringify(params));
  
  // Get the current value of the specified indicator
  switch (indicatorType) {
    case 'rsi': {
      const period = params.period || 14;
      const rsiValues = indicators.calculateRSI(priceHistory, period);
      indicatorValue = rsiValues[priceHistory.length - 1];
      console.log(`[TECHNICAL] RSI(${period}) value: ${indicatorValue}`);
      break;
    }
    case 'macd': {
      const fastPeriod = params.fastPeriod || 12;
      const slowPeriod = params.slowPeriod || 26;
      const signalPeriod = params.signalPeriod || 9;
      
      const macdResult = indicators.calculateMACD(
        priceHistory, 
        fastPeriod, 
        slowPeriod, 
        signalPeriod
      );
      
      // Determine which MACD value to use (line, signal, or histogram)
      const macdValueType = params.valueType || 'histogram';
      
      if (macdValueType === 'line') {
        indicatorValue = macdResult.macd[priceHistory.length - 1];
        console.log(`[TECHNICAL] MACD Line value: ${indicatorValue}`);
      } else if (macdValueType === 'signal') {
        indicatorValue = macdResult.signal[priceHistory.length - 1];
        console.log(`[TECHNICAL] MACD Signal value: ${indicatorValue}`);
      } else if (macdValueType === 'histogram') {
        indicatorValue = macdResult.histogram[priceHistory.length - 1];
        console.log(`[TECHNICAL] MACD Histogram value: ${indicatorValue}`);
      } else if (macdValueType === 'crossover') {
        // Check for crossover (histogram sign change)
        const currHist = macdResult.histogram[priceHistory.length - 1];
        const prevHist = macdResult.histogram[priceHistory.length - 2];
        
        if (isNaN(currHist) || isNaN(prevHist)) {
          return false;
        }
        
        // Bullish crossover (histogram goes from negative to positive)
        if (params.direction === 'bullish') {
          indicatorValue = (prevHist < 0 && currHist > 0) ? 1 : 0;
          console.log(`[TECHNICAL] MACD Bullish crossover check: ${indicatorValue === 1 ? 'YES' : 'NO'}`);
        } 
        // Bearish crossover (histogram goes from positive to negative)
        else if (params.direction === 'bearish') {
          indicatorValue = (prevHist > 0 && currHist < 0) ? 1 : 0;
          console.log(`[TECHNICAL] MACD Bearish crossover check: ${indicatorValue === 1 ? 'YES' : 'NO'}`);
        }
      }
      break;
    }
    case 'ma_relative': {
      const period = params.period || 20;
      const relativeValues = indicators.calculatePriceRelativeToMA(priceHistory, period);
      indicatorValue = relativeValues[priceHistory.length - 1];
      console.log(`[TECHNICAL] Price relative to MA(${period}) value: ${indicatorValue}%`);
      break;
    }
    case 'bbands': {
      const period = params.period || 20;
      const multiplier = params.multiplier || 2;
      const bbands = indicators.calculateBollingerBands(priceHistory, period, multiplier);
      
      const valueType = params.valueType || 'percent_b';
      
      if (valueType === 'upper') {
        indicatorValue = bbands.upper[priceHistory.length - 1];
        console.log(`[TECHNICAL] Bollinger Upper Band value: ${indicatorValue}`);
      } else if (valueType === 'lower') {
        indicatorValue = bbands.lower[priceHistory.length - 1];
        console.log(`[TECHNICAL] Bollinger Lower Band value: ${indicatorValue}`);
      } else if (valueType === 'width') {
        const upper = bbands.upper[priceHistory.length - 1];
        const lower = bbands.lower[priceHistory.length - 1];
        indicatorValue = ((upper - lower) / bbands.middle[priceHistory.length - 1]) * 100;
        console.log(`[TECHNICAL] Bollinger Band Width value: ${indicatorValue}%`);
      } else if (valueType === 'percent_b') {
        // Calculate %B indicator (0 = at lower band, 1 = at upper band)
        const currPrice = priceHistory[priceHistory.length - 1].close;
        const upper = bbands.upper[priceHistory.length - 1];
        const lower = bbands.lower[priceHistory.length - 1];
        
        if (upper === lower) {
          indicatorValue = 0.5;
        } else {
          indicatorValue = (currPrice - lower) / (upper - lower);
        }
        
        console.log(`[TECHNICAL] Bollinger %B value: ${indicatorValue}`);
      }
      break;
    }
    case 'volume_change': {
      if (priceHistory.length < 2) return false;
      
      const currentVolume = priceHistory[priceHistory.length - 1].volume;
      const previousVolume = priceHistory[priceHistory.length - 2].volume;
      
      if (previousVolume === 0) return false;
      
      indicatorValue = ((currentVolume - previousVolume) / previousVolume) * 100;
      console.log(`[TECHNICAL] Volume change: ${indicatorValue}%`);
      break;
    }
    case 'obv': {
      const obvValues = indicators.calculateOBV(priceHistory);
      
      // Get OBV values for last two periods for slope measurement
      const currentOBV = obvValues[priceHistory.length - 1];
      const previousOBV = obvValues[priceHistory.length - 2];
      
      if (params.slope === true) {
        // Return the slope (% change) instead of actual value
        if (!isNaN(currentOBV) && !isNaN(previousOBV) && previousOBV !== 0) {
          indicatorValue = ((currentOBV - previousOBV) / Math.abs(previousOBV)) * 100;
          console.log(`[TECHNICAL] OBV slope value: ${indicatorValue}%`);
        }
      } else {
        indicatorValue = currentOBV;
        console.log(`[TECHNICAL] OBV value: ${indicatorValue}`);
      }
      break;
    }
    case 'atr': {
      const period = params.period || 14;
      const atrValues = indicators.calculateATR(priceHistory, period);
      indicatorValue = atrValues[priceHistory.length - 1];
      
      // Convert to percent of price if requested
      if (params.percent === true) {
        const currentPrice = priceHistory[priceHistory.length - 1].close;
        indicatorValue = (indicatorValue / currentPrice) * 100;
        console.log(`[TECHNICAL] ATR(${period}) percentage: ${indicatorValue}%`);
      } else {
        console.log(`[TECHNICAL] ATR(${period}) absolute value: ${indicatorValue}`);
      }
      break;
    }
    case 'mfi': {
      const period = params.period || 14;
      const mfiValues = indicators.calculateMFI(priceHistory, period);
      indicatorValue = mfiValues[priceHistory.length - 1];
      console.log(`[TECHNICAL] MFI(${period}) value: ${indicatorValue}`);
      break;
    }
    default:
      console.log(`[TECHNICAL] Unknown indicator type: ${indicatorType}`);
      return false;
  }
  
  // Check if the indicator condition is met
  if (indicatorValue === null || isNaN(indicatorValue)) {
    console.log(`[TECHNICAL] Invalid indicator value, condition not met`);
    return false;
  }
  
  // For crossover types, special handling
  if (indicatorType === 'macd' && params.valueType === 'crossover') {
    return indicatorValue === 1; // Directly return true if crossover occurred
  }
  
  // Normal condition checking
  return checkSimpleCondition(indicatorValue, condition.operator, condition.value);
}

/**
 * Main condition checking function that dispatches to the appropriate checker
 * @param {object} condition - The condition object from the strategy
 * @param {object} data - Data needed to evaluate the condition
 * @returns {boolean} Whether the condition is met
 */
function checkCondition(condition, data) {
  // Handle different condition types
  if (condition.type === 'consecutive') {
    return checkConsecutiveCondition(
      data.priceHistory,
      condition.days,
      condition.direction
    );
  } else if (condition.type === 'pattern') {
    // Future implementation for pattern recognition
    console.log(`Pattern condition '${condition.pattern}' not yet implemented`);
    return false;
  } else if (condition.type === 'technical') {
    // Handle technical indicator conditions
    return checkTechnicalCondition(condition, data);
  } else {
    // Default to simple condition
    return checkSimpleCondition(
      data.value,
      condition.operator,
      condition.value
    );
  }
}

/**
 * Calculate the buy/sell amount based on rule
 * @param {object} amountRule - Rule for calculating amount
 * @param {number} portfolioValue - Current portfolio value
 * @param {number} currentPrice - Current price of the stock
 * @returns {object} Object containing amount in dollars and shares
 */
function calculateAmount(amountRule, portfolioValue, currentPrice) {
  // Default result structure
  const result = {
    dollars: 0,
    shares: 0
  };
  
  console.log(`[AMOUNT] Calculating amount with rule:`, JSON.stringify(amountRule));
  console.log(`[AMOUNT] Rule type: ${amountRule?.type}, value: ${amountRule?.value}`);
  console.log(`[AMOUNT] Current price: $${currentPrice}, Portfolio value: $${portfolioValue}`);
  
  // Basic validation
  if (!amountRule || typeof amountRule !== 'object') {
    console.error(`[AMOUNT] Invalid amount rule: ${JSON.stringify(amountRule)}`);
    // Default to $100 to prevent $0 transactions
    result.dollars = 100;
    result.shares = currentPrice > 0 ? result.dollars / currentPrice : 0;
    return result;
  }
  
  // Ensure we have a valid value (default to 100 if not provided)
  const value = typeof amountRule.value === 'number' && !isNaN(amountRule.value) ? 
    amountRule.value : 
    (amountRule.type === 'percentage' ? 5 : 100); // Default to 5% or $100
  
  // Handle different amount types
  const amountType = amountRule.type || 'fixed_amount'; // Default to fixed amount if type is missing
  
  switch (amountType) {
    case 'fixed_amount':
    case 'fixed': // Legacy support
      result.dollars = value;
      result.shares = currentPrice > 0 ? result.dollars / currentPrice : 0;
      console.log(`[AMOUNT] Using fixed_amount: $${value}`);
      break;
      
    case 'percentage':
      result.dollars = (portfolioValue * value) / 100;
      result.shares = currentPrice > 0 ? result.dollars / currentPrice : 0;
      console.log(`[AMOUNT] Using percentage: ${value}% of $${portfolioValue}`);
      break;
      
    case 'shares':
      result.shares = value;
      result.dollars = result.shares * currentPrice;
      console.log(`[AMOUNT] Using shares: ${value} shares at $${currentPrice}`);
      break;
      
    default:
      // Default to fixed amount if type is unknown
      console.log(`[AMOUNT] Unknown amount type: ${amountType}, defaulting to fixed amount`);
      result.dollars = value;
      result.shares = currentPrice > 0 ? result.dollars / currentPrice : 0;
  }
  
  // Ensure we never return zero amounts
  if (result.dollars <= 0 || result.shares <= 0) {
    console.warn(`[AMOUNT] Zero or negative amount calculated! Defaulting to $100`);
    result.dollars = 100;
    result.shares = currentPrice > 0 ? 100 / currentPrice : 0;
  }
  
  console.log(`[AMOUNT] Final calculation: $${result.dollars.toFixed(2)}, ${result.shares.toFixed(4)} shares`);
  return result;
}

/**
 * Execute a backtest for a given strategy and historical data
 * @param {object} strategy - Structured strategy object
 * @param {object} stockData - Historical stock data by symbol
 * @returns {object} Backtest results
 */
function runBacktest(strategy, stockData) {
  // Initialize portfolio and results tracking
  const initialCash = 10000; // Starting with $10,000
  const portfolio = {
    cash: initialCash,
    positions: {}, // Symbol -> quantity
    positionCost: {}, // Symbol -> total cost basis
    transactions: [],
    valueHistory: [],
    metrics: {
      startDate: null,
      endDate: null,
      totalReturn: 0,
      maxDrawdown: 0,
      sharpeRatio: 0
    }
  };

  // Log the initial portfolio state
  console.log(`[PORTFOLIO] Initial cash: $${portfolio.cash.toFixed(2)}`);
  console.log(`[PORTFOLIO] Initializing position cost tracking`);
  
  // Get unique dates across all stocks, sorted chronologically
  const allDates = new Set();
  Object.values(stockData).forEach(data => {
    data.forEach(bar => {
      // Handle date whether it's a string or Date object
      const dateStr = typeof bar.date === 'string' ? bar.date : bar.date.toISOString().split('T')[0];
      allDates.add(dateStr);
    });
  });
  const tradingDates = Array.from(allDates).sort();
  
  if (tradingDates.length === 0) {
    return { error: 'No trading data available' };
  }
  
  portfolio.metrics.startDate = tradingDates[0];
  portfolio.metrics.endDate = tradingDates[tradingDates.length - 1];
  
  // Previous data for calculating changes and tracking patterns
  const previousData = {};
  
  // Historical data for tracking consecutive patterns
  const historyData = {}; // Symbol -> array of recent prices (oldest to newest)
  
  // Track timeframes to maintain consistency in data point intervals
  const timeframeInfo = {
    currentTimeframe: 'daily', // Always use daily timeframe
    lastWeekNumber: null,
    lastMonth: null
  };
  
  // Log the date range
  const totalDays = Math.round((new Date(tradingDates[tradingDates.length-1]) - new Date(tradingDates[0])) / (1000 * 60 * 60 * 24));
  console.log(`Using daily timeframe for ${totalDays} day date range`);
  
  // Function to get week number of a date (ISO week)
  const getWeekNumber = (date) => {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  };
  
  // Main backtest loop - iterate through each date
  tradingDates.forEach((date, dateIndex) => {
    let totalPortfolioValue = portfolio.cash;
    let totalPositionValue = 0;
    
    // Update positions value (both long and short positions)
    Object.keys(portfolio.positions).forEach(symbol => {
      const quantity = portfolio.positions[symbol];
      const currentBar = stockData[symbol].find(bar => bar.date === date);
      
      if (currentBar) {
        // For short positions (negative quantity), we subtract from the portfolio value
        // For long positions (positive quantity), we add to the portfolio value
        const positionValue = currentBar.close * quantity;
        totalPortfolioValue += positionValue;
        totalPositionValue += positionValue;
        
        // Log position values periodically for debugging
        if (dateIndex % 20 === 0) {
          console.log(`[PORTFOLIO] ${symbol} position: ${quantity.toFixed(4)} shares at $${currentBar.close} = $${positionValue.toFixed(2)}`);
        }
      }
    });
    
    // Verify total portfolio value is consistent
    const expectedTotal = portfolio.cash + totalPositionValue;
    if (Math.abs(expectedTotal - totalPortfolioValue) > 0.01) {
      console.warn(`[PORTFOLIO] Value inconsistency detected: Cash $${portfolio.cash.toFixed(2)} + Positions $${totalPositionValue.toFixed(2)} = $${expectedTotal.toFixed(2)}, but calculated as $${totalPortfolioValue.toFixed(2)}`);
      // Correct the value if there's a discrepancy
      totalPortfolioValue = expectedTotal;
    }
    
    // Track portfolio value at each date
    portfolio.valueHistory.push({
      date,
      value: totalPortfolioValue,
      cash: portfolio.cash,
      positions: totalPositionValue
    });
    
    // Process each stock for trading signals
    Object.keys(stockData).forEach(symbol => {
      // Normalized date comparison function
      const matchDate = (bar, targetDate) => {
        if (typeof bar.date === 'string') {
          return bar.date === targetDate;
        } else if (bar.date instanceof Date) {
          return bar.date.toISOString().split('T')[0] === targetDate;
        }
        return false;
      };
      
      const currentBar = stockData[symbol].find(bar => matchDate(bar, date));
      if (!currentBar) return;
      
      const previousBar = dateIndex > 0 ? 
        stockData[symbol].find(bar => matchDate(bar, tradingDates[dateIndex - 1])) : null;
      
      if (!previousBar) {
        previousData[symbol] = currentBar;
        
        // Initialize price history array for this symbol if it doesn't exist
        if (!historyData[symbol]) {
          historyData[symbol] = [];
        }
        
        // Add current bar to history
        historyData[symbol].push(currentBar);
        
        return;
      }
      
      // Update price history
      if (!historyData[symbol]) {
        historyData[symbol] = [];
      }
      
      // Add current bar to history array (limit to last 30 days for efficiency)
      historyData[symbol].push(currentBar);
      if (historyData[symbol].length > 30) {
        historyData[symbol].shift(); // Remove oldest item
      }
      
      // Calculate daily percent change
      const dailyPercentChange = calculatePercentChange(currentBar.close, previousBar.close);
      
      // Get dates to determine if we're at a weekly boundary
      const currentDate = new Date(date);
      const prevDate = new Date(tradingDates[dateIndex - 1]);
      
      // Get current week and month number for consistency
      const currentWeek = getWeekNumber(currentDate);
      const currentMonth = currentDate.getUTCMonth();
      const currentYear = currentDate.getUTCFullYear();
      
      // Check if this is a week boundary based on timeframe
      const isWeekBoundary = 
        dateIndex === 0 || // First data point
        currentYear !== prevDate.getUTCFullYear() || 
        currentWeek !== getWeekNumber(prevDate);
      
      // Update last week number for consistency
      if (isWeekBoundary) {
        timeframeInfo.lastWeekNumber = currentWeek;
      }
      
      // Calculate weekly percent change consistently
      let weeklyPercentChange = null;
      
      // Always calculate weekly metrics for all days using daily data
      if (dateIndex >= 5) {
        const weekAgoIndex = dateIndex - 5; // Approximate a week of trading days
        const weekAgoDate = tradingDates[weekAgoIndex];
        const weekAgoBar = stockData[symbol].find(bar => matchDate(bar, weekAgoDate));
        
        if (weekAgoBar) {
          weeklyPercentChange = calculatePercentChange(currentBar.close, weekAgoBar.close);
          if (isWeekBoundary) {
            console.log(`[TIMEFRAME] Weekly change for ${symbol} on ${date}: ${weeklyPercentChange.toFixed(2)}%`);
          }
        }
      }
      
      // Monthly calculations
      let monthlyPercentChange = null;
      const isMonthBoundary = 
        dateIndex === 0 || // First data point
        currentYear !== prevDate.getUTCFullYear() || 
        currentMonth !== prevDate.getUTCMonth();
      
      // Update last month for consistency
      if (isMonthBoundary) {
        timeframeInfo.lastMonth = currentMonth;
      }
      
      // Look back for monthly data (~20 trading days)
      if (dateIndex >= 20) {
        const monthAgoIndex = dateIndex - 20;
        const monthAgoDate = tradingDates[monthAgoIndex];
        const monthAgoBar = stockData[symbol].find(bar => matchDate(bar, monthAgoDate));
        
        if (monthAgoBar) {
          monthlyPercentChange = calculatePercentChange(currentBar.close, monthAgoBar.close);
        }
      }
      
      // Check strategy actions
      strategy.actions.forEach(action => {
        // Log current processing details
        console.log(`[STRATEGY] Processing ${symbol} on ${date} for ${action.type} action with ${action.timeframe} timeframe`);
        console.log(`[STRATEGY] Current price: ${currentBar.close}, Previous price: ${previousBar?.close || 'N/A'}`);
        
        // Check if we should process this action based on timeframe
        const shouldProcess = 
          (action.timeframe === 'daily') || 
          (action.timeframe === 'weekly' && isWeekBoundary && weeklyPercentChange !== null) ||
          (action.timeframe === 'monthly' && isMonthBoundary && monthlyPercentChange !== null);
        
        console.log(`[STRATEGY] Should process for ${action.timeframe} timeframe: ${shouldProcess}`);
        console.log(`[STRATEGY] IsWeekBoundary: ${isWeekBoundary}, WeeklyPercentChange: ${weeklyPercentChange}`);
        
        if (shouldProcess) {
          // Log the condition we're checking
          console.log(`[STRATEGY] Checking condition:`, JSON.stringify(action.condition));
          
          // Determine the data to pass based on condition type
          let conditionMet = false;
          
          if (action.condition.type === 'consecutive') {
            // For consecutive conditions, pass the price history
            console.log(`[STRATEGY] Checking consecutive condition: ${action.condition.days} days ${action.condition.direction}`);
            console.log(`[STRATEGY] History data length: ${historyData[symbol]?.length || 0} days`);
            
            conditionMet = checkCondition(
              action.condition,
              { priceHistory: historyData[symbol] }
            );
          } else if (action.condition.type === 'pattern') {
            // For pattern conditions, also pass price history
            console.log(`[STRATEGY] Checking pattern condition: ${action.condition.pattern}`);
            
            conditionMet = checkCondition(
              action.condition,
              { priceHistory: historyData[symbol] }
            );
          } else if (action.condition.type === 'technical') {
            // For technical indicator conditions, pass the price history
            console.log(`[STRATEGY] Checking technical condition: ${action.condition.indicator}`);
            console.log(`[STRATEGY] History data length: ${historyData[symbol]?.length || 0} days`);
            
            // Check minimum data requirements for technical indicators
            const minDataRequired = (() => {
              const indicator = action.condition.indicator;
              const params = action.condition.params || {};
              
              switch (indicator) {
                case 'rsi':
                  return (params.period || 14) * 2; // RSI needs 2x period
                case 'macd':
                  return Math.max(
                    (params.fastPeriod || 12), 
                    (params.slowPeriod || 26)
                  ) + 10; // MACD needs longer history for signal
                case 'ma_relative':
                  return (params.period || 20) + 5;
                case 'bbands':
                  return (params.period || 20) + 5;
                case 'obv':
                  return 5; // OBV doesn't need much data
                case 'atr':
                  return (params.period || 14) + 5;
                case 'mfi':
                  return (params.period || 14) + 5;
                case 'volume_change':
                  return 2; // Just need current and previous
                default:
                  return 30; // Default to requiring a month of data
              }
            })();
            
            if (historyData[symbol]?.length < minDataRequired) {
              console.log(`[STRATEGY] Insufficient data for ${action.condition.indicator}. Need at least ${minDataRequired} data points, have ${historyData[symbol]?.length}`);
              conditionMet = false;
            } else {
              conditionMet = checkCondition(
                action.condition,
                { priceHistory: historyData[symbol] }
              );
            }
          } else {
            // For simple conditions (percent_change, price, etc.)
            let value;
            
            // Get the right value based on metric type
            if (action.condition.metric === 'percent_change') {
              if (action.timeframe === 'daily') {
                value = dailyPercentChange;
                console.log(`[STRATEGY] Daily percent change: ${dailyPercentChange.toFixed(2)}%`);
              } else if (action.timeframe === 'weekly') {
                value = weeklyPercentChange;
                console.log(`[STRATEGY] Weekly percent change: ${weeklyPercentChange?.toFixed(2)}%`);
              } else if (action.timeframe === 'monthly') {
                value = monthlyPercentChange;
                console.log(`[STRATEGY] Monthly percent change: ${monthlyPercentChange?.toFixed(2)}%`);
              }
            } else if (action.condition.metric === 'price') {
              value = currentBar.close;
              console.log(`[STRATEGY] Current price: ${currentBar.close}`);
            } else if (action.condition.metric === 'volume') {
              value = currentBar.volume;
              console.log(`[STRATEGY] Current volume: ${currentBar.volume}`);
            }
            
            if (value !== undefined) {
              console.log(`[STRATEGY] Checking ${action.condition.metric} ${action.condition.operator} ${action.condition.value}`);
              console.log(`[STRATEGY] Actual value: ${value}`);
              
              conditionMet = checkCondition(
                action.condition,
                { value: value }
              );
            }
          }
          
          console.log(`[STRATEGY] Condition met: ${conditionMet}`);
          
          // Only proceed if condition is met
          if (conditionMet) {
            // Calculate amount to buy/sell with new function that handles various amount types
            const amountData = calculateAmount(action.amount, totalPortfolioValue, currentBar.close);
            console.log(`[TRANSACTION] Executing ${action.type} for ${symbol} at $${currentBar.close}`);
            console.log(`[TRANSACTION] Portfolio value: $${totalPortfolioValue.toFixed(2)}, Cash: $${portfolio.cash.toFixed(2)}`);
            console.log(`[TRANSACTION] Transaction amount: $${amountData.dollars.toFixed(2)}, ${amountData.shares.toFixed(4)} shares`);
            
            if (action.type === 'buy') {
              // Buy logic (can be going long or covering a short)
              if (portfolio.cash >= amountData.dollars) {
                const quantity = amountData.shares;
                const currentQuantity = portfolio.positions[symbol] || 0;
                
                // Update positions and cost basis
                portfolio.positions[symbol] = currentQuantity + quantity;
                
                // Track cost basis - different handling for long vs covering shorts
                if (portfolio.positionCost[symbol] === undefined) {
                  portfolio.positionCost[symbol] = 0;
                  console.log(`[COST BASIS] Initializing ${symbol} cost basis to 0`);
                }
                
                if (currentQuantity < 0) {
                  // Covering a short position - reduce cost basis proportionally 
                  const coverRatio = Math.min(1, quantity / Math.abs(currentQuantity));
                  const oldCost = portfolio.positionCost[symbol];
                  portfolio.positionCost[symbol] *= (1 - coverRatio);
                  console.log(`[COST BASIS] Updated ${symbol} cost basis from $${oldCost.toFixed(2)} to $${portfolio.positionCost[symbol].toFixed(2)} after covering short`);
                } else {
                  // Adding to a long position - increase cost basis with dollar-weighted average
                  const oldQuantity = currentQuantity;
                  const newQuantity = oldQuantity + quantity;
                  const oldCost = portfolio.positionCost[symbol];
                  
                  // Update cost basis
                  portfolio.positionCost[symbol] = oldCost + amountData.dollars;
                  
                  // Calculate and log the average cost
                  const avgCost = newQuantity > 0 ? (portfolio.positionCost[symbol] / newQuantity) : 0;
                  console.log(`[COST BASIS] Updated ${symbol} cost basis to $${portfolio.positionCost[symbol].toFixed(2)} after buying ${quantity.toFixed(4)} shares`);
                  console.log(`[COST BASIS] New average cost for ${symbol}: $${avgCost.toFixed(2)} per share`);
                }
                
                // Update cash balance
                portfolio.cash -= amountData.dollars;
                console.log(`[TRANSACTION] Cash reduced by $${amountData.dollars.toFixed(2)} to $${portfolio.cash.toFixed(2)}`);
                
                // Determine if this is covering a short or going long
                const transactionType = currentQuantity < 0 ? 'cover_short' : 'buy';
                console.log(`[TRANSACTION] ${transactionType.toUpperCase()} ${quantity.toFixed(4)} shares of ${symbol} at $${currentBar.close} for $${amountData.dollars.toFixed(2)}`);
                console.log(`[TRANSACTION] Position changes from ${currentQuantity.toFixed(4)} to ${portfolio.positions[symbol].toFixed(4)} shares`);
                
                // Record transaction - include the amount type and cost basis for transparency
                portfolio.transactions.push({
                  date,
                  symbol,
                  type: transactionType,
                  price: currentBar.close,
                  quantity,
                  amount: amountData.dollars,
                  amountType: action.amount.type,
                  amountValue: action.amount.value,
                  positionAfter: portfolio.positions[symbol],
                  costBasisAfter: portfolio.positionCost[symbol],
                  conditionDetails: JSON.stringify(action.condition)
                });
              } else {
                console.log(`[TRANSACTION] Insufficient cash ($${portfolio.cash.toFixed(2)}) to buy $${amountData.dollars.toFixed(2)} of ${symbol}`);
              }
            } else if (action.type === 'sell') {
              // Sell logic (can be liquidating a long or going short)
              const currentQuantity = portfolio.positions[symbol] || 0;
              
              // Handle special case for shares-based amounts when selling
              let sellQuantity, sellAmount;
              
              if (action.amount.type === 'shares') {
                // Direct share amount (up to available)
                sellQuantity = Math.min(amountData.shares, currentQuantity > 0 ? currentQuantity : Number.MAX_SAFE_INTEGER);
                sellAmount = sellQuantity * currentBar.close;
              } else {
                // Dollar-based or percentage amount
                if (currentQuantity > 0) {
                  // Limit to available shares if liquidating a long position
                  const maxSellAmount = currentQuantity * currentBar.close;
                  sellAmount = Math.min(amountData.dollars, maxSellAmount);
                  sellQuantity = sellAmount / currentBar.close;
                } else {
                  // No limit if going short
                  sellAmount = amountData.dollars;
                  sellQuantity = amountData.shares;
                }
              }
              
              // Initialize cost basis tracking if not exists
              if (portfolio.positionCost[symbol] === undefined) {
                portfolio.positionCost[symbol] = 0;
                console.log(`[COST BASIS] Initializing ${symbol} cost basis to 0`);
              }
              
              // Handle cost basis differently for selling long vs going short
              if (currentQuantity > 0) {
                // Selling long position - reduce cost basis proportionally
                const sellRatio = Math.min(1, sellQuantity / currentQuantity);
                const costBasisReduction = portfolio.positionCost[symbol] * sellRatio;
                const oldCost = portfolio.positionCost[symbol];
                portfolio.positionCost[symbol] -= costBasisReduction;
                
                // Calculate remaining position and new average cost
                const remainingQuantity = currentQuantity - sellQuantity;
                const avgCost = remainingQuantity > 0 ? (portfolio.positionCost[symbol] / remainingQuantity) : 0;
                
                console.log(`[COST BASIS] Reduced ${symbol} cost basis by $${costBasisReduction.toFixed(2)} to $${portfolio.positionCost[symbol].toFixed(2)} after selling`);
                console.log(`[COST BASIS] New average cost for ${symbol}: $${avgCost.toFixed(2)} per share`);
              } else if (currentQuantity <= 0) {
                // Increasing short position - track as negative cost basis
                const oldCost = portfolio.positionCost[symbol];
                portfolio.positionCost[symbol] -= sellAmount; // Negative cost for shorts
                
                // Calculate new average cost for short position (negative quantity)
                const newQuantity = currentQuantity - sellQuantity;
                const avgCost = newQuantity < 0 ? (Math.abs(portfolio.positionCost[symbol]) / Math.abs(newQuantity)) : 0;
                
                console.log(`[COST BASIS] Updated ${symbol} short position cost basis from $${oldCost.toFixed(2)} to $${portfolio.positionCost[symbol].toFixed(2)}`);
                console.log(`[COST BASIS] New average cost for short position: $${avgCost.toFixed(2)} per share`);
              }
              
              // Allow shorting - always allow sell transactions regardless of current position
              portfolio.positions[symbol] = currentQuantity - sellQuantity;
              portfolio.cash += sellAmount;
              console.log(`[TRANSACTION] Cash increased by $${sellAmount.toFixed(2)} to $${portfolio.cash.toFixed(2)}`);
              
              // Determine if this is going short or selling existing long position
              const transactionType = currentQuantity > 0 ? 'sell' : 'short';
              console.log(`[TRANSACTION] ${transactionType.toUpperCase()} ${sellQuantity.toFixed(4)} shares of ${symbol} at $${currentBar.close} for $${sellAmount.toFixed(2)}`);
              console.log(`[TRANSACTION] Position changes from ${currentQuantity.toFixed(4)} to ${portfolio.positions[symbol].toFixed(4)} shares`);
              
              // Record transaction - include the amount type and cost basis for transparency
              portfolio.transactions.push({
                date,
                symbol,
                type: transactionType,
                price: currentBar.close,
                quantity: sellQuantity,
                amount: sellAmount,
                amountType: action.amount.type,
                amountValue: action.amount.value,
                positionAfter: portfolio.positions[symbol],
                costBasisAfter: portfolio.positionCost[symbol],
                conditionDetails: JSON.stringify(action.condition)
              });
            } else if (action.type === 'short') {
              // Explicit short - always creates a negative position
              const shortQuantity = amountData.shares;
              const shortAmount = amountData.dollars;
              const currentQuantity = portfolio.positions[symbol] || 0;
              
              // Initialize cost basis if needed
              if (portfolio.positionCost[symbol] === undefined) {
                portfolio.positionCost[symbol] = 0;
                console.log(`[COST BASIS] Initializing ${symbol} cost basis to 0`);
              }
              
              // For shorts, track negative cost basis
              portfolio.positionCost[symbol] -= shortAmount;
              console.log(`[COST BASIS] Updated ${symbol} short position cost basis to $${portfolio.positionCost[symbol].toFixed(2)}`);
              
              // Update positions - make more negative
              portfolio.positions[symbol] = currentQuantity - shortQuantity;
              portfolio.cash += shortAmount;
              console.log(`[TRANSACTION] Cash increased by $${shortAmount.toFixed(2)} to $${portfolio.cash.toFixed(2)}`);
              
              console.log(`[TRANSACTION] SHORT ${shortQuantity.toFixed(4)} shares of ${symbol} at $${currentBar.close} for $${shortAmount.toFixed(2)}`);
              console.log(`[TRANSACTION] Position changes from ${currentQuantity.toFixed(4)} to ${portfolio.positions[symbol].toFixed(4)} shares`);
              
              // Record transaction - include the amount type and cost basis for transparency
              portfolio.transactions.push({
                date,
                symbol,
                type: 'short',
                price: currentBar.close,
                quantity: shortQuantity,
                amount: shortAmount,
                amountType: action.amount.type,
                amountValue: action.amount.value,
                positionAfter: portfolio.positions[symbol],
                costBasisAfter: portfolio.positionCost[symbol],
                conditionDetails: JSON.stringify(action.condition)
              });
            }
          }
        }
      });
      
      // Store current bar as previous for next iteration
      previousData[symbol] = currentBar;
    });
  });
  
  // Calculate performance metrics
  const portfolioFinalValue = portfolio.valueHistory[portfolio.valueHistory.length - 1].value;
  
  // Log all position costs for debugging
  console.log('[COST BASIS] Final position cost records:');
  Object.entries(portfolio.positionCost).forEach(([symbol, cost]) => {
    const quantity = portfolio.positions[symbol] || 0;
    if (quantity !== 0) {
      const avgCost = Math.abs(cost) / Math.abs(quantity);
      console.log(`[COST BASIS] ${symbol}: ${quantity.toFixed(4)} shares, cost basis $${cost.toFixed(2)}, avg cost $${avgCost.toFixed(2)}`);
    }
  });
  
  // Total return
  portfolio.metrics.totalReturn = ((portfolioFinalValue - initialCash) / initialCash) * 100;
  
  // Max drawdown
  let peak = initialCash;
  let maxDrawdown = 0;
  
  portfolio.valueHistory.forEach(point => {
    if (point.value > peak) {
      peak = point.value;
    }
    
    const drawdown = ((peak - point.value) / peak) * 100;
    if (drawdown > maxDrawdown) {
      maxDrawdown = drawdown;
    }
  });
  
  portfolio.metrics.maxDrawdown = maxDrawdown;
  
  // Simplified Sharpe ratio calculation (not accounting for risk-free rate)
  const returns = [];
  for (let i = 1; i < portfolio.valueHistory.length; i++) {
    const dailyReturn = (portfolio.valueHistory[i].value - portfolio.valueHistory[i-1].value) / 
                      portfolio.valueHistory[i-1].value;
    returns.push(dailyReturn);
  }
  
  const avgReturn = returns.reduce((sum, val) => sum + val, 0) / returns.length;
  const stdDeviation = Math.sqrt(
    returns.reduce((sum, val) => sum + Math.pow(val - avgReturn, 2), 0) / returns.length
  );
  
  portfolio.metrics.sharpeRatio = stdDeviation === 0 ? 0 : (avgReturn / stdDeviation) * Math.sqrt(252); // Annualized
  
  // Add the stock data to the portfolio results for charting
  portfolio._stockData = stockData;
  
  // Make one final pass to update position costs - this ensures the values are accessible in the results
  portfolio.positionAvgCost = {};
  
  Object.entries(portfolio.positions).forEach(([symbol, quantity]) => {
    if (quantity !== 0) {
      const absQuantity = Math.abs(quantity);
      const absPositionCost = Math.abs(portfolio.positionCost[symbol] || 0);
      const avgCost = absQuantity > 0 ? (absPositionCost / absQuantity) : 0;
      portfolio.positionAvgCost[symbol] = avgCost;
      console.log(`[FINAL COST] ${symbol}: ${quantity} shares, avg cost: $${avgCost.toFixed(2)}`);
    }
  });
  
  // Verify final portfolio value reconciles with individual components
  const calculatedFinalValue = portfolio.cash + 
    Object.entries(portfolio.positions).reduce((total, [symbol, quantity]) => {
      const lastPrice = portfolio.transactions
        .filter(tx => tx.symbol === symbol)
        .slice(-1)[0]?.price || 0;
      return total + (quantity * lastPrice);
    }, 0);
  
  console.log(`[FINAL VERIFICATION] Portfolio final value: $${portfolioFinalValue.toFixed(2)}`);
  console.log(`[FINAL VERIFICATION] Sum of components: $${calculatedFinalValue.toFixed(2)}`);
  console.log(`[FINAL VERIFICATION] Cash: $${portfolio.cash.toFixed(2)}`);
  
  if (Math.abs(portfolioFinalValue - calculatedFinalValue) > 0.01) {
    console.warn(`[FINAL VERIFICATION] Value discrepancy detected: ${portfolioFinalValue.toFixed(2)} vs ${calculatedFinalValue.toFixed(2)}`);
  } else {
    console.log(`[FINAL VERIFICATION] Values are consistent`);
  }
  
  // Add a consistency check status to the metrics
  portfolio.metrics.valuesConsistent = Math.abs(portfolioFinalValue - calculatedFinalValue) <= 0.01;
  
  return portfolio;
}

module.exports = {
  runBacktest
};