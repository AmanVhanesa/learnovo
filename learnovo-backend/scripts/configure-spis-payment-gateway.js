/**
 * Configure ICICI Orange payment gateway for SPIS production tenant.
 *
 * Usage:
 *   node scripts/configure-spis-payment-gateway.js [merchantId]
 *
 * If no merchantId is provided, defaults to 100000000420292 (SPIS production MID).
 *
 * Additional credentials (terminalId, apiKey, apiSecret) will be added
 * once the full MID kit is received from ICICI.
 *
 * Run this against the PRODUCTION database (set MONGODB_URI accordingly).
 */

require('dotenv').config({ path: './config.env' });
const mongoose = require('mongoose');
const Tenant = require('../models/Tenant');
// encrypt/decrypt handled automatically by Tenant model hooks

const DEFAULT_MERCHANT_ID = '100000000420292';

async function configure() {
  const merchantId = process.argv[2] || DEFAULT_MERCHANT_ID;

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

  // Update payment gateway config for ICICI Orange
  tenant.paymentGateway = {
    provider: 'icici_orange',
    iciciOrange: {
      merchantId,
      terminalId: '',  // Pending from MID kit
      apiKey: '',      // Pending from MID kit
      apiSecret: ''    // Pending from MID kit
    },
    isActive: false // Activate once full MID kit credentials are configured
  };

  await tenant.save();

  console.log('\nPayment gateway configured successfully!');
  console.log('  Provider      : ICICI Orange');
  console.log(`  Merchant ID   : ${merchantId}`);
  console.log('  Terminal ID   : (pending MID kit)');
  console.log('  API Key       : (pending MID kit)');
  console.log('  Active        : false (activate after full credentials are set)');
  console.log('\nNote: Run this script again or use the admin panel to update');
  console.log('credentials once the MID kit arrives from ICICI.');

  await mongoose.connection.close();
}

configure().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
