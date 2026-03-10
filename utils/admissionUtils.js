const mongoose = require('mongoose');

// Helper to extract numeric sequence from different admission number formats
function extractSequenceNumber(admNum) {
    if (!admNum) return 0;
    
    // Convert to string and trim
    const str = String(admNum).trim().toUpperCase();
    
    // 1. Pure legacy digits (e.g. "6053")
    if (/^\d+$/.test(str)) {
        return parseInt(str, 10);
    }
    
    // 2. Formats with characters (e.g. "ADM20260003", "ADM-0054", "ADM260054")
    // Target the continuous digits at the very end of the string
    const match = str.match(/(\d+)$/);
    if (!match) return 0; // No digits at the end
    
    let trailingDigits = match[1];
    
    // Handle prefixed year by stripping it if the trailing digits are long enough
    // e.g. "20260003" -> "2026" (4 digit year) + "0003" (sequence)
    if (trailingDigits.length >= 6 && /^20[2-9]\d/.test(trailingDigits)) {
        trailingDigits = trailingDigits.substring(4);
    } 
    // Handle 2-digit years like "260003" -> "26" + "0003"
    else if (trailingDigits.length >= 4 && /^[2-9]\d/.test(trailingDigits)) {
        trailingDigits = trailingDigits.substring(2);
    }
    
    return parseInt(trailingDigits, 10) || 0;
}

// Main logic to generate next admission number
async function generateAdmissionNumber(tenantId, session = null) {
    const User = mongoose.model('User');
    const Settings = mongoose.model('Settings');
    const Counter = mongoose.model('Counter');
    
    // 1. Get generation settings
    const settings = await Settings.getSettings(tenantId);
    const admissionSettings = settings?.admission || { mode: 'DEFAULT', prefix: 'ADM', yearFormat: 'YYYY', counterPadding: 4 };
    const { mode, prefix, yearFormat, counterPadding } = admissionSettings;
    
    const currentYear = new Date().getFullYear().toString();
    const yearStr = yearFormat === 'YY' ? currentYear.substring(2) : currentYear;
    const effectivePrefix = mode === 'CUSTOM' ? (prefix || 'ADM') : 'ADM';
    
    // 2. Check if we have synchronized the counter with legacy data recently
    // We'll use a special Counter document "admission_global" to store the max
    const queryOpts = session ? { session } : {};
    let counter = await Counter.findOne({ name: 'admission_global', tenantId }, null, queryOpts);
    
    if (!counter) {
        // Find ALL existing admission numbers for this exact tenant
        const students = await User.find({ role: 'student', tenantId }, 'admissionNumber', queryOpts).lean();
        
        let trueMax = 0;
        
        for (const student of students) {
           const seq = extractSequenceNumber(student.admissionNumber);
           if (seq > trueMax) {
               trueMax = seq;
           }
        }
        
        // Save this max as the base in our global counter
        // Use upsert to handle race conditions during initialization
        counter = await Counter.findOneAndUpdate(
            { name: 'admission_global', tenantId },
            { $setOnInsert: { sequence: trueMax } },
            { new: true, upsert: true, ...queryOpts }
        );
    }
    
    // 3. Increment the global counter atomically
    const nextSeqDoc = await Counter.findOneAndUpdate(
        { name: 'admission_global', tenantId },
        { $inc: { sequence: 1 } },
        { new: true, ...queryOpts }
    );
    
    const nextSequence = nextSeqDoc.sequence;
    
    // 4. Format the final admission number based on settings
    return `${effectivePrefix}${yearStr}${String(nextSequence).padStart(counterPadding, '0')}`;
}

module.exports = {
    generateAdmissionNumber,
    extractSequenceNumber
};
