const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');
const { errorHandler } = require('./middleware/errorHandler');
const { health, databaseHealth } = require('./controllers/healthController');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

app.use(cors());
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(uploadDir));
app.use('/api/auth', require('./routes/auth'));
app.use('/api/brands', require('./routes/brands'));
app.use('/api/organizations', require('./routes/organizations'));
app.use('/api/guidelines', require('./routes/guidelines'));
app.use('/api/content', require('./routes/content'));
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/reviews', require('./routes/reviews'));
app.use('/api', require('./routes/system'));

app.get('/health', health);
app.get('/health/db', databaseHealth);

app.use(errorHandler);

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`BrandGuard AI backend running on http://localhost:${PORT}`);
  });
}

module.exports = app;
