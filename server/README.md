# Finquanta AI Server

Fastify TypeScript backend server for Finquanta AI application.

## Features

- ⚡ **Fastify** - High-performance web framework
- 🔷 **TypeScript** - Type-safe development
- 📝 **Structured Logging** - Beautiful logs with pino-pretty
- 🔍 **Health Checks** - Built-in health monitoring
- 🛡️ **Schema Validation** - Request/response validation
- 🔧 **Hot Reload** - Development with nodemon

## Quick Start

1. **Install dependencies**
   ```bash
   pnpm install
   ```

2. **Copy environment file**
   ```bash
   cp .env.example .env
   ```

3. **Start development server**
   ```bash
   pnpm dev
   ```

4. **Start production server**
   ```bash
   pnpm build
   pnpm start
   ```

## Available Scripts

- `pnpm dev` - Start development server with hot reload
- `pnpm build` - Build TypeScript to JavaScript
- `pnpm start` - Start production server
- `pnpm start:prod` - Start in production mode
- `pnpm clean` - Clean build directory

## API Endpoints

### Health Checks
- `GET /health` - Basic health check
- `GET /health/detailed` - Detailed health with system info

### API Information
- `GET /api` - API information
- `GET /api/version` - Version information
- `GET /api/test` - Development test endpoint

## Project Structure

```
server/
├── src/
│   ├── config/          # Configuration files
│   ├── routes/          # API routes
│   │   ├── health.ts    # Health check routes
│   │   ├── api.ts       # General API routes
│   │   └── index.ts     # Route registry
│   ├── types/           # TypeScript type definitions
│   ├── utils/           # Utility functions
│   ├── controllers/     # Route controllers
│   ├── services/        # Business logic
│   ├── server.ts        # Fastify server setup
│   └── index.ts         # Application entry point
├── dist/                # Compiled JavaScript (build output)
├── .env.example         # Environment variables template
├── package.json         # Dependencies and scripts
├── tsconfig.json        # TypeScript configuration
└── README.md           # This file
```

## Environment Variables

See `.env.example` for all available configuration options.

## Development

The server runs on port 3001 by default. You can change this by setting the `PORT` environment variable.

## License

ISC