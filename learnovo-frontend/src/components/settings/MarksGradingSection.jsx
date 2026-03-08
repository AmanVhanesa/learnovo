import React, { useState } from 'react'
import { GraduationCap, Plus, Trash2, AlertCircle } from 'lucide-react'

const MarksGradingSection = ({ form, updateField }) => {
    const [newGrade, setNewGrade] = useState({
        gradeName: '',
        percentageFrom: '',
        percentageTo: '',
        status: 'PASS'
    })

    const addGradeRule = () => {
        if (!newGrade.gradeName || !newGrade.percentageFrom || !newGrade.percentageTo) {
            return
        }

        const rules = form.grading?.rules || []
        const updatedRules = [
            ...rules,
            {
                ...newGrade,
                percentageFrom: parseFloat(newGrade.percentageFrom),
                percentageTo: parseFloat(newGrade.percentageTo),
                order: rules.length
            }
        ]

        updateField('grading.rules', updatedRules)
        setNewGrade({ gradeName: '', percentageFrom: '', percentageTo: '', status: 'PASS' })
    }

    const removeGradeRule = (index) => {
        const rules = form.grading?.rules || []
        const updatedRules = rules.filter((_, i) => i !== index)
        updateField('grading.rules', updatedRules)
    }

    const validateRules = () => {
        const rules = form.grading?.rules || []
        if (rules.length === 0) return { valid: true, message: '' }

        const sorted = [...rules].sort((a, b) => a.percentageFrom - b.percentageFrom)

        // Check for overlaps
        for (let i = 0; i < sorted.length - 1; i++) {
            if (sorted[i].percentageTo > sorted[i + 1].percentageFrom) {
                return {
                    valid: false,
                    message: `Overlapping ranges: ${sorted[i].gradeName} and ${sorted[i + 1].gradeName}`
                }
            }
        }

        // Check coverage
        const minCovered = sorted[0]?.percentageFrom || 0
        const maxCovered = sorted[sorted.length - 1]?.percentageTo || 0

        if (minCovered > 0 || maxCovered < 100) {
            return {
                valid: false,
                message: `Incomplete coverage: Range should cover 0-100 (currently ${minCovered}-${maxCovered})`
            }
        }

        return { valid: true, message: 'All rules are valid' }
    }

    const validation = validateRules()

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-3 mb-6">
                <GraduationCap className="h-6 w-6 text-primary-600" />
                <div>
                    <h2 className="text-xl font-semibold text-gray-900">Marks Grading</h2>
                    <p className="text-sm text-gray-500">Define how marks convert to grades and pass/fail status</p>
                </div>
            </div>

            {!validation.valid && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4 flex items-start gap-3">
                    <AlertCircle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                    <div>
                        <p className="text-sm font-medium text-yellow-800">Validation Warning</p>
                        <p className="text-sm text-yellow-700 mt-1">{validation.message}</p>
                    </div>
                </div>
            )}

            {/* Existing Grades Table */}
            <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Grade
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Percentage Range
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Status
                            </th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Actions
                            </th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {(form.grading?.rules || []).length === 0 ? (
                            <tr>
                                <td colSpan="4" className="px-6 py-8 text-center text-sm text-gray-500">
                                    No grading rules defined. Add your first grade below.
                                </td>
                            </tr>
                        ) : (
                            (form.grading?.rules || [])
                                .sort((a, b) => b.percentageFrom - a.percentageFrom)
                                .map((rule, index) => (
                                    <tr key={index} className="hover:bg-gray-50">
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className="text-sm font-medium text-gray-900">{rule.gradeName}</span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className="text-sm text-gray-600">
                                                {rule.percentageFrom}% - {rule.percentageTo}%
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span
                                                className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${rule.status === 'PASS'
                                                        ? 'bg-green-100 text-green-800'
                                                        : 'bg-red-100 text-red-800'
                                                    }`}
                                            >
                                                {rule.status}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                            <button
                                                onClick={() => removeGradeRule(index)}
                                                className="text-red-600 hover:text-red-900"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </button>
                                        </td>
                                    </tr>
                                ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Add New Grade */}
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <h3 className="text-sm font-medium text-gray-900 mb-4">Add New Grade</h3>
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                    <div>
                        <label className="label">Grade Name</label>
                        <input
                            type="text"
                            className="input"
                            placeholder="A+"
                            value={newGrade.gradeName}
                            onChange={(e) => setNewGrade({ ...newGrade, gradeName: e.target.value })}
                        />
                    </div>
                    <div>
                        <label className="label">From %</label>
                        <input
                            type="number"
                            className="input"
                            placeholder="90"
                            min="0"
                            max="100"
                            value={newGrade.percentageFrom}
                            onChange={(e) => setNewGrade({ ...newGrade, percentageFrom: e.target.value })}
                        />
                    </div>
                    <div>
                        <label className="label">To %</label>
                        <input
                            type="number"
                            className="input"
                            placeholder="100"
                            min="0"
                            max="100"
                            value={newGrade.percentageTo}
                            onChange={(e) => setNewGrade({ ...newGrade, percentageTo: e.target.value })}
                        />
                    </div>
                    <div>
                        <label className="label">Status</label>
                        <select
                            className="input"
                            value={newGrade.status}
                            onChange={(e) => setNewGrade({ ...newGrade, status: e.target.value })}
                        >
                            <option value="PASS">PASS</option>
                            <option value="FAIL">FAIL</option>
                        </select>
                    </div>
                    <div className="flex items-end">
                        <button
                            onClick={addGradeRule}
                            className="btn btn-primary w-full"
                            disabled={!newGrade.gradeName || !newGrade.percentageFrom || !newGrade.percentageTo}
                        >
                            <Plus className="h-4 w-4 mr-2" />
                            Add
                        </button>
                    </div>
                </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
                <p className="text-sm text-blue-800">
                    <strong>Note:</strong> Grading rules affect exam results, report cards, and analytics. Ensure ranges cover 0-100% without overlaps.
                </p>
            </div>
        </div>
    )
}

export default MarksGradingSection
