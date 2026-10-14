const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const router = express.Router();
const adminAuth = require('../middleware/adminAuth');
const { uploadCSV, getSummary, deleteDemoData } = require('../controllers/uploadController');

const uploadDir = path.join(__dirname, '..', 'uploads');
fs.mkdirSync(uploadDir, { recursive: true });
const upload = multer({ dest: uploadDir, limits: { fileSize: 200 * 1024 * 1024 } });

router.get('/summary', getSummary);

router.post(
  '/upload',
  (req, res, next) =>
    req.is('multipart/form-data')
      ? next()
      : res.status(400).json({ error: 'No file uploaded' }),
  adminAuth,
  (req, res, next) =>
    upload.single('file')(req, res, (err) => (err ? res.status(400).json({ error: err.message }) : next())),
  uploadCSV
);

router.delete('/demo', adminAuth, deleteDemoData);

module.exports = router;
