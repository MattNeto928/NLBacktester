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
 * @returns {Object} Object with 'upper', 'middle', and 'lower' band arrays
 */
function calculateBollingerBands(data, period = 20, multiplier = 2) {
  const middle = calculateSMA(data, period);
  const upper = Array(data.length).fill(NaN);
  const lower = Array(data.length).fill(NaN);
  
  for (let i = period - 1; i < data.length; i++) {
    let sumSquaredDiff = 0;
    
    for (let j = 0; j < period; j++) {
      sumSquaredDiff += Math.pow(data[i - j].close - middle[i], 2);
    }
    
    const stdDev = Math.sqrt(sumSquaredDiff / period);
    
    upper[i] = middle[i] + (multiplier * stdDev);
    lower[i] = middle[i] - (multiplier * stdDev);
  }
  
  return {
    upper,
    middle,
    lower
  };
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

module.exports = {
  calculateSMA,
  calculateEMA,
  calculateRSI,
  calculateMACD,
  calculateVWMA,
  calculateBollingerBands,
  calculateOBV,
  calculatePriceRelativeToMA,
  calculateATR,
  calculateMFI
};