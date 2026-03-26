const cloudinary = require('cloudinary').v2;
const { Readable } = require('stream');

/**
 * Cloudinary Service
 * Handles all file uploads, deletions, and URL generation for Cloudinary
 * Implements tenant-aware folder structure for multi-school SaaS
 */

// Configure Cloudinary
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

class CloudinaryService {
    /**
     * Generate folder path based on tenant and file type
     * @param {string} tenantId - School/tenant ID
     * @param {string} type - File type (students, receipts, school, etc.)
     * @param {string} subPath - Additional sub-path (optional)
     * @returns {string} - Full folder path
     */
    getFolderPath(tenantId, type, subPath = '') {
        const basePath = `learnovo/${tenantId}`;

        if (subPath) {
            return `${basePath}/${type}/${subPath}`;
        }

        return `${basePath}/${type}`;
    }

    /**
     * Upload file from buffer to Cloudinary
     * @param {Buffer} buffer - File buffer
     * @param {Object} options - Upload options
     * @param {string} options.tenantId - Tenant ID
     * @param {string} options.folder - Folder type (students, school, receipts)
     * @param {string} options.subPath - Sub-path within folder
     * @param {string} options.resourceType - Resource type (image, raw, video)
     * @param {string} options.publicId - Custom public ID (optional)
     * @param {Object} options.transformation - Image transformations (optional)
     * @returns {Promise<Object>} - Upload result with secure_url and public_id
     */
    async uploadFile(buffer, options = {}) {
        const {
            tenantId,
            folder = 'documents',
            subPath = '',
            resourceType = 'auto',
            publicId,
            transformation
        } = options;

        if (!tenantId) {
            throw new Error('tenantId is required for file upload');
        }

        const folderPath = this.getFolderPath(tenantId, folder, subPath);

        return new Promise((resolve, reject) => {
            const uploadStream = cloudinary.uploader.upload_stream(
                {
                    folder: folderPath,
                    resource_type: resourceType,
                    public_id: publicId,
                    transformation: transformation,
                    use_filename: true,
                    unique_filename: true
                },
                (error, result) => {
                    if (error) {
                        console.error('Cloudinary upload error:', error);
                        reject(error);
                    } else {
                        resolve({
                            public_id: result.public_id,
                            secure_url: result.secure_url,
                            url: result.url,
                            format: result.format,
                            resource_type: result.resource_type,
                            bytes: result.bytes,
                            created_at: result.created_at
                        });
                    }
                }
            );

            // Convert buffer to stream and pipe to Cloudinary
            const readableStream = Readable.from(buffer);
            readableStream.pipe(uploadStream);
        });
    }

    /**
     * Upload file from file object (multer)
     * @param {Object} file - Multer file object
     * @param {Object} options - Upload options (same as uploadFile)
     * @returns {Promise<Object>} - Upload result
     */
    async uploadFromMulter(file, options = {}) {
        if (!file || !file.buffer) {
            throw new Error('Invalid file object');
        }

        // Determine resource type from mimetype
        let resourceType = 'auto';
        if (file.mimetype.startsWith('image/')) {
            resourceType = 'image';
        } else if (file.mimetype === 'application/pdf') {
            resourceType = 'raw';
        } else if (file.mimetype.startsWith('video/')) {
            resourceType = 'video';
        }

        return this.uploadFile(file.buffer, {
            ...options,
            resourceType: options.resourceType || resourceType
        });
    }

    /**
     * Generate signed URL for private file access
     * @param {string} publicId - Cloudinary public ID
     * @param {Object} options - Signing options
     * @param {number} options.expiresIn - Expiry time in seconds (default: 3600)
     * @param {Object} options.transformation - Image transformations
     * @returns {string} - Signed URL
     */
    getSignedUrl(publicId, options = {}) {
        const {
            expiresIn = 3600, // 1 hour default
            transformation
        } = options;

        const expiryTimestamp = Math.floor(Date.now() / 1000) + expiresIn;

        return cloudinary.url(publicId, {
            sign_url: true,
            type: 'authenticated',
            expires_at: expiryTimestamp,
            transformation: transformation
        });
    }

    /**
     * Delete file from Cloudinary
     * @param {string} publicId - Cloudinary public ID
     * @param {string} resourceType - Resource type (image, raw, video)
     * @returns {Promise<Object>} - Deletion result
     */
    async deleteFile(publicId, resourceType = 'image') {
        try {
            const result = await cloudinary.uploader.destroy(publicId, {
                resource_type: resourceType,
                invalidate: true
            });

            return result;
        } catch (error) {
            console.error('Cloudinary delete error:', error);
            throw error;
        }
    }

    /**
     * Delete multiple files
     * @param {Array<string>} publicIds - Array of public IDs
     * @param {string} resourceType - Resource type
     * @returns {Promise<Object>} - Deletion result
     */
    async deleteFiles(publicIds, resourceType = 'image') {
        try {
            const result = await cloudinary.api.delete_resources(publicIds, {
                resource_type: resourceType,
                invalidate: true
            });

            return result;
        } catch (error) {
            console.error('Cloudinary bulk delete error:', error);
            throw error;
        }
    }

