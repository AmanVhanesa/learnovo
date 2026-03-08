const multer = require('multer');
const path = require('path');
const fs = require('fs');

/**
 * File Upload Middleware for Import/Export
 * Handles CSV and Excel file uploads with validation
 */

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, '../uploads/imports');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure storage
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadsDir);
    },
    filename: (req, file, cb) => {
        // Generate unique filename: tenantId_timestamp_originalname
        const tenantId = req.user?.tenantId || 'unknown';
        const timestamp = Date.now();
        const sanitizedFilename = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
        cb(null, `${tenantId}_${timestamp}_${sanitizedFilename}`);
    }
});

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

// Configure multer
const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB limit
    }
});

/**
 * Middleware to handle single file upload
 */
const uploadSingleFile = upload.single('file');

/**
 * Cleanup old uploaded files (older than 24 hours)
 */
const cleanupOldFiles = () => {
    const now = Date.now();
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours

    fs.readdir(uploadsDir, (err, files) => {
        if (err) {
            console.error('Error reading uploads directory:', err);
            return;
        }

        files.forEach(file => {
            const filePath = path.join(uploadsDir, file);
            fs.stat(filePath, (err, stats) => {
                if (err) {
                    console.error('Error getting file stats:', err);
                    return;
                }

                if (now - stats.mtimeMs > maxAge) {
                    fs.unlink(filePath, (err) => {
                        if (err) {
                            console.error('Error deleting old file:', err);
                        } else {
                            console.log(`Deleted old upload file: ${file}`);
                        }
                    });
                }
            });
        });
    });
};

// Run cleanup every hour
setInterval(cleanupOldFiles, 60 * 60 * 1000);

/**
 * Delete a specific file
 */
const deleteFile = (filePath) => {
    return new Promise((resolve, reject) => {
        fs.unlink(filePath, (err) => {
            if (err) {
                reject(err);
            } else {
                resolve();
            }
        });
    });
};

module.exports = {
    uploadSingleFile,
    cleanupOldFiles,
    deleteFile,
    uploadsDir
};
