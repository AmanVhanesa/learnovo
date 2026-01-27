import React, { useState, useEffect } from 'react';
import { X, Save } from 'lucide-react';
import { studentsService } from '../services/studentsService';
import { examsService } from '../services/examsService';
import toast from 'react-hot-toast';

const ExamResultsModal = ({ exam, onClose }) => {
    const [students, setStudents] = useState([]);
    const [marks, setMarks] = useState({});
    const [remarks, setRemarks] = useState({});
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        fetchData();
    }, [exam]);

    const fetchData = async () => {
        try {
            setLoading(true);
            // Fetch students of the class
            const studentsRes = await studentsService.list({ className: exam.class, limit: 100 });
            const studentList = studentsRes.data || studentsRes.students || [];
            setStudents(studentList);

            // Fetch existing results
            const resultsRes = await examsService.getResults(exam._id);
            const existingResults = resultsRes.data || [];

            const newMarks = {};
            const newRemarks = {};
            existingResults.forEach(r => {
                newMarks[r.student._id || r.student] = r.marksObtained;
                newRemarks[r.student._id || r.student] = r.remarks || '';
            });
            setMarks(newMarks);
            setRemarks(newRemarks);

        } catch (error) {
            console.error('Error details:', error);
            toast.error('Failed to load data');
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const resultsToSave = Object.keys(marks).map(studentId => ({
                studentId,
                marks: marks[studentId],
                remarks: remarks[studentId]
            })).filter(r => r.marks !== undefined && r.marks !== '');

            await examsService.saveResults(exam._id, resultsToSave);
            toast.success('Results saved successfully');
            onClose();
        } catch (error) {
            console.error('Save error:', error);
            toast.error('Failed to save results');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="modal-overlay" role="dialog" aria-modal="true">
            <div className="modal-content p-4 max-w-4xl w-full h-[90vh] flex flex-col">
                <div className="flex items-center justify-between border-b border-gray-200 p-4 shrink-0">
                    <div>
                        <h3 className="text-lg font-semibold text-gray-900">Enter Results - {exam.name}</h3>
                        <p className="text-sm text-gray-500">{exam.subject} | Class {exam.class} | Max Marks: {exam.totalMarks}</p>
                    </div>
                    <button className="p-2 rounded-md hover:bg-gray-100" onClick={onClose}>
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-4">
                    {loading ? (
                        <div className="flex justify-center p-10"><div className="loading-spinner"></div></div>
                    ) : (
                        <table className="table w-full">
                            <thead className="sticky top-0 bg-white z-10 shadow-sm">
                                <tr>
                                    <th>Roll No</th>
                                    <th>Student Name</th>
                                    <th>Marks Obtained</th>
                                    <th>Remarks</th>
                                </tr>
                            </thead>
                            <tbody>
                                {students.map(student => (
                                    <tr key={student._id || student.id}>
                                        <td>{student.rollNumber}</td>
                                        <td>{student.name}</td>
                                        <td>
                                            <input
                                                type="number"
                                                className="input w-24"
                                                max={exam.totalMarks}
                                                min="0"
                                                value={marks[student._id || student.id] !== undefined ? marks[student._id || student.id] : ''}
                                                onChange={(e) => setMarks({ ...marks, [student._id || student.id]: e.target.value })}
                                            />
                                        </td>
                                        <td>
                                            <input
                                                type="text"
                                                className="input w-full"
                                                placeholder="Good, Excellent..."
                                                value={remarks[student._id || student.id] || ''}
                                                onChange={(e) => setRemarks({ ...remarks, [student._id || student.id]: e.target.value })}
                                            />
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>

                <div className="border-t border-gray-200 p-4 shrink-0 flex justify-end gap-2">
                    <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
                    <button
                        className="btn btn-primary"
                        onClick={handleSave}
                        disabled={saving || loading}
                    >
                        <Save className="h-4 w-4 mr-2" />
                        {saving ? 'Saving...' : 'Save Results'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ExamResultsModal;