    /**
     * Delete entire folder (for tenant/student cleanup)
     * @param {string} folderPath - Folder path to delete
     * @returns {Promise<Object>} - Deletion result
     */
    async deleteFolder(folderPath) {
        try {
            // Delete all resources in folder
            const result = await cloudinary.api.delete_resources_by_prefix(folderPath, {
                invalidate: true
            });

            // Delete the folder itself
            await cloudinary.api.delete_folder(folderPath);

            return result;
        } catch (error) {
            console.error('Cloudinary folder delete error:', error);
            throw error;
        }
    }

    /**
     * Get file details from Cloudinary
     * @param {string} publicId - Cloudinary public ID
     * @param {string} resourceType - Resource type
     * @returns {Promise<Object>} - File details
     */
    async getFileDetails(publicId, resourceType = 'image') {
        try {
            const result = await cloudinary.api.resource(publicId, {
                resource_type: resourceType
            });

            return result;
        } catch (error) {
            console.error('Cloudinary get details error:', error);
            throw error;
        }
    }

    /**
     * List files in a folder
     * @param {string} folderPath - Folder path
     * @param {Object} options - List options
     * @returns {Promise<Object>} - List of files
     */
    async listFiles(folderPath, options = {}) {
        try {
            const result = await cloudinary.api.resources({
                type: 'upload',
                prefix: folderPath,
                max_results: options.maxResults || 100,
                next_cursor: options.nextCursor
            });

            return result;
        } catch (error) {
            console.error('Cloudinary list files error:', error);
            throw error;
        }
    }

    /**
     * Upload student photo with automatic transformations
     * @param {Object} file - Multer file object
     * @param {string} tenantId - Tenant ID
     * @param {string} studentId - Student ID
     * @returns {Promise<Object>} - Upload result
     */
    async uploadStudentPhoto(file, tenantId, studentId) {
        return this.uploadFromMulter(file, {
            tenantId,
            folder: 'students',
            subPath: `${studentId}/photos`,
            transformation: {
                width: 500,
                height: 500,
                crop: 'fill',
                gravity: 'face',
                quality: 'auto:good'
            }
        });
    }

    /**
     * Upload certificate PDF
     * @param {Buffer} pdfBuffer - PDF buffer
     * @param {string} tenantId - Tenant ID
     * @param {string} studentId - Student ID
     * @param {string} certificateType - Type of certificate (leaving, bonafide, study)
     * @param {string} filename - Custom filename
     * @returns {Promise<Object>} - Upload result
     */
    async uploadCertificate(pdfBuffer, tenantId, studentId, certificateType, filename) {
        return this.uploadFile(pdfBuffer, {
            tenantId,
            folder: 'students',
            subPath: `${studentId}/certificates/${certificateType}`,
            resourceType: 'raw',
            publicId: filename
        });
    }

    /**
     * Upload receipt PDF
     * @param {Buffer} pdfBuffer - PDF buffer
     * @param {string} tenantId - Tenant ID
     * @param {string} year - Year
     * @param {string} month - Month
     * @param {string} filename - Custom filename
     * @returns {Promise<Object>} - Upload result
     */
    async uploadReceipt(pdfBuffer, tenantId, year, month, filename) {
        return this.uploadFile(pdfBuffer, {
            tenantId,
            folder: 'receipts',
            subPath: `${year}/${month}`,
            resourceType: 'raw',
            publicId: filename
        });
    }

    /**
     * Upload school logo
     * @param {Object} file - Multer file object
     * @param {string} tenantId - Tenant ID
     * @returns {Promise<Object>} - Upload result
     */
    async uploadSchoolLogo(file, tenantId) {
        return this.uploadFromMulter(file, {
            tenantId,
            folder: 'school',
            subPath: 'logos',
            transformation: {
                width: 300,
                height: 300,
                crop: 'fit',
                quality: 'auto:best'
            }
        });
    }

    /**
     * Upload driver profile photo
     * @param {Object} file - Multer file object
     * @param {string} tenantId - Tenant ID
     * @param {string} driverId - Driver document ID
     * @returns {Promise<Object>} - Upload result
     */
    async uploadDriverPhoto(file, tenantId, driverId) {
        return this.uploadFromMulter(file, {
            tenantId,
            folder: 'drivers',
            subPath: `${driverId}/photos`,
            transformation: {
                width: 500,
                height: 500,
                crop: 'fill',
                gravity: 'face',
                quality: 'auto:good'
            }
        });
    }

    /**
     * Upload employee profile photo
     * @param {Object} file - Multer file object
     * @param {string} tenantId - Tenant ID
     * @param {string} employeeId - Employee document ID
     * @returns {Promise<Object>} - Upload result
     */
    async uploadEmployeePhoto(file, tenantId, employeeId) {
        return this.uploadFromMulter(file, {
            tenantId,
            folder: 'employees',
            subPath: `${employeeId}/photos`,
            transformation: {
                width: 500,
                height: 500,
                crop: 'fill',
                gravity: 'face',
                quality: 'auto:good'
            }
        });
    }
}

module.exports = new CloudinaryService();
