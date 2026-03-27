import {
    Document,
    Paragraph,
    TextRun,
    Table,
    TableRow,
    TableCell,
    WidthType,
    AlignmentType,
    BorderStyle,
    HeadingLevel,
    Packer,
} from 'docx';
import { saveAs } from 'file-saver';

const val = (v) => (v && v !== '-' ? v : 'N/A');

function buildTCRows(data) {
    return [
        ['Student Name', val(data.studentName)],
        ["Father's / Guardian's Name", val(data.fatherName)],
        ["Mother's Name", val(data.motherName)],
        ['Nationality', val(data.nationality)],
        ['Category', val(data.category)],
        ['Date of Birth', val(data.dob)],
        ['Date of Birth (in words)', val(data.dobWords)],
        ['Admission Number', val(data.admissionNumber)],
        ['Date of First Admission', val(data.admissionDate)],
        ['Class in which Last Studied', val(data.class)],
        ['Section', val(data.section)],
        ['Academic Year', val(data.academicYear)],
        ['Board Examination Result', val(data.boardResult)],
        ['Promotion Status', val(data.promotionStatus)],
        ['Subjects Studied', val(data.subjects)],
        ['Fee Status', val(data.feeStatus)],
        ['General Conduct', val(data.conduct)],
        ['Date of Application', val(data.applicationDate)],
        ['Date of Issue', val(data.issueDate)],
        ['Reason for Leaving', val(data.leavingReason)],
        ['Remarks', val(data.remarks)],
    ];
}

function buildBonafideRows(data) {
    return [
        ['Student Name', val(data.studentName)],
        ["Father's Name", val(data.fatherName)],
        ["Mother's Name", val(data.motherName)],
        ['Admission Number', val(data.admissionNumber)],
        ['Date of Birth', val(data.dob)],
        ['Class', val(data.class)],
        ['Section', val(data.section)],
        ['Academic Year', val(data.academicYear)],
        ['Category', val(data.category)],
        ['Purpose', val(data.purpose)],
    ];
}

function makeRow(label, value) {
    return new TableRow({
        children: [
            new TableCell({
                width: { size: 3600, type: WidthType.DXA },
                children: [
                    new Paragraph({
                        children: [new TextRun({ text: label, bold: true, size: 22, font: 'Arial' })],
                        spacing: { before: 40, after: 40 },
                    }),
                ],
            }),
            new TableCell({
                width: { size: 5400, type: WidthType.DXA },
                children: [
                    new Paragraph({
                        children: [new TextRun({ text: value, size: 22, font: 'Arial' })],
                        spacing: { before: 40, after: 40 },
                    }),
                ],
            }),
        ],
    });
}

function buildTable(rows) {
    return new Table({
        width: { size: 9000, type: WidthType.DXA },
        rows: rows.map(([label, value]) => makeRow(label, value)),
        borders: {
            top: { style: BorderStyle.SINGLE, size: 1, color: '999999' },
            bottom: { style: BorderStyle.SINGLE, size: 1, color: '999999' },
            left: { style: BorderStyle.SINGLE, size: 1, color: '999999' },
            right: { style: BorderStyle.SINGLE, size: 1, color: '999999' },
            insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: '999999' },
            insideVertical: { style: BorderStyle.SINGLE, size: 1, color: '999999' },
        },
    });
}

const TITLE_MAP = {
    tc: 'SCHOOL LEAVING CERTIFICATE',
    TC: 'SCHOOL LEAVING CERTIFICATE',
    bonafide: 'BONAFIDE CERTIFICATE',
    BONAFIDE: 'BONAFIDE CERTIFICATE',
};

