/**
 * Migration: Sync `avatar` and `photo` fields on User documents.
 *
 * The User model has two independent photo fields (`avatar` and `photo`).
 * Different upload flows historically wrote to different fields:
 *   - Profile page (self-upload) wrote only to `avatar`
 *   - Admin Employees form wrote only to `photo`
 *
 * After fixing /api/auth/upload-photo to write both fields, this script
 * back-syncs existing users so the two fields match.
 *
 * Usage:
 *   node scripts/backfill-user-photo-avatar-sync.js
 */
require('dotenv').config({ path: require('path').resolve(__dirname, '../config.env') });
const mongoose = require('mongoose');

const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;
if (!mongoUri) {
  console.error('FATAL: MONGO_URI or MONGODB_URI is not set');
  process.exit(1);
}

(async() => {
  await mongoose.connect(mongoUri);
  const users = mongoose.connection.db.collection('users');

  const avatarToPhoto = await users.updateMany(
    {
      avatar: { $type: 'string', $ne: '' },
      $or: [{ photo: null }, { photo: '' }, { photo: { $exists: false } }]
    },
    [{ $set: { photo: '$avatar' } }]
  );
  console.log(`avatar → photo: updated ${avatarToPhoto.modifiedCount} (matched ${avatarToPhoto.matchedCount})`);

  const photoToAvatar = await users.updateMany(
    {
      photo: { $type: 'string', $ne: '' },
      $or: [{ avatar: null }, { avatar: '' }, { avatar: { $exists: false } }]
    },
    [{ $set: { avatar: '$photo' } }]
  );
  console.log(`photo → avatar: updated ${photoToAvatar.modifiedCount} (matched ${photoToAvatar.matchedCount})`);

  await mongoose.disconnect();
})().catch(err => {
  console.error(err);
  process.exit(1);
});
