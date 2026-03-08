import React, { useState, useEffect } from 'react'
import { X, Plus, Trash2, AlertCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import { invoicesService } from '../services/feesService'

const EditInvoiceModal = ({ invoice, onClose, onSuccess }) => {
    const [items, setItems] = useState([])
    const [dueDate, setDueDate] = useState('')
    const [remarks, setRemarks] = useState('')
    const [isSaving, setIsSaving] = useState(false)

    useEffect(() => {
        if (invoice) {
            setItems(invoice.items.map(item => ({
                feeHeadName: item.feeHeadName,
                amount: item.amount,
                frequency: item.frequency
            })))
            setDueDate(new Date(invoice.dueDate).toISOString().split('T')[0])
            setRemarks(invoice.remarks || '')
        }
    }, [invoice])

    const handleAddItem = () => {
        setItems([...items, { feeHeadName: '', amount: 0, frequency: 'One-time' }])
    }

    const handleRemoveItem = (index) => {
        setItems(items.filter((_, i) => i !== index))
    }

    const handleItemChange = (index, field, value) => {
        const newItems = [...items]
        newItems[index] = { ...newItems[index], [field]: value }
        setItems(newItems)
    }

    const totalAmount = items.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0)
    const paidAmount = invoice?.paidAmount || 0

    const handleSubmit = async (e) => {
        e.preventDefault()

        if (items.length === 0) {
            toast.error('At least one fee item is required')
            return
        }

        if (totalAmount < paidAmount) {
            toast.error(`Total amount (${totalAmount}) cannot be less than paid amount (${paidAmount})`)
            return
        }

        try {
            setIsSaving(true)
            await invoicesService.update(invoice._id, {
                items,
                dueDate,
                remarks
            })
            toast.success('Invoice updated successfully')
            onSuccess()
        } catch (error) {
            console.error('Update error:', error)
            toast.error(error.response?.data?.message || 'Failed to update invoice')
        } finally {
            setIsSaving(false)
        }
    }

    if (!invoice) return null

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between border-b border-gray-200 p-6">
                    <div>
                        <h3 className="text-xl font-semibold text-gray-900">Edit Invoice</h3>
                        <p className="text-sm text-gray-500">#{invoice.invoiceNumber}</p>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-md hover:bg-gray-100">
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-6">
                    {/* Items Section */}
                    <div>
                        <div className="flex justify-between items-center mb-3">
                            <label className="block text-sm font-medium text-gray-700">Fee Items</label>
                            <button
                                type="button"
                                onClick={handleAddItem}
                                className="text-sm text-primary-600 hover:text-primary-700 flex items-center gap-1"
                            >
                                <Plus className="h-4 w-4" />
                                Add Item
                            </button>
                        </div>

                        <div className="space-y-3">
                            {items.map((item, index) => (
                                <div key={index} className="flex gap-3 items-start">
                                    <div className="flex-1">
                                        <input
                                            type="text"
                                            placeholder="Fee Head Name"
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                            value={item.feeHeadName}
                                            onChange={(e) => handleItemChange(index, 'feeHeadName', e.target.value)}
                                            required
                                        />
                                    </div>
                                    <div className="w-32">
                                        <input
                                            type="number"
                                            placeholder="Amount"
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                            value={item.amount}
                                            onChange={(e) => handleItemChange(index, 'amount', parseFloat(e.target.value))}
                                            min="0"
                                            required
                                        />
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => handleRemoveItem(index)}
                                        className="p-2 text-red-500 hover:bg-red-50 rounded-lg"
                                        title="Remove Item"
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </button>
                                </div>
                            ))}
                        </div>

                        {items.length === 0 && (
                            <div className="text-center py-4 text-sm text-gray-500 bg-gray-50 rounded-lg">
                                No items added
                            </div>
                        )}
                    </div>

                    {/* Summary */}
                    <div className="bg-gray-50 p-4 rounded-lg space-y-2">
                        <div className="flex justify-between text-sm">
                            <span className="text-gray-600">Total Amount:</span>
                            <span className="font-semibold">₹{totalAmount.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span className="text-gray-600">Paid Amount:</span>
                            <span className="font-semibold text-green-600">₹{paidAmount.toLocaleString()}</span>
                        </div>
                        {totalAmount < paidAmount && (
                            <div className="flex items-center gap-2 text-red-600 text-xs mt-2">
                                <AlertCircle className="h-4 w-4" />
                                Total cannot be less than paid amount
                            </div>
                        )}
                    </div>

                    {/* Due Date & Remarks */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Due Date</label>
                            <input
                                type="date"
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                                value={dueDate}
                                onChange={(e) => setDueDate(e.target.value)}
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Remarks</label>
                            <input
                                type="text"
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                                value={remarks}
                                onChange={(e) => setRemarks(e.target.value)}
                                placeholder="Optional remarks"
                            />
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isSaving || totalAmount < paidAmount}
                            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
                        >
                            {isSaving ? 'Saving...' : 'Update Invoice'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}

export default EditInvoiceModal
