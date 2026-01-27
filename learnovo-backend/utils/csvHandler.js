const csv = require('csv-parser');
const fs = require('fs');

/**
 * Parses a CSV file and returns an array of objects
 * @param {string} filePath - Path to the CSV file
 * @returns {Promise<Array>} - Array of data objects
 */
const parseCSV = (filePath) => {
  return new Promise((resolve, reject) => {
    const results = [];
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (data) => results.push(data))
      .on('end', () => resolve(results))
      .on('error', (error) => reject(error));
  });
};

module.exports = { parseCSV };
