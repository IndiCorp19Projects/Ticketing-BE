const multer = require('multer');
const path = require('path');

const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5 MB (5000 KB) max per file
  },
  fileFilter: (req, file, cb) => {
    // Allowed file types
    const allowedMimeTypes = [
      // Images
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/gif',
      'image/webp',
      
      // PDF
      'application/pdf',
      
      // Microsoft Word
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      
      // Microsoft Excel
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      
      // CSV and Text files
      'text/csv',
      'text/plain',
      'text/txt'
    ];

    // Check file extension as backup
    const fileExt = path.extname(file.originalname).toLowerCase();
    const allowedExtensions = [
      '.jpg', '.jpeg', '.png', '.gif', '.webp', // Images
      '.pdf',                                   // PDF
      '.doc', '.docx',                         // Word
      '.xls', '.xlsx',                         // Excel
      '.csv', '.txt'                           // CSV and Text
    ];

    // Check both MIME type and file extension
    const isValidMimeType = allowedMimeTypes.includes(file.mimetype);
    const isValidExtension = allowedExtensions.includes(fileExt);

    if (isValidMimeType && isValidExtension) {
      cb(null, true);
    } else {
      cb(new Error(`Invalid file type. Only ${allowedExtensions.join(', ')} files are allowed.`), false);
    }
  }
});

// Alternative simpler version without extension check (uncomment if preferred):
/*
const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5 MB max per file
  },
  fileFilter: (req, file, cb) => {
    // Check if file type is allowed
    if (
      file.mimetype.startsWith('image/') ||
      file.mimetype === 'application/pdf' ||
      file.mimetype.includes('word') ||
      file.mimetype.includes('excel') ||
      file.mimetype.includes('spreadsheet') ||
      file.mimetype === 'text/csv' ||
      file.mimetype === 'text/plain'
    ) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only images, PDF, Word, Excel, CSV, and TXT files are allowed.'), false);
    }
  }
});
*/

module.exports = upload;