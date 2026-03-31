/**
 * Configure ICICI EazyPay payment gateway for SPIS production tenant.
 *
 * Usage:
 *   node scripts/configure-spis-payment-gateway.js <merchantId> <encryptionKey> <subMerchantId>
 *
 * Example:
 *   node scripts/configure-spis-payment-gateway.js 123456 myAES128key1234 SUB001
 *
 * Run this against the PRODUCTION database (set MONGODB_URI accordingly).
 * The encryption key must be exactly 16 characters (AES-128).
 */

require('dotenv').config({ path: './config.env' });
const mongoose = require('mongoose');
const Tenant = require('../models/Tenant');
// encrypt/decrypt handled automatically by Tenant model hooks

async function configure() {
  const [merchantId, encryptionKey, subMerchantId] = process.argv.slice(2);

  if (!merchantId || !encryptionKey || !subMerchantId) {
    console.error('Usage: node scripts/configure-spis-payment-gateway.js <merchantId> <encryptionKey> <subMerchantId>');
    process.exit(1);
  }

  if (encryptionKey.length !== 16) {
    console.error(`ERROR: Encryption key must be exactly 16 characters (AES-128). Got ${encryptionKey.length} characters.`);
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB');

  // Find the SPIS production tenant (schoolCode: 'spis')
  const tenant = await Tenant.findOne({ schoolCode: 'spis' });

  if (!tenant) {
    console.error('SPIS production tenant not found (schoolCode: "spis").');
    console.log('Available tenants:');
    const tenants = await Tenant.find({}, 'schoolCode schoolName').lean();
    tenants.forEach(t => console.log(`  ${t.schoolCode} — ${t.schoolName}`));
    process.exit(1);
  }

  console.log(`Found tenant: ${tenant.schoolName} (${tenant.schoolCode})`);

  // Update payment gateway config
  tenant.paymentGateway = {
    provider: 'icici_eazypay',
    icici: {
      merchantId,
      encryptionKey,
      subMerchantId,
      paymode: '9' // All payment modes
    },
    isActive: true
  };

  await tenant.save();

  console.log('\nPayment gateway configured successfully!');
  console.log('  Provider      : ICICI EazyPay');
  console.log(`  Merchant ID   : ${merchantId}`);
  console.log(`  Sub-Merchant  : ${subMerchantId}`);
  console.log(`  Encryption Key: ${'*'.repeat(12)}${encryptionKey.slice(-4)}`);
  console.log('  Pay Mode      : 9 (all modes)');
  console.log('  Active        : true');

  await mongoose.connection.close();
}

configure().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
