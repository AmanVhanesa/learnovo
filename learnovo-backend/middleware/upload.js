const multer = require('multer');

// Use memory storage for Cloudinary uploads
// Files are stored in memory as Buffer objects instead of disk
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  // Allowed file types
  const allowedMimes = [
    'text/csv',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'image/jpeg',
    'image/png',
    'image/gif'
  ];

  if (allowedMimes.some(mime => file.mimetype.includes(mime)) ||
        file.originalname.endsWith('.csv') ||
        file.originalname.match(/\.(jpg|jpeg|png|gif)$/i)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only CSV, Excel, and Images are allowed.'), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 20 * 1024 * 1024 // 20MB limit (large CSV/Excel imports can exceed 5MB)
  }
});

module.exports = upload;
