const csv = require('csv-parser');
const fs = require('fs');
const XLSX = require('xlsx');

/**
 * Parses a CSV or Excel file and returns an array of objects
 * @param {string} filePath - Path to the CSV/Excel file
 * @returns {Promise<Array>} - Array of data objects
 */
const parseCSV = (filePath) => {
  return new Promise((resolve, reject) => {
    // Check file extension
    const ext = filePath.toLowerCase().split('.').pop();

    if (ext === 'xlsx' || ext === 'xls') {
      // Parse Excel file
      try {
        const workbook = XLSX.readFile(filePath);
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
      fs.createReadStream(filePath)
        .pipe(csv())
        .on('data', (data) => results.push(data))
        .on('end', () => resolve(results))
        .on('error', (error) => reject(error));
    }
  });
};

module.exports = { parseCSV };
