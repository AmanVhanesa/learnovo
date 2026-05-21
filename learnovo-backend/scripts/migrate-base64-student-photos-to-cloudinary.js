/**
 * One-time migration: extract base64-encoded student photos from the users
 * collection, upload each to Cloudinary, and replace the inline blob with the
 * resulting URL. This was needed because the original photo upload path stored
 * `data:image/...;base64,...` strings directly in the document, bloating
 * affected docs to multi-MB and slowing every students list query.
 *
 * Usage:
 *   node scripts/migrate-base64-student-photos-to-cloudinary.js --dry-run
 *   node scripts/migrate-base64-student-photos-to-cloudinary.js
 *
 * Safe to re-run: only acts on docs where `photo` still starts with `data:`.
 */

require('dotenv').config({ path: 'config.env' });
const mongoose = require('mongoose');
const User = require('../models/User');
const cloudinaryService = require('../services/cloudinaryService');

const DRY_RUN = process.argv.includes('--dry-run');

function parseDataUrl(dataUrl) {
  // data:<mime>;base64,<payload>
  const match = /^data:([^;]+);base64,(.+)$/.exec(dataUrl);
  if (!match) return null;
  const mimetype = match[1];
  const buffer = Buffer.from(match[2], 'base64');
  return { mimetype, buffer };
}

function extFor(mime) {
  if (mime === 'image/jpeg' || mime === 'image/jpg') return 'jpg';
  if (mime === 'image/png') return 'png';
  if (mime === 'image/webp') return 'webp';
  return 'bin';
}

(async() => {
  const start = Date.now();
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) {
    console.error('MONGODB_URI not set');
    process.exit(1);
  }

  await mongoose.connect(uri);
  console.log(DRY_RUN ? '[DRY RUN] ' : '', 'Connected to MongoDB');

  const filter = { role: 'student', photo: { $regex: /^data:/ } };
  const total = await User.countDocuments(filter);
  console.log(`Found ${total} student(s) with base64 photo`);

  if (total === 0) {
    await mongoose.disconnect();
    process.exit(0);
  }

  // Use a cursor to avoid loading every bloated doc into memory at once.
  const cursor = User.find(filter).select('_id tenantId admissionNumber name photo').cursor();

  let migrated = 0;
  let skipped = 0;
  let failed = 0;
  let bytesFreed = 0;

  for (let doc = await cursor.next(); doc; doc = await cursor.next()) {
    const id = doc._id.toString();
    const tag = doc.admissionNumber || doc.name || id;
    const parsed = parseDataUrl(doc.photo || '');
    if (!parsed) {
      console.log(`  [skip] ${tag}: photo not a parseable data URL`);
      skipped += 1;
      continue;
    }

    const ext = extFor(parsed.mimetype);
    const fakeFile = {
      buffer: parsed.buffer,
      mimetype: parsed.mimetype,
      originalname: `student-${id}.${ext}`,
      size: parsed.buffer.length
    };

    const sizeKb = (parsed.buffer.length / 1024).toFixed(1);
    console.log(`  [${migrated + 1}/${total}] ${tag} — ${sizeKb} KB ${parsed.mimetype}`);

    if (DRY_RUN) {
      bytesFreed += doc.photo.length;
      migrated += 1;
      continue;
    }

    try {
      const result = await cloudinaryService.uploadStudentPhoto(
        fakeFile,
        doc.tenantId.toString(),
        id
      );
      const url = result.secure_url;
      if (!url) throw new Error('Cloudinary returned no secure_url');

      await User.updateOne({ _id: doc._id }, { $set: { photo: url } });
      bytesFreed += doc.photo.length;
      migrated += 1;
      console.log(`      -> ${url}`);
    } catch (err) {
      failed += 1;
      console.error(`      [fail] ${err.message}`);
    }
  }

  console.log('');
  console.log(`Done in ${((Date.now() - start) / 1000).toFixed(1)}s${DRY_RUN ? ' (DRY RUN)' : ''}`);
  console.log(`  migrated: ${migrated}`);
  console.log(`  skipped:  ${skipped}`);
  console.log(`  failed:   ${failed}`);
  console.log(`  bytes freed in users collection: ${(bytesFreed / 1024 / 1024).toFixed(2)} MB`);

  await mongoose.disconnect();
  process.exit(failed > 0 ? 1 : 0);
})().catch(async(err) => {
  console.error('Migration error:', err);
  try {
    await mongoose.disconnect();
  } catch (_) { /* ignore */ }
  process.exit(1);
});
