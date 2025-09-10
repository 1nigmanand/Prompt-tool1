# Prompt Tool Server

A robust Express.js backend server for AI-powered image generation and analysis.

## 🚀 Features

- **Multiple AI Models**: Support for both Pollinations AI and Google Gemini Imagen
- **Image Generation**: Generate images from text prompts using various AI models
- **Image Analysis**: Compare generated images with target images using AI
- **TypeScript**: Fully typed codebase for better development experience
- **Error Handling**: Comprehensive error handling with custom ApiError class
- **Request Validation**: Input validation for all endpoints
- **Logging**: Detailed request/response logging with emojis

## 🛠️ Tech Stack

- **Framework**: Express.js with TypeScript
- **AI Services**: 
  - Google Gemini AI (@google/genai)
  - Pollinations AI (via text-se-image package)
- **Middleware**: CORS, Helmet, Compression
- **Environment**: dotenv for configuration

## 📋 API Endpoints

### Health Check
```
GET /health
```
Returns server status and information.

### Image Generation
```
POST /api/images/generate
```
Generate images using AI models.

**Request Body:**
```json
{
  "prompt": "A beautiful sunset over mountains",
  "service": "gemini-imagen-3",
  "apiKey": "optional-api-key"
}
```

**Supported Services:**
- `pollinations-flux` - High-quality image generation
- `pollinations-kontext` - Photorealistic images  
- `pollinations-krea` - Anime/manga style
- `gemini-imagen-3` - Standard Gemini quality
- `gemini-imagen-4-fast` - Fast generation
- `gemini-imagen-4-ultra` - Ultra realistic 4K

### Local Image Retrieval
```
POST /api/images/local
```
Fetch and convert local images to base64.

**Request Body:**
```json
{
  "imageUrl": "challenges/challenge-1.png"
}
```

### Image Analysis
```
POST /api/analysis/compare
```
Compare generated image with target image.

**Request Body:**
```json
{
  "user": { "email": "user@example.com" },
  "challenge": {
    "name": "Simple Shape",
    "description": "Generate a simple shape"
  },
  "generatedImageBase64": "base64-string"
}
```

## 🔧 Installation

1. **Install dependencies:**
```bash
npm install
```

2. **Set up environment variables:**
```bash
cp .env.example .env
```

3. **Configure environment:**
```env
PORT=3002
NODE_ENV=development
CORS_ORIGIN=http://localhost:5173
GEMINI_API_KEY=your-gemini-api-key
```

4. **Start development server:**
```bash
npm run dev
```

## 📁 Project Structure

```
server/
├── src/
│   ├── controllers/     # Request handlers
│   │   ├── imageController.ts
│   │   └── analysisController.ts
│   ├── services/        # Business logic
│   │   ├── imageService.ts
│   │   └── analysisService.ts
│   ├── routes/          # API routes
│   │   ├── imageRoutes.ts
│   │   └── analysisRoutes.ts
│   ├── middleware/      # Custom middleware
│   │   ├── errorHandler.ts
│   │   └── requestLogger.ts
│   ├── types/           # TypeScript definitions
│   │   └── index.ts
│   └── server.ts        # Main application
├── package.json
└── tsconfig.json
```

## 🔑 Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | 3002 |
| `NODE_ENV` | Environment | development |
| `CORS_ORIGIN` | Frontend URL | http://localhost:5173 |
| `GEMINI_API_KEY` | Google Gemini API key | - |

## 🧪 Development

### Scripts
```bash
# Start development server with hot reload
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Type checking
npm run type-check
```

### Logging
The server uses comprehensive logging with emojis for better visibility:
- 🚀 Server startup
- 🎯 Request received
- 🎨 Image generation
- 🔍 Analysis start
- ✅ Success operations
- ❌ Error operations

## 🚨 Error Handling

Custom `ApiError` class provides structured error responses:

```typescript
{
  "success": false,
  "error": "Error message",
  "timestamp": "2025-09-11T10:30:00.000Z"
}
```

## 🔐 Security

- **Helmet**: Security headers
- **CORS**: Cross-origin resource sharing
- **Input validation**: All requests validated
- **Environment variables**: Sensitive data protected

## 📝 API Response Format

All endpoints return consistent response format:

**Success Response:**
```json
{
  "success": true,
  "data": {},
  "timestamp": "2025-09-11T10:30:00.000Z"
}
```

**Error Response:**
```json
{
  "success": false,
  "error": "Error message",
  "timestamp": "2025-09-11T10:30:00.000Z"
}
```

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

## 📄 License

This project is licensed under the MIT License.
