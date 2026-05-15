# Showroom Pro - Frontend

React admin dashboard for Showroom Pro e-commerce management system.

## Quick Start

```bash
# Install dependencies
npm install

# Setup environment variables
cp .env.example .env
# Edit .env if your API server runs on a different URL

# Development (Vite dev server on port 3000)
npm run dev

# Build for production
npm run build

# Preview build
npm run serve
```

## Environment Variables

- `VITE_API_URL` - Backend API URL (default: `http://localhost:5001/api`)

## Features

- ✅ React 18 with TypeScript
- ✅ Vite bundler for fast development
- ✅ Radix UI component library
- ✅ React Hook Form for forms
- ✅ TanStack React Query for API state management
- ✅ Tailwind CSS for styling
- ✅ Responsive design (mobile-friendly)
- ✅ Toast notifications

## Pages

- **Dashboard** - Overview & analytics
- **Products** - Product catalog with bulk upload
- **Orders** - Order management
- **Customers** - Customer data
- **Staff** - Employee management
- **Categories** - Product categories
- **Billing** - Invoice & billing information
- **SignIn / SignUp** - Authentication

## Project Structure

```
showroom/        Main React app
packages/        Shared UI & utilities
dist/           Built output (after npm run build)
```

## Scripts

- `npm run dev` - Start development server (port 3000)
- `npm run build` - Build for production
- `npm run serve` - Preview production build
- `npm run typecheck` - TypeScript type checking

## API Integration

Communicates with backend API at `/api/*` endpoints:
- `/api/auth/*` - Authentication
- `/api/products` - Product management
- `/api/orders` - Orders
- `/api/customers` - Customers
- `/api/staff` - Staff
- `/api/categories` - Categories
- `/api/dashboard` - Dashboard data
- `/api/billing` - Billing

Backend should be running on `http://localhost:5001` by default.
