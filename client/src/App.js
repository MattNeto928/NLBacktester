import { useState, useEffect } from 'react';
import StrategyInput from './components/StrategyInput';
import ResultsDashboard from './components/ResultsDashboard';

function App() {
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [progressStep, setProgressStep] = useState(0);
  const [progressText, setProgressText] = useState('');
  const [progressAnimation, setProgressAnimation] = useState(false);

  // Add effect for animated progress bar
  useEffect(() => {
    if (loading && progressStep < 100) {
      // Set up different progress animations for each step
      const timer = setTimeout(() => {
        if (progressStep < 25) {
          // Parsing phase - move more quickly
          setProgressStep(prev => Math.min(prev + 0.5, 25));
        } else if (progressStep < 50) {
          // Waiting for parsing response - slow down a bit
          setProgressStep(prev => Math.min(prev + 0.2, 50));
        } else if (progressStep < 75) {
          // Backtesting phase - steady progress
          setProgressStep(prev => Math.min(prev + 0.3, 75));
        } else if (progressStep < 95) {
          // Final data processing - slow movement
          setProgressStep(prev => Math.min(prev + 0.1, 95));
        }
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [loading, progressStep]);

  const handleStrategySubmit = async (description) => {
    setLoading(true);
    setError(null);
    setResults(null);
    setProgressStep(0);
    setProgressAnimation(true);
    setProgressText('Analyzing your strategy...');
    
    try {
      // Start of parsing phase
      setProgressStep(5);
      setProgressText('Processing natural language strategy...');
      
      // Step 1: Parse natural language to structured strategy
      const parseResponse = await fetch('http://100.27.187.96:5001/api/strategy/parse', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ description }),
      });
      
      if (!parseResponse.ok) {
        const errorData = await parseResponse.json();
        throw new Error(errorData.error || 'Failed to parse strategy');
      }
      
      // Parsing successful
      setProgressStep(30);
      setProgressText('Strategy parsed successfully! Preparing backtest parameters...');
      
      const parseData = await parseResponse.json();
      
      // Start of backtesting phase
      setProgressStep(40);
      setProgressText('Fetching historical data...');
      
      setTimeout(() => {
        setProgressStep(50);
        setProgressText('Running backtest simulation...');
      }, 1000);
      
      // Step 2: Submit structured strategy for backtesting
      const backtestResponse = await fetch('http://100.27.187.96:5001/api/strategy/backtest', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ strategy: parseData.strategy }),
      });
      
      if (!backtestResponse.ok) {
        const errorData = await backtestResponse.json();
        throw new Error(errorData.error || 'Failed to run backtest');
      }
      
      // Backtesting successful
      setProgressStep(85);
      setProgressText('Backtest complete! Processing results...');
      
      const backtestData = await backtestResponse.json();
      
      // Final processing
      setProgressStep(95);
      setProgressText('Preparing visualizations...');
      
      // Clear any error messages
      setError(null);
      
      // Small delay for visual satisfaction before showing results
      setTimeout(() => {
        // Finalize the progress bar
        setProgressStep(100);
        setProgressText('Complete!');
        
        // Set results
        setResults(backtestData.results);
        
        // Delay slightly before removing the loading state
        setTimeout(() => {
          setLoading(false);
          setProgressAnimation(false);
        }, 500);
      }, 800);
      
    } catch (err) {
      console.error('Error:', err);
      setError(`Error: ${err.message}. Please try a different strategy or check the server logs.`);
      setProgressAnimation(false);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-white shadow-md">
        <div className="max-w-7xl mx-auto py-6 px-4">
          <h1 className="text-3xl font-bold text-gray-900">NLBacktest</h1>
          <p className="text-gray-600">Backtest trading strategies using natural language</p>
        </div>
      </header>
      
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <StrategyInput onSubmit={handleStrategySubmit} isLoading={loading} />
          
          {/* Stylish Progress Bar */}
          {loading && progressAnimation && (
            <div className="mt-6 bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
              <div className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center">
                    <div className="mr-3 bg-indigo-100 p-2 rounded-full">
                      {progressStep < 30 ? (
                        <svg className="h-5 w-5 text-indigo-600 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                        </svg>
                      ) : progressStep < 60 ? (
                        <svg className="h-5 w-5 text-indigo-600 animate-bounce" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                        </svg>
                      ) : progressStep < 90 ? (
                        <svg className="h-5 w-5 text-indigo-600 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                        </svg>
                      ) : (
                        <svg className="h-5 w-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      )}
                    </div>
                    <div>
                      <h3 className="font-medium text-gray-800">{progressText}</h3>
                      <div className="text-xs text-gray-500 mt-0.5">
                        {progressStep < 30 ? (
                          "AI is parsing and interpreting your strategy..."
                        ) : progressStep < 60 ? (
                          "Collecting historical market data for the specified assets..."
                        ) : progressStep < 90 ? (
                          "Executing virtual trades based on your strategy rules..."
                        ) : (
                          "Finalizing results and preparing visualizations..."
                        )}
                      </div>
                    </div>
                  </div>
                  <span className="px-2 py-1 bg-indigo-100 text-sm font-semibold text-indigo-700 rounded-md">
                    {Math.round(progressStep)}%
                  </span>
                </div>
                
                {/* Animated progress bar */}
                <div className="relative w-full h-3 bg-gray-100 rounded-full overflow-hidden">
                  <div 
                    className="absolute top-0 left-0 h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-600 rounded-full transition-all duration-500 ease-out"
                    style={{ width: `${progressStep}%` }}
                  >
                    {/* Animated shimmer effect */}
                    <div className="absolute inset-0 w-full h-full">
                      <div className="absolute inset-0 opacity-25 bg-[linear-gradient(110deg,transparent_33%,rgba(255,255,255,0.3)_50%,transparent_66%)] animate-[shimmer_2s_infinite]"></div>
                    </div>
                  </div>
                </div>
                
                {/* Stage indicators - dynamic progress markers */}
                <div className="relative w-full h-7 mt-2">
                  <div className="absolute top-0 left-0 w-full flex justify-between">
                    {/* Step markers with indicators */}
                    <div className="relative flex flex-col items-center">
                      <div className={`w-4 h-4 rounded-full ${progressStep >= 25 ? 'bg-indigo-600' : 'bg-gray-300'} 
                        transition-colors duration-500 z-10 ${progressStep < 30 && progressStep > 5 ? 'shadow-[0_0_8px_rgba(79,70,229,0.6)]' : ''}`}></div>
                      <div className={`text-xs mt-1 font-medium ${progressStep >= 25 ? 'text-indigo-700' : 'text-gray-500'}`}>Parse</div>
                    </div>
                    
                    <div className="relative flex flex-col items-center">
                      <div className={`w-4 h-4 rounded-full ${progressStep >= 50 ? 'bg-indigo-600' : 'bg-gray-300'} 
                        transition-colors duration-500 z-10 ${progressStep < 55 && progressStep > 35 ? 'shadow-[0_0_8px_rgba(79,70,229,0.6)]' : ''}`}></div>
                      <div className={`text-xs mt-1 font-medium ${progressStep >= 50 ? 'text-indigo-700' : 'text-gray-500'}`}>Collect</div>
                    </div>
                    
                    <div className="relative flex flex-col items-center">
                      <div className={`w-4 h-4 rounded-full ${progressStep >= 75 ? 'bg-indigo-600' : 'bg-gray-300'} 
                        transition-colors duration-500 z-10 ${progressStep < 80 && progressStep > 55 ? 'shadow-[0_0_8px_rgba(79,70,229,0.6)]' : ''}`}></div>
                      <div className={`text-xs mt-1 font-medium ${progressStep >= 75 ? 'text-indigo-700' : 'text-gray-500'}`}>Backtest</div>
                    </div>
                    
                    <div className="relative flex flex-col items-center">
                      <div className={`w-4 h-4 rounded-full ${progressStep >= 100 ? 'bg-green-600' : 'bg-gray-300'} 
                        transition-colors duration-500 z-10 ${progressStep < 100 && progressStep > 90 ? 'shadow-[0_0_8px_rgba(16,185,129,0.6)]' : ''}`}></div>
                      <div className={`text-xs mt-1 font-medium ${progressStep >= 100 ? 'text-green-700' : 'text-gray-500'}`}>Complete</div>
                    </div>
                  </div>
                  
                  {/* Progress line connecting steps */}
                  <div className="absolute top-2 left-0 w-full h-0.5 bg-gray-200 z-0">
                    <div 
                      className="absolute h-full bg-indigo-600 transition-all duration-500 ease-out"
                      style={{ width: `${Math.min(progressStep, 100)}%` }}
                    ></div>
                  </div>
                </div>
                
                {/* Status indicators section */}
                <div className="mt-3 text-sm flex justify-between">
                  <div className="flex items-center space-x-1">
                    <span className="relative flex h-2 w-2">
                      <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${progressStep < 100 ? 'bg-indigo-400' : 'bg-green-400'} opacity-75`}></span>
                      <span className={`relative inline-flex rounded-full h-2 w-2 ${progressStep < 100 ? 'bg-indigo-500' : 'bg-green-500'}`}></span>
                    </span>
                    <span className={`text-xs ${progressStep < 100 ? 'text-indigo-700' : 'text-green-700'}`}>
                      {progressStep < 100 ? "Processing..." : "Ready!"}
                    </span>
                  </div>
                  
                  <div className="text-xs text-gray-500">
                    {progressStep < 100 ? (
                      <span>
                        Typically takes <span className="font-medium">10-20 seconds</span> to complete
                      </span>
                    ) : (
                      <span className="text-green-600 font-medium">Processing completed successfully!</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && !loading && (
            <div className="mt-6 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative">
              <span className="block sm:inline">{error}</span>
            </div>
          )}
          
          {results && <ResultsDashboard results={results} />}
        </div>
      </main>
    </div>
  );
}

export default App;
