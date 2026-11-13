const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');
const { errorHandler } = require('./middleware/errorHandler');
const { health, databaseHealth } = require('./controllers/healthController');

dotenv.config();
dotenv.config({ path: path.join(__dirname, '.env') });
// Ensure a JWT secret is always present (use a generated one in dev if missing)
if (!process.env.JWT_SECRET) {
  const crypto = require('crypto');
  process.env.JWT_SECRET = crypto.randomBytes(48).toString('base64');
  console.warn('JWT_SECRET was not defined; generated a temporary secret for this session.');
}

const app = express();
const PORT = process.env.PORT || 5000;
const HOST = process.env.HOST || '0.0.0.0';

const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configurable CORS to support LAN access from other laptops
const allowedOrigins = process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',').map((o) => o.trim()) : null;

app.use(cors({
  origin: (origin, callback) => {
    // Allow non-browser requests (mobile apps, curl, smoke tests, server-to-server)
    if (!origin) return callback(null, true);
    if (!allowedOrigins || allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    // Allow local network and localhost origins automatically
    if (/^https?:\/\/(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+)(:\d+)?$/.test(origin)) {
      return callback(null, true);
    }
    return callback(null, true);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
}));
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(uploadDir));
// Serve frontend production build (SPA)
const frontendDist = path.resolve(__dirname, '../../frontend/dist');
app.use(express.static(frontendDist));

// API routes (must be defined BEFORE the catch‑all)
app.use('/api/auth', require('./routes/auth'));
app.use('/api/brands', require('./routes/brands'));
app.use('/api/organizations', require('./routes/organizations'));
app.use('/api/guidelines', require('./routes/guidelines'));
app.use('/api/content', require('./routes/content'));
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/reviews', require('./routes/reviews'));
app.use('/api', require('./routes/system'));


// Health endpoints
app.get('/health', health);
app.get('/health/db', databaseHealth);
app.get('/api/health', health);
app.get('/api/health/db', databaseHealth);

// Catch‑all for SPA routing – send index.html for any non‑API route
app.get('/*', (req, res) => {
  res.sendFile(path.join(frontendDist, 'index.html'));
});

app.use(errorHandler);

if (require.main === module) {
  app.listen(PORT, HOST, () => {
    console.log(`BrandGuard AI backend running on http://${HOST}:${PORT}`);
  });
}

module.exports = app;
