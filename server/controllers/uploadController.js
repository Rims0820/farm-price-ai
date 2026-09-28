const fs = require('fs');
const csv = require('csv-parser');
const PriceHistory = require('../models/PriceHistory');

exports.uploadCSV = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  const filePath = req.file.path;
  const rows = [];
  let errorCount = 0;

  fs.createReadStream(filePath)
    .pipe(csv())
    .on('data', (row) => {
      try {
        if (!row.crop || !row.market || !row.date || !row.modalPrice) {
          errorCount++;
          return;
        }
        rows.push({
          crop: row.crop.trim(),
          state: row.state ? row.state.trim() : 'Unknown',
          market: row.market.trim(),
          date: new Date(row.date),
          minPrice: parseFloat(row.minPrice) || null,
          maxPrice: parseFloat(row.maxPrice) || null,
          modalPrice: parseFloat(row.modalPrice),
          source: 'upload'
        });
      } catch (e) {
        errorCount++;
      }
    })
    .on('end', async () => {
      try {
        if (rows.length === 0) {
          fs.unlinkSync(filePath);
          return res.status(400).json({ error: 'No valid rows found in CSV' });
        }
        await PriceHistory.insertMany(rows);
        fs.unlinkSync(filePath); // clean up temp file
        res.json({
          message: 'Upload successful',
          inserted: rows.length,
          skipped: errorCount
        });
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });
};