/**
 * Technical indicators module for stock backtesting
 */

/**
 * Calculates a simple moving average (SMA)
 * @param {Array} data - Array of price objects with 'close' property
 * @param {number} period - Period for the moving average
 * @returns {Array} Array of SMA values (same length as input, with NaN for periods with insufficient data)
 */
function calculateSMA(data, period) {
  const result = Array(data.length).fill(NaN);
  
  for (let i = period - 1; i < data.length; i++) {
    let sum = 0;
    for (let j = 0; j < period; j++) {
      sum += data[i - j].close;
    }
    result[i] = sum / period;
  }
  
  return result;
}

/**
 * Calculates an exponential moving average (EMA)
 * @param {Array} data - Array of price objects with 'close' property
 * @param {number} period - Period for the moving average
 * @returns {Array} Array of EMA values (same length as input, with NaN for periods with insufficient data)
 */
function calculateEMA(data, period) {
  const result = Array(data.length).fill(NaN);
  const k = 2 / (period + 1);
  
  // Start with SMA for the first value
  let sum = 0;
  for (let i = 0; i < period; i++) {
    sum += data[i].close;
  }
  result[period - 1] = sum / period;
  
  // Calculate EMA for the rest
  for (let i = period; i < data.length; i++) {
    result[i] = (data[i].close - result[i - 1]) * k + result[i - 1];
  }
  
  return result;
}

/**
 * Calculates Relative Strength Index (RSI)
 * @param {Array} data - Array of price objects with 'close' property
 * @param {number} period - Period for RSI calculation (typically 14)
 * @returns {Array} Array of RSI values (same length as input, with NaN for periods with insufficient data)
 */
function calculateRSI(data, period) {
  const result = Array(data.length).fill(NaN);
  
  if (data.length <= period) {
    return result;
  }
  
  // Calculate price changes
  const changes = [];
  for (let i = 1; i < data.length; i++) {
    changes.push(data[i].close - data[i - 1].close);
  }
  
  // Calculate initial average gains and losses
  let avgGain = 0;
  let avgLoss = 0;
  
  for (let i = 0; i < period; i++) {
    const change = changes[i];
    if (change > 0) {
      avgGain += change;
    } else {
      avgLoss += Math.abs(change);
    }
  }
  
  avgGain /= period;
  avgLoss /= period;
  
  // Calculate first RSI
  let rs = avgGain / (avgLoss === 0 ? 0.001 : avgLoss); // Avoid division by zero
  result[period] = 100 - (100 / (1 + rs));
  
  // Calculate RSI for the remaining data
  for (let i = period + 1; i < data.length; i++) {
    const change = changes[i - 1];
    const gain = change > 0 ? change : 0;
    const loss = change < 0 ? Math.abs(change) : 0;
    
    // Use smoothed averages (Wilder's method)
    avgGain = ((avgGain * (period - 1)) + gain) / period;
    avgLoss = ((avgLoss * (period - 1)) + loss) / period;
    
    rs = avgGain / (avgLoss === 0 ? 0.001 : avgLoss); // Avoid division by zero
    result[i] = 100 - (100 / (1 + rs));
  }
  
  return result;
}

/**
 * Calculates Moving Average Convergence Divergence (MACD)
 * @param {Array} data - Array of price objects with 'close' property
 * @param {number} fastPeriod - Fast EMA period (typically 12)
 * @param {number} slowPeriod - Slow EMA period (typically 26)
 * @param {number} signalPeriod - Signal line period (typically 9)
 * @returns {Object} Object with 'macd', 'signal', and 'histogram' arrays
 */
