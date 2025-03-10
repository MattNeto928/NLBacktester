# NLTradeTest

NLTradeTest is a web application that allows users to backtest trading strategies described in natural language against historical stock data. The application leverages Google Gemini's API for language parsing and React with Tailwind for the frontend.

## Features

- Natural language processing of trading strategies
- Historical stock data retrieval via Yahoo Finance API
- Backtesting engine for strategy evaluation
- Interactive dashboard with performance charts and metrics
- Local SQLite database for efficient data storage

## Project Structure

- `/client` - React frontend with Tailwind CSS
- `/server` - Node.js backend with Express API
- `/data` - Local directory for SQLite database
- `/lib` - Shared utilities and helper functions

## Getting Started

### Prerequisites

- Node.js (v14 or higher)
- npm (v6 or higher)
- Google Gemini API key

### Installation

1. Clone the repository
2. Install server dependencies:
   ```
   cd server
   npm install
   ```
3. Install client dependencies:
   ```
   cd client
   npm install
   ```
4. Set up environment variables:
   - Create a `.env` file in the server directory
   - Add your Google Gemini API key: `GEMINI_API_KEY=your_api_key_here`

### Running the Application

1. Start the server:
   ```
   cd server
   npm run dev
   ```
2. Start the client:
   ```
   cd client
   npm start
   ```
3. Access the application at `http://localhost:3000`

## Usage Example

Enter a natural language strategy description like:

```
For every week a stock goes down 5%, I will buy $5 worth of that stock. And every instance that a stock goes up 10% for a given week, I will sell $10 of that stock. Do this for 10 blue chip stocks and 10 penny stocks ranging from 2010 to 2023.
```

The system will:
1. Parse this into a structured format
2. Fetch historical data for the specified stock universe
3. Execute the backtesting simulation
4. Display results with interactive charts and metrics

## Technologies Used

- **Frontend**: React, Tailwind CSS, Recharts
- **Backend**: Node.js, Express
- **Database**: SQLite
- **APIs**: Google Gemini API, Yahoo Finance API
- **Data Processing**: Custom backtesting engine

## License

MIT