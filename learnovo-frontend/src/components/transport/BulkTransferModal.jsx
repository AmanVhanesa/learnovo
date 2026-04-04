import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, ArrowRightLeft, Search, Trash2, Loader2, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import transportService from '../../services/transportService';

const BulkTransferModal = ({ routes, drivers, onClose }) => {
    // Input mode: 'admission' (paste admission numbers) or 'driver' (select from driver)
    const [inputMode, setInputMode] = useState('admission');

    // Admission number input
    const [admissionInput, setAdmissionInput] = useState('');
    const [resolvedStudents, setResolvedStudents] = useState([]);
    const [notFoundNumbers, setNotFoundNumbers] = useState([]);
    const [resolving, setResolving] = useState(false);
    const [hasResolved, setHasResolved] = useState(false);

    // Driver selection mode
    const [fromDriverId, setFromDriverId] = useState('');
    const [driverStudents, setDriverStudents] = useState([]);
    const [selectedStudentIds, setSelectedStudentIds] = useState(new Set());
    const [loadingDriverStudents, setLoadingDriverStudents] = useState(false);

    // Target config
    const [toRouteId, setToRouteId] = useState('');
    const [toStop, setToStop] = useState('');
    const [transportType, setTransportType] = useState('');
    const [monthlyFee, setMonthlyFee] = useState('');

    // Transfer state
    const [transferring, setTransferring] = useState(false);
    const [results, setResults] = useState(null);

    const selectedRoute = routes.find(r => r._id === toRouteId);

    // When source driver changes, load their students
    useEffect(() => {
        if (inputMode === 'driver' && fromDriverId) {
            fetchDriverStudents();
        } else {
            setDriverStudents([]);
            setSelectedStudentIds(new Set());
        }
    }, [fromDriverId, inputMode]);

    // Auto-fill monthly fee when target route changes
    useEffect(() => {
        if (selectedRoute && !monthlyFee) {
            setMonthlyFee(selectedRoute.monthlyFee || '');
        }
    }, [toRouteId]);

    const fetchDriverStudents = async () => {
        try {
            setLoadingDriverStudents(true);
            // Find routes assigned to this driver
            const driverRoutes = routes.filter(r => r.assignedDriver === fromDriverId || r.assignedDriver?._id === fromDriverId);

            let allStudents = [];
            for (const route of driverRoutes) {
                try {
                    const response = await transportService.getRouteAssignments(route._id);
                    const students = (response.data || []).map(a => ({
                        _id: a.student?._id,
                        name: a.student?.name || 'Unknown',
                        admissionNumber: a.student?.admissionNumber || 'N/A',
                        class: a.student?.class,
                        section: a.student?.section,
                        routeName: route.routeName,
                        stop: a.stop,
                        assignmentId: a._id,
                        routeId: route._id
                    }));
                    allStudents = [...allStudents, ...students];
                } catch {
                    // skip failed route
                }
            }

            // Also try direct assignment query
            if (allStudents.length === 0) {
                try {
                    const response = await transportService.getStudentTransportAssignments({ limit: 500, status: 'active' });
                    const filtered = (response.data || []).filter(a => {
                        const routeDriver = a.route?.assignedDriver;
                        const dId = typeof routeDriver === 'object' ? routeDriver?._id : routeDriver;
                        return dId === fromDriverId;
                    });
                    allStudents = filtered.map(a => ({
                        _id: a.student?._id,
                        name: a.student?.name || 'Unknown',
                        admissionNumber: a.student?.admissionNumber || 'N/A',
                        class: a.student?.class,
                        section: a.student?.section,
                        routeName: a.route?.routeName,
                        stop: a.stop,
                        assignmentId: a._id,
                        routeId: a.route?._id
                    }));
                } catch {
                    // fallback failed
                }
            }

            setDriverStudents(allStudents);
            // Select all by default
            setSelectedStudentIds(new Set(allStudents.map(s => s._id).filter(Boolean)));
        } catch {
            toast.error('Failed to load driver students');
        } finally {
            setLoadingDriverStudents(false);
        }
    };

    const handleResolve = async () => {
        const numbers = admissionInput
            .split(/[,\n]+/)
            .map(n => n.trim())
            .filter(n => n.length > 0);

        if (numbers.length === 0) return toast.error('Enter at least one admission number');

        try {
            setResolving(true);
            const response = await transportService.resolveStudentsByAdmission(numbers);
            setResolvedStudents(response.data.students || []);
            setNotFoundNumbers(response.data.notFound || []);
            setHasResolved(true);

            if (response.data.notFound?.length > 0) {
                toast.error(`${response.data.notFound.length} admission number(s) not found`);
            } else {
                toast.success(`Found ${response.data.students?.length || 0} student(s)`);
            }
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to resolve students');
        } finally {
            setResolving(false);
        }
    };

    const removeResolved = (admNum) => {
        setResolvedStudents(prev => prev.filter(s => s.admissionNumber !== admNum));
    };

    const toggleStudent = (id) => {
        const next = new Set(selectedStudentIds);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setSelectedStudentIds(next);
    };

    const toggleSelectAll = () => {
        if (selectedStudentIds.size === driverStudents.length) {
            setSelectedStudentIds(new Set());
        } else {
            setSelectedStudentIds(new Set(driverStudents.map(s => s._id).filter(Boolean)));
        }
    };

    const getStudentsToTransfer = () => {
        if (inputMode === 'admission') return resolvedStudents.filter(s => s.hasTransport);
        return driverStudents.filter(s => selectedStudentIds.has(s._id));
    };

    const canTransfer = () => {
        if (!toRouteId || !toStop) return false;
        if (inputMode === 'admission') return resolvedStudents.filter(s => s.hasTransport).length > 0;
        return selectedStudentIds.size > 0;
    };

    const handleTransfer = async () => {
        if (!canTransfer()) return;

        try {
            setTransferring(true);
            const payload = {
                toRouteId,
                toStop,
                transportType: transportType || undefined,
                monthlyFee: monthlyFee ? Number(monthlyFee) : undefined
            };

            if (inputMode === 'admission') {
                payload.admissionNumbers = resolvedStudents.filter(s => s.hasTransport).map(s => s.admissionNumber);
            } else {
                payload.studentIds = Array.from(selectedStudentIds);
            }

            const response = await transportService.bulkTransferStudents(payload);
            setResults(response.data);
            toast.success(response.message || 'Transfer completed');
        } catch (error) {
            toast.error(error.response?.data?.message || 'Transfer failed');
        } finally {
            setTransferring(false);
        }
    };

    const handleDone = () => {
        onClose(results ? true : false);
    };

    return createPortal(
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999] p-4">
            <div className="bg-white dark:bg-[#1C1C1E] rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto shadow-glass-lg">
                {/* Header */}
                <div className="sticky top-0 bg-white dark:bg-[#1C1C1E] border-b border-gray-200 dark:border-[#38383A] px-6 py-4 flex justify-between items-center z-10">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary-100 dark:bg-primary-900/30 rounded-lg">
                            <ArrowRightLeft className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                        </div>
                        <div>
                            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Bulk Transfer Students</h2>
                            <p className="text-sm text-gray-500 dark:text-[#8E8E93]">Transfer students from one driver/route to another</p>
                        </div>
                    </div>
                    <button onClick={handleDone} className="text-gray-400 hover:text-gray-600 dark:text-[#8E8E93]">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                <div className="p-6 space-y-6">
                    {/* Results View */}
                    {results ? (
                        <div className="space-y-4">
                            <div className="grid grid-cols-3 gap-4">
                                <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4 text-center">
                                    <CheckCircle className="w-8 h-8 text-green-600 mx-auto mb-1" />
                                    <p className="text-2xl font-bold text-green-700 dark:text-green-400">{results.transferred?.length || 0}</p>
                                    <p className="text-sm text-green-600 dark:text-green-500">Transferred</p>
                                </div>
                                <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-4 text-center">
                                    <AlertTriangle className="w-8 h-8 text-yellow-600 mx-auto mb-1" />
                                    <p className="text-2xl font-bold text-yellow-700 dark:text-yellow-400">{results.skipped?.length || 0}</p>
                                    <p className="text-sm text-yellow-600 dark:text-yellow-500">Skipped</p>
                                </div>
                                <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-4 text-center">
                                    <XCircle className="w-8 h-8 text-red-600 mx-auto mb-1" />
                                    <p className="text-2xl font-bold text-red-700 dark:text-red-400">{results.failed?.length || 0}</p>
                                    <p className="text-sm text-red-600 dark:text-red-500">Failed</p>
                                </div>
                            </div>

                            {/* Detail lists */}
                            {results.transferred?.length > 0 && (
                                <div>
                                    <h4 className="text-sm font-medium text-green-700 dark:text-green-400 mb-2">Transferred Students</h4>
                                    <div className="space-y-1">
                                        {results.transferred.map((s, i) => (
                                            <div key={i} className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                                                <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                                                <span>{s.name}</span>
                                                <span className="text-gray-400">({s.admissionNumber})</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                            {results.skipped?.length > 0 && (
                                <div>
                                    <h4 className="text-sm font-medium text-yellow-700 dark:text-yellow-400 mb-2">Skipped Students</h4>
                                    <div className="space-y-1">
                                        {results.skipped.map((s, i) => (
                                            <div key={i} className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                                                <AlertTriangle className="w-4 h-4 text-yellow-500 flex-shrink-0" />
                                                <span>{s.name} ({s.admissionNumber})</span>
                                                <span className="text-gray-400">— {s.reason}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                            {results.failed?.length > 0 && (
                                <div>
                                    <h4 className="text-sm font-medium text-red-700 dark:text-red-400 mb-2">Failed</h4>
                                    <div className="space-y-1">
                                        {results.failed.map((s, i) => (
                                            <div key={i} className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                                                <XCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                                                <span>{s.name} ({s.admissionNumber})</span>
                                                <span className="text-gray-400">— {s.reason}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div className="flex justify-end pt-4">
                                <button
                                    onClick={handleDone}
                                    className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
                                >
                                    Done
                                </button>
                            </div>
                        </div>
                    ) : (
                        <>
                            {/* Step 1: Input Mode Toggle */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-[#8E8E93] mb-2">Select Students By</label>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => { setInputMode('admission'); setDriverStudents([]); setSelectedStudentIds(new Set()); setFromDriverId(''); }}
                                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${inputMode === 'admission'
                                            ? 'bg-primary-600 text-white'
                                            : 'bg-gray-100 dark:bg-[#2C2C2E] text-gray-700 dark:text-[#8E8E93] hover:bg-gray-200 dark:hover:bg-[#38383A]'}`}
                                    >
                                        By Admission No.
                                    </button>
                                    <button
                                        onClick={() => { setInputMode('driver'); setResolvedStudents([]); setNotFoundNumbers([]); setHasResolved(false); setAdmissionInput(''); }}
                                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${inputMode === 'driver'
                                            ? 'bg-primary-600 text-white'
                                            : 'bg-gray-100 dark:bg-[#2C2C2E] text-gray-700 dark:text-[#8E8E93] hover:bg-gray-200 dark:hover:bg-[#38383A]'}`}
                                    >
                                        By Driver
                                    </button>
                                </div>
                            </div>

                            {/* Step 2: Source Selection */}
                            {inputMode === 'admission' ? (
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-[#8E8E93] mb-2">
                                        Enter Admission Numbers
                                    </label>
                                    <textarea
                                        value={admissionInput}
                                        onChange={(e) => setAdmissionInput(e.target.value)}
                                        rows="3"
                                        className="w-full px-3 py-2 border border-gray-300 dark:border-[#38383A] rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent dark:bg-[#1C1C1E] dark:text-white font-mono text-sm"
                                        placeholder="Enter admission numbers separated by commas or new lines&#10;e.g. ADM001, ADM002, ADM003"
                                    />
                                    <button
                                        onClick={handleResolve}
                                        disabled={resolving || !admissionInput.trim()}
                                        className="mt-2 inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 text-sm"
                                    >
                                        {resolving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                                        {resolving ? 'Finding...' : 'Find Students'}
                                    </button>

                                    {/* Not found numbers */}
                                    {notFoundNumbers.length > 0 && (
                                        <div className="mt-3 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                                            <p className="text-sm font-medium text-red-700 dark:text-red-400 mb-1">Not Found:</p>
                                            <p className="text-sm text-red-600 dark:text-red-500">{notFoundNumbers.join(', ')}</p>
                                        </div>
                                    )}

                                    {/* Resolved students */}
                                    {hasResolved && resolvedStudents.length > 0 && (
                                        <div className="mt-3 border border-gray-200 dark:border-[#38383A] rounded-lg overflow-hidden">
                                            <div className="px-3 py-2 bg-gray-50 dark:bg-[#2C2C2E] text-xs font-medium text-gray-500 dark:text-[#8E8E93]">
                                                {resolvedStudents.filter(s => s.hasTransport).length} student(s) with active transport
                                            </div>
                                            <div className="max-h-48 overflow-y-auto divide-y divide-gray-100 dark:divide-[#38383A]">
                                                {resolvedStudents.map((student) => (
                                                    <div key={student._id} className="flex items-center justify-between px-3 py-2 hover:bg-gray-50 dark:hover:bg-[#2C2C2E]">
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-sm font-medium text-gray-900 dark:text-white truncate">{student.name}</span>
                                                                <span className="text-xs text-gray-500 dark:text-[#8E8E93]">{student.admissionNumber}</span>
                                                                {student.class && <span className="text-xs text-gray-400">({student.class}{student.section ? `-${student.section}` : ''})</span>}
                                                            </div>
                                                            {student.hasTransport ? (
                                                                <p className="text-xs text-green-600 dark:text-green-400">
                                                                    Current: {student.assignment?.route?.routeName} — {student.assignment?.stop}
                                                                </p>
                                                            ) : (
                                                                <p className="text-xs text-yellow-600 dark:text-yellow-400">No active transport assignment</p>
                                                            )}
                                                        </div>
                                                        <button onClick={() => removeResolved(student.admissionNumber)} className="ml-2 text-gray-400 hover:text-red-500">
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-[#8E8E93] mb-2">
                                        Select Source Driver
                                    </label>
                                    <select
                                        value={fromDriverId}
                                        onChange={(e) => setFromDriverId(e.target.value)}
                                        className="w-full px-3 py-2 border border-gray-300 dark:border-[#38383A] rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent dark:bg-[#1C1C1E] dark:text-white"
                                    >
                                        <option value="">Select a driver</option>
                                        {drivers.map(d => (
                                            <option key={d._id} value={d._id}>{d.name} — {d.phone}</option>
                                        ))}
                                    </select>

                                    {loadingDriverStudents && (
                                        <div className="mt-3 flex items-center gap-2 text-sm text-gray-500 dark:text-[#8E8E93]">
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                            Loading students...
                                        </div>
                                    )}

                                    {!loadingDriverStudents && fromDriverId && driverStudents.length === 0 && (
                                        <div className="mt-3 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                                            <p className="text-sm text-yellow-700 dark:text-yellow-400">No students found for this driver</p>
                                        </div>
                                    )}

                                    {driverStudents.length > 0 && (
                                        <div className="mt-3 border border-gray-200 dark:border-[#38383A] rounded-lg overflow-hidden">
                                            <div className="px-3 py-2 bg-gray-50 dark:bg-[#2C2C2E] flex items-center justify-between">
                                                <span className="text-xs font-medium text-gray-500 dark:text-[#8E8E93]">
                                                    {selectedStudentIds.size} of {driverStudents.length} selected
                                                </span>
                                                <button
                                                    onClick={toggleSelectAll}
                                                    className="text-xs text-primary-600 hover:text-primary-700 font-medium"
                                                >
                                                    {selectedStudentIds.size === driverStudents.length ? 'Deselect All' : 'Select All'}
                                                </button>
                                            </div>
                                            <div className="max-h-48 overflow-y-auto divide-y divide-gray-100 dark:divide-[#38383A]">
                                                {driverStudents.map((student) => (
                                                    <label key={student._id} className="flex items-center gap-3 px-3 py-2 hover:bg-gray-50 dark:hover:bg-[#2C2C2E] cursor-pointer">
                                                        <input
                                                            type="checkbox"
                                                            checked={selectedStudentIds.has(student._id)}
                                                            onChange={() => toggleStudent(student._id)}
                                                            className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                                                        />
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-sm font-medium text-gray-900 dark:text-white truncate">{student.name}</span>
                                                                <span className="text-xs text-gray-500 dark:text-[#8E8E93]">{student.admissionNumber}</span>
                                                            </div>
                                                            <p className="text-xs text-gray-400">{student.routeName} — {student.stop}</p>
                                                        </div>
                                                    </label>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Step 3: Target Configuration */}
                            <div className="border-t border-gray-200 dark:border-[#38383A] pt-5">
                                <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Transfer To</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="md:col-span-2">
                                        <label className="block text-sm font-medium text-gray-700 dark:text-[#8E8E93] mb-1">Target Route *</label>
                                        <select
                                            value={toRouteId}
                                            onChange={(e) => { setToRouteId(e.target.value); setToStop(''); }}
                                            className="w-full px-3 py-2 border border-gray-300 dark:border-[#38383A] rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent dark:bg-[#1C1C1E] dark:text-white"
                                        >
                                            <option value="">Select Route</option>
                                            {routes.map(route => (
                                                <option key={route._id} value={route._id}>
                                                    {route.routeName} {route.assignedDriver?.name ? `(Driver: ${route.assignedDriver.name})` : ''} — ₹{route.monthlyFee}/month
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    {selectedRoute && selectedRoute.stops && (
                                        <div className="md:col-span-2">
                                            <label className="block text-sm font-medium text-gray-700 dark:text-[#8E8E93] mb-1">Target Stop *</label>
                                            <select
                                                value={toStop}
                                                onChange={(e) => setToStop(e.target.value)}
                                                className="w-full px-3 py-2 border border-gray-300 dark:border-[#38383A] rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent dark:bg-[#1C1C1E] dark:text-white"
                                            >
                                                <option value="">Select Stop</option>
                                                {selectedRoute.stops.map((stop, index) => (
                                                    <option key={index} value={stop.stopName}>
                                                        {stop.stopName} {stop.landmark && `(${stop.landmark})`}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                    )}

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-[#8E8E93] mb-1">Transport Type</label>
                                        <select
                                            value={transportType}
                                            onChange={(e) => setTransportType(e.target.value)}
                                            className="w-full px-3 py-2 border border-gray-300 dark:border-[#38383A] rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent dark:bg-[#1C1C1E] dark:text-white"
                                        >
                                            <option value="">Keep Existing</option>
                                            <option value="Both">Both (Pickup & Drop)</option>
                                            <option value="Pickup Only">Pickup Only</option>
                                            <option value="Drop Only">Drop Only</option>
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-[#8E8E93] mb-1">Monthly Fee</label>
                                        <input
                                            type="number"
                                            value={monthlyFee}
                                            onChange={(e) => setMonthlyFee(e.target.value)}
                                            min="0"
                                            placeholder="Keep existing fee"
                                            className="w-full px-3 py-2 border border-gray-300 dark:border-[#38383A] rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent dark:bg-[#1C1C1E] dark:text-white"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="flex items-center justify-between pt-4 border-t border-gray-200 dark:border-[#38383A]">
                                <p className="text-sm text-gray-500 dark:text-[#8E8E93]">
                                    {getStudentsToTransfer().length} student(s) will be transferred
                                </p>
                                <div className="flex gap-3">
                                    <button
                                        type="button"
                                        onClick={handleDone}
                                        className="px-4 py-2 border border-gray-300 dark:border-[#38383A] rounded-lg text-gray-700 dark:text-[#8E8E93] hover:bg-gray-50 dark:hover:bg-[#2C2C2E]"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={handleTransfer}
                                        disabled={!canTransfer() || transferring}
                                        className="inline-flex items-center gap-2 px-5 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
                                    >
                                        {transferring ? (
                                            <>
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                                Transferring...
                                            </>
                                        ) : (
                                            <>
                                                <ArrowRightLeft className="w-4 h-4" />
                                                Transfer Students
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>,
        document.body
    );
};

export default BulkTransferModal;
