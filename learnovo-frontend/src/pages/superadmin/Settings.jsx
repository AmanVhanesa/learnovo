import { useState, useEffect } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { superAdminService } from '../../services/superAdminService'
import toast from 'react-hot-toast'
import { Settings as SettingsIcon, Globe, Palette, GraduationCap, Mail, MessageSquare, CreditCard, HardDrive, Languages, Wrench, FileText, Save, RefreshCw } from 'lucide-react'

const sections = [
  { id: 'general', label: 'General', icon: Globe },
  { id: 'branding', label: 'Branding', icon: Palette },
  { id: 'academics', label: 'Academic Defaults', icon: GraduationCap },
  { id: 'email', label: 'Email Config', icon: Mail },
  { id: 'sms', label: 'SMS Config', icon: MessageSquare },
  { id: 'payment', label: 'Payment Gateway', icon: CreditCard },
  { id: 'storage', label: 'Storage', icon: HardDrive },
  { id: 'localization', label: 'Localization', icon: Languages },
  { id: 'maintenance', label: 'Maintenance', icon: Wrench },
  { id: 'legal', label: 'Legal & Policies', icon: FileText }
]

const PlatformSettings = () => {
  const [activeSection, setActiveSection] = useState('general')
  const [formData, setFormData] = useState({})

  const { data: settings, isLoading, error, refetch } = useQuery({
    queryKey: ['superadmin-settings'],
    queryFn: async () => { const res = await superAdminService.getSettings(); return res.data },
  })

  // Sync formData when settings load
  useEffect(() => {
    if (settings) setFormData(settings)
  }, [settings])

  const saveMutation = useMutation({
    mutationFn: (sectionData) => superAdminService.updateSettings(sectionData),
    onSuccess: () => { toast.success('Settings saved successfully') },
    onError: (err) => { toast.error(err.response?.data?.message || 'Failed to save settings') },
  })

  const handleSave = async () => {
    const sectionData = { [activeSection]: formData[activeSection] }
    saveMutation.mutate(sectionData)
  }

  const updateField = (section, field, value) => { setFormData(prev => ({ ...prev, [section]: { ...prev[section], [field]: value } })) }
  const updateNestedField = (section, parent, field, value) => { setFormData(prev => ({ ...prev, [section]: { ...prev[section], [parent]: { ...prev[section]?.[parent], [field]: value } } })) }

  if (isLoading) {
    return (<div className="space-y-4 sm:space-y-6"><div className="h-8 w-48 bg-gray-200 dark:bg-[#2C2C2E] rounded animate-pulse" /><div className="flex flex-col lg:flex-row gap-4 sm:gap-6"><div className="w-full lg:w-48 flex lg:flex-col gap-2 overflow-x-auto">{[1,2,3,4,5].map(i => <div key={i} className="h-10 min-w-[80px] lg:min-w-0 bg-gray-200 dark:bg-[#2C2C2E] rounded-lg animate-pulse" />)}</div><div className="flex-1 h-64 sm:h-96 bg-gray-200 dark:bg-[#2C2C2E] rounded-2xl animate-pulse" /></div></div>)
  }

  const sectionData = formData[activeSection] || {}

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4">
        <div><h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">Platform Settings</h1><p className="text-sm text-gray-500 dark:text-[#8E8E93] mt-1">Configure platform-wide settings and defaults</p></div>
        <button onClick={handleSave} disabled={saveMutation.isPending} className="btn btn-primary flex items-center gap-2 disabled:opacity-50 w-full sm:w-auto"><Save className="h-4 w-4" /> {saveMutation.isPending ? 'Saving...' : 'Save Changes'}</button>
      </div>

      {error && (<div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-3 sm:p-4 flex items-center justify-between"><p className="text-sm text-red-700 dark:text-red-400 truncate">{error.response?.data?.message || error.message || 'Failed to load settings'}</p><button onClick={() => refetch()} className="text-red-600 hover:text-red-800 flex-shrink-0"><RefreshCw className="h-4 w-4" /></button></div>)}

      <div className="flex flex-col lg:flex-row gap-4 sm:gap-6">
        <div className="w-full lg:w-56 flex-shrink-0">
          <div className="card p-2 lg:sticky lg:top-4">
            <div className="flex lg:flex-col gap-1 overflow-x-auto pb-1 lg:pb-0 lg:overflow-x-visible">
              {sections.map(sec => (<button key={sec.id} onClick={() => setActiveSection(sec.id)} className={`flex items-center gap-2.5 px-3 py-2 text-sm rounded-lg transition-colors whitespace-nowrap flex-shrink-0 lg:flex-shrink lg:w-full ${activeSection === sec.id ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-700 font-medium' : 'text-gray-600 dark:text-[#8E8E93] hover:bg-gray-50 dark:hover:bg-[#2C2C2E]'}`}><sec.icon className="h-4 w-4 flex-shrink-0" />{sec.label}</button>))}
            </div>
          </div>
        </div>

        <div className="flex-1 card p-4 sm:p-6">
          {activeSection === 'general' && (<div className="space-y-4"><h2 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white mb-4">General Settings</h2><div className="grid grid-cols-1 md:grid-cols-2 gap-4"><FormField label="Platform Name" value={sectionData.platformName} onChange={v => updateField('general', 'platformName', v)} /><FormField label="Tagline" value={sectionData.tagline} onChange={v => updateField('general', 'tagline', v)} /><FormField label="Primary Domain" value={sectionData.primaryDomain} onChange={v => updateField('general', 'primaryDomain', v)} placeholder="https://app.learnovo.com" /><FormField label="Support Email" value={sectionData.supportEmail} onChange={v => updateField('general', 'supportEmail', v)} type="email" /><FormField label="Support Phone" value={sectionData.supportPhone} onChange={v => updateField('general', 'supportPhone', v)} /></div></div>)}

          {activeSection === 'branding' && (<div className="space-y-4"><h2 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white mb-4">Branding Defaults</h2><div className="grid grid-cols-1 md:grid-cols-2 gap-4"><FormField label="Primary Color" value={sectionData.primaryColor} onChange={v => updateField('branding', 'primaryColor', v)} type="color" /><FormField label="Secondary Color" value={sectionData.secondaryColor} onChange={v => updateField('branding', 'secondaryColor', v)} type="color" /><FormField label="Accent Color" value={sectionData.accentColor} onChange={v => updateField('branding', 'accentColor', v)} type="color" /></div></div>)}

          {activeSection === 'academics' && (<div className="space-y-4"><h2 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white mb-4">Academic Defaults</h2><div className="grid grid-cols-1 md:grid-cols-2 gap-4"><FormField label="Academic Year Format" value={sectionData.defaultAcademicYearFormat} onChange={v => updateField('academics', 'defaultAcademicYearFormat', v)} /><div><label className="block text-sm font-medium text-gray-700 dark:text-[#8E8E93] mb-1">Default Grading System</label><select value={sectionData.defaultGradingSystem || 'percentage'} onChange={e => updateField('academics', 'defaultGradingSystem', e.target.value)} className="input w-full"><option value="percentage">Percentage</option><option value="gpa">GPA</option><option value="letter_grade">Letter Grade</option></select></div><FormField label="Default Class Naming" value={sectionData.defaultClassNaming} onChange={v => updateField('academics', 'defaultClassNaming', v)} /></div></div>)}

          {activeSection === 'email' && (<div className="space-y-4"><h2 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white mb-4">Email Configuration</h2><div className="grid grid-cols-1 md:grid-cols-2 gap-4"><FormField label="SMTP Host" value={sectionData.host} onChange={v => updateField('email', 'host', v)} /><FormField label="SMTP Port" value={sectionData.port} onChange={v => updateField('email', 'port', parseInt(v) || 587)} type="number" /><FormField label="Username" value={sectionData.username} onChange={v => updateField('email', 'username', v)} /><FormField label="Sender Name" value={sectionData.senderName} onChange={v => updateField('email', 'senderName', v)} /><FormField label="Sender Email" value={sectionData.senderEmail} onChange={v => updateField('email', 'senderEmail', v)} type="email" /><FormField label="Daily Limit" value={sectionData.dailyLimit} onChange={v => updateField('email', 'dailyLimit', parseInt(v) || 500)} type="number" /></div></div>)}

          {activeSection === 'sms' && (<div className="space-y-4"><h2 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white mb-4">SMS Configuration</h2><div className="grid grid-cols-1 md:grid-cols-2 gap-4"><FormField label="SMS Provider" value={sectionData.provider} onChange={v => updateField('sms', 'provider', v)} /><FormField label="Sender ID" value={sectionData.senderId} onChange={v => updateField('sms', 'senderId', v)} /><FormField label="Daily Limit" value={sectionData.dailyLimit} onChange={v => updateField('sms', 'dailyLimit', parseInt(v) || 100)} type="number" /></div></div>)}

          {activeSection === 'payment' && (<div className="space-y-4"><h2 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white mb-4">Payment Gateway</h2><div className="grid grid-cols-1 md:grid-cols-2 gap-4"><div><label className="block text-sm font-medium text-gray-700 dark:text-[#8E8E93] mb-1">Gateway Provider</label><select value={sectionData.gateway || 'razorpay'} onChange={e => updateField('payment', 'gateway', e.target.value)} className="input w-full"><option value="razorpay">Razorpay</option><option value="stripe">Stripe</option><option value="payu">PayU</option><option value="instamojo">Instamojo</option><option value="none">None</option></select></div><div className="flex items-center gap-3"><label className="text-sm font-medium text-gray-700 dark:text-[#8E8E93]">Test Mode</label><input type="checkbox" checked={sectionData.testMode ?? true} onChange={e => updateField('payment', 'testMode', e.target.checked)} className="rounded text-primary-500" /></div></div></div>)}

          {activeSection === 'storage' && (<div className="space-y-4"><h2 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white mb-4">Storage Configuration</h2><div className="grid grid-cols-1 md:grid-cols-2 gap-4"><div><label className="block text-sm font-medium text-gray-700 dark:text-[#8E8E93] mb-1">Storage Provider</label><select value={sectionData.provider || 'cloudinary'} onChange={e => updateField('storage', 'provider', e.target.value)} className="input w-full"><option value="cloudinary">Cloudinary</option><option value="aws_s3">AWS S3</option><option value="gcs">Google Cloud Storage</option><option value="local">Local</option></select></div><FormField label="Max File Size (MB)" value={sectionData.maxFileSize} onChange={v => updateField('storage', 'maxFileSize', parseInt(v) || 10)} type="number" /></div></div>)}

          {activeSection === 'localization' && (<div className="space-y-4"><h2 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white mb-4">Localization</h2><div className="grid grid-cols-1 md:grid-cols-2 gap-4"><FormField label="Default Language" value={sectionData.defaultLanguage} onChange={v => updateField('localization', 'defaultLanguage', v)} /><FormField label="Default Timezone" value={sectionData.defaultTimezone} onChange={v => updateField('localization', 'defaultTimezone', v)} /><FormField label="Default Currency" value={sectionData.defaultCurrency} onChange={v => updateField('localization', 'defaultCurrency', v)} /><div><label className="block text-sm font-medium text-gray-700 dark:text-[#8E8E93] mb-1">Date Format</label><select value={sectionData.defaultDateFormat || 'DD/MM/YYYY'} onChange={e => updateField('localization', 'defaultDateFormat', e.target.value)} className="input w-full"><option value="DD/MM/YYYY">DD/MM/YYYY</option><option value="MM/DD/YYYY">MM/DD/YYYY</option><option value="YYYY-MM-DD">YYYY-MM-DD</option></select></div></div></div>)}

          {activeSection === 'maintenance' && (<div className="space-y-4"><h2 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white mb-4">Maintenance Mode</h2><div className="flex items-center gap-3"><label className="text-sm font-medium text-gray-700 dark:text-[#8E8E93]">Enable Maintenance Mode</label><input type="checkbox" checked={sectionData.isEnabled ?? false} onChange={e => updateField('maintenance', 'isEnabled', e.target.checked)} className="rounded text-primary-500" /></div>{sectionData.isEnabled && (<div className="grid grid-cols-1 md:grid-cols-2 gap-4"><FormField label="Maintenance Message" value={sectionData.message} onChange={v => updateField('maintenance', 'message', v)} multiline /><FormField label="Estimated Downtime" value={sectionData.estimatedDowntime} onChange={v => updateField('maintenance', 'estimatedDowntime', v)} placeholder="e.g., 2 hours" /></div>)}</div>)}

          {activeSection === 'legal' && (<div className="space-y-4"><h2 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white mb-4">Legal & Policies</h2><FormField label="Terms of Service" value={sectionData.termsOfService} onChange={v => updateField('legal', 'termsOfService', v)} multiline rows={6} /><FormField label="Privacy Policy" value={sectionData.privacyPolicy} onChange={v => updateField('legal', 'privacyPolicy', v)} multiline rows={6} /><FormField label="Refund Policy" value={sectionData.refundPolicy} onChange={v => updateField('legal', 'refundPolicy', v)} multiline rows={4} /></div>)}
        </div>
      </div>
    </div>
  )
}

const FormField = ({ label, value, onChange, type = 'text', placeholder, multiline, rows = 3 }) => (
  <div>
    <label className="block text-sm font-medium text-gray-700 dark:text-[#8E8E93] mb-1">{label}</label>
    {multiline ? (
      <textarea value={value || ''} onChange={e => onChange(e.target.value)} className="input w-full resize-none" rows={rows} placeholder={placeholder} />
    ) : type === 'color' ? (
      <div className="flex items-center gap-3"><input type="color" value={value || '#3EC4B1'} onChange={e => onChange(e.target.value)} className="h-10 w-14 rounded cursor-pointer border border-gray-200" /><input type="text" value={value || ''} onChange={e => onChange(e.target.value)} className="input w-32 font-mono text-sm" /></div>
    ) : (
      <input type={type} value={value || ''} onChange={e => onChange(e.target.value)} className="input w-full" placeholder={placeholder} />
    )}
  </div>
)

export default PlatformSettings
