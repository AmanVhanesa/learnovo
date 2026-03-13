const multer = require('multer');
const path = require('path');

/**
 * File Upload Middleware for Import/Export
 * Uses memory storage — files stay in req.file.buffer (no disk writes).
 * Compatible with Render's ephemeral filesystem.
 */

// Use memory storage instead of disk — files are kept as Buffers
const storage = multer.memoryStorage();

// File filter - only allow CSV and Excel files
const fileFilter = (req, file, cb) => {
    const allowedExtensions = ['.csv', '.xlsx', '.xls'];
    const ext = path.extname(file.originalname).toLowerCase();

    if (allowedExtensions.includes(ext)) {
        cb(null, true);
    } else {
        cb(new Error(`Invalid file type. Only ${allowedExtensions.join(', ')} files are allowed.`), false);
    }
};

// Configure multer with memory storage
const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB limit
    }
});

/**
 * Middleware to handle single file upload (result in req.file.buffer)
 */
const uploadSingleFile = upload.single('file');

module.exports = {
    uploadSingleFile,
};
