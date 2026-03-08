# Cloudinary Integration - Learnovo

## Overview

Learnovo uses Cloudinary for persistent, cloud-based file storage. This replaces local file uploads which don't persist in serverless environments (Vercel/Render).

---

## Features

✅ **Tenant-Aware Storage** - Files organized by school (tenant)  
✅ **Secure Uploads** - Private files with signed URL access  
✅ **Automatic Transformations** - Image optimization and resizing  
✅ **Cleanup Logic** - Automatic deletion when students/tenants are removed  
✅ **Production-Ready** - Scalable and cost-effective

---

## Folder Structure

All files are organized hierarchically:

```
/learnovo/
  /{tenantId}/
    /students/
      /{studentId}/
        /photos/          # Profile photos
        /certificates/    # Leaving, bonafide, study certificates
          /leaving/
          /bonafide/
          /study/
        /documents/       # Other student documents
    /receipts/
      /{year}/
        /{month}/         # Fee receipts organized by date
    /school/
      /logos/             # School logos
      /documents/         # School documents
```

---

## Environment Variables

Add these to your Render environment:

```env
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```

**Never commit these to Git!**

---

## Usage

### Upload School Logo

```javascript
POST /api/settings/upload-logo
Content-Type: multipart/form-data

// Automatically uploads to: /learnovo/{tenantId}/school/logos/
// Returns: { url, public_id }
```

### Upload Student Photo

```javascript
const cloudinaryService = require('./services/cloudinaryService');

const result = await cloudinaryService.uploadStudentPhoto(
  file,           // Multer file object
  tenantId,       // School ID
  studentId       // Student ID
);

// Uploads to: /learnovo/{tenantId}/students/{studentId}/photos/
// Auto-transforms: 500x500, face-centered, optimized quality
```

### Upload Certificate PDF

```javascript
const result = await cloudinaryService.uploadCertificate(
  pdfBuffer,      // PDF buffer from pdfService
  tenantId,
  studentId,
  'leaving',      // Certificate type: leaving, bonafide, study
  'cert-2024.pdf' // Filename
);

// Uploads to: /learnovo/{tenantId}/students/{studentId}/certificates/leaving/
```

### Upload Receipt PDF

```javascript
const result = await cloudinaryService.uploadReceipt(
  pdfBuffer,
  tenantId,
  '2024',         // Year
  '01',           // Month
  'receipt-123.pdf'
);

// Uploads to: /learnovo/{tenantId}/receipts/2024/01/
```

### Get Signed URL (for private files)

```javascript
GET /api/files/signed-url?publicId={public_id}&expiresIn=3600

// Returns time-limited URL (default 1 hour)
// Use for certificates, receipts, sensitive documents
```

### Delete File

```javascript
await cloudinaryService.deleteFile(publicId, 'image'); // or 'raw' for PDFs
```

### Delete Student Folder (on student deletion)

```javascript
await cloudinaryService.deleteFolder(`learnovo/${tenantId}/students/${studentId}`);
```

---

## API Endpoints

### Files Routes

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/files/signed-url` | GET | Generate signed URL for private file |
| `/api/files/upload` | POST | Generic file upload |

### Settings Routes

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/settings/upload-logo` | POST | Upload school logo |

---

## Security

### Private Files
- Certificates, receipts, and student documents are **not publicly accessible**
- Access via signed URLs with expiration (default 1 hour)
- URLs automatically expire for security

### Public Files (Optional)
- School logos can be public for display on login page
- Student photos can be public or private based on requirements

### Tenant Isolation
- All files are scoped by `tenantId`
- No cross-tenant access possible
- Folder structure enforces separation

---

## Cost

### Free Tier (Cloudinary)
- **Storage**: 25 GB
- **Bandwidth**: 25 GB/month
- **Transformations**: 25,000/month

### Expected Usage (100 students)
- **Storage**: ~2 GB
- **Bandwidth**: ~5 GB/month
- **Cost**: **FREE** (within limits)

### Monitoring
- Check usage at: [cloudinary.com/console](https://cloudinary.com/console)
- Set alerts at 80% usage

---

## Migration from Local Storage

If you have existing files in `uploads/` directory:

1. Files will need to be re-uploaded to Cloudinary
2. Update database records with new Cloudinary URLs
3. Old `uploads/` directory can be removed

**Note**: Since Vercel/Render don't persist local files, most uploads are likely already lost. Cloudinary prevents this issue.

---

## Troubleshooting

### "Invalid API credentials"
- Check environment variables are set correctly in Render
- Verify no extra spaces in credentials
- Ensure Cloudinary account is active

### "Upload failed"
- Check file size limits (default 10MB in multer)
- Verify file type is allowed
- Check Cloudinary free tier limits

### "Signed URL not working"
- Ensure file exists in Cloudinary
- Check `public_id` is correct
- Verify URL hasn't expired

---

## Development

### Local Testing

1. Create Cloudinary account
2. Add credentials to `config.env`:
   ```env
   CLOUDINARY_CLOUD_NAME=your_cloud_name
   CLOUDINARY_API_KEY=your_api_key
   CLOUDINARY_API_SECRET=your_api_secret
   ```
3. Test uploads locally
4. Verify files appear in Cloudinary dashboard

### Production Deployment

1. Add credentials to Render environment variables
2. Deploy backend
3. Test logo upload from settings page
4. Verify files persist after redeployment

---

## Future Enhancements

- [ ] Automatic image optimization based on device
- [ ] Video upload support for school events
- [ ] Bulk file upload for documents
- [ ] File versioning for document history
- [ ] Migration to AWS S3 (if needed for cost optimization)

---

## Support

For Cloudinary-specific issues:
- Documentation: [cloudinary.com/documentation](https://cloudinary.com/documentation)
- Support: [support.cloudinary.com](https://support.cloudinary.com)

For Learnovo integration issues:
- Check logs in Render dashboard
- Verify environment variables are set
- Test with Cloudinary dashboard to isolate issues
