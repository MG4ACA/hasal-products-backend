# Hasal POS Backend API

Backend API for Hasal Products POS & Inventory Management System

## Tech Stack

- **Runtime:** Node.js v20.19.1
- **Framework:** Express.js
- **Database:** MySQL 8.0.39
- **ORM:** Sequelize
- **Authentication:** JWT (24-hour expiry)

## Project Structure

```
hasal-pos-backend/
├── config/          # Configuration files
├── controllers/     # Route controllers
├── models/          # Sequelize models
├── routes/          # API routes
├── middleware/      # Express middleware
├── utils/           # Utility functions
├── app.js           # Express app setup
├── server.js        # Server entry point
└── package.json     # Dependencies
```

## Getting Started

### Prerequisites

- Node.js v20.19.1
- MySQL 8.0.39
- npm or yarn

### Installation

1. Install dependencies:
```bash
npm install
```

2. Configure environment variables:
```bash
# Copy .env.development and update with your values
cp .env.development .env
```

3. Update `.env` file with your database credentials:
```
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=hasal_pos_dev
```

4. Create database:
```bash
# Login to MySQL and create database
mysql -u root -p
CREATE DATABASE hasal_pos_dev;
```

### Running the Server

Development mode with auto-reload:
```bash
npm run dev
```

Production mode:
```bash
npm start
```

Server will start on `http://localhost:5000`

## API Endpoints

### Health Check
- `GET /health` - Server health status

### API Base
- `GET /api` - API information

## Development

### Code Style

- ESLint for linting
- Prettier for formatting

Run linting:
```bash
npx eslint .
```

Format code:
```bash
npx prettier --write .
```

## Database

### Sequelize CLI Commands

Run migrations:
```bash
npx sequelize-cli db:migrate
```

Undo migrations:
```bash
npx sequelize-cli db:migrate:undo
```

Run seeders:
```bash
npx sequelize-cli db:seed:all
```

## Response Format

All API responses follow this format:

**Success:**
```json
{
  "success": true,
  "message": "Success message",
  "data": {}
}
```

**Error:**
```json
{
  "success": false,
  "message": "Error message",
  "errors": []
}
```

## License

ISC
