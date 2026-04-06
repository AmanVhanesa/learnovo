import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Lock, ArrowRight, Crown, Zap, Star, Check, LogOut } from 'lucide-react'
import { motion } from 'framer-motion'
import { useAuth } from '../contexts/AuthContext'
import { useTheme } from '../contexts/ThemeContext'
import { tenantService } from '../services/tenantService'
import toast from 'react-hot-toast'

const AccountLocked = () => {
  const navigate = useNavigate()
  const { tenant, logout } = useAuth()
  const { theme } = useTheme()
  const isDark = theme?.mode === 'dark'
  const [selectedPlan, setSelectedPlan] = useState('basic')
  const [billingCycle, setBillingCycle] = useState('monthly')
  const [processing, setProcessing] = useState(false)

  const PLAN_OPTIONS = [
    {
      id: 'basic',
      name: 'Basic',
      price: 2999,
      yearlyPrice: Math.round(2999 * 12 * 0.8),
      icon: Zap,
      color: '#3EC4B1',
      popular: true,
      features: ['Up to 500 students', '30 teachers', 'Grades & Exams', 'Fees & Finance', 'CSV Import', 'Parent Portal']
    },
    {
      id: 'pro',
      name: 'Pro',
      price: 6999,
      yearlyPrice: Math.round(6999 * 12 * 0.8),
      icon: Crown,
      color: '#F59E0B',
      features: ['Up to 2,000 students', '100 teachers', 'Advanced Analytics', 'Payment Gateway', 'SMS & WhatsApp', 'Priority Support']
    }
  ]

  // Load Razorpay script
  useEffect(() => {
    if (document.getElementById('razorpay-checkout-script')) return
    const script = document.createElement('script')
    script.id = 'razorpay-checkout-script'
    script.src = 'https://checkout.razorpay.com/v1/checkout.js'
    script.async = true
    document.body.appendChild(script)
  }, [])

  const handlePayment = async () => {
    setProcessing(true)

    try {
      const orderData = await tenantService.createRegistrationOrder({
        plan: selectedPlan,
        billingCycle
      })

      if (!orderData.success) {
        toast.error(orderData.message || 'Failed to create payment order')
        return
      }

      const { orderId, amount, currency, keyId, mock } = orderData.data

      if (mock) {
        // Mock payment for dev
        const api = (await import('../services/authService')).default
        const verifyRes = await api.post('/payments/verify', {
          orderId,
          paymentId: `mock_pay_${Date.now()}`,
          signature: 'mock_signature',
          plan: selectedPlan,
          billingCycle
        })
        if (verifyRes.data?.success) {
          toast.success('Subscription activated!')
          // Update tenant in localStorage and navigate
          const storedTenant = JSON.parse(localStorage.getItem('tenant') || '{}')
          storedTenant.subscription = verifyRes.data.data.subscription
          localStorage.setItem('tenant', JSON.stringify(storedTenant))
          window.location.href = '/app/dashboard'
        }
        return
      }

      const options = {
        key: keyId,
        amount,
        currency: currency || 'INR',
        name: 'Learnovo',
        description: `${selectedPlan.charAt(0).toUpperCase() + selectedPlan.slice(1)} Plan - ${billingCycle === 'yearly' ? 'Annual' : 'Monthly'}`,
        order_id: orderId,
        handler: async (response) => {
          try {
            const api = (await import('../services/authService')).default
            const verifyRes = await api.post('/payments/verify', {
              orderId: response.razorpay_order_id,
              paymentId: response.razorpay_payment_id,
              signature: response.razorpay_signature,
              plan: selectedPlan,
              billingCycle
            })
            if (verifyRes.data?.success) {
              toast.success('Subscription activated! Welcome back!')
              const storedTenant = JSON.parse(localStorage.getItem('tenant') || '{}')
              storedTenant.subscription = verifyRes.data.data.subscription
              localStorage.setItem('tenant', JSON.stringify(storedTenant))
              window.location.href = '/app/dashboard'
            }
          } catch {
            toast.error('Payment successful but activation failed. Please contact support.')
          } finally {
            setProcessing(false)
          }
        },
        prefill: {
          email: tenant?.email || ''
        },
        theme: { color: '#3EC4B1' },
        modal: {
          ondismiss: () => setProcessing(false)
        }
      }

      const rzp = new window.Razorpay(options)
      rzp.on('payment.failed', (response) => {
        toast.error(response.error?.description || 'Payment failed')
        setProcessing(false)
      })
      rzp.open()
    } catch (error) {
      toast.error(error.response?.data?.message || 'Payment initialization failed')
      setProcessing(false)
    }
  }

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10"
      style={isDark ? { background: '#000000' } : { background: 'linear-gradient(150deg, #f8fffd 0%, #f0faf8 40%, #eaf6f6 100%)' }}
    >
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="w-full max-w-lg"
      >
        <div className="bg-white dark:bg-[#1C1C1E] rounded-2xl shadow-xl border border-gray-100 dark:border-[#38383A] px-6 sm:px-8 py-8">
          {/* Lock icon */}
          <div className="flex justify-center mb-5">
            <div className="h-16 w-16 rounded-2xl bg-red-50 dark:bg-red-500/10 flex items-center justify-center">
              <Lock className="h-8 w-8 text-red-500" />
            </div>
          </div>

          <h1 className="text-2xl font-bold text-center text-gray-900 dark:text-white tracking-tight mb-2">
            Account Locked
          </h1>
          <p className="text-center text-gray-500 dark:text-[#8E8E93] text-sm mb-6">
            Your free trial has expired. Choose a plan to continue using {tenant?.schoolName || 'Learnovo'}.
          </p>

          {/* Billing toggle */}
          <div className="flex items-center justify-center gap-2 mb-5">
            <button
              type="button"
              onClick={() => setBillingCycle('monthly')}
              className={`px-4 py-1.5 rounded-full text-[13px] font-medium transition-all ${
                billingCycle === 'monthly'
                  ? 'bg-[#3EC4B1] text-white shadow-md'
                  : 'bg-gray-100 dark:bg-[#2C2C2E] text-gray-500 dark:text-[#8E8E93]'
              }`}
            >
              Monthly
            </button>
            <button
              type="button"
              onClick={() => setBillingCycle('yearly')}
              className={`px-4 py-1.5 rounded-full text-[13px] font-medium transition-all inline-flex items-center gap-1.5 ${
                billingCycle === 'yearly'
                  ? 'bg-[#3EC4B1] text-white shadow-md'
                  : 'bg-gray-100 dark:bg-[#2C2C2E] text-gray-500 dark:text-[#8E8E93]'
              }`}
            >
              Yearly
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-green-500/20 text-green-600 dark:text-green-400">
                Save 20%
              </span>
            </button>
          </div>

          {/* Plan cards */}
          <div className="space-y-3 mb-6">
            {PLAN_OPTIONS.map((plan) => {
              const isSelected = selectedPlan === plan.id
              const displayPrice = billingCycle === 'yearly'
                ? Math.round((plan.yearlyPrice || plan.price * 12) / 12)
                : plan.price
              const totalYearly = plan.yearlyPrice || plan.price * 12
              const Icon = plan.icon

              return (
                <button
                  key={plan.id}
                  type="button"
                  onClick={() => setSelectedPlan(plan.id)}
                  className={`w-full text-left p-4 rounded-xl border-2 transition-all duration-200 relative ${
                    isSelected
                      ? 'border-[#3EC4B1] bg-[#3EC4B1]/5 dark:bg-[#3EC4B1]/10 shadow-md'
                      : 'border-gray-200 dark:border-[#38383A] hover:border-gray-300 dark:hover:border-[#48484A] bg-white dark:bg-[#2C2C2E]'
                  }`}
                >
                  {plan.popular && (
                    <span className="absolute -top-2.5 right-4 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-full bg-[#3EC4B1] text-white">
                      Recommended
                    </span>
                  )}
                  <div className="flex items-start gap-3">
                    <div
                      className="h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ background: `${plan.color}15`, color: plan.color }}
                    >
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <h3 className="text-[15px] font-bold text-gray-900 dark:text-white">{plan.name}</h3>
                        <div className="text-right">
                          <span className="text-[15px] font-bold text-gray-900 dark:text-white">
                            ₹{displayPrice.toLocaleString('en-IN')}
                          </span>
                          <span className="text-[11px] text-gray-400">/mo</span>
                          {billingCycle === 'yearly' && (
                            <p className="text-[10px] text-gray-400">₹{totalYearly.toLocaleString('en-IN')}/yr</p>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
                        {plan.features.map((f) => (
                          <span key={f} className="text-[11px] text-gray-500 dark:text-[#8E8E93] flex items-center gap-1">
                            <Check className="h-3 w-3 text-[#3EC4B1] flex-shrink-0" />
                            {f}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="flex-shrink-0 mt-1">
                      <div className={`h-5 w-5 rounded-full border-2 flex items-center justify-center transition-all ${
                        isSelected ? 'border-[#3EC4B1] bg-[#3EC4B1]' : 'border-gray-300 dark:border-[#48484A]'
                      }`}>
                        {isSelected && <Check className="h-3 w-3 text-white" />}
                      </div>
                    </div>
                  </div>
                </button>
              )
            })}
          </div>

          {/* Pay button */}
          <button
            onClick={handlePayment}
            disabled={processing}
            className="w-full py-3 rounded-full text-sm font-semibold text-white transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-teal-200/60 dark:hover:shadow-teal-900/40 active:scale-95 disabled:opacity-50 disabled:pointer-events-none inline-flex items-center justify-center gap-2"
            style={{ background: 'linear-gradient(135deg, #3EC4B1 0%, #0ea5a3 60%, #0b8f8f 100%)' }}
          >
            {processing ? (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
            ) : (
              <>
                Upgrade & Unlock Account
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>

          {/* Logout link */}
          <button
            onClick={handleLogout}
            className="w-full mt-3 py-2 text-[13px] text-gray-400 dark:text-[#636366] hover:text-gray-600 dark:hover:text-white transition-colors inline-flex items-center justify-center gap-1.5"
          >
            <LogOut className="h-3.5 w-3.5" />
            Sign out
          </button>

          <p className="text-center text-[11px] text-gray-300 dark:text-[#48484A] mt-4">
            Need help? <a href="mailto:evotechnologiesinnovation@gmail.com" className="hover:text-gray-500 transition-colors">evotechnologiesinnovation@gmail.com</a>
          </p>
        </div>
      </motion.div>
    </div>
  )
}

export default AccountLocked
