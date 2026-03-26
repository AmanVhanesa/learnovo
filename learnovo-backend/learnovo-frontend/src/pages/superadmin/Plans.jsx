import React, { useState } from 'react'
import { Check, X, Zap, Shield, Star, Building2, Info, ChevronDown, ChevronUp } from 'lucide-react'

// ── Single source of truth for plans (mirrors backend utils/planConfig.js) ──
const PLANS = [
    {
        id: 'free_trial',
        name: 'Free Trial',
        price: 0,
        priceDisplay: '₹0',
        period: '/ 14 days',
        description: 'Try Learnovo free for 14 days. No credit card required.',
        color: 'text-gray-700 bg-gray-100',
        borderClass: 'border-gray-200',
        icon: Star,
        limits: { students: 50, teachers: 5 },
        features: {
            // Core
            'Core Academics (Students, Teachers, Classes)': true,
            'Attendance Tracking': true,
            'Timetable Management': true,
            'Homework & Assignments': true,
            'Notices & Announcements': true,
            // Grades
            'Grades & Results': false,
            'Exams Management': false,
            'Result Cards / Report Cards': false,
            // Finance
            'Fees & Finance': false,
            'Fee Receipts (PDF)': false,
            // Analytics
            'Basic Reports': false,
            'Advanced Analytics': false,
            'Custom Reports': false,
            // Integrations
            'CSV Import': false,
            'API Access': false,
            'Custom Integrations': false,
            // Support
            'Email Support': true,
            'Priority Support': false,
            'Phone Support': false,
            'Dedicated Account Manager': false,
        }
    },
    {
        id: 'basic',
        name: 'Basic',
        price: 2499,
        priceDisplay: '₹2,499',
        period: '/ month',
        description: 'Essential tools for small schools to go fully digital.',
        color: 'text-blue-700 bg-blue-50',
        borderClass: 'border-blue-200',
        icon: Shield,
        limits: { students: 500, teachers: 30 },
        features: {
            'Core Academics (Students, Teachers, Classes)': true,
            'Attendance Tracking': true,
            'Timetable Management': true,
            'Homework & Assignments': true,
            'Notices & Announcements': true,
            'Grades & Results': true,
            'Exams Management': true,
            'Result Cards / Report Cards': true,
            'Fees & Finance': true,
            'Fee Receipts (PDF)': true,
            'Basic Reports': true,
            'Advanced Analytics': false,
            'Custom Reports': false,
            'CSV Import': true,
            'API Access': false,
            'Custom Integrations': false,
            'Email Support': true,
            'Priority Support': false,
            'Phone Support': false,
            'Dedicated Account Manager': false,
        }
    },
    {
        id: 'pro',
        name: 'Pro',
        price: 5999,
        priceDisplay: '₹5,999',
        period: '/ month',
        description: 'Full-featured ERP for growing schools and institutions.',
        color: 'text-violet-700 bg-violet-50',
        borderClass: 'border-violet-300',
        icon: Zap,
        isPopular: true,
        limits: { students: 2000, teachers: 100 },
        features: {
            'Core Academics (Students, Teachers, Classes)': true,
            'Attendance Tracking': true,
            'Timetable Management': true,
            'Homework & Assignments': true,
            'Notices & Announcements': true,
            'Grades & Results': true,
            'Exams Management': true,
            'Result Cards / Report Cards': true,
            'Fees & Finance': true,
            'Fee Receipts (PDF)': true,
            'Basic Reports': true,
            'Advanced Analytics': true,
            'Custom Reports': true,
            'CSV Import': true,
            'API Access': true,
            'Custom Integrations': false,
            'Email Support': true,
            'Priority Support': true,
            'Phone Support': true,
            'Dedicated Account Manager': false,
        }
    },
    {
        id: 'enterprise',
        name: 'Enterprise',
        price: null,
        priceDisplay: 'Custom',
        period: '/ year',
        description: 'Unlimited capacity, dedicated support & custom integrations.',
        color: 'text-amber-700 bg-amber-50',
        borderClass: 'border-amber-300',
        icon: Building2,
        limits: { students: 0, teachers: 0 }, // 0 = unlimited
        features: {
            'Core Academics (Students, Teachers, Classes)': true,
            'Attendance Tracking': true,
            'Timetable Management': true,
            'Homework & Assignments': true,
            'Notices & Announcements': true,
            'Grades & Results': true,
            'Exams Management': true,
            'Result Cards / Report Cards': true,
            'Fees & Finance': true,
            'Fee Receipts (PDF)': true,
            'Basic Reports': true,
            'Advanced Analytics': true,
            'Custom Reports': true,
            'CSV Import': true,
            'API Access': true,
            'Custom Integrations': true,
            'Email Support': true,
            'Priority Support': true,
            'Phone Support': true,
            'Dedicated Account Manager': true,
        }
    }
]

