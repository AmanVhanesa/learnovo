/**
 * Configure ICICI Orange (PG Direct) payment gateway for SPIS production tenant.
 *
 * Usage:
 *   node scripts/configure-spis-payment-gateway.js \
 *     --merchantId=100000000423320 \
 *     --aggregatorId=100000000423319 \
 *     --secureHashKey=<uuid-from-icici-dashboard> \
 *     --environment=production
 *
 * Defaults to the SPIS production credentials if no merchantId/aggregatorId
 * is supplied. The secureHashKey MUST always be supplied — no default.
 *
 * Run this against the PRODUCTION database (set MONGODB_URI accordingly).
 * The Tenant pre-save hook encrypts secureHashKey at rest automatically.
 */

require('dotenv').config({ path: './config.env' });
const mongoose = require('mongoose');
const Tenant = require('../models/Tenant');

// SPIS production credentials shipped from ICICI 2026-04-28.
const DEFAULTS = {
  merchantId: '100000000423320',
  aggregatorId: '100000000423319',
  environment: 'production',
  schoolCode: 'spis'
};

function parseArgs(argv) {
  const out = {};
  for (const arg of argv.slice(2)) {
    const m = arg.match(/^--([^=]+)=(.*)$/);
    if (m) out[m[1]] = m[2];
  }
  return out;
}

async function configure() {
  const args = parseArgs(process.argv);
  const schoolCode = args.schoolCode || DEFAULTS.schoolCode;
  const merchantId = args.merchantId || DEFAULTS.merchantId;
  const aggregatorId = args.aggregatorId || DEFAULTS.aggregatorId;
  const environment = args.environment === 'uat' ? 'uat' : 'production';
  const secureHashKey = args.secureHashKey || '';

  if (!secureHashKey) {
    console.error('Missing required --secureHashKey=<uuid> argument.');
    console.error('Generate it from the ICICI merchant dashboard:');
    console.error('  Live keys → Key Management → Generate / Download Key');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB');

  const tenant = await Tenant.findOne({ schoolCode });
  if (!tenant) {
    console.error(`Tenant not found (schoolCode: "${schoolCode}").`);
    const tenants = await Tenant.find({}, 'schoolCode schoolName').lean();
    console.log('Available tenants:');
    tenants.forEach(t => console.log(`  ${t.schoolCode} — ${t.schoolName}`));
    await mongoose.connection.close();
    process.exit(1);
  }

  console.log(`Found tenant: ${tenant.schoolName} (${tenant.schoolCode})`);

  tenant.paymentGateway = {
    provider: 'icici_orange',
    iciciOrange: {
      merchantId,
      aggregatorId,
      secureHashKey,
      environment
    },
    isActive: true
  };

  await tenant.save();

  console.log('\nICICI Orange gateway configured.');
  console.log(`  School Code   : ${tenant.schoolCode}`);
  console.log(`  Merchant ID   : ${merchantId}`);
  console.log(`  Aggregator ID : ${aggregatorId}`);
  console.log(`  Environment   : ${environment}`);
  console.log(`  Hash Key      : ${secureHashKey.slice(0, 4)}…${secureHashKey.slice(-4)} (encrypted at rest)`);
  console.log('  Active        : true');

  await mongoose.connection.close();
}

configure().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