function calculateMACD(data, fastPeriod = 12, slowPeriod = 26, signalPeriod = 9) {
  const fastEMA = calculateEMA(data, fastPeriod);
  const slowEMA = calculateEMA(data, slowPeriod);
  
  const macdLine = Array(data.length).fill(NaN);
  
  // Calculate MACD line
  for (let i = 0; i < data.length; i++) {
    if (!isNaN(fastEMA[i]) && !isNaN(slowEMA[i])) {
      macdLine[i] = fastEMA[i] - slowEMA[i];
    }
  }
  
  // Calculate signal line (EMA of MACD line)
  const signalLine = [];
  const macdData = macdLine.map((value, index) => ({ close: value }));
  const signalEMA = calculateEMA(macdData.filter(item => !isNaN(item.close)), signalPeriod);
  
  let signalIndex = 0;
  for (let i = 0; i < macdLine.length; i++) {
    if (!isNaN(macdLine[i])) {
      // Calculate signal line using signalPeriod
      if (signalIndex >= signalPeriod - 1) {
        signalLine[i] = signalEMA[signalIndex - (signalPeriod - 1)];
      } else {
        signalLine[i] = NaN;
      }
      signalIndex++;
    } else {
      signalLine[i] = NaN;
    }
  }
  
  // Calculate histogram
  const histogram = macdLine.map((value, index) => {
    if (!isNaN(value) && !isNaN(signalLine[index])) {
      return value - signalLine[index];
    }
    return NaN;
  });
  
  return {
    macd: macdLine,
    signal: signalLine,
    histogram: histogram
  };
}

/**
 * Calculates Volume Weighted Moving Average (VWMA)
 * @param {Array} data - Array of price objects with 'close' and 'volume' properties
 * @param {number} period - Period for VWMA
 * @returns {Array} Array of VWMA values
 */
function calculateVWMA(data, period) {
  const result = Array(data.length).fill(NaN);
  
  for (let i = period - 1; i < data.length; i++) {
    let volumeSum = 0;
    let volumePriceSum = 0;
    
    for (let j = 0; j < period; j++) {
      volumeSum += data[i - j].volume;
      volumePriceSum += data[i - j].close * data[i - j].volume;
    }
    
    if (volumeSum !== 0) {
      result[i] = volumePriceSum / volumeSum;
    }
  }
  
  return result;
}

/**
 * Calculates Bollinger Bands
 * @param {Array} data - Array of price objects with 'close' property
 * @param {number} period - Period for SMA (typically 20)
 * @param {number} multiplier - Standard deviation multiplier (typically 2)
 * @returns {Object} Object with 'upper', 'middle', 'lower' band arrays and 'width' arrays
 */
function calculateBollingerBands(data, period = 20, multiplier = 2) {
  const middle = calculateSMA(data, period);
  const upper = Array(data.length).fill(NaN);
  const lower = Array(data.length).fill(NaN);
  const width = Array(data.length).fill(NaN);
  
  for (let i = period - 1; i < data.length; i++) {
    let sumSquaredDiff = 0;
    
    for (let j = 0; j < period; j++) {
      sumSquaredDiff += Math.pow(data[i - j].close - middle[i], 2);
    }
    
    const stdDev = Math.sqrt(sumSquaredDiff / period);
    
    upper[i] = middle[i] + (multiplier * stdDev);
    lower[i] = middle[i] - (multiplier * stdDev);
    
    // Calculate Bollinger Band width as a percentage of the middle band
    width[i] = ((upper[i] - lower[i]) / middle[i]) * 100;
  }
  
  return {
    upper,
    middle,
    lower,
    width
  };
}

/**
 * Calculates Bollinger Bands Width changes (percentage)
 * @param {Array} data - Array of price objects with 'close' property
 * @param {number} period - Period for SMA (typically 20)
 * @param {number} multiplier - Standard deviation multiplier (typically 2)
 * @param {number} lookback - Lookback period for calculating width change (default: 1)
 * @returns {Array} Array of width percentage changes
 */
function calculateBollingerBandsWidthChange(data, period = 20, multiplier = 2, lookback = 1) {
  const bbands = calculateBollingerBands(data, period, multiplier);
  const widthChangePercent = Array(data.length).fill(NaN);
  
  for (let i = period - 1 + lookback; i < data.length; i++) {
    if (!isNaN(bbands.width[i]) && !isNaN(bbands.width[i - lookback]) && bbands.width[i - lookback] !== 0) {
      widthChangePercent[i] = ((bbands.width[i] - bbands.width[i - lookback]) / bbands.width[i - lookback]) * 100;
    }
  }
  
  return widthChangePercent;
}

