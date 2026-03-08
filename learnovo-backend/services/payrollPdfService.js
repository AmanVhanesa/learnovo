const PDFDocument = require('pdfkit');
const Payroll = require('../models/Payroll');
const User = require('../models/User');
const Settings = require('../models/Settings');
const fs = require('fs');
const path = require('path');
const axios = require('axios');

/**
 * Payroll PDF Service - Generate salary slips and reports
 */
const payrollPdfService = {
    /**
     * Helper function to add professional letterhead to PDF
     * @param {PDFKit.PDFDocument} doc - PDF document
     * @param {Object} settings - School settings
     * @param {String} title - Report title
     * @param {String} subtitle - Report subtitle (optional)
     * @returns {Number} Current Y position after letterhead
     */
    addLetterhead: async (doc, settings, title, subtitle = null) => {
        const pageWidth = doc.page.width;
        const pageHeight = doc.page.height;

        // Draw double border around the page
        doc.rect(20, 20, pageWidth - 40, pageHeight - 40).stroke();
        doc.rect(25, 25, pageWidth - 50, pageHeight - 50).lineWidth(0.5).stroke();

        let currentY = 50;

        // Load logo if available (same logic as certificate service)
        let logoImage = null;
        if (settings?.schoolLogo) {
            try {
                if (settings.schoolLogo.startsWith('http')) {
                    // Remote URL
                    const response = await axios.get(settings.schoolLogo, { responseType: 'arraybuffer' });
                    logoImage = response.data;
                } else {
                    // Local File Path
                    let logoPath = settings.schoolLogo;
                    if (fs.existsSync(logoPath)) {
                        logoImage = logoPath;
                    } else {
                        // Try resolving relative to project root
                        logoPath = path.resolve(process.cwd(), settings.schoolLogo);
                        if (fs.existsSync(logoPath)) {
                            logoImage = logoPath;
                        } else {
                            // Try resolving relative to 'uploads'
                            logoPath = path.join(process.cwd(), 'uploads', path.basename(settings.schoolLogo));
                            if (fs.existsSync(logoPath)) {
                                logoImage = logoPath;
                            } else {
                                console.warn(`Logo file not found at: ${settings.schoolLogo} or resolved paths`);
                            }
                        }
                    }
                }
            } catch (err) {
                console.warn('Failed to load logo:', err.message);
            }
        }

        // Logo (Left Aligned)
        if (logoImage) {
            try {
                const logoWidth = 70;
                const logoX = 60;
                const logoY = 45;
                doc.image(logoImage, logoX, logoY, { width: logoWidth });
            } catch (err) {
                console.warn('Failed to render logo:', err.message);
            }
        }

        // School Details (Centered)
        doc.y = 45;

        // School Name
        doc.font('Helvetica-Bold').fontSize(24).fillColor('#000000')
            .text(settings?.schoolName || 'School Name', { align: 'center' });
        doc.moveDown(0.5);

        // Address
        if (settings?.address) {
            doc.font('Helvetica').fontSize(10).text(settings.address, { align: 'center' });
        }

        // Contact Details
        if (settings?.phone || settings?.email) {
            const contactParts = [];
            if (settings?.phone) contactParts.push(`Phone: ${settings.phone}`);
            if (settings?.email) contactParts.push(`Email: ${settings.email}`);
            doc.moveDown(0.2);
            doc.text(contactParts.join(' | '), { align: 'center' });
        }

        // Board & Affiliation Details
        if (settings?.board || settings?.affiliationNumber || settings?.schoolCode) {
            doc.moveDown(0.2);
            const boardParts = [];
            if (settings?.board) boardParts.push(settings.board);
            if (settings?.affiliationNumber) boardParts.push(`Affiliation No: ${settings.affiliationNumber}`);
            if (settings?.schoolCode) boardParts.push(`School Code: ${settings.schoolCode}`);
            doc.text(boardParts.join(' | '), { align: 'center' });
        }

        // UDISE Code
        if (settings?.udiseCode) {
            doc.moveDown(0.2);
            doc.text(`UDISE No: ${settings.udiseCode}`, { align: 'center' });
        }

        doc.moveDown(1.5);

        // Separator Line
        doc.lineWidth(2).moveTo(50, doc.y).lineTo(pageWidth - 50, doc.y).stroke();
        doc.moveDown(2);

        // Title
        doc.font('Helvetica-Bold').fontSize(18).fillColor('#2355A6')
            .text(title, { align: 'center' });
        doc.fillColor('black');

        if (subtitle) {
            doc.moveDown(0.5);
            doc.font('Helvetica').fontSize(14)
                .text(subtitle, { align: 'center' });
        }

        doc.moveDown(2);

        return doc.y;
    },
    /**
     * Generate individual salary slip PDF
     * @param {String} payrollId - Payroll record ID
     * @returns {Promise<PDFKit.PDFDocument>} PDF stream
     */
    generateSalarySlip: async (payrollId) => {
        return new Promise(async (resolve, reject) => {
            try {
                // Fetch payroll record with employee details
                const payroll = await Payroll.findById(payrollId)
                    .populate('employeeId', 'name employeeId email phone designation department')
                    .populate('advanceDeductions.advanceId', 'amount reason requestDate')
                    .lean();

                if (!payroll) {
                    throw new Error('Payroll record not found');
                }

                // Fetch school settings
                const settings = await Settings.findOne({ tenantId: payroll.tenantId }).lean();

                // Map settings to match certificate format
                const mappedSettings = {
                    schoolName: settings?.institution?.name || 'School Name',
                    schoolLogo: settings?.institution?.logo,
                    address: settings?.institution?.address ?
                        `${settings.institution.address.street || ''}, ${settings.institution.address.city || ''}`.trim().replace(/^,\s*/, '') :
                        '',
                    phone: settings?.institution?.contact?.phone || '',
                    email: settings?.institution?.contact?.email || '',
                    board: settings?.institution?.board || '',
                    affiliationNumber: settings?.institution?.affiliationNumber || '',
                    schoolCode: settings?.institution?.schoolCode || '',
                    udiseCode: settings?.institution?.udiseCode || ''
                };

                const doc = new PDFDocument({
                    size: 'A4',
                    margin: 50
                });

                // Add metadata
                doc.info['Title'] = `Salary Slip - ${payroll.employeeId.name}`;
                doc.info['Author'] = mappedSettings.schoolName;

                // Page dimensions
                const pageWidth = doc.page.width;

                // Month and Year
                const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                    'July', 'August', 'September', 'October', 'November', 'December'];

                // Add professional letterhead
                let currentY = await payrollPdfService.addLetterhead(
                    doc,
                    mappedSettings,
                    'SALARY SLIP',
                    `For the month of: ${monthNames[payroll.month - 1]} ${payroll.year}`
                );

                // Employee details
                currentY = doc.y;
                const col1X = 60;
                const col2X = 200;
                const col3X = 340;
                const col4X = 480;

                doc.font('Helvetica-Bold').fontSize(11);
                doc.text('Employee ID:', col1X, currentY);
                doc.font('Helvetica').text(payroll.employeeId.employeeId || 'N/A', col2X, currentY);

                doc.font('Helvetica-Bold').text('Name:', col3X, currentY);
                doc.font('Helvetica').text(payroll.employeeId.name, col4X, currentY);

                currentY += 20;
                doc.font('Helvetica-Bold').text('Designation:', col1X, currentY);
                doc.font('Helvetica').text(payroll.employeeId.designation || 'N/A', col2X, currentY);

                doc.font('Helvetica-Bold').text('Department:', col3X, currentY);
                doc.font('Helvetica').text(payroll.employeeId.department || 'N/A', col4X, currentY);

                currentY += 30;
                doc.moveDown(2);

                // Salary breakdown table
                doc.font('Helvetica-Bold').fontSize(12).text('Salary Breakdown', 60, currentY);
                currentY += 25;

                // Table header
                doc.lineWidth(1).moveTo(60, currentY).lineTo(535, currentY).stroke();
                currentY += 5;

                doc.font('Helvetica-Bold').fontSize(10);
                doc.text('Description', 70, currentY);
                doc.text('Amount (₹)', 450, currentY, { align: 'right', width: 75 });
                currentY += 20;

                doc.lineWidth(0.5).moveTo(60, currentY).lineTo(535, currentY).stroke();
                currentY += 10;

                // Earnings
                doc.font('Helvetica').fontSize(10);
                doc.text('Base Salary', 70, currentY);
                doc.text(payroll.baseSalary.toFixed(2), 450, currentY, { align: 'right', width: 75 });
                currentY += 20;

                if (payroll.bonuses > 0) {
                    doc.text('Bonuses', 70, currentY);
                    doc.text(payroll.bonuses.toFixed(2), 450, currentY, { align: 'right', width: 75 });
                    currentY += 20;
                }

                // Deductions
                if (payroll.otherDeductions > 0 || payroll.totalAdvanceDeduction > 0) {
                    currentY += 10;
                    doc.font('Helvetica-Bold').text('Deductions:', 70, currentY);
                    currentY += 20;
                    doc.font('Helvetica');

                    if (payroll.otherDeductions > 0) {
                        doc.text('Other Deductions', 70, currentY);
                        doc.text(payroll.otherDeductions.toFixed(2), 450, currentY, { align: 'right', width: 75 });
                        currentY += 20;
                    }

                    if (payroll.advanceDeductions && payroll.advanceDeductions.length > 0) {
                        doc.text('Advance Salary Deductions:', 70, currentY);
                        currentY += 15;

                        payroll.advanceDeductions.forEach((adv, index) => {
                            const advReason = adv.advanceId?.reason || 'Advance';
                            doc.fontSize(9).text(`  - ${advReason}`, 80, currentY);
                            doc.text(adv.amount.toFixed(2), 450, currentY, { align: 'right', width: 75 });
                            currentY += 15;
                        });

                        doc.fontSize(10);
                        currentY += 5;
                    }
                }

                // Total line
                currentY += 10;
                doc.lineWidth(1).moveTo(60, currentY).lineTo(535, currentY).stroke();
                currentY += 10;

                doc.font('Helvetica-Bold').fontSize(12);
                doc.text('Net Salary', 70, currentY);
                doc.text(`₹ ${payroll.netSalary.toFixed(2)}`, 450, currentY, { align: 'right', width: 75 });
                currentY += 20;

                doc.lineWidth(1).moveTo(60, currentY).lineTo(535, currentY).stroke();

                // Payment status
                currentY += 30;
                doc.font('Helvetica').fontSize(10);
                doc.text(`Payment Status: ${payroll.paymentStatus.toUpperCase()}`, 70, currentY);

                if (payroll.paymentDate) {
                    const paymentDate = new Date(payroll.paymentDate).toLocaleDateString('en-IN');
                    doc.text(`Payment Date: ${paymentDate}`, 70, currentY + 15);
                }

                // Footer
                const bottomY = doc.page.height - 100;
                doc.fontSize(9).text('This is a computer-generated document and does not require a signature.',
                    60, bottomY, { align: 'center', width: pageWidth - 120 });

                doc.end();
                resolve(doc);

            } catch (error) {
                reject(error);
            }
        });
    },

    /**
     * Generate monthly all-employees salary report PDF
     * @param {String} tenantId - Tenant ID
     * @param {Number} month - Month
     * @param {Number} year - Year
     * @returns {Promise<PDFKit.PDFDocument>} PDF stream
     */
    generateMonthlyReport: async (tenantId, month, year) => {
        return new Promise(async (resolve, reject) => {
            try {
                // Fetch all payroll records for the month
                const payrolls = await Payroll.find({ tenantId, month, year, isDeleted: { $ne: true } })
                    .populate('employeeId', 'name employeeId designation bankName accountNumber ifscCode')
                    .sort({ 'employeeId.employeeId': 1 })
                    .lean();

                if (payrolls.length === 0) {
                    throw new Error('No payroll records found for this period');
                }

                // Fetch school settings
                const settings = await Settings.findOne({ tenantId }).lean();

                // Map settings to match certificate format
                const mappedSettings = {
                    schoolName: settings?.institution?.name || 'School Name',
                    schoolLogo: settings?.institution?.logo,
                    address: settings?.institution?.address ?
                        `${settings.institution.address.street || ''}, ${settings.institution.address.city || ''}`.trim().replace(/^,\s*/, '') :
                        '',
                    phone: settings?.institution?.contact?.phone || '',
                    email: settings?.institution?.contact?.email || '',
                    board: settings?.institution?.board || '',
                    affiliationNumber: settings?.institution?.affiliationNumber || '',
                    schoolCode: settings?.institution?.schoolCode || '',
                    udiseCode: settings?.institution?.udiseCode || ''
                };

                const doc = new PDFDocument({
                    size: 'A4',
                    layout: 'landscape',
                    margin: 40
                });

                doc.info['Title'] = `Monthly Salary Report - ${month}/${year}`;
                doc.info['Author'] = mappedSettings.schoolName;

                const pageWidth = doc.page.width;
                const margin = 40;

                // Add professional letterhead
                const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                    'July', 'August', 'September', 'October', 'November', 'December'];

                let currentY = await payrollPdfService.addLetterhead(
                    doc,
                    mappedSettings,
                    'MONTHLY SALARY REPORT',
                    `${monthNames[month - 1]} ${year}`
                );

                // Table
                const tableTop = currentY;
                const col1X = 50;   // S.No
                const col2X = 90;   // Emp ID
                const col3X = 170;  // Name
                const col4X = 280;  // Bank Name
                const col5X = 400;  // Account No
                const col6X = 510;  // IFSC Code
                const col7X = 610;  // Base Salary
                const col8X = 690;  // Net Salary

                // Table header
                doc.lineWidth(1).moveTo(40, currentY).lineTo(pageWidth - 40, currentY).stroke();
                currentY += 5;

                doc.font('Helvetica-Bold').fontSize(8);
                doc.text('S.No', col1X, currentY, { width: 30 });
                doc.text('Emp ID', col2X, currentY, { width: 70 });
                doc.text('Name', col3X, currentY, { width: 100 });
                doc.text('Bank Name', col4X, currentY, { width: 110 });
                doc.text('Account No', col5X, currentY, { width: 100 });
                doc.text('IFSC Code', col6X, currentY, { width: 90 });
                doc.text('Base', col7X, currentY, { width: 70, align: 'right' });
                doc.text('Net Salary', col8X, currentY, { width: 80, align: 'right' });
                currentY += 15;

                doc.lineWidth(0.5).moveTo(40, currentY).lineTo(pageWidth - 40, currentY).stroke();
                currentY += 8;

                // Table rows
                doc.font('Helvetica').fontSize(7);
                let totalBase = 0;
                let totalNet = 0;

                payrolls.forEach((payroll, index) => {
                    // Check for page break
                    if (currentY > doc.page.height - 100) {
                        doc.addPage();
                        currentY = 50;

                        // Redraw header on new page
                        doc.lineWidth(1).moveTo(40, currentY).lineTo(pageWidth - 40, currentY).stroke();
                        currentY += 5;
                        doc.font('Helvetica-Bold').fontSize(8);
                        doc.text('S.No', col1X, currentY, { width: 30 });
                        doc.text('Emp ID', col2X, currentY, { width: 70 });
                        doc.text('Name', col3X, currentY, { width: 100 });
                        doc.text('Bank Name', col4X, currentY, { width: 110 });
                        doc.text('Account No', col5X, currentY, { width: 100 });
                        doc.text('IFSC Code', col6X, currentY, { width: 90 });
                        doc.text('Base', col7X, currentY, { width: 70, align: 'right' });
                        doc.text('Net Salary', col8X, currentY, { width: 80, align: 'right' });
                        currentY += 15;
                        doc.lineWidth(0.5).moveTo(40, currentY).lineTo(pageWidth - 40, currentY).stroke();
                        currentY += 8;
                        doc.font('Helvetica').fontSize(7);
                    }

                    doc.text((index + 1).toString(), col1X, currentY, { width: 30 });
                    doc.text(payroll.employeeId.employeeId || 'N/A', col2X, currentY, { width: 70 });
                    doc.text(payroll.employeeId.name, col3X, currentY, { width: 100 });
                    doc.text(payroll.employeeId.bankName || '-', col4X, currentY, { width: 110 });
                    doc.text(payroll.employeeId.accountNumber || '-', col5X, currentY, { width: 100 });
                    doc.text(payroll.employeeId.ifscCode || '-', col6X, currentY, { width: 90 });
                    doc.text(payroll.baseSalary.toFixed(2), col7X, currentY, { width: 70, align: 'right' });
                    doc.text(payroll.netSalary.toFixed(2), col8X, currentY, { width: 80, align: 'right' });

                    totalBase += payroll.baseSalary;
                    totalNet += payroll.netSalary;

                    currentY += 18;
                });

                // Total row
                currentY += 5;
                doc.lineWidth(1).moveTo(40, currentY).lineTo(pageWidth - 40, currentY).stroke();
                currentY += 8;

                doc.font('Helvetica-Bold').fontSize(9);
                doc.text('TOTAL', col3X, currentY, { width: 100 });
                doc.text(totalBase.toFixed(2), col7X, currentY, { width: 70, align: 'right' });
                doc.text(totalNet.toFixed(2), col8X, currentY, { width: 80, align: 'right' });
                currentY += 15;

                doc.lineWidth(1).moveTo(40, currentY).lineTo(pageWidth - 40, currentY).stroke();

                // Footer
                const bottomY = doc.page.height - 60;
                doc.font('Helvetica').fontSize(8)
                    .text(`Total Employees: ${payrolls.length}`, 50, bottomY);
                doc.text(`Generated on: ${new Date().toLocaleDateString('en-IN')}`,
                    pageWidth - 200, bottomY, { align: 'right', width: 150 });

                doc.end();
                resolve(doc);

            } catch (error) {
                reject(error);
            }
        });
    },

    /**
     * Generate yearly employee salary report PDF
     * @param {String} employeeId - Employee ID
     * @param {String} tenantId - Tenant ID
     * @param {Number} year - Year
     * @returns {Promise<PDFKit.PDFDocument>} PDF stream
     */
    generateYearlyReport: async (employeeId, tenantId, year) => {
        return new Promise(async (resolve, reject) => {
            try {
                // Fetch employee details
                const employee = await User.findById(employeeId).lean();
                if (!employee) {
                    throw new Error('Employee not found');
                }

                // Fetch all payroll records for the year
                const payrolls = await Payroll.find({ tenantId, employeeId, year, isDeleted: { $ne: true } })
                    .sort({ month: 1 })
                    .lean();

                // Fetch school settings
                const settings = await Settings.findOne({ tenantId }).lean();

                // Map settings to match certificate format
                const mappedSettings = {
                    schoolName: settings?.institution?.name || 'School Name',
                    schoolLogo: settings?.institution?.logo,
                    address: settings?.institution?.address ?
                        `${settings.institution.address.street || ''}, ${settings.institution.address.city || ''}`.trim().replace(/^,\s*/, '') :
                        '',
                    phone: settings?.institution?.contact?.phone || '',
                    email: settings?.institution?.contact?.email || '',
                    board: settings?.institution?.board || '',
                    affiliationNumber: settings?.institution?.affiliationNumber || '',
                    schoolCode: settings?.institution?.schoolCode || '',
                    udiseCode: settings?.institution?.udiseCode || ''
                };

                const doc = new PDFDocument({
                    size: 'A4',
                    margin: 50
                });

                doc.info['Title'] = `Yearly Salary Report - ${employee.name} - ${year}`;
                doc.info['Author'] = mappedSettings.schoolName;

                const pageWidth = doc.page.width;

                // Add professional letterhead
                let currentY = await payrollPdfService.addLetterhead(
                    doc,
                    mappedSettings,
                    'YEARLY SALARY REPORT',
                    `${year}`
                );

                // Employee details
                doc.font('Helvetica-Bold').fontSize(11);
                doc.text(`Employee Name: `, 60, currentY, { continued: true });
                doc.font('Helvetica').text(employee.name);

                doc.font('Helvetica-Bold').text(`Employee ID: `, 60, doc.y, { continued: true });
                doc.font('Helvetica').text(employee.employeeId || 'N/A');

                doc.font('Helvetica-Bold').text(`Designation: `, 60, doc.y, { continued: true });
                doc.font('Helvetica').text(employee.designation || 'N/A');

                doc.moveDown(2);

                // Table
                currentY = doc.y;
                const col1X = 60;
                const col2X = 160;
                const col3X = 260;
                const col4X = 360;
                const col5X = 450;

                // Table header
                doc.lineWidth(1).moveTo(50, currentY).lineTo(545, currentY).stroke();
                currentY += 5;

                doc.font('Helvetica-Bold').fontSize(10);
                doc.text('Month', col1X, currentY);
                doc.text('Base Salary', col2X, currentY, { width: 85, align: 'right' });
                doc.text('Deductions', col3X, currentY, { width: 85, align: 'right' });
                doc.text('Advances', col4X, currentY, { width: 75, align: 'right' });
                doc.text('Net Salary', col5X, currentY, { width: 85, align: 'right' });
                currentY += 20;

                doc.lineWidth(0.5).moveTo(50, currentY).lineTo(545, currentY).stroke();
                currentY += 10;

                // Create month map
                const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                    'July', 'August', 'September', 'October', 'November', 'December'];
                const payrollMap = {};
                payrolls.forEach(p => {
                    payrollMap[p.month] = p;
                });

                // Table rows for all 12 months
                doc.font('Helvetica').fontSize(9);
                let totalBase = 0;
                let totalDeductions = 0;
                let totalAdvances = 0;
                let totalNet = 0;

                for (let month = 1; month <= 12; month++) {
                    const payroll = payrollMap[month];

                    doc.text(monthNames[month - 1], col1X, currentY);

                    if (payroll) {
                        doc.text(payroll.baseSalary.toFixed(2), col2X, currentY, { width: 85, align: 'right' });
                        doc.text(payroll.otherDeductions.toFixed(2), col3X, currentY, { width: 85, align: 'right' });
                        doc.text(payroll.totalAdvanceDeduction.toFixed(2), col4X, currentY, { width: 75, align: 'right' });
                        doc.text(payroll.netSalary.toFixed(2), col5X, currentY, { width: 85, align: 'right' });

                        totalBase += payroll.baseSalary;
                        totalDeductions += payroll.otherDeductions;
                        totalAdvances += payroll.totalAdvanceDeduction;
                        totalNet += payroll.netSalary;
                    } else {
                        doc.text('-', col2X, currentY, { width: 85, align: 'right' });
                        doc.text('-', col3X, currentY, { width: 85, align: 'right' });
                        doc.text('-', col4X, currentY, { width: 75, align: 'right' });
                        doc.text('-', col5X, currentY, { width: 85, align: 'right' });
                    }

                    currentY += 20;
                }

                // Total row
                currentY += 5;
                doc.lineWidth(1).moveTo(50, currentY).lineTo(545, currentY).stroke();
                currentY += 10;

                doc.font('Helvetica-Bold').fontSize(10);
                doc.text('TOTAL', col1X, currentY);
                doc.text(totalBase.toFixed(2), col2X, currentY, { width: 85, align: 'right' });
                doc.text(totalDeductions.toFixed(2), col3X, currentY, { width: 85, align: 'right' });
                doc.text(totalAdvances.toFixed(2), col4X, currentY, { width: 75, align: 'right' });
                doc.text(totalNet.toFixed(2), col5X, currentY, { width: 85, align: 'right' });
                currentY += 15;

                doc.lineWidth(1).moveTo(50, currentY).lineTo(545, currentY).stroke();

                // Footer
                const bottomY = doc.page.height - 80;
                doc.font('Helvetica').fontSize(9)
                    .text(`Months with salary: ${payrolls.length}/12`, 60, bottomY);
                doc.text(`Generated on: ${new Date().toLocaleDateString('en-IN')}`,
                    400, bottomY, { align: 'right', width: 135 });

                doc.end();
                resolve(doc);

            } catch (error) {
                reject(error);
            }
        });
    }
};

module.exports = payrollPdfService;
