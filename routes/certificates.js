const express = require('express');
const router = express.Router();
const certificateController = require('../controllers/certificateController');
const { protect, authorize } = require('../middleware/auth'); // Assuming auth middleware exists

// All routes are protected
router.use(protect);

// Template Management (Admin only)
router.get('/templates', authorize('admin', 'principal'), certificateController.getTemplates);
router.post('/templates', authorize('admin', 'principal'), certificateController.createOrUpdateTemplate);

// Certificate Generation (teacher can generate BONAFIDE only — frontend enforces type restriction)
router.post('/preview', authorize('admin', 'principal', 'teacher'), certificateController.previewCertificate);
router.post('/generate', authorize('admin', 'principal', 'teacher'), certificateController.generateCertificate);

// History
router.get('/history', authorize('admin', 'principal', 'teacher'), certificateController.getGeneratedCertificates);

// Management
router.get('/:id/download', authorize('admin', 'principal', 'teacher'), certificateController.downloadCertificate);
router.delete('/:id', authorize('admin', 'principal'), certificateController.deleteCertificate);
router.put('/:id', authorize('admin', 'principal'), certificateController.updateCertificate);

module.exports = router;