/**
 * Calculates On-Balance Volume (OBV)
 * @param {Array} data - Array of price objects with 'close' and 'volume' properties
 * @returns {Array} Array of OBV values
 */
function calculateOBV(data) {
  const result = Array(data.length).fill(NaN);
  result[0] = 0;
  
  for (let i = 1; i < data.length; i++) {
    const currentClose = data[i].close;
    const previousClose = data[i - 1].close;
    const currentVolume = data[i].volume;
    
    if (currentClose > previousClose) {
      result[i] = result[i - 1] + currentVolume;
    } else if (currentClose < previousClose) {
      result[i] = result[i - 1] - currentVolume;
    } else {
      result[i] = result[i - 1];
    }
  }
  
  return result;
}

/**
 * Calculates On-Balance Volume (OBV) Divergence
 * @param {Array} data - Array of price objects with 'close' and 'volume' properties
 * @param {number} period - Period for calculating divergence (default: 14)
 * @returns {Array} Array of OBV divergence values (positive values indicate positive divergence)
 */
function calculateOBVDivergence(data, period = 14) {
  const obv = calculateOBV(data);
  const result = Array(data.length).fill(NaN);
  
  for (let i = period; i < data.length; i++) {
    // Calculate price change over period
    const priceChange = ((data[i].close - data[i - period].close) / data[i - period].close) * 100;
    
    // Calculate OBV change over period
    const obvChange = obv[i] - obv[i - period];
    const obvPercentChange = obv[i - period] !== 0 ? (obvChange / Math.abs(obv[i - period])) * 100 : 0;
    
    // Calculate divergence
    // Positive values indicate positive divergence (OBV going up while price goes down)
    // Negative values indicate negative divergence (OBV going down while price goes up)
    result[i] = obvPercentChange - priceChange;
  }
  
  return result;
}

/**
 * Calculates Price Relative to Moving Average
 * @param {Array} data - Array of price objects with 'close' property
 * @param {number} period - Period for moving average
 * @returns {Array} Array of percentage deviations from moving average
 */
function calculatePriceRelativeToMA(data, period) {
  const ma = calculateSMA(data, period);
  const result = Array(data.length).fill(NaN);
  
  for (let i = period - 1; i < data.length; i++) {
    if (!isNaN(ma[i])) {
      result[i] = ((data[i].close - ma[i]) / ma[i]) * 100;
    }
  }
  
  return result;
}

/**
 * Calculates Average True Range (ATR)
 * @param {Array} data - Array of price objects with 'high', 'low', and 'close' properties
 * @param {number} period - Period for ATR calculation (typically 14)
 * @returns {Array} Array of ATR values
 */
function calculateATR(data, period = 14) {
  const trueRanges = Array(data.length).fill(NaN);
  const result = Array(data.length).fill(NaN);
  
  // Calculate True Range for each period
  for (let i = 1; i < data.length; i++) {
    const high = data[i].high;
    const low = data[i].low;
    const prevClose = data[i - 1].close;
    
    const tr1 = high - low;
    const tr2 = Math.abs(high - prevClose);
    const tr3 = Math.abs(low - prevClose);
    
    trueRanges[i] = Math.max(tr1, tr2, tr3);
  }
  
  // Calculate first ATR as simple average of true ranges
  let firstATR = 0;
  for (let i = 1; i <= period; i++) {
    firstATR += trueRanges[i];
  }
  result[period] = firstATR / period;
  
  // Calculate subsequent ATRs with smoothing
  for (let i = period + 1; i < data.length; i++) {
    result[i] = ((result[i - 1] * (period - 1)) + trueRanges[i]) / period;
  }
  
  return result;
}

/**
 * Calculates Average True Range (ATR) percentage change
 * @param {Array} data - Array of price objects with 'high', 'low', and 'close' properties
 * @param {number} period - Period for ATR calculation (typically 14)
 * @param {number} lookback - Lookback period for calculating ATR change (default: 5)
 * @returns {Array} Array of ATR percentage change values
 */
