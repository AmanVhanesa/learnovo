import React, { useState } from 'react'
import { Banknote, Plus, Edit2, Trash2, Star } from 'lucide-react'

const BankAccountsSection = ({ form, updateField, settingsService }) => {
    const [isAdding, setIsAdding] = useState(false)
    const [editingId, setEditingId] = useState(null)
    const [formData, setFormData] = useState({
        bankName: '',
        accountNumber: '',
        branch: '',
        address: '',
        instructions: '',
        isDefault: false
    })

    const resetForm = () => {
        setFormData({
            bankName: '',
            accountNumber: '',
            branch: '',
            address: '',
            instructions: '',
            isDefault: false
        })
        setIsAdding(false)
        setEditingId(null)
    }

    const handleAdd = () => {
        const accounts = form.bankAccounts || []
        updateField('bankAccounts', [...accounts, { ...formData, isActive: true }])
        resetForm()
    }

    const handleEdit = (account, index) => {
        setFormData(account)
        setEditingId(index)
        setIsAdding(true)
    }

    const handleUpdate = () => {
        const accounts = [...(form.bankAccounts || [])]
        accounts[editingId] = formData
        updateField('bankAccounts', accounts)
        resetForm()
    }

    const handleDelete = (index) => {
        const accounts = form.bankAccounts || []
        updateField('bankAccounts', accounts.filter((_, i) => i !== index))
    }

    const setAsDefault = (index) => {
        const accounts = (form.bankAccounts || []).map((acc, i) => ({
            ...acc,
            isDefault: i === index
        }))
        updateField('bankAccounts', accounts)
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <Banknote className="h-6 w-6 text-primary-600" />
                    <div>
                        <h2 className="text-xl font-semibold text-gray-900">Bank Accounts</h2>
                        <p className="text-sm text-gray-500">Manage bank details for fee invoices and receipts</p>
                    </div>
                </div>
                {!isAdding && (
                    <button
                        onClick={() => setIsAdding(true)}
                        className="btn btn-primary"
                    >
                        <Plus className="h-4 w-4 mr-2" />
                        Add Account
                    </button>
                )}
            </div>

            {/* Add/Edit Form */}
            {isAdding && (
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
                    <h3 className="text-sm font-medium text-gray-900 mb-4">
                        {editingId !== null ? 'Edit Bank Account' : 'Add New Bank Account'}
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="label">Bank Name *</label>
                            <input
                                type="text"
                                className="input"
                                value={formData.bankName}
                                onChange={(e) => setFormData({ ...formData, bankName: e.target.value })}
                                placeholder="e.g., State Bank of India"
                            />
                        </div>
                        <div>
                            <label className="label">Account Number *</label>
                            <input
                                type="text"
                                className="input"
                                value={formData.accountNumber}
                                onChange={(e) => setFormData({ ...formData, accountNumber: e.target.value })}
                                placeholder="1234567890"
                            />
                        </div>
                        <div>
                            <label className="label">Branch</label>
                            <input
                                type="text"
                                className="input"
                                value={formData.branch}
                                onChange={(e) => setFormData({ ...formData, branch: e.target.value })}
                                placeholder="Main Branch"
                            />
                        </div>
                        <div>
                            <label className="label">Branch Address</label>
                            <input
                                type="text"
                                className="input"
                                value={formData.address}
                                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                                placeholder="123 Main St, City"
                            />
                        </div>
                        <div className="md:col-span-2">
                            <label className="label">Payment Instructions</label>
                            <textarea
                                className="input"
                                rows="3"
                                value={formData.instructions}
                                onChange={(e) => setFormData({ ...formData, instructions: e.target.value })}
                                placeholder="Additional payment instructions for students/parents"
                            />
                        </div>
                        <div className="md:col-span-2">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={formData.isDefault}
                                    onChange={(e) => setFormData({ ...formData, isDefault: e.target.checked })}
                                    className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                                />
                                <span className="text-sm text-gray-700">Set as default bank account</span>
                            </label>
                        </div>
                    </div>
                    <div className="flex gap-3 mt-6">
                        <button
                            onClick={editingId !== null ? handleUpdate : handleAdd}
                            className="btn btn-primary"
                            disabled={!formData.bankName || !formData.accountNumber}
                        >
                            {editingId !== null ? 'Update' : 'Add'} Account
                        </button>
                        <button onClick={resetForm} className="btn btn-outline">
                            Cancel
                        </button>
                    </div>
                </div>
            )}

            {/* Bank Accounts List */}
            <div className="space-y-4">
                {(form.bankAccounts || []).length === 0 ? (
                    <div className="text-center py-12 bg-gray-50 rounded-lg border border-gray-200">
                        <Banknote className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                        <p className="text-sm text-gray-500">No bank accounts added yet</p>
                        <p className="text-xs text-gray-400 mt-1">Add your first bank account to get started</p>
                    </div>
                ) : (
                    (form.bankAccounts || []).map((account, index) => (
                        <div
                            key={index}
                            className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow"
                        >
                            <div className="flex items-start justify-between">
                                <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-2">
                                        <h3 className="text-lg font-semibold text-gray-900">{account.bankName}</h3>
                                        {account.isDefault && (
                                            <span className="inline-flex items-center px-2 py-1 text-xs font-semibold rounded-full bg-primary-100 text-primary-800">
                                                <Star className="h-3 w-3 mr-1" />
                                                Default
                                            </span>
                                        )}
                                    </div>
                                    <div className="space-y-1 text-sm text-gray-600">
                                        <p><span className="font-medium">Account:</span> {account.accountNumber}</p>
                                        {account.branch && <p><span className="font-medium">Branch:</span> {account.branch}</p>}
                                        {account.address && <p><span className="font-medium">Address:</span> {account.address}</p>}
                                        {account.instructions && (
                                            <p className="text-xs text-gray-500 mt-2 italic">{account.instructions}</p>
                                        )}
                                    </div>
                                </div>
                                <div className="flex gap-2 ml-4">
                                    {!account.isDefault && (
                                        <button
                                            onClick={() => setAsDefault(index)}
                                            className="p-2 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-md"
                                            title="Set as default"
                                        >
                                            <Star className="h-4 w-4" />
                                        </button>
                                    )}
                                    <button
                                        onClick={() => handleEdit(account, index)}
                                        className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-md"
                                    >
                                        <Edit2 className="h-4 w-4" />
                                    </button>
                                    <button
                                        onClick={() => handleDelete(index)}
                                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md"
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    )
}

export default BankAccountsSection
