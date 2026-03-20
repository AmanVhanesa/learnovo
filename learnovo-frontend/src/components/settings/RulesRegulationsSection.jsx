import React, { useState } from 'react'
import { FileText, Eye, Edit3 } from 'lucide-react'

const RulesRegulationsSection = ({ form, updateField }) => {
    const [isEditing, setIsEditing] = useState(false)
    const [content, setContent] = useState(form.rulesAndRegulations?.content || '')

    const handleSave = () => {
        updateField('rulesAndRegulations.content', content)
        setIsEditing(false)
    }

    const handleCancel = () => {
        setContent(form.rulesAndRegulations?.content || '')
        setIsEditing(false)
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
                <div className="flex items-center gap-3">
                    <FileText className="h-6 w-6 text-primary-600" />
                    <div>
                        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Rules & Regulations</h2>
                        <p className="text-sm text-gray-500 dark:text-[#8E8E93]">Official school rules shown to parents and students</p>
                    </div>
                </div>
                {!isEditing && (
                    <button
                        onClick={() => setIsEditing(true)}
                        className="btn btn-primary w-full sm:w-auto"
                    >
                        <Edit3 className="h-4 w-4 mr-2" />
                        Edit Rules
                    </button>
                )}
            </div>

            {form.rulesAndRegulations?.version && (
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-2xl p-3 flex items-center justify-between">
                    <div className="text-sm text-blue-800 dark:text-blue-300">
                        <span className="font-medium">Version:</span> {form.rulesAndRegulations.version}
                        {form.rulesAndRegulations.lastUpdatedAt && (
                            <span className="ml-4">
                                <span className="font-medium">Last Updated:</span>{' '}
                                {new Date(form.rulesAndRegulations.lastUpdatedAt).toLocaleDateString()}
                            </span>
                        )}
                    </div>
                </div>
            )}

            {isEditing ? (
                <div className="space-y-4">
                    <div>
                        <label className="label">Rules & Regulations Content</label>
                        <textarea
                            className="input font-mono text-sm"
                            rows="20"
                            value={content}
                            onChange={(e) => setContent(e.target.value)}
                            placeholder="Enter your school's rules and regulations here...

Example:
1. Students must arrive on time
2. Uniform is mandatory
3. Mobile phones are not allowed
..."
                        />
                        <p className="text-xs text-gray-500 dark:text-[#8E8E93] mt-2">
                            This content will be displayed in admission forms, student portal, and certificates.
                        </p>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-3">
                        <button onClick={handleSave} className="btn btn-primary w-full sm:w-auto">
                            Save Changes
                        </button>
                        <button onClick={handleCancel} className="btn btn-outline w-full sm:w-auto">
                            Cancel
                        </button>
                    </div>
                </div>
            ) : (
                <div className="bg-white dark:bg-[#1C1C1E] border border-gray-200 dark:border-[#38383A] rounded-2xl p-6">
                    {form.rulesAndRegulations?.content ? (
                        <div className="prose prose-sm max-w-none">
                            <pre className="whitespace-pre-wrap font-sans text-sm text-gray-700 dark:text-[#8E8E93]">
                                {form.rulesAndRegulations.content}
                            </pre>
                        </div>
                    ) : (
                        <div className="text-center py-12">
                            <FileText className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                            <p className="text-sm text-gray-500 dark:text-[#8E8E93]">No rules and regulations defined yet</p>
                            <p className="text-xs text-gray-400 mt-1">Click "Edit Rules" to add content</p>
                        </div>
                    )}
                </div>
            )}

            <div className="bg-gray-50 dark:bg-[#2C2C2E] border border-gray-200 dark:border-[#38383A] rounded-2xl p-4">
                <p className="text-sm text-gray-700 dark:text-[#8E8E93]">
                    <strong>Note:</strong> Rules and regulations are version-controlled. Each update increments the version number.
                </p>
            </div>
        </div>
    )
}

export default RulesRegulationsSection