function calculateATRChange(data, period = 14, lookback = 5) {
  const atr = calculateATR(data, period);
  const result = Array(data.length).fill(NaN);
  
  for (let i = period + lookback; i < data.length; i++) {
    if (!isNaN(atr[i]) && !isNaN(atr[i - lookback]) && atr[i - lookback] !== 0) {
      result[i] = ((atr[i] - atr[i - lookback]) / atr[i - lookback]) * 100;
    }
  }
  
  return result;
}

/**
 * Calculates Money Flow Index (MFI)
 * @param {Array} data - Array of price objects with 'high', 'low', 'close', and 'volume' properties
 * @param {number} period - Period for MFI calculation (typically 14)
 * @returns {Array} Array of MFI values
 */
function calculateMFI(data, period = 14) {
  const result = Array(data.length).fill(NaN);
  
  // Calculate typical price for each day
  const typicalPrices = data.map(item => (item.high + item.low + item.close) / 3);
  
  // Calculate raw money flow
  const rawMoneyFlows = typicalPrices.map((tp, i) => tp * data[i].volume);
  
  // Calculate positive and negative money flows
  for (let i = period; i < data.length; i++) {
    let positiveFlow = 0;
    let negativeFlow = 0;
    
    for (let j = i - period + 1; j <= i; j++) {
      if (j > 0) {
        if (typicalPrices[j] > typicalPrices[j - 1]) {
          positiveFlow += rawMoneyFlows[j];
        } else if (typicalPrices[j] < typicalPrices[j - 1]) {
          negativeFlow += rawMoneyFlows[j];
        }
      }
    }
    
    if (negativeFlow === 0) {
      result[i] = 100;
    } else {
      const moneyFlowRatio = positiveFlow / negativeFlow;
      result[i] = 100 - (100 / (1 + moneyFlowRatio));
    }
  }
  
  return result;
}

/**
 * Detects price gaps between closing and opening prices
 * @param {Array} data - Array of price objects with 'open', 'close', 'high', 'low' properties
 * @param {number} minGapPercent - Minimum gap percentage to consider (default: 1.0)
 * @returns {Array} Array of gap objects {value: gapPercent, type: 'up'|'down'}
 */
function detectGaps(data, minGapPercent = 1.0) {
  const result = Array(data.length).fill(null);
  
  for (let i = 1; i < data.length; i++) {
    const prevClose = data[i - 1].close;
    const currentOpen = data[i].open;
    
    // Calculate gap percentage
    const gapPercent = ((currentOpen - prevClose) / prevClose) * 100;
    
    // Only record if gap exceeds minimum threshold
    if (Math.abs(gapPercent) >= minGapPercent) {
      result[i] = {
        value: gapPercent,
        type: gapPercent > 0 ? 'up' : 'down'
      };
    }
  }
  
  return result;
}

/**
 * Check for day trading signals where a stock should be bought at open and sold at close
 * @param {Array} data - Array of price objects with 'open', 'close', 'high', 'low' properties
 * @param {Object} params - Parameters for detecting day trading signals
 * @param {number} params.gapThreshold - Minimum gap percentage to trigger a signal (default: 3.0)
 * @param {string} params.gapDirection - Direction of gap to look for ('up', 'down', or 'both', default: 'both')
 * @returns {Array} Array of signal objects {signal: boolean, gapPercent: number, gapDirection: 'up'|'down'}
 */
function detectDayTradingSignals(data, params = {}) {
  const gapThreshold = params.gapThreshold || 3.0;
  const gapDirection = params.gapDirection || 'both';
  const result = Array(data.length).fill(null);
  
  // First detect all gaps
  const gaps = detectGaps(data, 0); // Use 0 threshold to detect all gaps, we'll filter by threshold
  
  for (let i = 1; i < data.length; i++) {
    const gap = gaps[i];
    
    if (gap) {
      // Check if the gap meets our threshold and direction requirements
      const meetsThreshold = Math.abs(gap.value) >= gapThreshold;
      const meetsDirection = 
        gapDirection === 'both' || 
        (gapDirection === 'up' && gap.type === 'up') ||
        (gapDirection === 'down' && gap.type === 'down');
      
      if (meetsThreshold && meetsDirection) {
        result[i] = {
          signal: true,
          gapPercent: gap.value,
          gapDirection: gap.type
        };
      }
    }
  }
  
  return result;
}

