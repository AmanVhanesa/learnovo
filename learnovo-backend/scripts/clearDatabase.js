require('dotenv').config({ path: './config.env' });
const mongoose = require('mongoose');

async function clearDatabase() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/learnovo', {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('✅ Connected to MongoDB');

    const db = mongoose.connection.db;
    
    console.log('\n🗑️  Clearing entire database...');
    
    // Get all collections
    const collections = await db.listCollections().toArray();
    console.log(`Found ${collections.length} collections`);
    
    // Drop all collections
    for (const coll of collections) {
      await db.collection(coll.name).drop();
      console.log(`✅ Dropped collection: ${coll.name}`);
    }
    
    console.log('\n✅ Database completely cleared!');
    console.log('📝 Database is now empty and ready for fresh data');
    
    await mongoose.connection.close();
    console.log('✅ Connection closed');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Stack:', error.stack);
    await mongoose.connection.close();
    process.exit(1);
  }
}

clearDatabase();

