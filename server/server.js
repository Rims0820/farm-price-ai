require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const priceRoutes = require('./routes/priceRoutes');
const uploadRoutes = require('./routes/uploadRoutes');
const predictRoutes = require('./routes/predictRoutes');
const adminRoutes = require('./routes/adminRoutes');
const { startScheduler } = require('./jobs/scheduler');

const app = express();
app.set('trust proxy', 1);

const allowedOrigins = [
  'http://localhost:5173',
  ...(process.env.CLIENT_URL || '')
    .split(',')
    .map((s) => s.trim().replace(/\/$/, ''))
    .filter(Boolean),
];

app.use(cors({
  origin(origin, callback) {
    // no Origin header = curl, server-to-server, health checks
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error(`Origin not allowed by CORS: ${origin}`));
  },
}));
app.use(express.json());

app.get('/api/health', (req, res) =>
  res.json({ status: 'Server running', db: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected' })
);

app.use('/api', priceRoutes);
app.use('/api/data', uploadRoutes);
app.use('/api', predictRoutes);
app.use('/api/admin', adminRoutes);

// must keep all four parameters, or Express won't treat it as an error handler
app.use((err, req, res, next) => {
  if (String(err.message).startsWith('Origin not allowed')) {
    return res.status(403).json({ error: err.message });
  }
  console.error(err);
  res.status(500).json({ error: 'Server error' });
});

mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log('MongoDB connected');
    startScheduler();
  })
  .catch((err) => console.error('MongoDB error:', err.message));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server on port ${PORT}`));