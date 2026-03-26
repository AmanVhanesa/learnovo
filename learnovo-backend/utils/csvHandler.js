const csv = require('csv-parser');
const fs = require('fs');
const XLSX = require('xlsx');

/**
 * Parses a CSV or Excel file and returns an array of objects
 * @param {string} filePath - Path to the CSV/Excel file
 * @returns {Promise<Array>} - Array of data objects
 */
const parseCSV = (fileSource) => {
  return new Promise((resolve, reject) => {
    let filePath = null;
    let buffer = null;
    let originalName = '';

    // Determine input type
    if (typeof fileSource === 'string') {
      filePath = fileSource;
      originalName = fileSource;
    } else if (fileSource && typeof fileSource === 'object') {
      if (fileSource.path) filePath = fileSource.path;
      if (fileSource.buffer) buffer = fileSource.buffer;
      originalName = fileSource.originalname || '';
    }

    if (!filePath && !buffer) {
      return reject(new Error('No file content found (missing path and buffer)'));
    }

    // Check file extension
    const ext = originalName.toLowerCase().split('.').pop();
    const stream = require('stream');

    if (ext === 'xlsx' || ext === 'xls') {
      // Parse Excel file
      try {
        let workbook;
        if (filePath) {
          workbook = XLSX.readFile(filePath);
        } else {
          workbook = XLSX.read(buffer, { type: 'buffer' });
        }

        const sheetName = workbook.SheetNames[0]; // Get first sheet
        const worksheet = workbook.Sheets[sheetName];
        const data = XLSX.utils.sheet_to_json(worksheet, {
          raw: false, // Convert all values to strings
          defval: '' // Default value for empty cells
        });
        resolve(data);
      } catch (error) {
        reject(error);
      }
    } else {
      // Parse CSV file
      const results = [];
      let input;

      if (filePath) {
        input = fs.createReadStream(filePath);
      } else {
        input = stream.Readable.from(buffer);
      }

      input
        .pipe(csv())
        .on('data', (data) => results.push(data))
        .on('end', () => resolve(results))
        .on('error', (error) => reject(error));
    }
  });
};

module.exports = { parseCSV };
