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
      
      // Calculate EMA helper function
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

    
    const calculateVolumeChange = (data) => {
      const result = [];
      
      // First point has no previous to compare with
      result.push({ ...data[0], indicator: 0 });
      
      // Calculate volume change for remaining points
      for (let i = 1; i < data.length; i++) {
        const previousVolume = data[i-1].volume;
        const currentVolume = data[i].volume;
        
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
          labelFormatter: (value) => `${value.toFixed(2)}`
        };
      case 'volume':
        return {
          domain: ['auto', 'auto'],
          label: 'Volume Change %',
          labelFormatter: (value) => `${value.toFixed(2)}%`,
          referenceLinesY: [
            { y: 0, stroke: '#888', strokeWidth: 1 }
          ]
        };
      case 'raw_volume':
        return {
          domain: [0, 'auto'],
          label: 'Volume',
          labelFormatter: (value) => {
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
          labelFormatter: (value) => `${value.toFixed(2)}`
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
          {/* Render indicator line */}
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
          
          {indicator === 'macd' && (
            <>
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
                fill="#10b981"
                yAxisId="left"
                opacity={0.6}
                name="Histogram"
              />
            </>
          )}
          
          {indicator === 'volume' && (
            <Bar 
              dataKey="indicator"
              fill="#4f46e5"
              yAxisId="left"
              name="Volume Change %"
            />
          )}
          
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