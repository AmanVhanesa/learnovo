import React, { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Settings as SettingsIcon, Save, Loader } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { settingsService } from '../services/settingsService'
import toast from 'react-hot-toast'
import { cn } from '../utils/cn'

// Import section components
import InstituteProfileSection from '../components/settings/InstituteProfileSection'
import MarksGradingSection from '../components/settings/MarksGradingSection'
import BankAccountsSection from '../components/settings/BankAccountsSection'
import RulesRegulationsSection from '../components/settings/RulesRegulationsSection'
import ThemeLanguageSection from '../components/settings/ThemeLanguageSection'
import AccountSettingsSection from '../components/settings/AccountSettingsSection'
import SubDepartmentsSection from '../components/settings/SubDepartmentsSection'
import BackupRestoreSection from '../components/settings/BackupRestoreSection'
import NotificationSettingsSection from '../components/settings/NotificationSettingsSection'

const DEFAULT_FORM = {
  institution: {
    name: '',
    tagline: '',
    address: { street: '', city: '', state: '', pincode: '', country: 'India' },
    contact: { phone: '', email: '', website: '' },
    logo: null
  },
  grading: { rules: [], isActive: true },
  bankAccounts: [],
  rulesAndRegulations: { content: '', version: 1, isActive: true },
  theme: { mode: 'light', language: 'en' },
  account: { timezone: 'Asia/Kolkata', dateFormat: 'DD/MM/YYYY', timeFormat: '12h' },
  currency: { default: 'INR', symbol: '\u20B9', position: 'before' }
}

