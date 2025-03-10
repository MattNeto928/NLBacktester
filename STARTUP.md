# NLBacktest Startup Guide

Follow these steps to run the NLBacktest application:

## Prerequisites

1. Ensure you have Node.js installed (v14 or higher)
2. Obtain a Google Gemini API key from https://ai.google.dev/

## First-Time Setup

1. Set up the environment variables:
   ```
   cd server
   ```

   Edit the `.env` file to add your Google Gemini API key:
   ```
   GEMINI_API_KEY=your_api_key_here
   PORT=5000
   NODE_ENV=development
   ```

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

## Running the Application

1. Start the server:
   ```
   cd server
   npm run dev
   ```

2. In a new terminal, start the client:
   ```
   cd client
   npm start
   ```

3. Open your browser and navigate to:
   ```
   http://localhost:3000
   ```

## Example Strategy

Try entering this example trading strategy:

```
For every week a stock goes down 5%, I will buy $5 worth of that stock. And every instance that a stock goes up 10% for a given week, I will sell $10 of that stock. Do this for 10 blue chip stocks and 10 penny stocks ranging from 2010 to 2023.
```

## Troubleshooting

- If you encounter a Gemini API error, verify your API key in the `.env` file
- If the server fails to start, check if port 5000 is already in use
- If the client fails to connect to the server, verify the server is running on port 5000