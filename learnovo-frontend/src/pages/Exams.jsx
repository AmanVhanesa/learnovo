import React, { useState, useEffect } from 'react';
import { Plus, Search, Calendar, FileText, CheckCircle, Trash2, X, ClipboardList } from 'lucide-react';
import { examsService } from '../services/examsService';
import ExamResultsModal from '../components/ExamResultsModal';
import toast from 'react-hot-toast';
import { useAuth } from '../contexts/AuthContext';

const Exams = () => {
    const { user } = useAuth();
    const [exams, setExams] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showAddModal, setShowAddModal] = useState(false);
    const [selectedExam, setSelectedExam] = useState(null); // For results modal
    const [form, setForm] = useState({
        name: '',
        class: '',
        subject: '',
        date: '',
        totalMarks: 100,
        examType: 'Midterm'
    });

    useEffect(() => {
        fetchExams();
    }, []);

    const fetchExams = async () => {
        try {
            setLoading(true);
            const res = await examsService.list();
            setExams(res.data || []);
        } catch (error) {
            console.error('Fetch exams error:', error);
            toast.error('Failed to load exams');
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Are you sure? This will delete all results associated with this exam.')) return;
        try {
            await examsService.delete(id);
            toast.success('Exam deleted');
            fetchExams();
        } catch (error) {
            toast.error('Failed to delete exam');
        }
    };

    const handleCreate = async (e) => {
        e.preventDefault();
        try {
            await examsService.create(form);
            toast.success('Exam scheduled successfully');
            setShowAddModal(false);
            fetchExams();
            setForm({ name: '', class: '', subject: '', date: '', totalMarks: 100, examType: 'Midterm' });
        } catch (error) {
            toast.error('Failed to create exam');
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold text-gray-900">Exams & Results</h1>
                {(user.role === 'admin' || user.role === 'teacher') && (
                    <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>
                        <Plus className="h-4 w-4 mr-2" />
                        Schedule Exam
                    </button>
                )}
            </div>

            <div className="bg-white rounded-lg shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="table">
                        <thead>
                            <tr>
                                <th>Date</th>
                                <th>Exam Name</th>
                                <th>Class</th>
                                <th>Subject</th>
                                <th>Type</th>
                                <th>Marks</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {exams.length === 0 ? (
                                <tr>
                                    <td colSpan="7" className="text-center py-8 text-gray-500">No exams scheduled</td>
                                </tr>
                            ) : (
                                exams.map(exam => (
                                    <tr key={exam._id}>
                                        <td>
                                            <div className="flex items-center text-gray-900">
                                                <Calendar className="h-4 w-4 mr-2 text-gray-400" />
                                                {new Date(exam.date).toLocaleDateString()}
                                            </div>
                                        </td>
                                        <td className="font-medium text-gray-900">{exam.name}</td>
                                        <td><span className="badge badge-blue">{exam.class}</span></td>
                                        <td>{exam.subject}</td>
                                        <td>{exam.examType}</td>
                                        <td>{exam.totalMarks}</td>
                                        <td>
                                            <div className="flex space-x-2">
                                                <button
                                                    className="btn btn-sm btn-outline text-teal-600 hover:bg-teal-50"
                                                    onClick={() => setSelectedExam(exam)}
                                                    title="Enter/View Results"
                                                >
                                                    <ClipboardList className="h-4 w-4 mr-1" />
                                                    Results
                                                </button>
                                                {(user.role === 'admin' || user.role === 'teacher') && (
                                                    <button
                                                        className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                                                        onClick={() => handleDelete(exam._id)}
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Add Exam Modal */}
            {showAddModal && (
                <div className="modal-overlay" role="dialog" aria-modal="true">
                    <div className="modal-content p-4 max-w-md">
                        <div className="flex items-center justify-between border-b border-gray-200 p-4">
                            <h3 className="text-lg font-semibold text-gray-900">Schedule New Exam</h3>
                            <button className="p-2 rounded-md hover:bg-gray-100" onClick={() => setShowAddModal(false)}>
                                <X className="h-5 w-5" />
                            </button>
                        </div>
                        <form onSubmit={handleCreate} className="p-4 space-y-4">
                            <div>
                                <label className="label">Exam Name</label>
                                <input className="input" placeholder="e.g. Mid Term Physics" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="label">Class</label>
                                    <input className="input" placeholder="e.g. 10th Grade" value={form.class} onChange={e => setForm({ ...form, class: e.target.value })} required />
                                </div>
                                <div>
                                    <label className="label">Subject</label>
                                    <input className="input" placeholder="e.g. Physics" value={form.subject} onChange={e => setForm({ ...form, subject: e.target.value })} required />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="label">Date</label>
                                    <input type="date" className="input" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} required />
                                </div>
                                <div>
                                    <label className="label">Total Marks</label>
                                    <input type="number" className="input" value={form.totalMarks} onChange={e => setForm({ ...form, totalMarks: e.target.value })} required />
                                </div>
                            </div>
                            <div>
                                <label className="label">Exam Type</label>
                                <select className="input" value={form.examType} onChange={e => setForm({ ...form, examType: e.target.value })}>
                                    <option>Quiz</option>
                                    <option>Midterm</option>
                                    <option>Final</option>
                                    <option>Assignment</option>
                                </select>
                            </div>
                            <div className="flex justify-end gap-2 pt-2">
                                <button type="button" className="btn btn-ghost" onClick={() => setShowAddModal(false)}>Cancel</button>
                                <button type="submit" className="btn btn-primary">Schedule</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Results Modal */}
            {selectedExam && (
                <ExamResultsModal
                    exam={selectedExam}
                    onClose={() => setSelectedExam(null)}
                />
            )}
        </div>
    );
};

export default Exams;
