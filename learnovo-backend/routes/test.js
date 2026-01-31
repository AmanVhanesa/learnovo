const express = require('express');
const router = express.Router();

/**
 * @desc    Test Cloudinary configuration
 * @route   GET /api/test/cloudinary
 * @access  Public (for debugging only - remove in production)
 */
router.get('/cloudinary', (req, res) => {
    try {
        const cloudinary = require('cloudinary').v2;

        const config = {
            configured: !!(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET),
            cloud_name: process.env.CLOUDINARY_CLOUD_NAME || 'NOT SET',
            api_key_set: !!process.env.CLOUDINARY_API_KEY,
            api_secret_set: !!process.env.CLOUDINARY_API_SECRET,
            cloudinary_config: cloudinary.config()
        };

        res.json({
            success: true,
            message: 'Cloudinary configuration check',
            data: config
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message,
            stack: error.stack
        });
    }
});

module.exports = router;
