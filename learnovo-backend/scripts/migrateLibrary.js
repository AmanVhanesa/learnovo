/**
 * Library Management — initial migration
 *
 * 1) Ensures indexes for new collections.
 * 2) Seeds default LibrarySettings + default BookCategories per existing tenant.
 *
 * Run: node scripts/migrateLibrary.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', 'config.env') });
const mongoose = require('mongoose');

const Tenant = require('../models/Tenant');
const LibrarySettings = require('../models/LibrarySettings');
const BookCategory = require('../models/BookCategory');
const Book = require('../models/Book');
const BookCopy = require('../models/BookCopy');
const BookIssue = require('../models/BookIssue');
const BookReservation = require('../models/BookReservation');
const LibraryMember = require('../models/LibraryMember');
const LibraryFine = require('../models/LibraryFine');

const DEFAULT_CATEGORIES = [
  { name: 'Textbook', description: 'Curriculum textbooks' },
  { name: 'Reference', description: 'Reference and encyclopedia material' },
  { name: 'Fiction', description: 'Novels and short stories' },
  { name: 'Non-Fiction', description: 'Biographies, history, science' },
  { name: 'Magazine', description: 'Magazines and periodicals' },
  { name: 'Comics', description: 'Comics and graphic novels' }
];

async function run() {
  const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!uri) {
    console.error('MONGO_URI is required'); process.exit(1);
  }

  await mongoose.connect(uri);
  console.log('Connected to MongoDB');

  // Trigger index creation
  await Promise.all([
    LibrarySettings.syncIndexes(),
    BookCategory.syncIndexes(),
    Book.syncIndexes(),
    BookCopy.syncIndexes(),
    BookIssue.syncIndexes(),
    BookReservation.syncIndexes(),
    LibraryMember.syncIndexes(),
    LibraryFine.syncIndexes()
  ]);
  console.log('Indexes synced');

  const tenants = await Tenant.find({}).select('_id schoolName').lean();
  console.log(`Seeding library defaults for ${tenants.length} tenant(s)...`);

  let settingsCreated = 0;
  let categoriesCreated = 0;

  for (const t of tenants) {
    const exists = await LibrarySettings.findOne({ tenantId: t._id });
    if (!exists) {
      await LibrarySettings.create({ tenantId: t._id });
      settingsCreated++;
    }
    for (const c of DEFAULT_CATEGORIES) {
      const r = await BookCategory.findOneAndUpdate(
        { tenantId: t._id, name: c.name },
        { $setOnInsert: { tenantId: t._id, name: c.name, description: c.description, isActive: true } },
        { upsert: true, new: false }
      );
      if (!r) categoriesCreated++;
    }
  }

  console.log(`✔ ${settingsCreated} settings created, ${categoriesCreated} categories upserted`);
  await mongoose.disconnect();
  console.log('Done.');
}

run().catch(err => {
  console.error(err); process.exit(1);
});
