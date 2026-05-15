# Showroom Pro - Backend API

Express.js REST API for the Showroom Pro e-commerce management system.

## Quick Start

```bash
# Install dependencies
npm install

# Setup environment variables
cp .env.example .env
# Edit .env with your MongoDB connection string

# Development
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

## Environment Variables

- `MONGODB_URI` - MongoDB connection string (required)
- `MONGODB_DB` - Database name (optional, defaults to `showroom_pro`)
- `CLOUDINARY_CLOUD_NAME` - Cloudinary cloud name for invoice logo uploads
- `CLOUDINARY_API_KEY` - Cloudinary API key for signed uploads
- `CLOUDINARY_API_SECRET` - Cloudinary API secret for signed uploads
- `NODE_ENV` - Environment (`development` or `production`)
- `PORT` - Server port (default: 5001)

## API Routes

- `POST /health` - Health check
- `POST /auth/*` - Authentication endpoints
- `GET/POST /products` - Product management with bulk upload
- `GET/POST /orders` - Order management
- `GET/POST /customers` - Customer data
- `GET/POST /staff` - Staff management
- `GET/POST /categories` - Product categories
- `GET /dashboard` - Dashboard analytics
- `GET /billing` - Billing information

## Features

- ✅ JWT authentication
- ✅ CSV/Excel bulk product upload (5MB max)
- ✅ MongoDB integration
- ✅ Zod validation
- ✅ Pino logging
- ✅ CORS support

## Project Structure

```
api-server/       Express API server
db/              MongoDB schema & utilities
dist/            Built output (after npm run build)
```

## Scripts

- `npm run dev` - Start with auto-rebuild
- `npm run build` - Build for production
- `npm start` - Run production build
- `npm run typecheck` - TypeScript type checking

## Database

Uses MongoDB with directly imported MongoDB native driver. Schema defined in `db/src/schema/`.