/**
 * Detect double bottom pattern
 * @param {Array} data - Array of price objects with 'close', 'low' properties
 * @param {number} lookbackPeriod - Number of bars to look back (default: 40)
 * @param {number} maxBottomVariation - Maximum percentage variation between the two bottoms (default: 3.0)
 * @returns {Array} Array of boolean values (true when pattern detected)
 */
function detectDoubleBottom(data, lookbackPeriod = 40, maxBottomVariation = 3.0) {
  const result = Array(data.length).fill(false);
  
  // Need at least lookbackPeriod bars to find the pattern
  if (data.length < lookbackPeriod) {
    return result;
  }
  
  for (let i = lookbackPeriod; i < data.length; i++) {
    // Get section of data to analyze
    const section = data.slice(i - lookbackPeriod, i + 1);
    
    // Find local minimums (potential bottoms)
    const localMins = [];
    
    for (let j = 1; j < section.length - 1; j++) {
      if (section[j].low < section[j - 1].low && 
          section[j].low < section[j + 1].low) {
        localMins.push({
          index: j,
          value: section[j].low
        });
      }
    }
    
    // Need at least 2 local minimums
    if (localMins.length < 2) {
      continue;
    }
    
    // Check pairs of bottoms to see if they form a double bottom
    for (let b = 0; b < localMins.length - 1; b++) {
      for (let c = b + 1; c < localMins.length; c++) {
        const bottom1 = localMins[b];
        const bottom2 = localMins[c];
        
        // Ensure bottoms are not too close together (at least 10 bars apart)
        if (bottom2.index - bottom1.index < 10) {
          continue;
        }
        
        // Calculate variation between bottoms
        const variation = Math.abs((bottom2.value - bottom1.value) / bottom1.value) * 100;
        
        if (variation <= maxBottomVariation) {
          // Check that the price between bottoms rose by at least 5%
          const middleHigh = Math.max(...section.slice(bottom1.index, bottom2.index).map(bar => bar.high));
          const risePercent = ((middleHigh - bottom1.value) / bottom1.value) * 100;
          
          if (risePercent >= 5) {
            // Check that current price is higher than middle price
            const currentPrice = section[section.length - 1].close;
            if (currentPrice > middleHigh) {
              result[i] = true;
              break;
            }
          }
        }
      }
      
      if (result[i]) {
        break;
      }
    }
  }
  
  return result;
}

/**
 * Calculate Mean Reversion indicator
 * @param {Array} data - Array of price objects with 'close' property
 * @param {number} period - Lookback period for mean calculation (default: 20)
 * @returns {Array} Array of deviation values from mean (in percent)
 */
function calculateMeanReversion(data, period = 20) {
  const result = Array(data.length).fill(NaN);
  
  // Calculate moving average as the "mean"
  const ma = calculateSMA(data, period);
  
  for (let i = period - 1; i < data.length; i++) {
    if (!isNaN(ma[i])) {
      // Calculate percent deviation from mean
      result[i] = ((data[i].close - ma[i]) / ma[i]) * 100;
    }
  }
  
  return result;
}

module.exports = {
  calculateSMA,
  calculateEMA,
  calculateRSI,
  calculateMACD,
  calculateVWMA,
  calculateBollingerBands,
  calculateBollingerBandsWidthChange,
  calculateOBV,
  calculateOBVDivergence,
  calculatePriceRelativeToMA,
  calculateATR,
  calculateATRChange,
  calculateMFI,
  detectGaps,
  detectDoubleBottom,
  calculateMeanReversion,
  detectDayTradingSignals
};