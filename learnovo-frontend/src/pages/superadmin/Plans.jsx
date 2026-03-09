import React, { useState } from 'react'
import { Check, X, Shield, Edit2, Info } from 'lucide-react'
import { superAdminService } from '../../services/superAdminService'
import toast from 'react-hot-toast'

const SuperAdminPlans = () => {
    const [plans, setPlans] = useState([
        {
            id: 'free_trial',
            name: 'Free Trial',
            price: '$0',
            period: '/ 14 days',
            description: 'Test out Learnovo for your school.',
            color: 'bg-gray-100 text-gray-800',
            accentColor: 'border-gray-200 hover:border-gray-300',
            limits: { students: 50, teachers: 5 },
            features: ['Core Academics', 'Attendance Tracking'],
            missing: ['Fees & Finance', 'Advanced Analytics']
        },
        {
            id: 'basic',
            name: 'Basic',
            price: '$49',
            period: '/ month',
            description: 'Essential management for small schools.',
            color: 'bg-blue-100 text-blue-800',
            accentColor: 'border-blue-200 hover:border-blue-300',
            limits: { students: 500, teachers: 30 },
            features: ['Core Academics', 'Attendance Tracking', 'Fees & Finance'],
            missing: ['Advanced Analytics']
        },
        {
            id: 'premium',
            name: 'Premium',
            price: '$99',
            period: '/ month',
            description: 'Complete ERP suite for growing institutions.',
            color: 'bg-purple-100 text-purple-800',
            accentColor: 'border-purple-200 hover:border-purple-300 transform scale-105 shadow-md', // Highlight
            isPopular: true,
            limits: { students: 1500, teachers: 100 },
            features: ['Core Academics', 'Attendance Tracking', 'Fees & Finance', 'Advanced Analytics'],
            missing: []
        },
        {
            id: 'enterprise',
            name: 'Enterprise',
            price: 'Custom',
            period: '/ year',
            description: 'Unlimited capacity with priority support.',
            color: 'bg-yellow-100 text-yellow-800',
            accentColor: 'border-yellow-200 hover:border-yellow-300',
            limits: { students: 0, teachers: 0 }, // 0 means unlimited
            features: ['Core Academics', 'Attendance Tracking', 'Fees & Finance', 'Advanced Analytics'],
            missing: []
        }
    ])

    const [editingPlan, setEditingPlan] = useState(null)
    const [editForm, setEditForm] = useState({ students: 0, teachers: 0 })
    const [isUpdating, setIsUpdating] = useState(false)

    const handleEditClick = (plan) => {
        setEditingPlan(plan.id)
        setEditForm({ students: plan.limits.students, teachers: plan.limits.teachers })
    }

    const handleSaveLimits = async (planId) => {
        setIsUpdating(true)
        try {
            // In full implementation: await superAdminService.updatePlanConfig(planId, editForm)

            // Update local state for UI demonstration
            setPlans(plans.map(p =>
                p.id === planId ? { ...p, limits: { ...editForm } } : p
            ))

            toast.success(`${planId} plan limits updated successfully (Simulation in dev)`)
            setEditingPlan(null)
        } catch (error) {
            toast.error('Failed to update plan limits')
        } finally {
            setIsUpdating(false)
        }
    }

    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Subscription Plans</h1>
                    <p className="mt-1 text-sm text-gray-500">Configure global subscription tiers, pricing, and resource limits.</p>
                </div>
            </div>

            <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 flex items-start gap-3">
                <Info className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div>
                    <h3 className="text-sm font-medium text-blue-800">Global Plan Configurations</h3>
                    <p className="mt-1 text-sm text-blue-600">
                        Changes made here apply system-wide to all new tenants. To apply custom limits to a specific school, use the
                        "Override Features" option in the Tenant Management drawer instead. Note: Price changes require Stripe dashboard sync.
                    </p>
                </div>
            </div>

            {/* Pricing Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 items-center">
                {plans.map((plan) => (
                    <div
                        key={plan.id}
                        className={`relative bg-white rounded-2xl border-2 transition-all duration-200 flex flex-col h-full ${plan.accentColor} ${plan.isPopular ? 'z-10 bg-gradient-to-b from-white to-purple-50/30' : ''}`}
                    >
                        {plan.isPopular && (
                            <div className="absolute top-0 inset-x-0 transform -translate-y-1/2 flex justify-center">
                                <span className="bg-purple-600 text-white text-xs font-bold uppercase tracking-wider py-1 px-3 rounded-full">
                                    Most Popular
                                </span>
                            </div>
                        )}

                        <div className="p-6 border-b border-gray-100 flex-1">
                            <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold mb-4 ${plan.color}`}>
                                {plan.name}
                            </span>
                            <div className="flex items-baseline mb-2">
                                <span className="text-4xl font-extrabold text-gray-900">{plan.price}</span>
                                <span className="text-gray-500 ml-1 font-medium">{plan.period}</span>
                            </div>
                            <p className="text-sm text-gray-500 min-h-[40px]">{plan.description}</p>
                        </div>

                        <div className="p-6 bg-gray-50 rounded-b-2xl">
                            {/* Limits Section */}
                            <div className="mb-6">
                                <div className="flex justify-between items-center mb-3">
                                    <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wide">Resource Limits</h4>
                                    {editingPlan === plan.id ? (
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => handleSaveLimits(plan.id)}
                                                disabled={isUpdating}
                                                className="text-xs font-medium text-green-600 hover:text-green-800"
                                            >Save</button>
                                            <button
                                                onClick={() => setEditingPlan(null)}
                                                className="text-xs font-medium text-gray-500 hover:text-gray-700"
                                            >Cancel</button>
                                        </div>
                                    ) : (
                                        <button
                                            onClick={() => handleEditClick(plan)}
                                            className="text-gray-400 hover:text-primary-600 transition-colors"
                                            title="Edit Global Limits"
                                        >
                                            <Edit2 className="h-4 w-4" />
                                        </button>
                                    )}
                                </div>

                                {editingPlan === plan.id ? (
                                    <div className="space-y-3 bg-white p-3 rounded border border-primary-200">
                                        <div>
                                            <label className="block text-xs text-gray-500 mb-1">Max Students (0 = ∞)</label>
                                            <input
                                                type="number"
                                                min="0"
                                                value={editForm.students}
                                                onChange={(e) => setEditForm({ ...editForm, students: Number(e.target.value) })}
                                                className="block w-full border-gray-300 rounded text-sm focus:ring-primary-500 focus:border-primary-500"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs text-gray-500 mb-1">Max Teachers (0 = ∞)</label>
                                            <input
                                                type="number"
                                                min="0"
                                                value={editForm.teachers}
                                                onChange={(e) => setEditForm({ ...editForm, teachers: Number(e.target.value) })}
                                                className="block w-full border-gray-300 rounded text-sm focus:ring-primary-500 focus:border-primary-500"
                                            />
                                        </div>
                                    </div>
                                ) : (
                                    <ul className="space-y-2">
                                        <li className="flex justify-between text-sm">
                                            <span className="text-gray-600">Students</span>
                                            <span className="font-semibold text-gray-900">{plan.limits.students === 0 ? 'Unlimited' : plan.limits.students.toLocaleString()}</span>
                                        </li>
                                        <li className="flex justify-between text-sm">
                                            <span className="text-gray-600">Teachers</span>
                                            <span className="font-semibold text-gray-900">{plan.limits.teachers === 0 ? 'Unlimited' : plan.limits.teachers.toLocaleString()}</span>
                                        </li>
                                    </ul>
                                )}
                            </div>

                            {/* Features Array */}
                            <div>
                                <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wide mb-3">Included Features</h4>
                                <ul className="space-y-3">
                                    {plan.features.map((feature, idx) => (
                                        <li key={idx} className="flex items-start text-sm">
                                            <Check className="h-5 w-5 text-green-500 mr-2 flex-shrink-0" />
                                            <span className="text-gray-700">{feature}</span>
                                        </li>
                                    ))}
                                    {plan.missing.map((feature, idx) => (
                                        <li key={idx} className="flex items-start text-sm opacity-50">
                                            <X className="h-5 w-5 text-gray-400 mr-2 flex-shrink-0" />
                                            <span className="text-gray-500 line-through">{feature}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>

                        </div>
                    </div>
                ))}
            </div>

        </div>
    )
}

export default SuperAdminPlans
