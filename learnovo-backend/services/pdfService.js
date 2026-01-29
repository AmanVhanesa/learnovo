const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const axios = require('axios');

/**
 * Service to generate PDF certificates
 */
const pdfService = {
    /**
     * Generate a PDF certificate stream
     * @param {Object} data - Certificate data
     * @param {Object} template - Template configuration
     * @returns {Promise<PDFKit.PDFDocument>}
     */
    generateCertificate: async (data, template) => {
        return new Promise(async (resolve, reject) => {
            try {
                const doc = new PDFDocument({
                    size: 'A4',
                    margin: 50,
                    bufferPages: true
                });

                // Add metadata
                doc.info['Title'] = `${template.type} - ${data.studentName}`;
                doc.info['Author'] = data.schoolName;

                // --- Helper Functions ---

                // Load logo if available
                // Load logo if available
                let logoImage = null;
                if (data.schoolLogo) {
                    try {
                        if (data.schoolLogo.startsWith('http')) {
                            // Remote URL
                            const response = await axios.get(data.schoolLogo, { responseType: 'arraybuffer' });
                            logoImage = response.data;
                        } else {
                            // Local File Path
                            // Try absolute path first
                            let logoPath = data.schoolLogo;
                            if (fs.existsSync(logoPath)) {
                                logoImage = logoPath;
                            } else {
                                // Try resolving relative to project root
                                logoPath = path.resolve(process.cwd(), data.schoolLogo);
                                if (fs.existsSync(logoPath)) {
                                    logoImage = logoPath;
                                } else {
                                    // Try resolving relative to 'public' or 'uploads' if path is just filename
                                    // Common case: 'uploads/logo.png' -> /app/uploads/logo.png
                                    logoPath = path.join(process.cwd(), 'uploads', path.basename(data.schoolLogo));
                                    if (fs.existsSync(logoPath)) {
                                        logoImage = logoPath;
                                    } else {
                                        console.warn(`Logo file not found at: ${data.schoolLogo} or resolved paths`);
                                    }
                                }
                            }
                        }
                    } catch (err) {
                        console.warn('Failed to load logo:', err.message);
                    }
                }

                // --- Layout Logic ---

                // 1. Header (School Details)

                // 1. Header (School Details) - New "Professional" Layout
                const pageWidth = doc.page.width;
                const pageHeight = doc.page.height;
                const margin = 50;

                // Draw Border around the page
                doc.rect(20, 20, pageWidth - 40, pageHeight - 40).stroke();
                doc.rect(25, 25, pageWidth - 50, pageHeight - 50).lineWidth(0.5).stroke();

                let currentY = 50;

                // Logo Logic (Left Aligned)
                if (logoImage) {
                    const logoWidth = 70; // Slightly smaller for professionalism
                    const logoX = 60; // Left margin offset
                    const logoY = 45;

                    doc.image(logoImage, logoX, logoY, { width: logoWidth });
                }

                // School Details Logic (Centered)
                // We move 'y' only slightly to align with logo top
                doc.y = 45;

                // School Name
                doc.font('Helvetica-Bold').fontSize(24).fillColor('#000000')
                    .text(data.schoolName, { align: 'center' });

                doc.moveDown(0.5);


                // Address
                doc.font('Helvetica').fontSize(10).text(data.schoolAddress, { align: 'center' });

                // Contact Details
                if (data.schoolPhone || data.schoolEmail) {
                    const contactParts = [];
                    if (data.schoolPhone) contactParts.push(`Phone: ${data.schoolPhone}`);
                    if (data.schoolEmail) contactParts.push(`Email: ${data.schoolEmail}`);

                    doc.moveDown(0.2);
                    doc.text(contactParts.join(' | '), { align: 'center' });
                }

                doc.moveDown(0.2);

                // Board & Affiliation Details (Combined Line)
                const boardLine = `${data.schoolBoard} Affiliation No: ${data.affiliationNumber} | School Code: ${data.schoolCode}`;
                doc.text(boardLine, { align: 'center' });

                // UDISE Code (New Line)
                if (data.udiseCode) {
                    doc.moveDown(0.2);
                    doc.text(`UDISE No: ${data.udiseCode}`, { align: 'center' });
                }

                doc.moveDown(1.5);

                // Separator Line
                doc.lineWidth(2).moveTo(50, doc.y).lineTo(545, doc.y).stroke();
                doc.moveDown(2);

                // 2. Certificate Title
                const title = template.type === 'TC' ? 'SCHOOL LEAVING CERTIFICATE' : 'BONAFIDE CERTIFICATE';
                doc.font('Helvetica-Bold').fontSize(18).fillColor('#2355A6').text(title, { align: 'center', underline: true });
                doc.fillColor('black');
                doc.moveDown(2);

                // 3. Certificate Details & Body
                if (template.type === 'TC') {
                    pdfService.renderTCBody(doc, data);
                } else {
                    pdfService.renderBonafideBody(doc, data, template.declarationText);
                }

                // 4. Footer & Signatures
                const bottomY = doc.page.height - 150;

                doc.fontSize(10).text(`Place: ${data.place}`, 50, bottomY);
                doc.text(`Date: ${data.issueDate}`, 50, bottomY + 15);

                doc.text('Class Teacher', 50, bottomY + 80, { align: 'left' });
                doc.text('Principal', 450, bottomY + 80, { align: 'left' });

                doc.end();
                resolve(doc);

            } catch (error) {
                reject(error);
            }
        });
    },

    /**
     * Render Bonafide Certificate Body
     */
    renderBonafideBody: (doc, data, declarationText) => {
        doc.fontSize(12).font('Helvetica').text(`Certificate No: ${data.certificateNumber}`, 50, doc.y, { align: 'left' });
        doc.moveDown(2);

        const text = declarationText || 'This is to certify that the above student is a bonafide student of this institution.';
        // Replace placeholders if text has them (simple implementations)

        const bodyText = `This is to certify that Master/Miss ${data.studentName}, Son/Daughter of Mr. ${data.fatherName} and Mrs. ${data.motherName}, is a bonafide student of our school studying in Class ${data.class} (Section ${data.section}) for the academic year ${data.academicYear}.

His/Her date of birth as per school records is ${data.dob} (in figures) and ${data.dobWords} (in words).

Admission Number: ${data.admissionNumber}`;

        doc.font('Helvetica').fontSize(14).text(bodyText, {
            align: 'justify',
            lineGap: 10
        });
    },

    /**
     * Render TC Body (Table format)
     */
    renderTCBody: (doc, data) => {
        doc.fontSize(10);

        const startX = 50;
        let currentY = doc.y;
        const col1X = 50;
        const col2X = 250;
        const rowHeight = 25;

        const fields = [
            { label: '1. Name of the Student', value: data.studentName },
            { label: '2. Father\'s / Guardian\'s Name', value: data.fatherName },
            { label: '3. Mother\'s Name', value: data.motherName },
            { label: '4. Nationality', value: data.nationality },
            { label: '5. Category (Gen/SC/ST/OBC)', value: data.category },
            { label: '6. Date of Birth', value: `${data.dob} (${data.dobWords})` },
            { label: '7. Admission Number', value: data.admissionNumber },
            { label: '8. Date of First Admission', value: data.admissionDate },
            { label: '9. Class Last Studied', value: data.class },
            { label: '10. Board / Exam Last Taken', value: data.boardResult },
            { label: '11. Whether Qualified for Promotion', value: data.promotionStatus },
            { label: '12. Subjects Studied', value: data.subjects },
            { label: '13. Month up to which fees paid', value: data.feeStatus },
            { label: '14. General Conduct', value: data.conduct || 'Good' },
            { label: '15. Date of Application for Certificate', value: data.applicationDate },
            { label: '16. Date of Issue of Certificate', value: data.issueDate },
            { label: '17. Reason for Leaving', value: data.leavingReason },
            { label: '18. Any other remarks', value: data.remarks || '-' }
        ];

        fields.forEach(field => {
            // Check for page break
            if (currentY > 700) {
                doc.addPage();
                currentY = 50;
            }

            doc.font('Helvetica-Bold').text(field.label, col1X, currentY);
            doc.font('Helvetica').text(`:  ${field.value}`, col2X, currentY);
            currentY += rowHeight;
        });
    }
};

module.exports = pdfService;
