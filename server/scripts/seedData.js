const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const PriceHistory = require('../models/PriceHistory');

const CSV_PATH = path.join(__dirname, '..', '..', 'ml-service', 'data', 'price_history.csv');

async function seed() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('MongoDB connected');

    const existingCount = await PriceHistory.countDocuments();
    if (existingCount > 0) {
      console.log(`Collection already has ${existingCount} documents.`);
      const args = process.argv.slice(2);
      if (!args.includes('--force')) {
        console.log('Run with --force to wipe and reseed. Exiting.');
        process.exit(0);
      }
      console.log('Wiping existing data (--force flag detected)...');
      await PriceHistory.deleteMany({});
    }

    const rows = [];
    fs.createReadStream(CSV_PATH)
      .pipe(csv())
      .on('data', (row) => {
        rows.push({
          crop: row.crop,
          state: row.state,
          market: row.market,
          date: new Date(row.date),
          minPrice: parseFloat(row.minPrice),
          maxPrice: parseFloat(row.maxPrice),
          modalPrice: parseFloat(row.modalPrice),
          source: 'seed'
        });
      })
      .on('end', async () => {
        console.log(`Parsed ${rows.length} rows from CSV. Inserting into MongoDB...`);
        const BATCH_SIZE = 1000;
        for (let i = 0; i < rows.length; i += BATCH_SIZE) {
          const batch = rows.slice(i, i + BATCH_SIZE);
          await PriceHistory.insertMany(batch);
          console.log(`Inserted ${Math.min(i + BATCH_SIZE, rows.length)} / ${rows.length}`);
        }
        console.log('Seeding complete.');
        await mongoose.disconnect();
        process.exit(0);
      });
  } catch (err) {
    console.error('Seed error:', err.message);
    process.exit(1);
  }
}

seed();