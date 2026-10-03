const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

const priceRoutes = require('./routes/priceRoutes');
app.use('/api', priceRoutes);

const uploadRoutes = require('./routes/uploadRoutes');
app.use('/api/data', uploadRoutes);

const predictRoutes = require('./routes/predictRoutes');
app.use('/api', predictRoutes);

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error('MongoDB error:', err.message));

app.get('/api/health', (req, res) =>
  res.json({ status: 'Server running', db: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected' })
);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(` Server on http://localhost:${PORT}`));