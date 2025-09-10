# Prompt Engineering Tool

A fullstack application for practicing prompt engineering with image generation and comparison features.

## Architecture

- **Frontend**: React + TypeScript + Vite (client folder)
- **Backend**: Express + TypeScript (server folder)
- **AI Services**: Google Gemini AI, Pollinations AI

## Features

- Image generation using multiple AI services (Pollinations, Gemini)
- Image comparison and analysis using Gemini AI
- Prompt engineering challenges
- User authentication
- Real-time feedback on prompt quality

## Setup Instructions

### Prerequisites

- Node.js (v18 or higher)
- npm or yarn
- Gemini API key (get from [Google AI Studio](https://aistudio.google.com/))

### Backend Setup

1. Navigate to the server directory:
   ```bash
   cd server
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Copy environment variables:
   ```bash
   cp .env.example .env
   ```

4. Add your Gemini API key to `.env`:
   ```
   GEMINI_API_KEY=your_actual_api_key_here
   ```

5. Start the development server:
   ```bash
   npm run dev
   ```

The backend will run on `http://localhost:3001`

### Frontend Setup

1. Navigate to the client directory:
   ```bash
   cd client
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

The frontend will run on `http://localhost:5173`

## API Endpoints

### Image Generation
- `POST /api/images/generate` - Generate images using AI services
- `POST /api/images/local` - Get local images as base64

### Image Analysis
- `POST /api/analysis/compare` - Compare generated vs target images

### Health Check
- `GET /health` - Server health status

## Environment Variables

### Server (.env)
```
NODE_ENV=development
PORT=3001
CORS_ORIGIN=http://localhost:5173
GEMINI_API_KEY=your_gemini_api_key
REQUEST_TIMEOUT=30000
MAX_FILE_SIZE=10485760
```

### Client (.env)
```
VITE_API_BASE_URL=http://localhost:3001/api
```

## Development

1. Start both frontend and backend servers
2. The frontend will proxy API requests to the backend
3. Both support hot reload for development

## Deployment

### Backend
1. Build: `npm run build`
2. Start: `npm start`

### Frontend
1. Build: `npm run build`
2. Serve the `dist` folder

## Architecture Decisions

- **Separation of Concerns**: Frontend handles UI/UX, backend handles AI API calls and image processing
- **Environment-based Configuration**: API keys and endpoints configurable via environment variables
- **Type Safety**: Full TypeScript support across frontend and backend
- **Error Handling**: Comprehensive error handling with meaningful messages
- **Security**: CORS protection, input validation, and secure API key handling

## Technologies Used

- **Frontend**: React 19, TypeScript, Vite
- **Backend**: Express, TypeScript, Node.js
- **AI Services**: Google Gemini AI, Pollinations
- **Development**: tsx for TypeScript execution, ESLint for code quality
