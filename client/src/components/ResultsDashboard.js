import { useState } from 'react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  BarChart,
  Bar,
  Legend,
  LineChart,
  Line,
  ReferenceDot,
  ReferenceLine,
  ComposedChart
} from 'recharts';

const formatCurrency = (value) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2
  }).format(value);
};

const formatDate = (dateString) => {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
};

const MetricCard = ({ title, value, suffix = '', description }) => (
  <div className="bg-white overflow-hidden shadow rounded-lg">
    <div className="px-4 py-5 sm:p-6">
      <dt className="text-sm font-medium text-gray-500 truncate">
        {title}
      </dt>
      <dd className="mt-1 text-3xl font-semibold text-gray-900">
        {value !== null && value !== undefined ? `${value}${suffix}` : 'N/A'}
      </dd>
      {description && (
        <p className="mt-2 text-sm text-gray-500">
          {description}
        </p>
      )}
    </div>
  </div>
);

// Technical Indicator Chart component
const TechnicalIndicatorChart = ({ 
  stockData, 
  indicator, 
  params = {}, 
  syncId, // Add syncId parameter for chart synchronization 
  activeDot = false // Whether to show active dot on hover
}) => {
  if (!stockData || stockData.length === 0) return null;

  // Calculate technical indicators based on the selected type
  const calculateIndicator = (data, indicator, params) => {
    const calculateSMA = (data, period) => {
      const result = [];
      for (let i = 0; i < data.length; i++) {
        if (i < period - 1) {
          result.push({ ...data[i], indicator: null });
        } else {
          let sum = 0;
          for (let j = 0; j < period; j++) {
            sum += data[i - j].close;
          }
          result.push({ ...data[i], indicator: sum / period });
        }
      }
      return result;
    };

    const calculateEMA = (data, period, valueKey = 'close') => {
      const result = Array(data.length).fill(null);
      
      // Start with SMA for the first value
      let sum = 0;
      for (let i = 0; i < period && i < data.length; i++) {
        sum += data[i][valueKey];
      }
      
      if (period <= data.length) {
        result[period - 1] = sum / period;
        
        // Calculate EMA for the rest
        const multiplier = 2 / (period + 1);
        for (let i = period; i < data.length; i++) {
          result[i] = ((data[i][valueKey] - result[i - 1]) * multiplier) + result[i - 1];
        }
      }
      
      return result;
    };

    const calculateRSI = (data, period = 14) => {
      const result = [];
      
      // Calculate price changes
      const changes = [];
      for (let i = 1; i < data.length; i++) {
        changes.push(data[i].close - data[i-1].close);
      }
      
      // Push initial null values for the initial period
      for (let i = 0; i < period; i++) {
        result.push({ ...data[i], indicator: null });
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
      result[period] = { ...data[period], indicator: 100 - (100 / (1 + rs)) };
      
      // Calculate RSI for the remaining data
      for (let i = period + 1; i < data.length; i++) {
        const change = changes[i - 1];
        const gain = change > 0 ? change : 0;
        const loss = change < 0 ? Math.abs(change) : 0;
        
        // Use smoothed averages (Wilder's method)
        avgGain = ((avgGain * (period - 1)) + gain) / period;
        avgLoss = ((avgLoss * (period - 1)) + loss) / period;
        
        rs = avgGain / (avgLoss === 0 ? 0.001 : avgLoss); // Avoid division by zero
        result.push({ ...data[i], indicator: 100 - (100 / (1 + rs)) });
      }
      
      return result;
    };

    const calculateMACD = (data, { fastPeriod = 12, slowPeriod = 26, signalPeriod = 9 }) => {
      // Make sure we have enough data
      if (data.length < Math.max(fastPeriod, slowPeriod) + signalPeriod) {
        console.warn("Not enough data for accurate MACD calculation");
      }
      
      // Calculate fast and slow EMAs
      const fastEMA = calculateEMA(data, fastPeriod);
      const slowEMA = calculateEMA(data, slowPeriod);
      
      // Create result data array with MACD line
      const resultData = data.map((item, i) => {
        // MACD is fast EMA - slow EMA
        let macdValue = null;
        if (fastEMA[i] !== null && slowEMA[i] !== null) {
          macdValue = fastEMA[i] - slowEMA[i];
        }
        
        return {
          ...item,
          indicator: macdValue, // MACD line
          signal: null, // Will be populated later
          histogram: null // Will be populated later
        };
      });
      
      // Now calculate signal line which is EMA of MACD line
      // First we need to create a temporary array of the MACD values 
      // that are not null for the EMA calculation
      const macdValuesForSignal = resultData
        .map(item => ({ close: item.indicator })) // Use 'close' as the key for our EMA function
        .filter(item => item.close !== null);
      
      // Calculate signal line
      const signalEMA = calculateEMA(macdValuesForSignal, signalPeriod, 'close');
      
      // Now map the signal values back to our result array
      let signalIndex = 0;
      for (let i = 0; i < resultData.length; i++) {
        if (resultData[i].indicator !== null) {
          if (signalIndex >= signalPeriod) {
            resultData[i].signal = signalEMA[signalIndex - signalPeriod];
            // Calculate histogram
            resultData[i].histogram = resultData[i].indicator - resultData[i].signal;
          }
          signalIndex++;
        }
      }
      
      return resultData;
    };
    
    const calculateBollingerBands = (data, { period = 20, multiplier = 2 }) => {
      const result = [];
      
      // Calculate SMA first as the middle band
      const smaValues = calculateSMA(data, period);
      
      // For each point, calculate the upper and lower bands
      for (let i = 0; i < data.length; i++) {
        const item = { ...data[i] };
        const sma = smaValues[i]?.indicator;
        
        if (sma !== null && sma !== undefined && i >= period - 1) {
          // Calculate standard deviation for this period
          let sumSquaredDiff = 0;
          for (let j = 0; j < period; j++) {
            sumSquaredDiff += Math.pow(data[i - j].close - sma, 2);
          }
          const stdDev = Math.sqrt(sumSquaredDiff / period);
          
          // Calculate Bollinger Bands
          item.middle = sma;
          item.upper = sma + (multiplier * stdDev);
          item.lower = sma - (multiplier * stdDev);
          
          // Calculate width as percentage of middle band
          item.indicator = ((item.upper - item.lower) / item.middle) * 100;
        } else {
          item.middle = null;
          item.upper = null;
          item.lower = null;
          item.indicator = null;
        }
        
        result.push(item);
      }
      
      return result;
    };
    
    const calculateOBV = (data) => {
      const result = [];
      let obvValue = 0; // Start OBV at 0
      
      // First point has no previous to compare with
      result.push({ ...data[0], indicator: obvValue });
      
      // Calculate OBV for remaining points
      for (let i = 1; i < data.length; i++) {
        const currentClose = data[i].close;
        const previousClose = data[i - 1].close;
        const currentVolume = data[i].volume || 0;
        
        if (currentClose > previousClose) {
          obvValue += currentVolume;
        } else if (currentClose < previousClose) {
          obvValue -= currentVolume;
        }
        // If prices are equal, OBV remains the same
        
        result.push({
          ...data[i],
          indicator: obvValue
        });
      }
      
      return result;
    };
    
    const calculateOBVDivergence = (data, { period = 14 }) => {
      // First calculate OBV
      const obvResult = calculateOBV(data);
      const result = [];
      
      // We need at least 'period' data points
      for (let i = 0; i < Math.min(period, data.length); i++) {
        result.push({ ...data[i], indicator: null });
      }
      
      // Calculate the divergence for the remaining points
      for (let i = period; i < data.length; i++) {
        // Calculate price change over period
        const priceChange = ((data[i].close - data[i - period].close) / data[i - period].close) * 100;
        
        // Calculate OBV change over period
        const obvChange = obvResult[i].indicator - obvResult[i - period].indicator;
        const obvPercentChange = obvResult[i - period].indicator !== 0 ? 
          (obvChange / Math.abs(obvResult[i - period].indicator)) * 100 : 0;
        
        // Divergence is the difference between OBV percent change and price percent change
        // Positive value means OBV is stronger than price (potentially bullish)
        // Negative value means OBV is weaker than price (potentially bearish)
        const divergence = obvPercentChange - priceChange;
        
        result.push({
          ...data[i],
          indicator: divergence
        });
      }
      
      return result;
    };
    
    const calculateATR = (data, { period = 14 }) => {
      const result = [];
      const trueRanges = [];
      
      // Calculate True Range for each day (except first day)
      trueRanges.push(0); // First day has no TR (no previous close)
      result.push({ ...data[0], indicator: null });
      
      for (let i = 1; i < data.length; i++) {
        const high = data[i].high || data[i].close;
        const low = data[i].low || data[i].close;
        const prevClose = data[i - 1].close;
        
        // True Range is the maximum of:
        // 1. High - Low
        // 2. |High - Previous Close|
        // 3. |Low - Previous Close|
        const tr1 = high - low;
        const tr2 = Math.abs(high - prevClose);
        const tr3 = Math.abs(low - prevClose);
        
        const trueRange = Math.max(tr1, tr2, tr3);
        trueRanges.push(trueRange);
        
        // Add null indicator until we have enough data points
        if (i < period) {
          result.push({ ...data[i], indicator: null });
        }
      }
      
      // Calculate first ATR value (simple average of first 'period' true ranges)
      let sum = 0;
      for (let i = 1; i <= period; i++) {
        sum += trueRanges[i];
      }
      let atr = sum / period;
      result[period] = { ...data[period], indicator: atr };
      
      // Calculate remaining ATR values using EMA method
      for (let i = period + 1; i < data.length; i++) {
        // Wilder's EMA formula: ATR = ((period-1) * previous ATR + current TR) / period
        atr = ((period - 1) * atr + trueRanges[i]) / period;
        result.push({ ...data[i], indicator: atr });
      }
      
      return result;
    };
    
    const calculateATRPercentage = (data, { period = 14 }) => {
      // First calculate ATR
      const atrResult = calculateATR(data, { period });
      
      // Convert ATR to percentage of price
      return atrResult.map(item => {
        if (item.indicator === null || item.close === 0) {
          return { ...item, indicator: null };
        }
        
        // ATR as percentage of closing price
        return {
          ...item,
          indicator: (item.indicator / item.close) * 100
        };
      });
    };
    
    const calculateMFI = (data, { period = 14 }) => {
      const result = [];
      
      // Not enough data points
      if (data.length <= period) {
        return data.map(item => ({ ...item, indicator: null }));
      }
      
      // Add null values for first 'period' days
      for (let i = 0; i < period; i++) {
        result.push({ ...data[i], indicator: null });
      }
      
      // Calculate typical prices and money flows
      const typicalPrices = data.map(item => {
        const high = item.high || item.close;
        const low = item.low || item.close;
        return (high + low + item.close) / 3;
      });
      
      const moneyFlows = typicalPrices.map((tp, i) => tp * (data[i].volume || 0));
      
      // Calculate MFI for each data point from 'period' onwards
      for (let i = period; i < data.length; i++) {
        let positiveFlow = 0;
        let negativeFlow = 0;
        
        // Calculate positive and negative money flows
        for (let j = i - period + 1; j <= i; j++) {
          if (j > 0) {
            if (typicalPrices[j] > typicalPrices[j - 1]) {
              positiveFlow += moneyFlows[j];
            } else if (typicalPrices[j] < typicalPrices[j - 1]) {
              negativeFlow += moneyFlows[j];
            }
            // Equal typical prices don't contribute to flows
          }
        }
        
        // Calculate money flow ratio and MFI
        if (negativeFlow === 0) {
          // Avoid division by zero - if there's no negative flow, MFI is 100
          result.push({ ...data[i], indicator: 100 });
        } else {
          const moneyFlowRatio = positiveFlow / negativeFlow;
          const mfi = 100 - (100 / (1 + moneyFlowRatio));
          result.push({ ...data[i], indicator: mfi });
        }
      }
      
      return result;
    };
    
    const detectDoubleBottom = (data, { lookbackPeriod = 40, maxBottomVariation = 3.0 }) => {
      const result = data.map(item => ({ ...item, indicator: 0 })); // Default to 0 (no pattern)
      
      if (data.length < lookbackPeriod) {
        return result;
      }
      
      // Analyze each day as a potential completion of a double bottom
      for (let i = lookbackPeriod; i < data.length; i++) {
        // Get section of data to analyze
        const section = data.slice(i - lookbackPeriod, i + 1);
        
        // Find local minimums (potential bottoms)
        const localMins = [];
        for (let j = 1; j < section.length - 1; j++) {
          const currentLow = section[j].low || section[j].close;
          const prevLow = section[j - 1].low || section[j - 1].close;
          const nextLow = section[j + 1].low || section[j + 1].close;
          
          if (currentLow < prevLow && currentLow < nextLow) {
            localMins.push({
              index: j,
              value: currentLow
            });
          }
        }
        
        // Need at least 2 local minimums
        if (localMins.length < 2) {
          continue;
        }
        
        // Check pairs of bottoms to see if they form a double bottom
        let patternFound = false;
        
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
              const middleHighs = section.slice(bottom1.index, bottom2.index).map(bar => bar.high || bar.close);
              const middleHigh = Math.max(...middleHighs);
              const risePercent = ((middleHigh - bottom1.value) / bottom1.value) * 100;
              
              if (risePercent >= 5) {
                // Check if current price is higher than middle price
                const currentPrice = section[section.length - 1].close;
                if (currentPrice > middleHigh) {
                  patternFound = true;
                  break;
                }
              }
            }
          }
          
          if (patternFound) {
            break;
          }
        }
        
        // Mark pattern presence with 1 (found) or 0 (not found)
        result[i].indicator = patternFound ? 1 : 0;
      }
      
      return result;
    };
    
    const calculateMeanReversion = (data, { period = 20 }) => {
      // Calculate SMA
      const smaResult = calculateSMA(data, period);
      
      // Calculate deviation from mean (SMA)
      return data.map((item, i) => {
        if (smaResult[i]?.indicator === null || smaResult[i]?.indicator === undefined) {
          return { ...item, indicator: null };
        }
        
        // Calculate percent deviation from mean
        const deviation = ((item.close - smaResult[i].indicator) / smaResult[i].indicator) * 100;
        return { ...item, indicator: deviation };
      });
    };

    const calculateVolumeChange = (data) => {
      const result = [];
      
      // First point has no previous to compare with
      result.push({ ...data[0], indicator: 0 });
      
      // Calculate volume change for remaining points
      for (let i = 1; i < data.length; i++) {
        const previousVolume = data[i-1].volume || 0;
        const currentVolume = data[i].volume || 0;
        
        // Handle division by zero
        const percentChange = previousVolume === 0 ? 0 : ((currentVolume - previousVolume) / previousVolume) * 100;
        
        result.push({
          ...data[i],
          indicator: percentChange
        });
      }
      
      return result;
    };

    // Process data based on indicator type
    let result;
    switch (indicator) {
      case 'sma':
        result = calculateSMA(data, params.period || 20);
        break;
      case 'rsi':
        result = calculateRSI(data, params.period || 14);
        break;
      case 'macd':
        result = calculateMACD(data, params);
        break;
      case 'bollinger_bands':
        result = calculateBollingerBands(data, params);
        break;
      case 'obv':
        if (params.valueType === 'divergence') {
          result = calculateOBVDivergence(data, params);
        } else {
          result = calculateOBV(data);
        }
        break;
      case 'atr':
        if (params.percent === true) {
          result = calculateATRPercentage(data, params);
        } else {
          result = calculateATR(data, params);
        }
        break;
      case 'mfi':
        result = calculateMFI(data, params);
        break;
      case 'double_bottom':
        result = detectDoubleBottom(data, params);
        break;
      case 'mean_reversion':
        result = calculateMeanReversion(data, params);
        break;
      case 'percent_change':
        // Calculate daily percent change
        result = [];
        
        // First point has no previous to compare with
        result.push({ ...data[0], indicator: 0 });
        
        // Calculate percent change for remaining points
        for (let i = 1; i < data.length; i++) {
          const previousClose = data[i-1].close;
          const currentClose = data[i].close;
          
          // Handle division by zero
          const percentChange = previousClose === 0 ? 0 : ((currentClose - previousClose) / previousClose) * 100;
          
          result.push({
            ...data[i],
            indicator: percentChange
          });
        }
        break;
      case 'volume':
        result = calculateVolumeChange(data);
        break;
      case 'raw_volume':
        // Just copy volume directly as the indicator
        result = data.map(item => ({ 
          ...item, 
          indicator: item.volume || 0
        }));
        break;
      default:
        result = data.map(item => ({ ...item, indicator: item.close }));
    }
    
    // Debug info
    console.log(`Calculated ${indicator} indicator with params:`, params);
    console.log(`First data point:`, result[0]);
    console.log(`Last data point:`, result[result.length - 1]);
    
    return result;
  };

  // Check data structure to ensure we have the needed data
  const checkStockData = (data) => {
    if (!data || data.length === 0) {
      console.error("No stock data available");
      return false;
    }
    
    // Log the first and last data point for debugging
    console.log("First data point:", data[0]);
    console.log("Last data point:", data[data.length - 1]);
    
    // Check if we have volume data
    const hasVolume = data.some(point => point.volume !== undefined && point.volume !== null);
    console.log("Data has volume information:", hasVolume);
    if (!hasVolume) {
      console.warn("No volume data found in the dataset");
    }
    
    return true;
  };

  // Log the stock data before processing
  checkStockData(stockData);
  
  // Check for volume data specifically
  if (stockData && stockData.length > 0) {
    const hasVolume = stockData.some(point => point.volume !== undefined && point.volume > 0);
    console.log(`[${indicator}] Has volume data:`, hasVolume);
    
    if (hasVolume) {
      // Find max volume for reference
      const maxVolume = Math.max(...stockData.map(point => point.volume || 0));
      console.log(`[${indicator}] Max volume:`, maxVolume);
      
      // Log a few data points with volume
      const volumePoints = stockData.filter(point => point.volume > 0).slice(0, 3);
      console.log(`[${indicator}] Sample volume data points:`, volumePoints);
    } else {
      console.warn(`[${indicator}] No valid volume data found in the dataset!`);
    }
  }
  
  // Generate indicator data
  const indicatorData = calculateIndicator(stockData, indicator, params);
  
  
  // Debug: Check if all chart items use yAxisId correctly
  console.log(`[Debug] Chart data for ${indicator}:`, 
    `Has valid indicatorData? ${!!indicatorData && indicatorData.length > 0}`);
  
  // Debug helper to log non-null values
  const logValidValues = (data, key) => {
    const validValues = data.filter(d => d[key] !== null && d[key] !== undefined);
    console.log(`${indicator} data (${key}): ${validValues.length} valid points out of ${data.length}`);
    if (validValues.length > 0) {
      console.log(`First valid point for ${key}:`, validValues[0][key]);
      console.log(`Last valid point for ${key}:`, validValues[validValues.length - 1][key]);
      
      // Check the spread for Bollinger Bands
      if (indicator === 'bollinger' && (key === 'upper' || key === 'lower')) {
        const middleValues = data.filter(d => d.middle !== null && d.middle !== undefined);
        const middlePoint = middleValues[middleValues.length - 1];
        if (middlePoint) {
          const spread = key === 'upper' 
            ? (middlePoint.upper - middlePoint.middle)
            : (middlePoint.middle - middlePoint.lower);
          console.log(`${key} band spread from middle: ${spread.toFixed(2)}`);
        }
      }
    } else {
      console.log(`No valid points for ${key}`);
    }
  };
  
  // Debug the calculated data
  if (indicator === 'sma' || indicator === 'rsi' || indicator === 'volume') {
    logValidValues(indicatorData, 'indicator');
  } else if (indicator === 'macd') {
    logValidValues(indicatorData, 'indicator');
    logValidValues(indicatorData, 'signal');
    logValidValues(indicatorData, 'histogram');
  }

  // Get proper y-axis range and labels based on indicator
  const getIndicatorProps = (indicator) => {
    // These are default threshold values for percent change coloring
    const defaultPosThreshold = 2; // Default 2% positive threshold
    const defaultNegThreshold = -2; // Default -2% negative threshold
    
    // Get the posThreshold and negThreshold from params if available
    const posThreshold = params?.posThreshold || defaultPosThreshold; 
    const negThreshold = params?.negThreshold || defaultNegThreshold;
    
    switch (indicator) {
      case 'rsi':
        return {
          domain: [0, 100],
          tickCount: 5,
          label: 'RSI',
          labelFormatter: (value) => `${value}`,
          referenceLinesY: [
            { y: 70, stroke: 'red', strokeDasharray: '3 3', label: 'Overbought' },
            { y: 30, stroke: 'green', strokeDasharray: '3 3', label: 'Oversold' }
          ]
        };
      case 'macd':
        return {
          domain: ['auto', 'auto'],
          label: 'MACD',
          labelFormatter: (value) => (value !== null && value !== undefined) ? `${value.toFixed(2)}` : '-'
        };
      case 'bollinger_bands':
        return {
          domain: ['auto', 'auto'],
          label: 'Bollinger Bands Width %',
          labelFormatter: (value) => (value !== null && value !== undefined) ? `${value.toFixed(2)}%` : '-',
          referenceLinesY: [
            { y: 5, stroke: '#888', strokeDasharray: '3 3', label: 'Narrow' },
            { y: 20, stroke: '#4f46e5', strokeDasharray: '3 3', label: 'Wide' }
          ]
        };
      case 'obv':
        if (params?.valueType === 'divergence') {
          return {
            domain: ['auto', 'auto'],
            label: 'OBV Divergence',
            labelFormatter: (value) => (value !== null && value !== undefined) ? `${value.toFixed(2)}` : '-',
            referenceLinesY: [
              { y: 0, stroke: '#888', strokeWidth: 1 },
              { y: 10, stroke: 'green', strokeDasharray: '3 3', label: 'Positive Divergence' },
              { y: -10, stroke: 'red', strokeDasharray: '3 3', label: 'Negative Divergence' }
            ]
          };
        } else {
          return {
            domain: ['auto', 'auto'],
            label: 'On-Balance Volume',
            labelFormatter: (value) => {
              if (value === null || value === undefined) return '-';
              // Format large numbers with K, M, B suffixes
              if (Math.abs(value) >= 1000000000) {
                return (value / 1000000000).toFixed(1) + 'B';
              } else if (Math.abs(value) >= 1000000) {
                return (value / 1000000).toFixed(1) + 'M';
              } else if (Math.abs(value) >= 1000) {
                return (value / 1000).toFixed(1) + 'K';
              } else {
                return value.toString();
              }
            }
          };
        }
      case 'atr':
        if (params?.percent === true) {
          return {
            domain: [0, 'auto'],
            label: 'ATR %',
            labelFormatter: (value) => (value !== null && value !== undefined) ? `${value.toFixed(2)}%` : '-'
          };
        } else {
          return {
            domain: [0, 'auto'],
            label: 'ATR',
            labelFormatter: (value) => (value !== null && value !== undefined) ? `${value.toFixed(2)}` : '-'
          };
        }
      case 'mfi':
        return {
          domain: [0, 100],
          tickCount: 5,
          label: 'Money Flow Index',
          labelFormatter: (value) => (value !== null && value !== undefined) ? `${value}` : '-',
          referenceLinesY: [
            { y: 80, stroke: 'red', strokeDasharray: '3 3', label: 'Overbought' },
            { y: 20, stroke: 'green', strokeDasharray: '3 3', label: 'Oversold' }
          ]
        };
      case 'double_bottom':
        return {
          domain: [0, 1.1],
          label: 'Double Bottom Pattern',
          labelFormatter: (value) => (value !== null && value !== undefined) ? (value === 1 ? 'YES' : 'NO') : '-'
        };
      case 'mean_reversion':
        return {
          domain: ['auto', 'auto'],
          label: 'Deviation from Mean (%)',
          labelFormatter: (value) => (value !== null && value !== undefined) ? `${value.toFixed(2)}%` : '-',
          referenceLinesY: [
            { y: 0, stroke: '#888', strokeWidth: 1 },
            { y: 10, stroke: 'red', strokeDasharray: '3 3', label: 'Overbought' },
            { y: -10, stroke: 'green', strokeDasharray: '3 3', label: 'Oversold' }
          ]
        };
      case 'percent_change':
        // Return with both default and provided thresholds
        return {
          domain: ['auto', 'auto'],
          label: 'Daily Percent Change',
          labelFormatter: (value) => (value !== null && value !== undefined) ? `${value.toFixed(2)}%` : '-',
          referenceLinesY: [
            { y: 0, stroke: '#888', strokeWidth: 1 },
            { y: posThreshold, stroke: 'green', strokeDasharray: '3 3', label: `+${posThreshold}%` },
            { y: negThreshold, stroke: 'red', strokeDasharray: '3 3', label: `${negThreshold}%` }
          ],
          // Store thresholds to use for conditional styling
          posThreshold,
          negThreshold
        };
      case 'volume':
        return {
          domain: ['auto', 'auto'],
          label: 'Volume Change %',
          labelFormatter: (value) => (value !== null && value !== undefined) ? `${value.toFixed(2)}%` : '-',
          referenceLinesY: [
            { y: 0, stroke: '#888', strokeWidth: 1 }
          ]
        };
      case 'raw_volume':
        return {
          domain: [0, 'auto'],
          label: 'Volume',
          labelFormatter: (value) => {
            if (value === null || value === undefined) return '-';
            // Format large numbers with K, M, B suffixes
            if (value >= 1000000000) {
              return (value / 1000000000).toFixed(1) + 'B';
            } else if (value >= 1000000) {
              return (value / 1000000).toFixed(1) + 'M';
            } else if (value >= 1000) {
              return (value / 1000).toFixed(1) + 'K';
            } else {
              return value.toString();
            }
          }
        };
      default:
        return {
          domain: ['auto', 'auto'],
          label: 'Value',
          labelFormatter: (value) => (value !== null && value !== undefined) ? `${value.toFixed(2)}` : '-'
        };
    }
  };

  const indicatorProps = getIndicatorProps(indicator);

  return (
    <div className="h-60 mt-4 pt-2 border-t border-gray-200">
      <div className="text-sm font-medium text-gray-700 mb-1">{indicatorProps.label} Chart</div>
      <ResponsiveContainer width="100%" height="92%">
        <ComposedChart
          data={indicatorData}
          margin={{
            top: 10,
            right: 40, // Match the right margin of the main chart to account for second Y-axis
            left: 20,
            bottom: 30,
          }}
          syncId={syncId} // Add syncId for synchronization
        >
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis 
            dataKey="date" 
            scale="band" 
            angle={-45} 
            textAnchor="end" 
            height={60} 
            tick={{ fontSize: 10 }}
            tickMargin={20}
            interval="preserveStartEnd"
            padding={{ left: 10, right: 10 }} // Add padding for alignment
            minTickGap={5} // Ensure readable tick spacing
          />
          <YAxis 
            yAxisId="left" // Add yAxisId for consistency
            orientation="left"
            domain={indicatorProps.domain}
            tickCount={indicatorProps.tickCount}
            tickFormatter={indicatorProps.labelFormatter}
          />
          {/* Add a dummy right axis to maintain alignment with main chart */}
          <YAxis 
            yAxisId="right"
            orientation="right"
            domain={[0, 1]}
            hide={true} // Hide the axis but keep the space
          />
          <Tooltip 
            formatter={(value) => {
              // Simple formatter for all indicators
              return [value ? value.toFixed(2) : 'N/A', indicatorProps.label];
            }}
          />
          <Legend />
          
          {/* Reference Lines (for RSI, etc.) */}
          {indicatorProps.referenceLinesY && indicatorProps.referenceLinesY.map((line, index) => (
            <ReferenceLine 
              key={index} 
              y={line.y}
              yAxisId="left"
              stroke={line.stroke}
              strokeDasharray={line.strokeDasharray} 
            />
          ))}

          {/* Render the appropriate chart based on indicator type */}
          {/* Default case - render simple line chart for most indicators */}
          {!['percent_change', 'macd', 'bollinger_bands', 'double_bottom', 'obv'].includes(indicator) && (
            <Line 
              type="monotone"
              dataKey="indicator"
              stroke="#4f46e5"
              dot={false}
              yAxisId="left"
              activeDot={activeDot ? { r: 4, stroke: 'white', strokeWidth: 1 } : false}
              name={indicatorProps.label}
              connectNulls={true}
            />
          )}
          
          {/* Special case for Bollinger Bands */}
          {indicator === 'bollinger_bands' && (
            <>
              <Line 
                type="monotone"
                dataKey="indicator"
                stroke="#4f46e5"
                dot={false}
                yAxisId="left"
                activeDot={activeDot ? { r: 4, stroke: 'white', strokeWidth: 1 } : false}
                name="Width %"
                connectNulls={true}
              />
            </>
          )}
          
          {/* Special case for Double Bottom Pattern */}
          {indicator === 'double_bottom' && (
            <Bar 
              dataKey="indicator"
              yAxisId="left"
              name="Pattern Detected"
              fill="#4f46e5"
              opacity={0.8}
            />
          )}
          
          {/* Special case for OBV Divergence */}
          {indicator === 'obv' && params.valueType === 'divergence' && (
            <Bar 
              dataKey="indicator"
              yAxisId="left"
              name="OBV Divergence"
              fill={(data) => {
                const val = data.indicator;
                if (val > 0) return "#22c55e"; // Green for positive divergence
                if (val < 0) return "#ef4444"; // Red for negative divergence
                return "#6366f1"; // Purple for no divergence
              }}
              opacity={0.7}
            />
          )}
          
          {/* Basic OBV chart */}
          {indicator === 'obv' && params.valueType !== 'divergence' && (
            <Line 
              type="monotone"
              dataKey="indicator"
              stroke="#4f46e5"
              dot={false}
              yAxisId="left"
              activeDot={activeDot ? { r: 4, stroke: 'white', strokeWidth: 1 } : false}
              name="OBV"
              connectNulls={true}
            />
          )}
          
          {/* Special rendering for percent change with color changes based on thresholds */}
          {indicator === 'percent_change' && (
            <>
              <Line 
                type="monotone"
                dataKey="indicator"
                dot={false}
                yAxisId="left"
                activeDot={activeDot ? { r: 4, stroke: 'white', strokeWidth: 1 } : false}
                name={indicatorProps.label}
                connectNulls={true}
                stroke="#4f46e5" // Default color
                strokeWidth={2}
              />
              <Bar 
                dataKey="indicator"
                yAxisId="left" 
                name="Daily % Change"
                fill={(data) => {
                  if (!data || data.indicator === undefined) return "#6366f1";
                  
                  // Extract thresholds from indicatorProps with default fallbacks
                  const posThreshold = indicatorProps.posThreshold || 2;
                  const negThreshold = indicatorProps.negThreshold || -2;
                  
                  if (data.indicator >= posThreshold) return "#22c55e"; // Green for values above positive threshold
                  if (data.indicator <= negThreshold) return "#ef4444"; // Red for values below negative threshold
                  return "#6366f1"; // Purple for values in between
                }}
                opacity={0.5}
              />
            </>
          )}
          
          {/* MACD Chart */}
          {indicator === 'macd' && (
            <>
              <Line 
                type="monotone"
                dataKey="indicator"
                stroke="#4f46e5"
                dot={false}
                yAxisId="left"
                activeDot={activeDot ? { r: 4, stroke: 'white', strokeWidth: 1 } : false}
                name="MACD Line"
                connectNulls={true}
              />
              <Line 
                type="monotone"
                dataKey="signal"
                stroke="#ef4444"
                dot={false}
                yAxisId="left"
                activeDot={activeDot ? { r: 4, stroke: 'white', strokeWidth: 1 } : false}
                name="Signal"
                connectNulls={true}
              />
              <Bar 
                dataKey="histogram"
                yAxisId="left" 
                name="Histogram"
                fill={(data) => {
                  if (!data || !data.histogram) return "#10b981";
                  return data.histogram >= 0 ? "#10b981" : "#ef4444"; // Green for positive, red for negative
                }}
                opacity={0.6}
              />
            </>
          )}
          
          {/* Volume Change */}
          {indicator === 'volume' && (
            <Bar 
              dataKey="indicator"
              yAxisId="left" 
              name="Volume Change %"
              fill={(data) => {
                if (!data || data.indicator === undefined || data.indicator === null) return "#4f46e5";
                return data.indicator >= 0 ? "#22c55e" : "#ef4444"; // Green for positive, red for negative
              }}
              opacity={0.6}
            />
          )}
          
          {/* Raw Volume */}
          {indicator === 'raw_volume' && (
            <Bar 
              dataKey="indicator"
              fill="#4f46e5"
              yAxisId="left"
              name="Volume"
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
};

// Stock Chart component for individual stock performance
const StockChart = ({ symbol, stockData, transactions, errorFallback }) => {
  const [selectedIndicator, setSelectedIndicator] = useState("sma");
  const [indicatorParams, setIndicatorParams] = useState({
    period: 20, // Default period for most indicators
    fastPeriod: 12, // For MACD
    slowPeriod: 26, // For MACD
    signalPeriod: 9, // For MACD
    multiplier: 2 // For Bollinger Bands (standard deviation multiplier)
  });
  
  console.log('Rendering StockChart for', symbol, 'with indicator:', selectedIndicator);
  
  // Enhanced error handling for stock data
  if (!stockData || stockData.length === 0) {
    return errorFallback || (
      <div className="p-4 text-center text-gray-500">
        No historical data available for {symbol}. Please try another stock.
      </div>
    );
  }

  // Validate and sanitize the stockData to prevent chart rendering issues
  console.log(`Processing chart data for ${symbol} with ${stockData ? stockData.length : 0} data points`);
  
  // Safety check to handle missing or invalid data
  if (!stockData || !Array.isArray(stockData) || stockData.length === 0) {
    console.error(`No valid data available for ${symbol}`);
    
    // Check if there are transactions for this symbol, even if no price data
    const hasTransactions = transactions.some(tx => tx.symbol === symbol);
    
    if (hasTransactions) {
      // Show transactions table even if no chart data
      return (
        <div className="p-4 bg-white shadow rounded-lg">
          <div className="p-4 text-center text-yellow-700 bg-yellow-50 rounded mb-4">
            <div className="font-medium">Limited Data Available</div>
            <p>
              Historical price data for {symbol} couldn't be loaded, but we found {
                transactions.filter(tx => tx.symbol === symbol).length
              } transactions.
            </p>
          </div>
          
          <h3 className="text-lg font-medium text-gray-900 mb-4">Transactions for {symbol}</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Price</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Quantity</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {transactions
                  .filter(tx => tx.symbol === symbol)
                  .map((tx, i) => (
                    <tr key={i} className={tx.type === 'buy' || tx.type === 'cover_short' ? 'bg-green-50' : 'bg-red-50'}>
                      <td className="px-4 py-2 text-sm">{formatDate(tx.date)}</td>
                      <td className="px-4 py-2 text-sm">
                        <span className={`px-2 py-1 text-xs rounded-full ${
                          tx.type === 'buy' || tx.type === 'cover_short' 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {tx.type === 'cover_short' ? 'COVER' : tx.type.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-sm">{formatCurrency(tx.price)}</td>
                      <td className="px-4 py-2 text-sm">{tx.quantity.toFixed(4)}</td>
                      <td className="px-4 py-2 text-sm">{formatCurrency(tx.amount)}</td>
                    </tr>
                  ))
                }
              </tbody>
            </table>
          </div>
        </div>
      );
    }
    
    return (
      <div className="p-4 text-center text-gray-500 bg-white shadow rounded-lg">
        <div className="mb-4">
          <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <p className="text-lg font-medium">No data available for {symbol}</p>
        <p className="mt-1">The stock may be delisted or the data source may be unavailable.</p>
      </div>
    );
  }

  // Check if data points have required fields
  const invalidDataPoints = stockData.filter(item => !item.date || !item.close);
  if (invalidDataPoints.length > 0) {
    console.warn(`${symbol} has ${invalidDataPoints.length} invalid data points`);
  }
  
  // Extract all transaction dates to ensure we include them in our chart
  const transactionDates = new Set();
  let transactionSymbols = new Set(); // Track which symbols have transactions
  
  transactions.forEach(tx => {
    if (tx.symbol === symbol) {
      try {
        const formattedDate = formatDate(tx.date);
        transactionDates.add(formattedDate);
        transactionSymbols.add(symbol);
        console.log(`Found transaction for ${symbol} on ${formattedDate}: ${tx.type}`);
      } catch (error) {
        console.error(`Error processing transaction date for ${symbol}:`, error);
      }
    }
  });
  
  console.log(`${symbol} has ${transactionDates.size} transaction dates to process`);
  
  // Prepare chart data - keep all transaction dates and sample the rest
  let chartData = stockData.map(item => {
    try {
      // Format and validate the date
      const formattedDate = formatDate(item.date || new Date().toISOString());
      const isTransactionDate = transactionDates.has(formattedDate);
      
      // Validate and sanitize price data (replace invalid values with defaults)
      const close = item.close !== undefined && !isNaN(item.close) ? item.close : 0;
      const open = item.open !== undefined && !isNaN(item.open) ? item.open : close;
      const high = item.high !== undefined && !isNaN(item.high) ? item.high : Math.max(open, close);
      const low = item.low !== undefined && !isNaN(item.low) ? item.low : Math.min(open, close);
      
      // Make sure volume data is included in chart data
      const volume = (item.volume !== undefined && !isNaN(item.volume)) ? item.volume : 0;
      
      return {
        date: formattedDate,
        close,
        open,
        high,
        low,
        volume,
        isTransactionDate
      };
    } catch (error) {
      console.error(`Error processing data point for ${symbol}:`, error);
      // Return a safe default to prevent chart rendering issues
      return {
        date: formatDate(new Date().toISOString()),
        close: 0,
        open: 0,
        high: 0,
        low: 0,
        volume: 0,
        isTransactionDate: false
      };
    }
  }).filter(item => item.date && !isNaN(item.close) && item.close !== 0); // Filter out any remaining invalid points
  
  // Check if we have valid chart data after filtering
  if (chartData.length === 0) {
    console.error(`No valid chart data available for ${symbol} after filtering`);
    return errorFallback || (
      <div className="p-4 text-center text-gray-500">
        Unable to render chart for {symbol}. The data may be in an incorrect format.
      </div>
    );
  }
  
  // Sort by date for proper chronological order
  chartData.sort((a, b) => {
    try {
      return new Date(a.date) - new Date(b.date);
    } catch (error) {
      console.error(`Error sorting dates for ${symbol}:`, error);
      return 0;
    }
  });
  
  // Calculate percentage changes from various reference points
  if (chartData.length > 0) {
    const initialPrice = chartData[0].close;
    const latestPrice = chartData[chartData.length - 1].close;
    
    // Calculate cumulative % change from initial price
    chartData = chartData.map(item => ({
      ...item,
      percentChange: ((item.close - initialPrice) / initialPrice) * 100
    }));
    
    // We'll track daily percent changes later to ensure they are calculated after sorting
    // Just calculate cumulative change from start for now
    chartData[0].dailyChange = 0;
    
    // Calculate % change from latest price (for reference in tooltip)
    chartData = chartData.map(item => ({
      ...item,
      changeFromLatest: ((item.close - latestPrice) / latestPrice) * 100
    }));
  }
  
  // Never sample points for daily data - keep all days to ensure accurate percent changes
  console.log(`${symbol} has ${chartData.length} points, using all data for accurate daily percent changes`);
  
  // Ensure the data is sorted chronologically
  chartData.sort((a, b) => new Date(a.date) - new Date(b.date));
  
  // Mark transaction dates for visual reference
  const transactionDatesSet = new Set(transactionDates);
  chartData.forEach(item => {
    item.isTransactionDate = transactionDatesSet.has(item.date);
  });
  
  console.log(`${symbol}: Final chart has ${chartData.length} total data points`);
  
  // Check for gaps in the date sequence
  let previousDate = null;
  let gapsFound = false;
  
  chartData.forEach(item => {
    if (previousDate) {
      const currentDate = new Date(item.date);
      const prevDate = new Date(previousDate);
      
      // Check if there's more than a 1-day gap
      const dayDiff = Math.round((currentDate - prevDate) / (1000 * 60 * 60 * 24));
      if (dayDiff > 1) {
        console.warn(`Gap in daily data for ${symbol}: ${dayDiff} days between ${previousDate} and ${item.date}`);
        gapsFound = true;
      }
    }
    previousDate = item.date;
  });
  
  if (gapsFound) {
    console.warn(`${symbol} has gaps in daily data which may affect percent change calculations`);
  } else {
    console.log(`${symbol} has consistent daily data with no gaps`);
  }

  // Create a Map for efficient date lookup and ensure all transaction dates are included
  const dateToDataPoint = new Map();
  
  // First pass: add all chart data points to the map
  chartData.forEach(point => {
    dateToDataPoint.set(point.date, point);
  });
  
  // Second pass: ensure all transaction dates have data points
  // If a transaction date doesn't have a data point, this shouldn't happen
  // but we'll log it for debugging
  transactionDates.forEach(date => {
    if (!dateToDataPoint.has(date)) {
      console.error(`Missing data point for transaction date ${date} in ${symbol}`);
    }
  });
  
  // Recalculate percent change based on consecutive days
  // This ensures the "dailyChange" property is accurate for our daily data
  for (let i = 1; i < chartData.length; i++) {
    const previous = chartData[i-1].close;
    const current = chartData[i].close;
    chartData[i].dailyChange = ((current - previous) / previous) * 100;
  }
  // Set first day's change to 0
  if (chartData.length > 0) {
    chartData[0].dailyChange = 0;
  }

  // Extract buy/sell transactions for this stock
  const buyTxDates = [];
  const sellTxDates = [];
  
  // Process all transactions regardless of whether the date exists in chartData
  // We'll find the closest data point for each transaction date
  const buyTransactions = [];
  const sellTransactions = [];
  
  // Get all dates in ascending order
  const allDates = chartData.map(d => d.date).sort();
  
  // With our improved data sampling, we should have all transaction dates
  // in the chart data, but let's keep a fallback just in case
  const findClosestDate = (targetDate) => {
    // First check exact match
    if (dateToDataPoint.has(targetDate)) {
      return targetDate;
    }
    
    console.log(`Warning: Transaction date ${targetDate} for ${symbol} not found in chart data - finding closest match`);
    
    // If not found (shouldn't happen now), find the closest date
    const targetTimestamp = new Date(targetDate).getTime();
    let closestDate = allDates[0];
    let minDiff = Math.abs(new Date(closestDate).getTime() - targetTimestamp);
    
    for (const date of allDates) {
      const diff = Math.abs(new Date(date).getTime() - targetTimestamp);
      if (diff < minDiff) {
        minDiff = diff;
        closestDate = date;
      }
    }
    
    return closestDate;
  };
  
  // Ensure all chart data is fully processed before handling transactions
  console.log(`${symbol}: Processing ${transactions.length} transactions for chart with ${chartData.length} data points`);
  
  // Process transactions and find closest dates
  transactions.forEach(tx => {
    if (tx.symbol === symbol) {
      const txDate = formatDate(tx.date);
      
      // First try to get exact date match (which should almost always work now)
      let matchDate = txDate;
      let point = dateToDataPoint.get(txDate);
      
      // If exact match not found (should be rare), find closest date
      if (!point) {
        matchDate = findClosestDate(txDate);
        if (matchDate) {
          point = dateToDataPoint.get(matchDate);
          console.warn(`${symbol}: Using closest date ${matchDate} for transaction on ${txDate}`);
        }
      }
      
      if (point) {
        // Process based on transaction type - handle all supported transaction types
        if (tx.type === 'buy' || tx.type === 'cover_short') {
          buyTransactions.push({
            date: matchDate,
            close: point.close,
            amount: tx.amount,
            type: tx.type
          });
          console.log(`${symbol}: Added buy marker at ${matchDate} at price ${point.close}`);
        } else if (tx.type === 'sell' || tx.type === 'short') {
          sellTransactions.push({
            date: matchDate,
            close: point.close,
            amount: tx.amount,
            type: tx.type
          });
          console.log(`${symbol}: Added sell marker at ${matchDate} at price ${point.close}`);
        }
      } else {
        console.error(`${symbol}: Failed to find data point for transaction on ${txDate}`);
      }
    }
  });
  
  console.log(`${symbol}: Completed processing with ${buyTransactions.length} buy and ${sellTransactions.length} sell markers`);
  
  // Indicator option tabs
  const indicators = [
    { id: "none", label: "None" },
    { id: "sma", label: "SMA" },
    { id: "rsi", label: "RSI" },
    { id: "macd", label: "MACD" },
    { id: "bollinger_bands", label: "Bollinger" },
    { id: "obv", label: "OBV" },
    { id: "atr", label: "ATR" },
    { id: "mfi", label: "MFI" },
    { id: "double_bottom", label: "Double Bottom" },
    { id: "percent_change", label: "% Change" },
    { id: "volume", label: "Volume Change" },
    { id: "raw_volume", label: "Raw Volume" }
  ];

  // Function to handle period change
  const handlePeriodChange = (e) => {
    const newPeriod = parseInt(e.target.value);
    if (!isNaN(newPeriod) && newPeriod > 0) {
      setIndicatorParams({
        ...indicatorParams,
        period: newPeriod
      });
    }
  };

  return (
    <div className="mt-4 p-4 bg-white shadow rounded-lg">
      <h3 className="text-lg font-medium text-gray-900 mb-4">
        {symbol} Daily Price Chart with Transactions
        <span className="ml-2 text-xs text-gray-500">({chartData.length} data points)</span>
      </h3>
      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={chartData}
            margin={{
              top: 10,
              right: 40, // Increased right margin for second Y-axis
              left: 20,
              bottom: 60, // Increased bottom margin to prevent x-axis label obstruction
            }}
            animationDuration={800}
            animationEasing="ease-in-out"
            syncId={`stock-chart-${symbol}`} // Add syncId for synchronization
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis 
              dataKey="date" 
              angle={-45} 
              textAnchor="end" 
              tick={{ fontSize: 10 }}
              tickMargin={20}
              interval="preserveStartEnd"
              scale="band"
              padding={{ left: 10, right: 10 }}
              minTickGap={5}
            />
            {/* Left Y-axis for Price */}
            <YAxis 
              yAxisId="left"
              tickFormatter={(value) => formatCurrency(value)}
              domain={['auto', 'auto']}
              orientation="left"
            />
            {/* Right Y-axis for Percentage Change */}
            <YAxis 
              yAxisId="right"
              tickFormatter={(value) => `${value.toFixed(2)}%`}
              domain={['auto', 'auto']}
              orientation="right"
            />
            <Tooltip 
              content={({ active, payload, label }) => {
                if (active && payload && payload.length) {
                  const data = payload[0].payload;
                  const price = formatCurrency(data.close);
                  
                  // Get index for current point to find previous point
                  const currentIndex = chartData.findIndex(item => item.date === data.date);
                  
                  // Calculate change from previous point (correctly handles sampling)
                  let pointChange = 0;
                  if (currentIndex > 0) {
                    const prevPoint = chartData[currentIndex - 1];
                    pointChange = ((data.close - prevPoint.close) / prevPoint.close) * 100;
                  }
                  
                  // Format point-to-point % change 
                  const dailyChange = pointChange;
                  const dailyChangePrefix = dailyChange >= 0 ? '+' : '';
                  const dailyChangeText = `${dailyChangePrefix}${dailyChange.toFixed(2)}%`;
                  
                  // Format cumulative % change
                  const cumulativeChange = data.percentChange;
                  const cumulativePrefix = cumulativeChange >= 0 ? '+' : '';
                  const cumulativeText = `${cumulativePrefix}${cumulativeChange.toFixed(2)}%`;
                  
                  // Format change from latest
                  const changeFromLatest = data.changeFromLatest;
                  const latestPrefix = changeFromLatest >= 0 ? '+' : '';
                  const latestText = `${latestPrefix}${changeFromLatest.toFixed(2)}%`;
                  
                  return (
                    <div className="bg-white p-3 border border-gray-200 shadow-md rounded-md">
                      <p className="text-gray-600 text-sm font-semibold mb-1">{label}</p>
                      <p className="text-gray-900 font-bold">{price}</p>
                      
                      <div className="mt-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-600 mr-3">Daily Change:</span>
                          <span className={dailyChange >= 0 ? 'text-green-600' : 'text-red-600'}>
                            {dailyChangeText}
                          </span>
                        </div>
                        
                        <div className="flex justify-between">
                          <span className="text-gray-600 mr-3">From Start:</span>
                          <span className={cumulativeChange >= 0 ? 'text-green-600' : 'text-red-600'}>
                            {cumulativeText}
                          </span>
                        </div>
                        
                        <div className="flex justify-between">
                          <span className="text-gray-600 mr-3">From End:</span>
                          <span className={changeFromLatest >= 0 ? 'text-green-600' : 'text-red-600'}>
                            {latestText}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Legend 
              formatter={(value) => {
                if (value === '% Change') {
                  return 'Cumulative % Change';
                } else if (value === 'From Latest') {
                  return '% Change From Latest';
                } else if (value === 'dailyChange') {
                  return 'Daily % Change';
                }
                return value;
              }}
              verticalAlign="top"
              height={36}
              wrapperStyle={{ paddingTop: 10, paddingBottom: 0 }}
            />
            {/* Price line */}
            <Line 
              yAxisId="left"
              type="monotone" 
              dataKey="close" 
              stroke="#4f46e5" 
              dot={false} 
              name="Price"
            />
            {/* Cumulative percentage change line */}
            <Line 
              yAxisId="right"
              type="monotone" 
              dataKey="percentChange" 
              stroke="#10b981" 
              dot={false} 
              name="% Change"
              strokeDasharray="3 3"
            />
            
            {/* Change from latest price - this will be a flat line at 0 for the last point */}
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="changeFromLatest"
              stroke="#9ca3af"  // Gray color
              dot={false}
              name="From Latest"
              strokeWidth={1}
              strokeDasharray="2 2"
              opacity={0.6}
            />
            
            {/* Buy transaction markers - rendered after chart data is processed */}
            {buyTransactions.length > 0 && buyTransactions.map((tx, index) => (
              <ReferenceDot
                key={`buy-${index}`}
                x={tx.date}
                y={tx.close}
                yAxisId="left"
                r={4}
                fill="green"
                stroke="white"
                strokeWidth={1}
              />
            ))}
            
            {/* Sell transaction markers */}
            {sellTransactions.length > 0 && sellTransactions.map((tx, index) => (
              <ReferenceDot
                key={`sell-${index}`}
                x={tx.date}
                y={tx.close}
                yAxisId="left"
                r={4}
                fill="red"
                stroke="white"
                strokeWidth={1}
              />
            ))}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      
      {/* Transaction Legend */}
      <div className="mt-4 flex items-center justify-center">
        <div className="flex items-center mr-4">
          <div className="w-3 h-3 rounded-full bg-green-500 mr-1"></div>
          <span className="text-sm text-gray-600">Buy ({buyTransactions.length})</span>
        </div>
        <div className="flex items-center">
          <div className="w-3 h-3 rounded-full bg-red-500 mr-1"></div>
          <span className="text-sm text-gray-600">Sell ({sellTransactions.length})</span>
        </div>
      </div>
      
      {/* Technical Indicator Controls */}
      <div className="mt-6">
        <h4 className="text-md font-medium text-gray-900 mb-2">Technical Indicators</h4>
        
        {/* Indicator Selector Tabs */}
        <div className="flex border-b border-gray-200 mb-4">
          {indicators.map((ind) => (
            <button
              key={ind.id}
              onClick={() => setSelectedIndicator(ind.id)}
              className={`py-2 px-4 text-sm font-medium focus:outline-none ${
                selectedIndicator === ind.id
                  ? "text-indigo-600 border-b-2 border-indigo-600"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {ind.label}
            </button>
          ))}
        </div>
        
        {/* Parameter Controls - conditional based on selected indicator */}
        {selectedIndicator !== "none" && (
          <div className="mb-4 flex items-center space-x-4">
            {/* Period input for most indicators */}
            {["sma", "rsi", "bollinger"].includes(selectedIndicator) && (
              <div className="flex items-center">
                <label htmlFor="period" className="mr-2 text-sm text-gray-600">
                  Period:
                </label>
                <input
                  id="period"
                  type="number"
                  min="1"
                  max="200"
                  value={indicatorParams.period}
                  onChange={handlePeriodChange}
                  className="w-16 px-2 py-1 text-sm border border-gray-300 rounded"
                />
              </div>
            )}
            
            {/* Percent Change thresholds */}
            {selectedIndicator === "percent_change" && (
              <div className="flex items-center space-x-4">
                <div className="flex items-center">
                  <label htmlFor="posThreshold" className="mr-2 text-sm text-gray-600">
                    <span className="inline-block w-3 h-3 bg-green-500 rounded-full mr-1"></span>
                    Positive:
                  </label>
                  <input
                    id="posThreshold"
                    type="number"
                    min="0.1"
                    max="10"
                    step="0.1"
                    value={indicatorParams.posThreshold || 2}
                    onChange={(e) => setIndicatorParams({...indicatorParams, posThreshold: parseFloat(e.target.value)})}
                    className="w-16 px-2 py-1 text-sm border border-gray-300 rounded"
                  />
                  <span className="ml-1 text-sm text-gray-600">%</span>
                </div>
                <div className="flex items-center">
                  <label htmlFor="negThreshold" className="mr-2 text-sm text-gray-600">
                    <span className="inline-block w-3 h-3 bg-red-500 rounded-full mr-1"></span>
                    Negative:
                  </label>
                  <input
                    id="negThreshold"
                    type="number"
                    min="-10"
                    max="-0.1"
                    step="0.1"
                    value={indicatorParams.negThreshold || -2}
                    onChange={(e) => setIndicatorParams({...indicatorParams, negThreshold: parseFloat(e.target.value)})}
                    className="w-16 px-2 py-1 text-sm border border-gray-300 rounded"
                  />
                  <span className="ml-1 text-sm text-gray-600">%</span>
                </div>
              </div>
            )}
            
            {/* MACD-specific parameters */}
            {selectedIndicator === "macd" && (
              <>
                <div className="flex items-center">
                  <label htmlFor="fastPeriod" className="mr-2 text-sm text-gray-600">
                    Fast:
                  </label>
                  <input
                    id="fastPeriod"
                    type="number"
                    min="1"
                    max="100"
                    value={indicatorParams.fastPeriod}
                    onChange={(e) => setIndicatorParams({...indicatorParams, fastPeriod: parseInt(e.target.value)})}
                    className="w-14 px-2 py-1 text-sm border border-gray-300 rounded"
                  />
                </div>
                <div className="flex items-center">
                  <label htmlFor="slowPeriod" className="mr-2 text-sm text-gray-600">
                    Slow:
                  </label>
                  <input
                    id="slowPeriod"
                    type="number"
                    min="1"
                    max="100"
                    value={indicatorParams.slowPeriod}
                    onChange={(e) => setIndicatorParams({...indicatorParams, slowPeriod: parseInt(e.target.value)})}
                    className="w-14 px-2 py-1 text-sm border border-gray-300 rounded"
                  />
                </div>
                <div className="flex items-center">
                  <label htmlFor="signalPeriod" className="mr-2 text-sm text-gray-600">
                    Signal:
                  </label>
                  <input
                    id="signalPeriod"
                    type="number"
                    min="1"
                    max="100"
                    value={indicatorParams.signalPeriod}
                    onChange={(e) => setIndicatorParams({...indicatorParams, signalPeriod: parseInt(e.target.value)})}
                    className="w-14 px-2 py-1 text-sm border border-gray-300 rounded"
                  />
                </div>
              </>
            )}
            
            {/* Bollinger Bands multiplier */}
            {selectedIndicator === "bollinger" && (
              <div className="flex items-center">
                <label htmlFor="multiplier" className="mr-2 text-sm text-gray-600">
                  Multiplier:
                </label>
                <input
                  id="multiplier"
                  type="number"
                  min="0.5"
                  max="5"
                  step="0.5"
                  value={indicatorParams.multiplier}
                  onChange={(e) => setIndicatorParams({...indicatorParams, multiplier: parseFloat(e.target.value)})}
                  className="w-16 px-2 py-1 text-sm border border-gray-300 rounded"
                />
              </div>
            )}
          </div>
        )}
        
        {/* Technical Indicator Chart */}
        {selectedIndicator !== "none" && (
          <>
            <TechnicalIndicatorChart
              stockData={chartData}
              indicator={selectedIndicator}
              params={indicatorParams}
              syncId={`stock-chart-${symbol}`} // Pass the same syncId as the main chart
              activeDot={true} // Enable active dots
            />
            {/* Debug Info - disabled by default */}
            {process.env.NODE_ENV === 'development' && false && (
              <div className="mt-2 p-2 bg-gray-100 text-xs text-gray-700 rounded">
                <div>Selected Indicator: {selectedIndicator}</div>
                <div>Params: {JSON.stringify(indicatorParams)}</div>
                <div>Chart Sync ID: {`stock-chart-${symbol}`}</div>
              </div>
            )}
          </>
        )}
        
        {/* Orders Table */}
        {transactions && transactions.length > 0 && (
          <div className="mt-6 pt-4 border-t border-gray-200">
            <h4 className="text-md font-medium text-gray-900 mb-3">Orders for {symbol}</h4>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Price</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Quantity</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Position After</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Reason</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {transactions.map((tx, index) => {
                    // Parse condition details to display reason for trade
                    let reasonText = 'Strategy criteria met';
                    if (tx.conditionDetails) {
                      try {
                        const condition = JSON.parse(tx.conditionDetails);
                        
                        // Log the condition details for debugging
                        console.log(`Transaction condition for ${tx.symbol} on ${tx.date}:`, condition);
                        
                        if (condition.type === 'technical') {
                          // Technical indicator condition
                          const indicatorName = condition.indicator.toUpperCase();
                          const operator = condition.operator.replace(/_/g, ' ');
                          const value = condition.value;
                          
                          if (condition.indicator === 'macd' && condition.params?.valueType === 'crossover') {
                            reasonText = `MACD ${condition.params.direction} crossover`;
                          } else {
                            reasonText = `${indicatorName} ${operator} ${value}`;
                          }
                          
                          // Log indicator parameters if available
                          if (condition.params) {
                            console.log(`${indicatorName} params:`, condition.params);
                          }
                          
                        } else if (condition.type === 'consecutive') {
                          // Consecutive price movement
                          reasonText = `${condition.days} consecutive ${condition.direction} days`;
                        } else if (condition.metric === 'percent_change') {
                          // Price percent change
                          const timeframe = condition.timeframe || 'daily';
                          const operator = condition.operator.replace(/_/g, ' ');
                          reasonText = `${timeframe} change ${operator} ${condition.value}%`;
                          
                          // Log actual values if available
                          if (condition.actualValue !== undefined) {
                            console.log(`Actual ${timeframe} change: ${condition.actualValue}%, Threshold: ${condition.value}%`);
                          }
                          
                        } else if (condition.metric === 'price') {
                          // Price condition
                          reasonText = `Price ${condition.operator.replace(/_/g, ' ')} $${condition.value}`;
                          
                          // Log actual price if available
                          if (condition.actualValue !== undefined) {
                            console.log(`Actual price: $${condition.actualValue}, Threshold: $${condition.value}`);
                          }
                          
                        } else if (condition.metric === 'volume') {
                          // Volume condition
                          reasonText = `Volume ${condition.operator.replace(/_/g, ' ')} ${condition.value}`;
                        }
                      } catch (e) {
                        console.error('Error parsing condition details:', e);
                      }
                    }
                    
                    return (
                      <tr key={index} className={
                        tx.type === 'buy' || tx.type === 'cover_short' 
                          ? 'bg-green-50' 
                          : 'bg-red-50'
                      }>
                        <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500">{formatDate(tx.date)}</td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          <span className={`px-2 py-1 text-xs rounded-full ${
                            tx.type === 'buy' || tx.type === 'cover_short' 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {tx.type === 'cover_short' ? 'COVER' : tx.type.toUpperCase()}
                          </span>
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500">{formatCurrency(tx.price)}</td>
                        <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500">{tx.quantity.toFixed(4)}</td>
                        <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500">{formatCurrency(tx.amount)}</td>
                        <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500">{tx.positionAfter.toFixed(4)}</td>
                        <td className="px-3 py-2 text-sm text-gray-500">{reasonText}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            
            {/* Key Metrics */}
            <div className="mt-4 bg-gray-50 p-3 rounded-md">
              <h5 className="text-sm font-medium text-gray-700 mb-2">Key Metrics</h5>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                {/* Total Trades */}
                <div className="bg-white p-2 rounded border border-gray-200">
                  <div className="text-xs text-gray-500">Total Trades</div>
                  <div className="text-lg font-semibold">{transactions.length}</div>
                </div>
                
                {/* Buy/Sell Ratio */}
                <div className="bg-white p-2 rounded border border-gray-200">
                  <div className="text-xs text-gray-500">Buy/Sell Ratio</div>
                  <div className="text-lg font-semibold">
                    {(() => {
                      const buys = transactions.filter(tx => tx.type === 'buy' || tx.type === 'cover_short').length;
                      const sells = transactions.filter(tx => tx.type === 'sell' || tx.type === 'short').length;
                      return `${buys}:${sells}`;
                    })()}
                  </div>
                </div>
                
                {/* Avg Buy Price */}
                <div className="bg-white p-2 rounded border border-gray-200">
                  <div className="text-xs text-gray-500">Avg Buy Price</div>
                  <div className="text-lg font-semibold">
                    {formatCurrency(
                      (() => {
                        const buyTx = transactions.filter(tx => tx.type === 'buy' || tx.type === 'cover_short');
                        if (buyTx.length === 0) return 0;
                        return buyTx.reduce((sum, tx) => sum + tx.price, 0) / buyTx.length;
                      })()
                    )}
                  </div>
                </div>
                
                {/* Avg Sell Price */}
                <div className="bg-white p-2 rounded border border-gray-200">
                  <div className="text-xs text-gray-500">Avg Sell Price</div>
                  <div className="text-lg font-semibold">
                    {formatCurrency(
                      (() => {
                        const sellTx = transactions.filter(tx => tx.type === 'sell' || tx.type === 'short');
                        if (sellTx.length === 0) return 0;
                        return sellTx.reduce((sum, tx) => sum + tx.price, 0) / sellTx.length;
                      })()
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const ResultsDashboard = ({ results }) => {
  // Initialize with the first stock symbol from stock data
  const firstStockSymbol = results?._stockData ? Object.keys(results._stockData)[0] : null;
  const [selectedStock, setSelectedStock] = useState(firstStockSymbol);
  const [loadingChart, setLoadingChart] = useState(false);
  
  // Log the results object to debug
  console.log('Results received in dashboard:', results);
  console.log('Stock data available:', results?._stockData ? Object.keys(results._stockData) : 'None');
  console.log('Initial selected stock:', firstStockSymbol);
  
  // More detailed logging for advanced strategy debugging
  console.log('Strategy details:', results?.strategy);
  
  // Log buy/sell conditions if available
  if (results?.buyConditions) {
    console.log('Buy conditions:', results.buyConditions);
  }
  if (results?.sellConditions) {
    console.log('Sell conditions:', results.sellConditions);
  }
  
  // Log transaction information for debugging
  if (results?.transactions) {
    const totalTransactions = results.transactions.length;
    const buyCount = results.transactions.filter(tx => tx.type === 'buy').length;
    const sellCount = results.transactions.filter(tx => tx.type === 'sell').length;
    
    console.log(`Total transactions: ${totalTransactions} (Buy: ${buyCount}, Sell: ${sellCount})`);
    console.log('Transaction dates distribution:');
    
    // Count transactions by month-year
    const transactionsByMonthYear = {};
    results.transactions.forEach(tx => {
      const date = new Date(tx.date);
      const monthYear = `${date.getFullYear()}-${date.getMonth() + 1}`;
      if (!transactionsByMonthYear[monthYear]) {
        transactionsByMonthYear[monthYear] = 0;
      }
      transactionsByMonthYear[monthYear]++;
    });
    
    // Log distribution
    console.log(transactionsByMonthYear);
  }
  
  // Function to handle stock selection with loading state
  const handleStockSelect = (symbol) => {
    setLoadingChart(true);
    // Use setTimeout to allow UI to update before processing data
    setTimeout(() => {
      setSelectedStock(symbol);
      setLoadingChart(false);
    }, 100);
  };
  
  if (!results || results.error) {
    return (
      <div className="mt-6 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative">
        <strong className="font-bold">Error: </strong>
        <span className="block sm:inline">{results?.error || 'No results available'}</span>
      </div>
    );
  }
  
  // Prepare portfolio value chart data with safety check
  const portfolioValueData = results.valueHistory && Array.isArray(results.valueHistory) 
    ? results.valueHistory.map(point => ({
        date: formatDate(point.date),
        value: point.value || 0 // Use 0 as fallback if value is null/undefined
      }))
    : [{ date: formatDate(new Date()), value: 0 }]; // Provide default if valueHistory is missing
  
  // Prepare transaction summary
  const transactionsByType = results.transactions.reduce((acc, transaction) => {
    const type = transaction.type;
    if (!acc[type]) {
      acc[type] = [];
    }
    acc[type].push(transaction);
    return acc;
  }, {});
  
  // Transaction count by symbol with enhanced type handling
  const transactionsBySymbol = results.transactions.reduce((acc, transaction) => {
    const symbol = transaction.symbol;
    if (!acc[symbol]) {
      acc[symbol] = { buy: 0, sell: 0, short: 0, cover: 0 };
    }
    
    // Map transaction types to our chart categories
    if (transaction.type === 'buy') {
      acc[symbol].buy++;
    } else if (transaction.type === 'sell') {
      acc[symbol].sell++;
    } else if (transaction.type === 'short') {
      acc[symbol].short++;
    } else if (transaction.type === 'cover_short') {
      acc[symbol].cover++;
    }
    
    return acc;
  }, {});
  
  const transactionChartData = Object.keys(transactionsBySymbol).map(symbol => ({
    symbol,
    buy: transactionsBySymbol[symbol].buy || 0,
    sell: transactionsBySymbol[symbol].sell || 0,
    short: transactionsBySymbol[symbol].short || 0,
    cover: transactionsBySymbol[symbol].cover || 0
  }));
  
  // Calculate average return per transaction
  const calculateAvgReturn = () => {
    if (!transactionsByType.sell || transactionsByType.sell.length === 0) {
      return 0;
    }
    
    const totalSellAmount = transactionsByType.sell.reduce((sum, tx) => sum + tx.amount, 0);
    const totalBuyAmount = transactionsByType.buy ? 
      transactionsByType.buy.reduce((sum, tx) => sum + tx.amount, 0) : 0;
    
    if (totalBuyAmount === 0) return 0;
    
    return ((totalSellAmount - totalBuyAmount) / totalBuyAmount) * 100;
  };

  return (
    <div className="mt-8">
      <h2 className="text-2xl font-bold text-gray-900 mb-4">Backtest Results</h2>
      <div className="mb-4 bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded">
        <div className="flex items-center">
          <svg className="h-5 w-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
          </svg>
          <p>Click on any stock symbol to view its price chart with buy/sell indicators</p>
        </div>
      </div>
      
      {/* Debug Panel - only visible in development environment */}
      {process.env.NODE_ENV === 'development' && (
        <div className="mb-4 p-4 bg-gray-100 rounded border border-gray-300">
          <details>
            <summary className="cursor-pointer font-medium text-gray-700 hover:text-gray-900">
              Debug Information (Parsed Strategy)
            </summary>
            <div className="mt-2 p-2 bg-white rounded overflow-auto max-h-60">
              <h4 className="text-sm font-medium">Buy Conditions:</h4>
              <pre className="text-xs overflow-auto whitespace-pre-wrap">
                {JSON.stringify(results.buyConditions, null, 2)}
              </pre>
              
              <h4 className="text-sm font-medium mt-2">Sell Conditions:</h4>
              <pre className="text-xs overflow-auto whitespace-pre-wrap">
                {JSON.stringify(results.sellConditions, null, 2)}
              </pre>
              
              <h4 className="text-sm font-medium mt-2">Full Strategy:</h4>
              <pre className="text-xs overflow-auto whitespace-pre-wrap">
                {JSON.stringify(results.strategy, null, 2)}
              </pre>
            </div>
          </details>
        </div>
      )}
      
      {/* Metrics Summary */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4 mb-6">
        <MetricCard 
          title="Total Return" 
          value={(results.metrics.totalReturn || 0).toFixed(2)} 
          suffix="%" 
          description={`From ${formatDate(results.metrics.startDate)} to ${formatDate(results.metrics.endDate)}`}
        />
        <MetricCard 
          title="Final Portfolio Value" 
          value={formatCurrency(portfolioValueData[portfolioValueData.length - 1].value)} 
          description="Including cash and positions"
        />
        <MetricCard 
          title="Max Drawdown" 
          value={(results.metrics.maxDrawdown || 0).toFixed(2)} 
          suffix="%" 
          description="Maximum percentage decline from peak"
        />
        <MetricCard 
          title="Sharpe Ratio" 
          value={(results.metrics.sharpeRatio !== null && results.metrics.sharpeRatio !== undefined) 
            ? results.metrics.sharpeRatio.toFixed(2) 
            : "N/A"} 
          description="Risk-adjusted return metric"
        />
      </div>
      
      {/* Portfolio Value Chart */}
      <div className="bg-white shadow rounded-lg p-4 mb-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Portfolio Value Over Time</h3>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={portfolioValueData}
              margin={{
                top: 10,
                right: 30,
                left: 20,
                bottom: 60, // Increased to make room for angled X-axis labels
              }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="date" 
                angle={-45} 
                textAnchor="end" 
                tickMargin={20}
              />
              <YAxis
                tickFormatter={(value) => formatCurrency(value)}
              />
              <Tooltip 
                formatter={(value) => [formatCurrency(value), 'Portfolio Value']}
              />
              <Legend verticalAlign="top" height={36} />
              <Area 
                type="monotone" 
                dataKey="value" 
                stroke="#4f46e5" 
                fill="#c7d2fe" 
                name="Portfolio Value" 
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
      
      {/* Transactions Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Transaction Counts by Symbol */}
        <div className="bg-white shadow rounded-lg p-4">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Transactions by Stock</h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={transactionChartData}
                margin={{
                  top: 10,
                  right: 30,
                  left: 20,
                  bottom: 60, // Increased to make room for angled X-axis labels
                }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="symbol" angle={-45} textAnchor="end" tickMargin={20} tick={{ fontSize: 10 }} />
                <YAxis />
                <Tooltip />
                <Legend verticalAlign="top" height={60} />
                <Bar dataKey="buy" fill="#4f46e5" name="Buy" />
                <Bar dataKey="sell" fill="#ef4444" name="Sell" />
                <Bar dataKey="short" fill="#f97316" name="Short" />
                <Bar dataKey="cover" fill="#10b981" name="Cover" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        
        {/* Transactions List */}
        <div className="bg-white shadow rounded-lg p-4">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Recent Transactions</h3>
          <div className="overflow-y-auto h-80">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Symbol</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {results.transactions.slice(-20).reverse().map((transaction, index) => (
                  <tr key={index}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{formatDate(transaction.date)}</td>
                    <td 
                      className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 hover:text-indigo-600 cursor-pointer"
                      onClick={() => handleStockSelect(transaction.symbol)}
                      title="Click to view stock chart"
                    >
                      {transaction.symbol}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        transaction.type === 'buy' || transaction.type === 'cover_short' 
                          ? 'bg-green-100 text-green-800' 
                          : transaction.type === 'sell' || transaction.type === 'short'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-gray-100 text-gray-800'
                      }`}>
                        {transaction.type === 'cover_short' ? 'COVER' : transaction.type.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {transaction.amountType === 'shares' ? 
                        `${transaction.amountValue} shares` : 
                      transaction.amountType === 'percentage' ?
                        `${transaction.amountValue}% of portfolio` :
                        formatCurrency(transaction.amount)
                      }
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      
      {/* Positions */}
      <div className="bg-white shadow rounded-lg p-4">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Current Positions</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Symbol</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Quantity</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Avg Cost</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Value (Last Close)</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {Object.entries(results.positions).map(([symbol, quantity]) => {
                if (quantity === 0) return null;
                
                // Get the latest transaction for this symbol to get price and cost basis
                const latestTx = results.transactions
                  .filter(tx => tx.symbol === symbol)
                  .slice(-1)[0];
                
                const currentPrice = latestTx?.price || 0;
                
                // Calculate position value
                const positionValue = currentPrice * quantity;
                
                // Get the average cost from our new dedicated field
                let avgCost = 0;
                
                // First try the dedicated positionAvgCost field (most accurate)
                if (results.positionAvgCost && results.positionAvgCost[symbol] !== undefined) {
                  avgCost = results.positionAvgCost[symbol];
                  console.log(`Symbol: ${symbol}, Using avg cost from positionAvgCost: $${avgCost.toFixed(2)}`);
                }
                // Next try to calculate from the latest transaction
                else if (latestTx?.costBasisAfter !== undefined && Math.abs(quantity) > 0) {
                  avgCost = Math.abs(latestTx.costBasisAfter) / Math.abs(quantity);
                  console.log(`Symbol: ${symbol}, Using transaction cost basis: ${latestTx.costBasisAfter}, Avg: ${avgCost}`);
                } 
                // Fallback to position cost calculation as last resort
                else if (results.positionCost && results.positionCost[symbol] !== undefined) {
                  const costBasis = results.positionCost[symbol];
                  const absQuantity = Math.abs(quantity);
                  
                  if (absQuantity > 0) {
                    avgCost = Math.abs(costBasis) / absQuantity;
                  }
                  
                  console.log(`Symbol: ${symbol}, Using position cost, Quantity: ${quantity}, Cost Basis: ${costBasis}, Avg Cost: ${avgCost}`);
                }
                
                // Ensure avgCost is a valid number and not zero
                if (isNaN(avgCost) || avgCost <= 0) {
                  // If we still have a zero/invalid avgCost, use the current price as a fallback
                  avgCost = currentPrice;
                  console.log(`Symbol: ${symbol}, Using current price as fallback avgCost: $${avgCost}`);
                }
                
                return (
                  <tr 
                    key={symbol} 
                    className={`hover:bg-blue-50 cursor-pointer ${quantity < 0 ? 'bg-red-50' : ''}`} 
                    onClick={() => handleStockSelect(symbol)}
                    title="Click to view stock chart"
                  >
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{symbol}</td>
                    <td className={`px-6 py-4 whitespace-nowrap text-sm ${quantity < 0 ? 'text-red-600 font-medium' : 'text-gray-500'}`}>
                      {quantity.toFixed(4)}
                      {quantity < 0 && (
                        <span className="ml-2 px-1.5 py-0.5 text-xs bg-red-100 text-red-800 rounded-full">
                          SHORT
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatCurrency(avgCost)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatCurrency(positionValue)}
                    </td>
                  </tr>
                );
              })}
              <tr className="bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">Cash</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">-</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">-</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{formatCurrency(results.cash)}</td>
              </tr>
              <tr className="bg-gray-100 font-medium">
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">Total</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">-</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">-</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {formatCurrency(
                    // Calculate total by summing all position values and cash
                    // This should match the value in valueHistory
                    (() => {
                      // Get the calculated total from valueHistory if available
                      const valueHistoryTotal = results.valueHistory && results.valueHistory.length > 0 
                        ? results.valueHistory[results.valueHistory.length-1].value 
                        : null;
                      
                      // Calculate our own total as backup
                      const calculatedTotal = Object.entries(results.positions).reduce((total, [symbol, quantity]) => {
                        if (quantity === 0) return total;
                        // Get latest transaction for this position to get price
                        const latestTx = results.transactions
                          .filter(tx => tx.symbol === symbol)
                          .slice(-1)[0];
                        // Calculate position value using the price
                        const currentPrice = latestTx?.price || 0;
                        const positionValue = currentPrice * quantity;
                        return total + positionValue;
                      }, results.cash || 0);
                      
                      // Use valueHistory total if available, otherwise use calculated
                      return valueHistoryTotal !== null ? valueHistoryTotal : calculatedTotal;
                    })()
                  )}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
      
      {/* Individual stock chart or loading indicator - Always displayed */}
      <div className="mt-6">
        <div className="flex justify-between items-center mb-2">
          <h3 className="text-xl font-bold text-gray-900">Stock Performance</h3>
          {selectedStock && (
            <div className="flex space-x-2 items-center">
              <span className="text-sm text-gray-500">Currently viewing: {selectedStock}</span>
              {Object.keys(results._stockData || {}).length > 1 && (
                <select 
                  className="text-sm border border-gray-300 rounded px-2 py-1"
                  value={selectedStock || ''}
                  onChange={(e) => setSelectedStock(e.target.value)}
                >
                  {Object.keys(results._stockData || {}).map(symbol => (
                    <option key={symbol} value={symbol}>{symbol}</option>
                  ))}
                </select>
              )}
            </div>
          )}
        </div>
        
        {loadingChart ? (
          <div className="bg-white shadow rounded-lg p-8">
            <div className="flex justify-center items-center h-60">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
              <span className="ml-3 text-gray-600">Loading chart data...</span>
            </div>
          </div>
        ) : selectedStock ? (
          <StockChart 
            symbol={selectedStock} 
            stockData={results._stockData && results._stockData[selectedStock] ? results._stockData[selectedStock] : []} 
            transactions={results.transactions.filter(tx => tx.symbol === selectedStock)}
            errorFallback={
              <div className="p-4 text-center text-gray-500 bg-white shadow rounded-lg">
                <p className="mb-2">Could not render chart for {selectedStock}. The data may be unavailable or in an incorrect format.</p>
                <div className="mt-2">
                  <select 
                    className="mr-2 border border-gray-300 rounded px-2 py-1"
                    value=""
                    onChange={(e) => setSelectedStock(e.target.value)}
                  >
                    <option value="" disabled>Select another stock</option>
                    {Object.keys(results._stockData || {})
                      .filter(s => s !== selectedStock)
                      .map(symbol => (
                        <option key={symbol} value={symbol}>{symbol}</option>
                    ))}
                  </select>
                </div>
              </div>
            }
          />
        ) : (
          <div className="p-4 text-center text-gray-500 bg-white shadow rounded-lg">
            <p>No stock data available to display.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ResultsDashboard;