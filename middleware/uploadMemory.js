// middleware/uploadMemory.js
const multer = require('multer');

const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5 MB max per file — adjust as needed
  },
  fileFilter: (req, file, cb) => {
    // optional: only images
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('Only image files are allowed'), false);
    }
    cb(null, true);
  }
});

module.exports = upload;
