// Standardized class values for the entire application
// This ensures consistency across student import, forms, and class management

export const STANDARD_CLASSES = [
    { value: 'Nursery', label: 'Nursery', grade: 'Nursery' },
    { value: 'LKG', label: 'LKG', grade: 'LKG' },
    { value: 'UKG', label: 'UKG', grade: 'UKG' },
    { value: '1', label: 'Class 1', grade: '1' },
    { value: '2', label: 'Class 2', grade: '2' },
    { value: '3', label: 'Class 3', grade: '3' },
    { value: '4', label: 'Class 4', grade: '4' },
    { value: '5', label: 'Class 5', grade: '5' },
    { value: '6', label: 'Class 6', grade: '6' },
    { value: '7', label: 'Class 7', grade: '7' },
    { value: '8', label: 'Class 8', grade: '8' },
    { value: '9', label: 'Class 9', grade: '9' },
    { value: '10', label: 'Class 10', grade: '10' },
    { value: '11', label: 'Class 11', grade: '11' },
    { value: '12', label: 'Class 12', grade: '12' }
];

// Helper function to get class label from value
export const getClassLabel = (value) => {
    const classItem = STANDARD_CLASSES.find(c => c.value === value || c.grade === value);
    return classItem ? classItem.label : value;
};

// Helper function to normalize class value (handles variations like "Class 1", "class 1", "1")
export const normalizeClassValue = (input) => {
    if (!input) return null;

    const inputStr = String(input).trim();

    // Direct match
    const directMatch = STANDARD_CLASSES.find(c =>
        c.value === inputStr ||
        c.label.toLowerCase() === inputStr.toLowerCase() ||
        c.grade === inputStr
    );

    if (directMatch) return directMatch.value;

    // Try to extract number from "Class X" format
    const match = inputStr.match(/class\s*(\d+|nursery|lkg|ukg)/i);
    if (match) {
        const extracted = match[1].toLowerCase();
        if (extracted === 'nursery' || extracted === 'lkg' || extracted === 'ukg') {
            return extracted.charAt(0).toUpperCase() + extracted.slice(1);
        }
        return extracted;
    }

    // Return as-is if no match found
    return inputStr;
};
