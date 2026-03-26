const pdfService = require('../../services/pdfService');
const fs = require('fs');
const path = require('path');

// Mock data
const mockData = {
    studentName: 'John Doe',
    fatherName: 'Richard Doe',
    motherName: 'Jane Doe',
    admissionNumber: 'ADM-2025-001',
    class: 'IX',
    section: 'A',
    academicYear: '2025-2026',
    dob: '01/01/2010',
    dobWords: 'First January Two Thousand Ten',
    schoolName: 'Test School',
    schoolAddress: '123 Test St, City',
    affiliationNumber: '123456',
    schoolCode: 'SCH-01',
    place: 'City',
    issueDate: '01/04/2026',
    // TC specifics
    leavingReason: 'Transfer',
    feeStatus: 'Paid',
    category: 'General',
    nationality: 'Indian',
    subjects: 'Maths, Science',
    admissionDate: '01/04/2020',
    boardResult: 'Passed',
    promotionStatus: 'Yes',
    conduct: 'Good'
};

const mockTemplateTC = {
    type: 'TC'
};

const mockTemplateBonafide = {
    type: 'BONAFIDE',
    declarationText: 'This is a test declaration.'
};

describe('PDF Service', () => {

    it('should generate a Bonafide Certificate stream', async () => {
        const doc = await pdfService.generateCertificate(mockData, mockTemplateBonafide);
        expect(doc).toBeDefined();
        // We can't easily check stream content in unit test without piping, but no error is good.
    });

    it('should generate a TC stream', async () => {
        const doc = await pdfService.generateCertificate(mockData, mockTemplateTC);
        expect(doc).toBeDefined();
    });

});
