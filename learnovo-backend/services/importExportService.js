const fs = require('fs');
const { Readable } = require('stream');
const csv = require('csv-parser');
const { format } = require('fast-csv');
const xlsx = require('xlsx');

/**
 * Base Import/Export Service
 * Provides core functionality for parsing, validating, and generating CSV/Excel files
 */

class ImportExportService {
  /**
     * Parse CSV file and return rows
     * @param {string} filePath - Path to CSV file
     * @param {Object} options - Parsing options
     * @returns {Promise<Array>} Array of row objects
     */
  static async parseCSV(filePath, options = {}) {
    return new Promise((resolve, reject) => {
      const rows = [];
      const _errors = [];
      let rowNumber = 0;

      fs.createReadStream(filePath)
        .pipe(csv({
          skipEmptyLines: true,
          trim: true,
          ...options
        }))
        .on('data', (row) => {
          rowNumber++;
          rows.push({ ...row, _rowNumber: rowNumber });
        })
        .on('error', (error) => {
          reject(error);
        })
        .on('end', () => {
          resolve(rows);
        });
    });
  }

  /**
     * Parse CSV from a Buffer (multer memory storage)
     * @param {Buffer} buffer - File content as Buffer
     * @param {Object} options - Parsing options
     * @returns {Promise<Array>} Array of row objects
     */
  static async parseCSVBuffer(buffer, options = {}) {
    return new Promise((resolve, reject) => {
      const rows = [];
      let rowNumber = 0;

      Readable.from(buffer)
        .pipe(csv({
          skipEmptyLines: true,
          trim: true,
          ...options
        }))
        .on('data', (row) => {
          rowNumber++;
          rows.push({ ...row, _rowNumber: rowNumber });
        })
        .on('error', (error) => {
          reject(error);
        })
        .on('end', () => {
          resolve(rows);
        });
    });
  }

