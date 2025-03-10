import { useState } from 'react';
import StrategyInput from './components/StrategyInput';
import ResultsDashboard from './components/ResultsDashboard';

function App() {
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleStrategySubmit = async (description) => {
    setLoading(true);
    setError(null);
    setResults(null);
    
    try {
      // Show processing message
      setError("Processing strategy... this may take a moment");
      
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
      
      const parseData = await parseResponse.json();
      setError("Strategy parsed successfully. Fetching historical data and running backtest...");
      
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
      
      const backtestData = await backtestResponse.json();
      
      // Clear any error messages
      setError(null);
      
      // Set results
      setResults(backtestData.results);
    } catch (err) {
      console.error('Error:', err);
      setError(`Error: ${err.message}. Please try a different strategy or check the server logs.`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-white shadow-md">
        <div className="max-w-7xl mx-auto py-6 px-4">
          <h1 className="text-3xl font-bold text-gray-900">NLTradeTest</h1>
          <p className="text-gray-600">Backtest trading strategies using natural language</p>
        </div>
      </header>
      
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <StrategyInput onSubmit={handleStrategySubmit} isLoading={loading} />
          
          {error && (
            <div className={`mt-6 ${error.startsWith('Processing') || error.startsWith('Strategy parsed') 
                             ? 'bg-blue-100 border border-blue-400 text-blue-700' 
                             : 'bg-red-100 border border-red-400 text-red-700'} 
                           px-4 py-3 rounded relative`}>
              {error.startsWith('Processing') || error.startsWith('Strategy parsed') ? (
                <div className="flex items-center">
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span className="block sm:inline">{error}</span>
                </div>
              ) : (
                <span className="block sm:inline">{error}</span>
              )}
            </div>
          )}
          
          {results && <ResultsDashboard results={results} />}
        </div>
      </main>
    </div>
  );
}

export default App;