export async function generateCertificateDocx(type, data) {
    const normalizedType = type.toUpperCase();
    const title = TITLE_MAP[normalizedType] || 'CERTIFICATE';
    const rows = normalizedType === 'TC' ? buildTCRows(data) : buildBonafideRows(data);

    const children = [
        // School name
        new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 80 },
            children: [
                new TextRun({
                    text: val(data.schoolName),
                    bold: true,
                    size: 32,
                    font: 'Arial',
                }),
            ],
        }),

        // School address
        new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 200 },
            children: [
                new TextRun({
                    text: val(data.schoolAddress),
                    size: 20,
                    font: 'Arial',
                    color: '666666',
                }),
            ],
        }),

        // Certificate title
        new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 100, after: 200 },
            heading: HeadingLevel.HEADING_1,
            children: [
                new TextRun({
                    text: title,
                    bold: true,
                    size: 28,
                    font: 'Arial',
                    underline: {},
                }),
            ],
        }),

        // Certificate number + date (right aligned)
        new Paragraph({
            alignment: AlignmentType.RIGHT,
            spacing: { after: 60 },
            children: [
                new TextRun({
                    text: `Certificate No: ${val(data.certificateNumber)}`,
                    size: 20,
                    font: 'Arial',
                }),
            ],
        }),
        new Paragraph({
            alignment: AlignmentType.RIGHT,
            spacing: { after: 200 },
            children: [
                new TextRun({
                    text: `Date: ${val(data.issueDate)}`,
                    size: 20,
                    font: 'Arial',
                }),
            ],
        }),
    ];

    // Bonafide declaration paragraph
    if (normalizedType === 'BONAFIDE') {
        children.push(
            new Paragraph({
                spacing: { after: 200 },
                children: [
                    new TextRun({
                        text: `This is to certify that `,
                        size: 22,
                        font: 'Arial',
                    }),
                    new TextRun({
                        text: val(data.studentName),
                        bold: true,
                        size: 22,
                        font: 'Arial',
                    }),
                    new TextRun({
                        text: ` is a bonafide student of this school. The details are as follows:`,
                        size: 22,
                        font: 'Arial',
                    }),
                ],
            })
        );
    }

    // Data table
    children.push(buildTable(rows));

    // Spacer before signatures
    children.push(
        new Paragraph({ spacing: { before: 600, after: 0 }, children: [] })
    );

    // Signature block
    children.push(
        new Table({
            width: { size: 9000, type: WidthType.DXA },
            borders: {
                top: { style: BorderStyle.NONE },
                bottom: { style: BorderStyle.NONE },
                left: { style: BorderStyle.NONE },
                right: { style: BorderStyle.NONE },
                insideHorizontal: { style: BorderStyle.NONE },
                insideVertical: { style: BorderStyle.NONE },
            },
            rows: [
                new TableRow({
                    children: [
                        new TableCell({
                            width: { size: 4500, type: WidthType.DXA },
                            children: [
                                new Paragraph({
                                    alignment: AlignmentType.CENTER,
                                    children: [
                                        new TextRun({
                                            text: '________________________',
                                            size: 22,
                                            font: 'Arial',
                                        }),
                                    ],
                                }),
                                new Paragraph({
                                    alignment: AlignmentType.CENTER,
                                    spacing: { before: 60 },
                                    children: [
                                        new TextRun({
                                            text: 'Class Teacher',
                                            bold: true,
                                            size: 20,
                                            font: 'Arial',
                                        }),
                                    ],
                                }),
                            ],
                        }),
                        new TableCell({
                            width: { size: 4500, type: WidthType.DXA },
                            children: [
                                new Paragraph({
                                    alignment: AlignmentType.CENTER,
                                    children: [
                                        new TextRun({
                                            text: '________________________',
                                            size: 22,
                                            font: 'Arial',
                                        }),
                                    ],
                                }),
                                new Paragraph({
                                    alignment: AlignmentType.CENTER,
                                    spacing: { before: 60 },
                                    children: [
                                        new TextRun({
                                            text: 'Principal',
                                            bold: true,
                                            size: 20,
                                            font: 'Arial',
                                        }),
                                    ],
                                }),
                            ],
                        }),
                    ],
                }),
            ],
        })
    );

    const doc = new Document({
        sections: [
            {
                properties: {
                    page: {
                        size: { width: 11906, height: 16838 }, // A4
                        margin: { top: 1440, bottom: 1440, left: 1440, right: 1440 },
                    },
                },
                children,
            },
        ],
    });

    const blob = await Packer.toBlob(doc);
    const studentName = (data.studentName || 'Student').replace(/[^a-zA-Z0-9]/g, '_');
    const admNo = (data.admissionNumber || '').replace(/[^a-zA-Z0-9]/g, '_');
    const filename = `${normalizedType}_${studentName}_${admNo}.docx`;
    saveAs(blob, filename);
}
