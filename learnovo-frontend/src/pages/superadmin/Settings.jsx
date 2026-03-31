import { useState, useEffect } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { superAdminService } from '../../services/superAdminService'
import toast from 'react-hot-toast'
import {
  Globe, Mail, CreditCard, HardDrive, Wrench, FileText,
  Save, RefreshCw, Eye, EyeOff, AlertTriangle, Info, CheckCircle, XCircle
} from 'lucide-react'

const sections = [
  { id: 'general', label: 'General', icon: Globe },
  { id: 'email', label: 'Email', icon: Mail },
  { id: 'payment', label: 'Payment', icon: CreditCard },
  { id: 'storage', label: 'Storage', icon: HardDrive },
  { id: 'maintenance', label: 'Maintenance', icon: Wrench },
  { id: 'legal', label: 'Legal', icon: FileText }
]

const FormField = ({ label, value, onChange, type = 'text', placeholder, multiline, rows = 3, disabled, children }) => {
  const [showPassword, setShowPassword] = useState(false)

  if (children) {
    return (
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-[#8E8E93] mb-1">{label}</label>
        {children}
      </div>
    )
  }

  if (multiline) {
    return (
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-[#8E8E93] mb-1">{label}</label>
        <textarea
          value={value || ''}
          onChange={e => onChange(e.target.value)}
          className="input w-full resize-none"
          rows={rows}
          placeholder={placeholder}
          disabled={disabled}
        />
      </div>
    )
  }

  if (type === 'password') {
    return (
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-[#8E8E93] mb-1">{label}</label>
        <div className="relative">
          <input
            type={showPassword ? 'text' : 'password'}
            autoComplete="new-password"
            value={value || ''}
            onChange={e => onChange(e.target.value)}
            className="input w-full pr-10"
            placeholder={placeholder}
            disabled={disabled}
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 dark:text-[#8E8E93] mb-1">{label}</label>
      <input
        type={type}
        autoComplete="off"
        value={value || ''}
        onChange={e => onChange(e.target.value)}
        className="input w-full"
        placeholder={placeholder}
        disabled={disabled}
      />
    </div>
  )
}

const PlatformSettings = () => {
  const [activeSection, setActiveSection] = useState('general')
  const [formData, setFormData] = useState({})

  const { data: settings, isLoading, error, refetch } = useQuery({
    queryKey: ['superadmin-settings'],
    queryFn: async () => {
      const res = await superAdminService.getSettings()
      return res.data
    },
  })

  useEffect(() => {
    if (settings) setFormData(settings)
  }, [settings])

  const saveMutation = useMutation({
    mutationFn: (sectionData) => superAdminService.updateSettings(sectionData),
    onSuccess: () => toast.success('Settings saved successfully'),
    onError: (err) => toast.error(err.response?.data?.message || 'Failed to save settings'),
  })

  const testEmailMutation = useMutation({
    mutationFn: () => superAdminService.testEmailConfig(),
    onSuccess: () => toast.success('Test email sent successfully'),
    onError: (err) => toast.error(err.response?.data?.message || 'Email test failed'),
  })

  const testPaymentMutation = useMutation({
    mutationFn: () => superAdminService.testPaymentGateway(),
    onSuccess: () => toast.success('Payment gateway connection successful'),
    onError: (err) => toast.error(err.response?.data?.message || 'Payment gateway test failed'),
  })

  const handleSave = (section) => {
    const sectionData = { [section]: formData[section] }
    saveMutation.mutate(sectionData)
  }

  const updateField = (section, field, value) => {
    setFormData(prev => ({
      ...prev,
      [section]: { ...prev[section], [field]: value }
    }))
  }

  const updateNestedField = (section, parent, field, value) => {
    setFormData(prev => ({
      ...prev,
      [section]: {
        ...prev[section],
        [parent]: { ...prev[section]?.[parent], [field]: value }
      }
    }))
  }

  if (isLoading) {
    return (
      <div className="space-y-4 sm:space-y-6">
        <div className="h-8 w-48 bg-gray-200/60 rounded-xl animate-pulse dark:bg-[#2C2C2E]" />
        <div className="flex flex-col lg:flex-row gap-4 sm:gap-6">
          <div className="w-full lg:w-56 flex-shrink-0">
            <div className="card p-2">
              <div className="flex lg:flex-col gap-1 overflow-x-auto">
                {[1, 2, 3, 4, 5, 6].map(i => (
                  <div key={i} className="h-10 min-w-[80px] lg:min-w-0 bg-gray-200/60 rounded-xl animate-pulse dark:bg-[#2C2C2E]" />
                ))}
              </div>
            </div>
          </div>
          <div className="flex-1 space-y-4">
            <div className="h-12 bg-gray-200/60 rounded-xl animate-pulse dark:bg-[#2C2C2E]" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[1, 2, 3, 4, 5, 6].map(i => (
                <div key={i} className="h-16 bg-gray-200/60 rounded-xl animate-pulse dark:bg-[#2C2C2E]" />
              ))}
            </div>
            <div className="h-10 w-32 bg-gray-200/60 rounded-xl animate-pulse dark:bg-[#2C2C2E]" />
          </div>
        </div>
      </div>
    )
  }

  const general = formData.general || {}
  const email = formData.email || {}
  const payment = formData.payment || {}
  const storage = formData.storage || {}
  const maintenance = formData.maintenance || {}
  const legal = formData.legal || {}

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">Platform Settings</h1>
          <p className="text-sm text-gray-500 dark:text-[#8E8E93] mt-1">Configure platform-wide settings and defaults</p>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-3 sm:p-4 flex items-center justify-between">
          <p className="text-sm text-red-700 dark:text-red-400 truncate">
            {error.response?.data?.message || error.message || 'Failed to load settings'}
          </p>
          <button onClick={() => refetch()} className="text-red-600 hover:text-red-800 flex-shrink-0 ml-3">
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      )}

      <div className="flex flex-col lg:flex-row gap-4 sm:gap-6">
        {/* Sidebar / Tab navigation */}
        <div className="w-full lg:w-56 flex-shrink-0">
          <div className="card p-2 lg:sticky lg:top-4">
            <div className="flex lg:flex-col gap-1 overflow-x-auto pb-1 lg:pb-0 lg:overflow-x-visible">
              {sections.map(sec => (
                <button
                  key={sec.id}
                  onClick={() => setActiveSection(sec.id)}
                  className={`flex items-center gap-2.5 px-3 py-2 text-sm rounded-lg transition-colors whitespace-nowrap flex-shrink-0 lg:flex-shrink lg:w-full ${
                    activeSection === sec.id
                      ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 font-medium'
                      : 'text-gray-600 dark:text-[#8E8E93] hover:bg-gray-50 dark:hover:bg-[#2C2C2E]'
                  }`}
                >
                  <sec.icon className="h-4 w-4 flex-shrink-0" />
                  {sec.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Content area */}
        <div className="flex-1 card p-4 sm:p-6">

          {/* ==================== GENERAL ==================== */}
          {activeSection === 'general' && (
            <div className="space-y-4">
              <h2 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white mb-4">General Settings</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  label="Platform Name"
                  value={general.platformName}
                  onChange={v => updateField('general', 'platformName', v)}
                  placeholder="Learnovo"
                />
                <FormField
                  label="Tagline"
                  value={general.tagline}
                  onChange={v => updateField('general', 'tagline', v)}
                  placeholder="Your school management platform"
                />
                <FormField
                  label="Support Email"
                  value={general.supportEmail}
                  onChange={v => updateField('general', 'supportEmail', v)}
                  type="email"
                  placeholder="support@learnovo.com"
                />
                <FormField
                  label="Support Phone"
                  value={general.supportPhone}
                  onChange={v => updateField('general', 'supportPhone', v)}
                  type="tel"
                  placeholder="+91 XXXXX XXXXX"
                />
                <FormField
                  label="Primary Domain"
                  value={general.primaryDomain}
                  onChange={v => updateField('general', 'primaryDomain', v)}
                  placeholder="https://app.learnovo.com"
                />
              </div>

              {/* Social Links */}
              <div className="pt-2">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Social Links</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    label="Twitter URL"
                    value={general.socialLinks?.twitter}
                    onChange={v => updateNestedField('general', 'socialLinks', 'twitter', v)}
                    placeholder="https://twitter.com/learnovo"
                  />
                  <FormField
                    label="LinkedIn URL"
                    value={general.socialLinks?.linkedin}
                    onChange={v => updateNestedField('general', 'socialLinks', 'linkedin', v)}
                    placeholder="https://linkedin.com/company/learnovo"
                  />
                  <FormField
                    label="Facebook URL"
                    value={general.socialLinks?.facebook}
                    onChange={v => updateNestedField('general', 'socialLinks', 'facebook', v)}
                    placeholder="https://facebook.com/learnovo"
                  />
                  <FormField
                    label="Instagram URL"
                    value={general.socialLinks?.instagram}
                    onChange={v => updateNestedField('general', 'socialLinks', 'instagram', v)}
                    placeholder="https://instagram.com/learnovo"
                  />
                </div>
              </div>

              <div className="pt-4">
                <button
                  onClick={() => handleSave('general')}
                  disabled={saveMutation.isPending}
                  className="btn btn-primary flex items-center gap-2 disabled:opacity-50"
                >
                  <Save className="h-4 w-4" />
                  {saveMutation.isPending ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>
          )}

          {/* ==================== EMAIL ==================== */}
          {activeSection === 'email' && (
            <div className="space-y-4">
              <h2 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white mb-4">Email Configuration</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  label="SMTP Host"
                  value={email.host}
                  onChange={v => updateField('email', 'host', v)}
                  placeholder="smtp.gmail.com"
                />
                <FormField
                  label="SMTP Port"
                  value={email.port}
                  onChange={v => updateField('email', 'port', parseInt(v) || '')}
                  type="number"
                  placeholder="587"
                />
                <div className="flex items-center gap-3 md:col-span-2">
                  <input
                    type="checkbox"
                    checked={email.secure ?? false}
                    onChange={e => updateField('email', 'secure', e.target.checked)}
                    className="rounded text-primary-500"
                    id="email-secure"
                  />
                  <label htmlFor="email-secure" className="text-sm font-medium text-gray-700 dark:text-[#8E8E93]">
                    Secure (TLS)
                  </label>
                </div>
                <FormField
                  label="Username"
                  value={email.username}
                  onChange={v => updateField('email', 'username', v)}
                  placeholder="your-email@gmail.com"
                />
                <FormField
                  label="Password"
                  value={email.password}
                  onChange={v => updateField('email', 'password', v)}
                  type="password"
                  placeholder="App password or SMTP password"
                />
                <FormField
                  label="From Email Address"
                  value={email.fromEmail}
                  onChange={v => updateField('email', 'fromEmail', v)}
                  type="email"
                  placeholder="noreply@learnovo.com"
                />
              </div>

              <div className="flex flex-wrap items-center gap-3 pt-4">
                <button
                  onClick={() => handleSave('email')}
                  disabled={saveMutation.isPending}
                  className="btn btn-primary flex items-center gap-2 disabled:opacity-50"
                >
                  <Save className="h-4 w-4" />
                  {saveMutation.isPending ? 'Saving...' : 'Save Changes'}
                </button>
                <button
                  onClick={() => testEmailMutation.mutate()}
                  disabled={testEmailMutation.isPending}
                  className="btn btn-outline flex items-center gap-2 disabled:opacity-50"
                >
                  <Mail className="h-4 w-4" />
                  {testEmailMutation.isPending ? 'Sending...' : 'Send Test Email'}
                </button>
              </div>
            </div>
          )}

          {/* ==================== PAYMENT ==================== */}
          {activeSection === 'payment' && (
            <div className="space-y-4">
              <h2 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white mb-4">Payment Gateway</h2>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-[#8E8E93] mb-1">Payment Gateway</label>
                <select
                  value={payment.gateway || 'none'}
                  onChange={e => updateField('payment', 'gateway', e.target.value)}
                  className="input w-full"
                >
                  <option value="razorpay">Razorpay</option>
                  <option value="stripe">Stripe</option>
                  <option value="payu">PayU</option>
                  <option value="none">None</option>
                </select>
              </div>

              {payment.gateway === 'razorpay' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    label="Key ID"
                    value={payment.razorpayKeyId}
                    onChange={v => updateField('payment', 'razorpayKeyId', v)}
                    type="password"
                    placeholder="rzp_live_..."
                  />
                  <FormField
                    label="Key Secret"
                    value={payment.razorpayKeySecret}
                    onChange={v => updateField('payment', 'razorpayKeySecret', v)}
                    type="password"
                    placeholder="Enter key secret"
                  />
                </div>
              )}

              {payment.gateway === 'stripe' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    label="Publishable Key"
                    value={payment.stripePublishableKey}
                    onChange={v => updateField('payment', 'stripePublishableKey', v)}
                    type="password"
                    placeholder="pk_live_..."
                  />
                  <FormField
                    label="Secret Key"
                    value={payment.stripeSecretKey}
                    onChange={v => updateField('payment', 'stripeSecretKey', v)}
                    type="password"
                    placeholder="sk_live_..."
                  />
                </div>
              )}

              {payment.gateway === 'payu' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    label="Merchant Key"
                    value={payment.payuMerchantKey}
                    onChange={v => updateField('payment', 'payuMerchantKey', v)}
                    type="password"
                    placeholder="Enter merchant key"
                  />
                  <FormField
                    label="Merchant Salt"
                    value={payment.payuMerchantSalt}
                    onChange={v => updateField('payment', 'payuMerchantSalt', v)}
                    type="password"
                    placeholder="Enter merchant salt"
                  />
                </div>
              )}

              {payment.gateway === 'none' && (
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4 flex items-start gap-3">
                  <Info className="h-5 w-5 text-blue-500 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-blue-700 dark:text-blue-400">
                    No payment gateway configured. Tenants will not be able to process online payments.
                  </p>
                </div>
              )}

              {payment.gateway && payment.gateway !== 'none' && (
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={payment.testMode ?? true}
                    onChange={e => updateField('payment', 'testMode', e.target.checked)}
                    className="rounded text-primary-500"
                    id="payment-test-mode"
                  />
                  <label htmlFor="payment-test-mode" className="text-sm font-medium text-gray-700 dark:text-[#8E8E93]">
                    Test Mode
                  </label>
                </div>
              )}

              <div className="flex flex-wrap items-center gap-3 pt-4">
                <button
                  onClick={() => handleSave('payment')}
                  disabled={saveMutation.isPending}
                  className="btn btn-primary flex items-center gap-2 disabled:opacity-50"
                >
                  <Save className="h-4 w-4" />
                  {saveMutation.isPending ? 'Saving...' : 'Save Changes'}
                </button>
                {payment.gateway && payment.gateway !== 'none' && (
                  <button
                    onClick={() => testPaymentMutation.mutate()}
                    disabled={testPaymentMutation.isPending}
                    className="btn btn-outline flex items-center gap-2 disabled:opacity-50"
                  >
                    <CreditCard className="h-4 w-4" />
                    {testPaymentMutation.isPending ? 'Testing...' : 'Test Connection'}
                  </button>
                )}
              </div>
            </div>
          )}

          {/* ==================== STORAGE ==================== */}
          {activeSection === 'storage' && (
            <div className="space-y-4">
              <h2 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white mb-4">Storage Configuration</h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Cloudinary status */}
                <div className="card p-4 sm:p-5 border border-gray-100 dark:border-[#38383A]">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Cloudinary</h3>
                    {storage.cloudinary?.connected ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                        <CheckCircle className="h-3 w-3" /> Connected
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                        <XCircle className="h-3 w-3" /> Not Connected
                      </span>
                    )}
                  </div>
                  {storage.cloudinary?.usage != null && (
                    <div className="mt-3">
                      <div className="flex items-center justify-between text-xs text-gray-500 dark:text-[#8E8E93] mb-1">
                        <span>Storage Used</span>
                        <span>{storage.cloudinary.usage} / {storage.cloudinary.total || 'N/A'}</span>
                      </div>
                      {storage.cloudinary.total && (
                        <div className="w-full bg-gray-100 dark:bg-[#2C2C2E] rounded-full h-2">
                          <div
                            className="h-2 rounded-full bg-primary-500 transition-all"
                            style={{ width: `${Math.min(100, (parseFloat(storage.cloudinary.usage) / parseFloat(storage.cloudinary.total)) * 100)}%` }}
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* AWS S3 status */}
                <div className="card p-4 sm:p-5 border border-gray-100 dark:border-[#38383A]">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white">AWS S3</h3>
                    {storage.s3?.connected ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                        <CheckCircle className="h-3 w-3" /> Connected
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                        <XCircle className="h-3 w-3" /> Not Connected
                      </span>
                    )}
                  </div>
                  {storage.s3?.usage != null && (
                    <div className="mt-3">
                      <div className="flex items-center justify-between text-xs text-gray-500 dark:text-[#8E8E93] mb-1">
                        <span>Storage Used</span>
                        <span>{storage.s3.usage} / {storage.s3.total || 'N/A'}</span>
                      </div>
                      {storage.s3.total && (
                        <div className="w-full bg-gray-100 dark:bg-[#2C2C2E] rounded-full h-2">
                          <div
                            className="h-2 rounded-full bg-primary-500 transition-all"
                            style={{ width: `${Math.min(100, (parseFloat(storage.s3.usage) / parseFloat(storage.s3.total)) * 100)}%` }}
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4 flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-amber-700 dark:text-amber-400">
                  Storage configuration is managed via environment variables and cannot be changed from this UI.
                </p>
              </div>
            </div>
          )}

          {/* ==================== MAINTENANCE ==================== */}
          {activeSection === 'maintenance' && (
            <div className="space-y-4">
              <h2 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white mb-4">Maintenance Mode</h2>

              <div className="flex items-center gap-4">
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={maintenance.isEnabled ?? false}
                    onChange={e => updateField('maintenance', 'isEnabled', e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-14 h-7 bg-gray-200 dark:bg-[#38383A] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[4px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-red-500" />
                </label>
                <span className="text-sm font-semibold text-gray-900 dark:text-white">
                  {maintenance.isEnabled ? 'Maintenance Mode ON' : 'Maintenance Mode OFF'}
                </span>
              </div>

              {maintenance.isEnabled && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-700 dark:text-red-400 font-medium">
                    All school portals will show a maintenance page
                  </p>
                </div>
              )}

              <FormField
                label="Maintenance Message"
                value={maintenance.message}
                onChange={v => updateField('maintenance', 'message', v)}
                multiline
                rows={4}
                placeholder="We are currently performing scheduled maintenance. Please check back shortly."
              />

              <FormField
                label="Maintenance End Time"
                value={maintenance.endTime}
                onChange={v => updateField('maintenance', 'endTime', v)}
                type="datetime-local"
              />

              <div className="pt-4">
                <button
                  onClick={() => handleSave('maintenance')}
                  disabled={saveMutation.isPending}
                  className="btn btn-primary flex items-center gap-2 disabled:opacity-50"
                >
                  <Save className="h-4 w-4" />
                  {saveMutation.isPending ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>
          )}

          {/* ==================== LEGAL ==================== */}
          {activeSection === 'legal' && (
            <div className="space-y-6">
              <h2 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white mb-4">Legal & Policies</h2>

              {/* Terms of Service */}
              <div className="space-y-2">
                <FormField
                  label="Terms of Service"
                  value={legal.termsOfService}
                  onChange={v => updateField('legal', 'termsOfService', v)}
                  multiline
                  rows={8}
                  placeholder="Enter your terms of service..."
                />
                {legal.termsOfServiceUpdatedAt && (
                  <p className="text-xs text-gray-400 dark:text-[#636366]">
                    Last updated: {new Date(legal.termsOfServiceUpdatedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </p>
                )}
                <button
                  onClick={() => saveMutation.mutate({ legal: { termsOfService: legal.termsOfService } })}
                  disabled={saveMutation.isPending}
                  className="btn btn-primary btn-sm flex items-center gap-2 disabled:opacity-50"
                >
                  <Save className="h-3.5 w-3.5" />
                  {saveMutation.isPending ? 'Saving...' : 'Save Terms of Service'}
                </button>
              </div>

              <hr className="border-gray-100 dark:border-[#38383A]" />

              {/* Privacy Policy */}
              <div className="space-y-2">
                <FormField
                  label="Privacy Policy"
                  value={legal.privacyPolicy}
                  onChange={v => updateField('legal', 'privacyPolicy', v)}
                  multiline
                  rows={8}
                  placeholder="Enter your privacy policy..."
                />
                {legal.privacyPolicyUpdatedAt && (
                  <p className="text-xs text-gray-400 dark:text-[#636366]">
                    Last updated: {new Date(legal.privacyPolicyUpdatedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </p>
                )}
                <button
                  onClick={() => saveMutation.mutate({ legal: { privacyPolicy: legal.privacyPolicy } })}
                  disabled={saveMutation.isPending}
                  className="btn btn-primary btn-sm flex items-center gap-2 disabled:opacity-50"
                >
                  <Save className="h-3.5 w-3.5" />
                  {saveMutation.isPending ? 'Saving...' : 'Save Privacy Policy'}
                </button>
              </div>

              <hr className="border-gray-100 dark:border-[#38383A]" />

              {/* Refund Policy */}
              <div className="space-y-2">
                <FormField
                  label="Refund Policy"
                  value={legal.refundPolicy}
                  onChange={v => updateField('legal', 'refundPolicy', v)}
                  multiline
                  rows={6}
                  placeholder="Enter your refund policy..."
                />
                {legal.refundPolicyUpdatedAt && (
                  <p className="text-xs text-gray-400 dark:text-[#636366]">
                    Last updated: {new Date(legal.refundPolicyUpdatedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </p>
                )}
                <button
                  onClick={() => saveMutation.mutate({ legal: { refundPolicy: legal.refundPolicy } })}
                  disabled={saveMutation.isPending}
                  className="btn btn-primary btn-sm flex items-center gap-2 disabled:opacity-50"
                >
                  <Save className="h-3.5 w-3.5" />
                  {saveMutation.isPending ? 'Saving...' : 'Save Refund Policy'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default PlatformSettings