// Feature groups for the comparison table
const FEATURE_GROUPS = [
    {
        label: 'Core Modules',
        features: [
            'Core Academics (Students, Teachers, Classes)',
            'Attendance Tracking',
            'Timetable Management',
            'Homework & Assignments',
            'Notices & Announcements',
        ]
    },
    {
        label: 'Academics',
        features: [
            'Grades & Results',
            'Exams Management',
            'Result Cards / Report Cards',
        ]
    },
    {
        label: 'Finance',
        features: [
            'Fees & Finance',
            'Fee Receipts (PDF)',
        ]
    },
    {
        label: 'Analytics & Reports',
        features: [
            'Basic Reports',
            'Advanced Analytics',
            'Custom Reports',
        ]
    },
    {
        label: 'Integrations',
        features: [
            'CSV Import',
            'API Access',
            'Custom Integrations',
        ]
    },
    {
        label: 'Support',
        features: [
            'Email Support',
            'Priority Support',
            'Phone Support',
            'Dedicated Account Manager',
        ]
    }
]

const SuperAdminPlans = () => {
    const [showTable, setShowTable] = useState(false)

    const planColors = {
        free_trial: { check: 'text-gray-500', row: '' },
        basic: { check: 'text-blue-500', row: '' },
        pro: { check: 'text-violet-500', row: '' },
        enterprise: { check: 'text-amber-500', row: '' },
    }

    return (
        <div className="space-y-8">
            {/* Page Header */}
            <div>
                <h1 className="text-2xl font-bold text-gray-900">Subscription Plans</h1>
                <p className="mt-1 text-sm text-gray-500">
                    Global subscription tiers, pricing, limits, and feature access.
                </p>
            </div>

            {/* Info Banner */}
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex items-start gap-3">
                <Info className="h-5 w-5 text-blue-500 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-blue-700">
                    <span className="font-semibold">Read-only overview.</span> Plan pricing and features are configured in the backend. To apply
                    custom limits for a specific school, use the <strong>Override Limits</strong> option inside their Tenant panel.
                </div>
            </div>

            {/* Plan Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5 items-stretch">
                {PLANS.map((plan) => {
                    const Icon = plan.icon
                    return (
                        <div
                            key={plan.id}
                            className={`relative bg-white rounded-2xl border-2 flex flex-col ${plan.borderClass} ${plan.isPopular ? 'shadow-lg shadow-violet-100 ring-2 ring-violet-400 ring-offset-2' : 'shadow-sm'}`}
                        >
                            {plan.isPopular && (
                                <div className="absolute -top-3.5 inset-x-0 flex justify-center">
                                    <span className="bg-gradient-to-r from-violet-600 to-purple-600 text-white text-[11px] font-bold tracking-wider uppercase px-4 py-1 rounded-full shadow">
                                        Most Popular
                                    </span>
                                </div>
                            )}

                            {/* Header */}
                            <div className="p-6 border-b border-gray-100">
                                <div className="flex items-center gap-2 mb-4">
                                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${plan.color}`}>
                                        <Icon className="h-4 w-4" />
                                    </div>
                                    <span className={`text-sm font-bold px-2.5 py-0.5 rounded-full ${plan.color}`}>{plan.name}</span>
                                </div>
                                <div className="flex items-baseline gap-1 mb-1">
                                    <span className="text-3xl font-extrabold text-gray-900">{plan.priceDisplay}</span>
                                    <span className="text-sm text-gray-400 font-medium">{plan.period}</span>
                                </div>
                                <p className="text-xs text-gray-500 mt-2 leading-relaxed">{plan.description}</p>
                            </div>

                            {/* Limits */}
                            <div className="px-6 py-4 bg-gray-50 border-b border-gray-100">
                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">Limits</p>
                                <div className="grid grid-cols-2 gap-2 text-sm">
                                    <div>
                                        <p className="text-gray-500 text-xs">Students</p>
                                        <p className="font-bold text-gray-900">{plan.limits.students === 0 ? '∞' : plan.limits.students.toLocaleString()}</p>
                                    </div>
                                    <div>
                                        <p className="text-gray-500 text-xs">Teachers</p>
                                        <p className="font-bold text-gray-900">{plan.limits.teachers === 0 ? '∞' : plan.limits.teachers.toLocaleString()}</p>
                                    </div>
                                </div>
                            </div>

                            {/* Features */}
                            <div className="px-6 py-4 flex-1">
                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">Features</p>
                                <ul className="space-y-2">
                                    {Object.entries(plan.features).map(([feature, enabled]) => (
                                        <li key={feature} className="flex items-start gap-2">
                                            {enabled
                                                ? <Check className={`h-4 w-4 mt-0.5 flex-shrink-0 ${planColors[plan.id].check}`} />
                                                : <X className="h-4 w-4 mt-0.5 flex-shrink-0 text-gray-300" />
                                            }
                                            <span className={`text-xs ${enabled ? 'text-gray-700' : 'text-gray-400 line-through'}`}>
                                                {feature}
                                            </span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                    )
                })}
            </div>

            {/* Feature Comparison Table Toggle */}
            <div>
                <button
                    onClick={() => setShowTable(!showTable)}
                    className="flex items-center gap-2 text-sm font-semibold text-primary-600 hover:text-primary-700 transition-colors"
                >
                    {showTable ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    {showTable ? 'Hide' : 'Show'} Full Feature Comparison Table
                </button>

                {showTable && (
                    <div className="mt-4 bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="bg-gray-50 border-b border-gray-200">
                                        <th className="text-left px-4 py-3 text-xs font-bold text-gray-700 w-56">Feature</th>
                                        {PLANS.map(p => (
                                            <th key={p.id} className="text-center px-4 py-3">
                                                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${p.color}`}>{p.name}</span>
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {FEATURE_GROUPS.map(group => (
                                        <React.Fragment key={group.label}>
                                            <tr className="bg-gray-50/70 border-y border-gray-100">
                                                <td colSpan={5} className="px-4 py-2 text-[11px] font-bold uppercase tracking-widest text-gray-400">
                                                    {group.label}
                                                </td>
                                            </tr>
                                            {group.features.map(feature => (
                                                <tr key={feature} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                                                    <td className="px-4 py-3 text-xs text-gray-700">{feature}</td>
                                                    {PLANS.map(p => (
                                                        <td key={p.id} className="text-center px-4 py-3">
                                                            {p.features[feature]
                                                                ? <Check className={`h-4 w-4 mx-auto ${planColors[p.id].check}`} />
                                                                : <X className="h-4 w-4 mx-auto text-gray-200" />
                                                            }
                                                        </td>
                                                    ))}
                                                </tr>
                                            ))}
                                        </React.Fragment>
                                    ))}
                                    {/* Limits rows */}
                                    <tr className="bg-gray-50/70 border-y border-gray-100">
                                        <td colSpan={5} className="px-4 py-2 text-[11px] font-bold uppercase tracking-widest text-gray-400">Limits</td>
                                    </tr>
                                    {['students', 'teachers'].map(key => (
                                        <tr key={key} className="border-b border-gray-50 hover:bg-gray-50/50">
                                            <td className="px-4 py-3 text-xs text-gray-700 capitalize">Max {key}</td>
                                            {PLANS.map(p => (
                                                <td key={p.id} className="text-center px-4 py-3 text-xs font-semibold text-gray-700">
                                                    {p.limits[key] === 0 ? '∞' : p.limits[key].toLocaleString()}
                                                </td>
                                            ))}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}

export default SuperAdminPlans