const Settings = () => {
  const { tenant } = useAuth()
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState('institute')
  const [form, setForm] = useState(DEFAULT_FORM)

  const tabs = [
    { id: 'institute', label: 'Institute Profile', icon: '\uD83C\uDFEB' },
    { id: 'subdepartments', label: 'Sub Departments', icon: '\uD83C\uDFE2' },
    { id: 'grading', label: 'Marks Grading', icon: '\uD83D\uDCCA' },
    { id: 'banks', label: 'Bank Accounts', icon: '\uD83C\uDFE6' },
    { id: 'rules', label: 'Rules & Regulations', icon: '\uD83D\uDCDC' },
    { id: 'theme', label: 'Theme & Language', icon: '\uD83C\uDFA8' },
    { id: 'account', label: 'Account Settings', icon: '\u2699\uFE0F' },
    { id: 'notifications', label: 'Notifications', icon: '\uD83D\uDD14' },
    { id: 'backup', label: 'Backup & Restore', icon: '\uD83D\uDCBE' }
  ]

  const { data: settingsData, isLoading } = useQuery({
    queryKey: ['settings'],
    queryFn: () => settingsService.getSettings(),
  })

  // Sync fetched settings into form state (onSuccess was removed in React Query v5)
  useEffect(() => {
    if (!settingsData) return

    if (settingsData.success && settingsData.data) {
      setForm(prevForm => ({
        ...prevForm,
        ...settingsData.data,
        institution: { ...prevForm.institution, ...settingsData.data.institution },
        grading: { ...prevForm.grading, ...settingsData.data.grading },
        theme: { ...prevForm.theme, ...settingsData.data.theme },
        account: { ...prevForm.account, ...settingsData.data.account },
        currency: { ...prevForm.currency, ...settingsData.data.currency }
      }))
    } else if (tenant) {
      setForm(prevForm => ({
        ...prevForm,
        institution: {
          ...prevForm.institution,
          name: tenant.schoolName || '',
          address: {
            street: tenant.address?.street || '',
            city: tenant.address?.city || '',
            state: tenant.address?.state || '',
            pincode: tenant.address?.zipCode || '',
            country: tenant.address?.country || 'India'
          },
          contact: {
            phone: tenant.phone || '',
            email: tenant.email || '',
            website: ''
          }
        }
      }))
    }
  }, [settingsData, tenant])

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {}

      if (form.institution) {
        payload.institution = {
          name: form.institution.name,
          tagline: form.institution.tagline,
          udiseCode: form.institution.udiseCode,
          board: form.institution.board,
          affiliationNumber: form.institution.affiliationNumber,
          schoolCode: form.institution.schoolCode,
          address: form.institution.address ? { ...form.institution.address } : undefined,
          contact: form.institution.contact ? { ...form.institution.contact } : undefined,
          logo: form.institution.logo,
          principalSignature: form.institution.principalSignature,
          establishedYear: form.institution.establishedYear
        }
        if (payload.institution.address) delete payload.institution.address._id
        if (payload.institution.contact) delete payload.institution.contact._id
        if (payload.institution.logo === null) delete payload.institution.logo
        if (payload.institution.principalSignature === null) delete payload.institution.principalSignature
      }
      if (form.currency) {
        payload.currency = { default: form.currency.default, symbol: form.currency.symbol, position: form.currency.position }
      }
      if (form.theme) {
        payload.theme = { mode: form.theme.mode || 'light', language: form.theme.language || 'en' }
      }
      if (form.grading) payload.grading = form.grading
      if (form.bankAccounts) {
        payload.bankAccounts = form.bankAccounts.map(acc => {
          const newAcc = { ...acc }
          delete newAcc._id
          return newAcc
        })
      }
      if (form.rulesAndRegulations) payload.rulesAndRegulations = form.rulesAndRegulations
      if (form.account) payload.account = form.account

      return await settingsService.updateSettings(payload)
    },
    onSuccess: (data) => {
      if (data.success) {
        toast.success(`${tabs.find(t => t.id === activeTab)?.label || 'Settings'} saved successfully!`)
        queryClient.invalidateQueries({ queryKey: ['settings'] })
      } else {
        toast.error(data.message || 'Failed to save settings')
      }
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Failed to save settings')
    }
  })

  const handleSave = (e) => {
    if (e) e.preventDefault()
    saveMutation.mutate()
  }

  const updateField = (path, value) => {
    setForm(prevForm => {
      const keys = path.split('.')
      const newForm = JSON.parse(JSON.stringify(prevForm))
      let current = newForm
      for (let i = 0; i < keys.length - 1; i++) {
        if (!current[keys[i]]) current[keys[i]] = {}
        current = current[keys[i]]
      }
      current[keys[keys.length - 1]] = value
      return newForm
    })
  }

  const handleLogoUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    const formData = new FormData()
    formData.append('logo', file)
    try {
      const data = await settingsService.uploadLogo(formData)
      if (data.success) {
        updateField('institution.logo', data.data.url)
        toast.success('Logo uploaded! Click Save to apply changes.')
      } else {
        toast.error('Upload failed')
      }
    } catch (err) {
      toast.error('Error uploading logo')
    }
  }

  const handleSignatureUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    const formData = new FormData()
    formData.append('signature', file)
    try {
      const data = await settingsService.uploadSignature(formData)
      if (data.success) {
        updateField('institution.principalSignature', data.data.url)
        toast.success('Signature uploaded! Click Save to apply changes.')
      } else {
        toast.error('Upload failed')
      }
    } catch (err) {
      toast.error('Error uploading signature')
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader className="h-8 w-8 animate-spin text-teal-600" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">General Settings</h1>
          <p className="text-sm text-gray-500 dark:text-[#8E8E93] mt-1">Manage your school's configuration and preferences</p>
        </div>
        <button
          className="btn btn-primary w-full sm:w-auto"
          onClick={handleSave}
          disabled={saveMutation.isPending}
        >
          <Save className="h-4 w-4 mr-2" />
          {saveMutation.isPending ? 'Saving...' : 'Save Changes'}
        </button>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200 dark:border-[#38383A]">
        <nav className="-mb-px flex space-x-4 sm:space-x-8 overflow-x-auto overflow-y-hidden whitespace-nowrap scrollbar-hide">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'whitespace-nowrap py-3 sm:py-4 px-1 border-b-2 font-medium text-xs sm:text-sm transition-colors flex-shrink-0',
                activeTab === tab.id
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 dark:text-[#8E8E93] hover:text-gray-700 dark:hover:text-white hover:border-gray-300'
              )}
            >
              <span className="mr-1 sm:mr-2">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <form onSubmit={handleSave}>
        <div className="bg-white dark:bg-[#1C1C1E] dark:border dark:border-[#38383A] rounded-2xl shadow-glass p-4 sm:p-6">
          {activeTab === 'institute' && (
            <InstituteProfileSection
              form={form}
              updateField={updateField}
              handleLogoUpload={handleLogoUpload}
              handleSignatureUpload={handleSignatureUpload}
            />
          )}
          {activeTab === 'subdepartments' && (
            <SubDepartmentsSection />
          )}
          {activeTab === 'grading' && (
            <MarksGradingSection
              form={form}
              updateField={updateField}
            />
          )}
          {activeTab === 'banks' && (
            <BankAccountsSection
              form={form}
              updateField={updateField}
              settingsService={settingsService}
            />
          )}
          {activeTab === 'rules' && (
            <RulesRegulationsSection
              form={form}
              updateField={updateField}
            />
          )}
          {activeTab === 'theme' && (
            <ThemeLanguageSection
              form={form}
              updateField={updateField}
            />
          )}
          {activeTab === 'account' && (
            <AccountSettingsSection
              form={form}
              updateField={updateField}
            />
          )}
          {activeTab === 'notifications' && (
            <NotificationSettingsSection />
          )}
          {activeTab === 'backup' && (
            <BackupRestoreSection />
          )}
        </div>
      </form>
    </div>
  )
}

export default Settings