  /**
     * Parse Excel file and return rows
     * @param {string} filePath - Path to Excel file
     * @param {Object} options - Parsing options
     * @returns {Promise<Array>} Array of row objects
     */
  static async parseExcel(filePath, options = {}) {
    try {
      const workbook = xlsx.readFile(filePath);
      const sheetName = options.sheetName || workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];

      // Convert to JSON
      const rows = xlsx.utils.sheet_to_json(worksheet, {
        raw: false, // Get formatted strings
        defval: '', // Default value for empty cells
        ...options
      });

      // Add row numbers
      return rows.map((row, index) => ({
        ...row,
        _rowNumber: index + 2 // +2 because Excel is 1-indexed and first row is header
      }));
    } catch (error) {
      throw new Error(`Failed to parse Excel file: ${error.message}`);
    }
  }

  /**
     * Parse Excel from a Buffer (multer memory storage)
     * @param {Buffer} buffer - File content as Buffer
     * @param {Object} options - Parsing options
     * @returns {Promise<Array>} Array of row objects
     */
  static async parseExcelBuffer(buffer, options = {}) {
    try {
      const workbook = xlsx.read(buffer, { type: 'buffer' });
      const sheetName = options.sheetName || workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];

      const rows = xlsx.utils.sheet_to_json(worksheet, {
        raw: false,
        defval: '',
        ...options
      });

      return rows.map((row, index) => ({
        ...row,
        _rowNumber: index + 2
      }));
    } catch (error) {
      throw new Error(`Failed to parse Excel buffer: ${error.message}`);
    }
  }

  /**
     * Validate a single row against a Joi schema
     * @param {Object} row - Row data
     * @param {Object} schema - Joi validation schema
     * @param {number} rowNumber - Row number for error reporting
     * @returns {Object} { valid: boolean, data: Object, errors: Array }
     */
  static validateRow(row, schema, rowNumber) {
    const { error, value } = schema.validate(row, {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      const errors = error.details.map(detail => ({
        row: rowNumber,
        field: detail.path.join('.'),
        message: detail.message,
        value: detail.context.value
      }));
      return { valid: false, data: null, errors };
    }

    return { valid: true, data: value, errors: [] };
  }

  /**
     * Validate all rows
     * @param {Array} rows - Array of rows
     * @param {Object} schema - Joi validation schema
     * @returns {Object} { validRows: Array, invalidRows: Array, errors: Array }
     */
  static validateRows(rows, schema) {
    const validRows = [];
    const invalidRows = [];
    const allErrors = [];

    rows.forEach((row) => {
      const rowNumber = row._rowNumber || 0;
      const { valid, data, errors } = this.validateRow(row, schema, rowNumber);

      if (valid) {
        validRows.push(data);
      } else {
        invalidRows.push(row);
        allErrors.push(...errors);
      }
    });

    return {
      validRows,
      invalidRows,
      errors: allErrors
    };
  }

  /**
     * Generate error report as CSV
     * @param {Array} errors - Array of error objects
     * @returns {Promise<string>} CSV string
     */
  static async generateErrorReport(errors) {
    return new Promise((resolve, reject) => {
      const csvRows = [];

      const stream = format({ headers: true });

      stream.on('data', (row) => csvRows.push(row));
      stream.on('error', reject);
      stream.on('end', () => resolve(csvRows.join('')));

      errors.forEach(error => {
        stream.write({
          'Row Number': error.row,
          'Field': error.field,
          'Error': error.message,
          'Invalid Value': error.value || ''
        });
      });

      stream.end();
    });
  }

  /**
     * Build CSV/Excel header rows from headerInfo
     * @param {Object} headerInfo - { schoolName, reportTitle, dateTime }
     * @param {number} colCount - Number of columns (for padding empty cells)
     * @returns {Array<string>} Array of pre-formatted CSV lines
     */
  static buildHeaderLines(headerInfo, colCount) {
    if (!headerInfo) return [];
    const lines = [];
    const pad = (val) => {
      const extra = Array(Math.max(0, colCount - 1)).fill('').join(',');
      return `"${(val || '').replace(/"/g, '""')}"${extra}`;
    };
    if (headerInfo.schoolName) {
      lines.push(pad(headerInfo.schoolName));
    }
    if (headerInfo.reportTitle) {
      lines.push(pad(headerInfo.reportTitle));
    }
    if (headerInfo.dateTime !== false) {
      const dt = headerInfo.dateTime || `Generated on: ${new Date().toLocaleDateString('en-IN')} at ${new Date().toLocaleTimeString('en-IN')}`;
      lines.push(pad(dt));
    }
    lines.push(''); // blank line before data
    return lines;
  }

  /**
     * Export data to CSV
     * @param {Array} data - Array of objects to export
     * @param {Array} columns - Column definitions [{ key: 'field', header: 'Header' }]
     * @param {Object} headerInfo - Optional { schoolName, reportTitle, dateTime } for report header
     * @returns {Promise<Buffer>} CSV buffer
     */
  static async exportToCSV(data, columns, headerInfo = null, footerRow = null) {
    return new Promise((resolve, reject) => {
      const csvRows = [];

      const headers = columns.map(col => col.header || col.key);
      const _keys = columns.map(col => col.key);

      // Add report header lines (school name, title, date)
      const headerLines = this.buildHeaderLines(headerInfo, headers.length);
      if (headerLines.length > 0) {
        csvRows.push(`${headerLines.join('\n')}\n`);
      }

      const stream = format({ headers: headers });

      stream.on('data', (row) => csvRows.push(row));
      stream.on('error', reject);
      stream.on('end', () => {
        if (Array.isArray(footerRow) && footerRow.length) {
          // Append a CSV footer row aligned to the columns
          const escape = (v) => {
            const s = v == null ? '' : String(v);
            return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
          };
          csvRows.push(`${footerRow.map(escape).join(',')}\n`);
        }
        resolve(Buffer.from(csvRows.join('')));
      });

      data.forEach(item => {
        const row = {};
        columns.forEach(col => {
          const value = this.getNestedValue(item, col.key);
          row[col.header || col.key] = col.format ? col.format(value) : value;
        });
        stream.write(row);
      });

      stream.end();
    });
  }

  /**
     * Export data to Excel
     * @param {Array} data - Array of objects to export
     * @param {Array} columns - Column definitions
     * @param {string} sheetName - Sheet name
     * @param {Object} headerInfo - Optional { schoolName, reportTitle, dateTime } for report header
     * @returns {Buffer} Excel buffer
     */
  static exportToExcel(data, columns, sheetName = 'Sheet1', headerInfo = null, footerRow = null) {
    // Prepare data with headers
    const headers = columns.map(col => col.header || col.key);
    const rows = data.map(item => {
      return columns.map(col => {
        const value = this.getNestedValue(item, col.key);
        return col.format ? col.format(value) : value;
      });
    });

    // Build header rows for school name, report title, date
    const topRows = [];
    if (headerInfo) {
      if (headerInfo.schoolName) topRows.push([headerInfo.schoolName]);
      if (headerInfo.reportTitle) topRows.push([headerInfo.reportTitle]);
      const dt = headerInfo.dateTime || `Generated on: ${new Date().toLocaleDateString('en-IN')} at ${new Date().toLocaleTimeString('en-IN')}`;
      if (headerInfo.dateTime !== false) topRows.push([dt]);
      topRows.push([]); // blank row
    }

    // Optional footer row appended after data
    const footerRows = Array.isArray(footerRow) && footerRow.length ? [footerRow] : [];

    // Create worksheet
    const wsData = [...topRows, headers, ...rows, ...footerRows];
    const worksheet = xlsx.utils.aoa_to_sheet(wsData);

    // Style header info rows — merge across all columns
    if (headerInfo && headers.length > 1) {
      if (!worksheet['!merges']) worksheet['!merges'] = [];
      for (let i = 0; i < topRows.length - 1; i++) { // -1 to skip blank row
        worksheet['!merges'].push({ s: { r: i, c: 0 }, e: { r: i, c: headers.length - 1 } });
      }
    }

    // Set column widths based on header lengths
    worksheet['!cols'] = headers.map(h => ({ wch: Math.max(h.length + 4, 15) }));

    // Create workbook
    const workbook = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(workbook, worksheet, sheetName);

    // Generate buffer
    return xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  }

  /**
     * Get nested value from object using dot notation
     * @param {Object} obj - Object to get value from
     * @param {string} path - Dot notation path (e.g., 'user.name')
     * @returns {*} Value at path
     */
  static getNestedValue(obj, path) {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  /**
     * Generate CSV template
     * @param {Array} columns - Column definitions
     * @param {Array} sampleData - Optional sample data rows
     * @returns {Promise<Buffer>} CSV buffer
     */
  static async generateTemplate(columns, sampleData = []) {
    const headers = columns.map(col => ({
      key: col.key,
      header: col.header || col.key
    }));

    if (sampleData.length === 0) {
      // Generate empty template with just headers
      sampleData = [{}];
    }

    return this.exportToCSV(sampleData, headers);
  }

  /**
     * Check for duplicate values in array
     * @param {Array} array - Array to check
     * @param {string} key - Key to check for duplicates
     * @returns {Array} Array of duplicate values
     */
  static findDuplicates(array, key) {
    const seen = new Set();
    const duplicates = new Set();

    array.forEach(item => {
      const value = this.getNestedValue(item, key);
      if (value) {
        if (seen.has(value)) {
          duplicates.add(value);
        } else {
          seen.add(value);
        }
      }
    });

    return Array.from(duplicates);
  }

  /**
     * Sanitize filename
     * @param {string} filename - Original filename
     * @returns {string} Sanitized filename
     */
  static sanitizeFilename(filename) {
    return filename.replace(/[^a-zA-Z0-9.-]/g, '_');
  }

  /**
     * Get export header info from tenant
     * @param {string} tenantId - Tenant ID
     * @param {string} reportTitle - Title for the report (e.g., "Employee List")
     * @returns {Promise<Object>} { schoolName, reportTitle, dateTime }
     */
  static async getExportHeaderInfo(tenantId, reportTitle) {
    let schoolName = '';
    let logo = '';
    try {
      const Settings = require('mongoose').model('Settings');
      const settings = await Settings.findOne({ tenantId });
      schoolName = settings?.institution?.name || '';
      logo = settings?.institution?.logo || '';
    } catch (_e) {
      // Fallback: try Tenant model
      try {
        const Tenant = require('../models/Tenant');
        const tenant = await Tenant.findById(tenantId).select('schoolName logo').lean();
        schoolName = tenant?.schoolName || '';
        logo = tenant?.logo || '';
      } catch (_e2) {
        // silently continue without school name
      }
    }
    return {
      schoolName,
      logo,
      reportTitle,
      dateTime: `Generated on: ${new Date().toLocaleDateString('en-IN')} at ${new Date().toLocaleTimeString('en-IN')}`
    };
  }
}

module.exports = ImportExportService;
