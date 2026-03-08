const express = require('express');
const { protect } = require('../middleware/auth');
const cloudinaryService = require('../services/cloudinaryService');

const router = express.Router();

/**
 * @desc    Get signed URL for private file access
 * @route   GET /api/files/signed-url
 * @access  Private
 */
router.get('/signed-url', protect, async (req, res) => {
    try {
        const { publicId, expiresIn } = req.query;

        if (!publicId) {
            return res.status(400).json({
                success: false,
                message: 'publicId is required'
            });
        }

        // TODO: Add authorization check - verify user has access to this file
        // For now, any authenticated user can request signed URLs
        // In production, check if file belongs to user's tenant

        const signedUrl = cloudinaryService.getSignedUrl(publicId, {
            expiresIn: expiresIn ? parseInt(expiresIn) : 3600 // Default 1 hour
        });

        res.json({
            success: true,
            data: {
                url: signedUrl,
                expiresIn: expiresIn || 3600
            }
        });
    } catch (error) {
        console.error('Get signed URL error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Server error while generating signed URL'
        });
    }
});

/**
 * @desc    Upload file (generic endpoint)
 * @route   POST /api/files/upload
 * @access  Private
 */
router.post('/upload', protect, async (req, res) => {
    try {
        const { folder, subPath } = req.body;
        const tenantId = req.user.tenantId;

        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: 'No file uploaded'
            });
        }

        const result = await cloudinaryService.uploadFromMulter(req.file, {
            tenantId: tenantId.toString(),
            folder: folder || 'documents',
            subPath: subPath || ''
        });

        res.json({
            success: true,
            message: 'File uploaded successfully',
            data: result
        });
    } catch (error) {
        console.error('File upload error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Server error while uploading file'
        });
    }
});

module.exports = router;
