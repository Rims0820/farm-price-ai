const fs = require('fs');
const csv = require('csv-parser');
const PriceHistory = require('../models/PriceHistory');
const Prediction = require('../models/Prediction');

const BATCH_SIZE = 5000;
const DEMO_FILTER = { $or: [{ source: 'seed' }, { source: { $exists: false } }] };
const num = (v) => {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : null;
};

exports.uploadCSV = (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }
  const filePath = req.file.path;
  const docs = [];
  let skipped = 0;
  const cleanup = () => fs.unlink(filePath, () => {});

  fs.createReadStream(filePath)
    .pipe(csv({ mapHeaders: ({ header }) => header.replace(/^\uFEFF/, '').trim() }))
    .on('data', (row) => {
      const modalPrice = num(row.modalPrice);
      const date = new Date(row.date);
      if (!row.crop || !row.market || !row.date || isNaN(date) || !modalPrice || modalPrice <= 0) {
        skipped++;
        return;
      }
      docs.push({
        crop: row.crop.trim(),
        state: row.state ? row.state.trim() : 'Unknown',
        market: row.market.trim(),
        date,
        minPrice: num(row.minPrice),
        maxPrice: num(row.maxPrice),
        modalPrice,
        source: 'upload',
      });
    })
    .on('error', (err) => {
      cleanup();
      res.status(400).json({ error: `Could not read CSV: ${err.message}` });
    })
    .on('end', async () => {
      try {
        if (docs.length === 0) {
          return res.status(400).json({
            error: 'No valid rows found. Required columns: crop,state,market,date,minPrice,maxPrice,modalPrice',
          });
        }
        let inserted = 0;
        let updated = 0;
        for (let i = 0; i < docs.length; i += BATCH_SIZE) {
          const ops = docs.slice(i, i + BATCH_SIZE).map((d) => ({
            updateOne: {
              filter: { crop: d.crop, market: d.market, date: d.date },
              update: { $set: d },
              upsert: true,
            },
          }));
          const r = await PriceHistory.bulkWrite(ops, { ordered: false });
          inserted += r.upsertedCount || 0;
          updated += r.modifiedCount || 0;
        }
        await Prediction.deleteMany({}); // cached forecasts are now out of date
        res.json({ message: 'Upload successful', inserted, updated, skipped });
      } catch (err) {
        res.status(500).json({ error: err.message });
      } finally {
        cleanup();
      }
    });
};

exports.getSummary = async (req, res) => {
  try {
    const [sources, crops, markets] = await Promise.all([
      PriceHistory.aggregate([
        {
          $group: {
            _id: { $ifNull: ['$source', 'seed'] },
            rows: { $sum: 1 },
            from: { $min: '$date' },
            to: { $max: '$date' },
          },
        },
      ]),
      PriceHistory.distinct('crop'),
      PriceHistory.distinct('market'),
    ]);
    res.json({
      sources: sources.map((s) => ({ source: s._id, rows: s.rows, from: s.from, to: s.to })),
      crops,
      markets,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.deleteDemoData = async (req, res) => {
  try {
    const r = await PriceHistory.deleteMany(DEMO_FILTER);
    await Prediction.deleteMany({});
    res.json({ message: 'Demo data removed', deleted: r.deletedCount });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};