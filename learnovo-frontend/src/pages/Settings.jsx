import React, { useState, useEffect } from 'react'
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

const Settings = () => {
  const { tenant } = useAuth()
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [activeTab, setActiveTab] = useState('institute')
  const [form, setForm] = useState({
    institution: {
      name: '',
      tagline: '',
      address: {
        street: '',
        city: '',
        state: '',
        pincode: '',
        country: 'India'
      },
      contact: {
        phone: '',
        email: '',
        website: ''
      },
      logo: null
    },
    grading: {
      rules: [],
      isActive: true
    },
    bankAccounts: [],
    rulesAndRegulations: {
      content: '',
      version: 1,
      isActive: true
    },
    theme: {
      mode: 'light',
      primaryColor: '#3EC4B1',
      secondaryColor: '#2355A6',
      language: 'en'
    },
    account: {
      timezone: 'Asia/Kolkata',
      dateFormat: 'DD/MM/YYYY',
      timeFormat: '12h'
    },
    currency: {
      default: 'INR',
      symbol: '₹',
      position: 'before'
    },
    admission: {
      mode: 'AUTO',
      prefix: '',
      yearFormat: 'YYYY',
      counterPadding: 4,
      isLocked: false
    }
  })

  const tabs = [
    { id: 'institute', label: 'Institute Profile', icon: '🏫' },
    { id: 'grading', label: 'Marks Grading', icon: '📊' },
    { id: 'banks', label: 'Bank Accounts', icon: '🏦' },
    { id: 'rules', label: 'Rules & Regulations', icon: '📜' },
    { id: 'theme', label: 'Theme & Language', icon: '🎨' },
    { id: 'account', label: 'Account Settings', icon: '⚙️' }
  ]

  useEffect(() => {
    loadSettings()
  }, [])

  const loadSettings = async () => {
    try {
      setIsLoading(true)
      const data = await settingsService.getSettings()

      if (data.success && data.data) {
        setForm(prevForm => ({
          ...prevForm,
          ...data.data,
          // Ensure nested objects exist
          institution: { ...prevForm.institution, ...data.data.institution },
          grading: { ...prevForm.grading, ...data.data.grading },
          theme: { ...prevForm.theme, ...data.data.theme },
          account: { ...prevForm.account, ...data.data.account },
          currency: { ...prevForm.currency, ...data.data.currency }
        }))
      } else if (tenant) {
        // Initialize from tenant data
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
    } catch (error) {
      console.error('Error loading settings:', error)
      toast.error('Failed to load settings')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSave = async (e) => {
    e.preventDefault()
    try {
      setIsSaving(true)

      // Save admission settings separately if they exist
      if (form.admission) {
        const admissionPayload = {
          mode: form.admission.mode,
          prefix: form.admission.prefix,
          counterPadding: form.admission.counterPadding
        }
        await settingsService.updateAdmissionSettings(admissionPayload)
      }

      // Save general settings
      const generalForm = { ...form }
      delete generalForm.admission

      // Don't send logo if it's null (preserve existing logo in database)
      if (generalForm.institution && generalForm.institution.logo === null) {
        delete generalForm.institution.logo
      }

      const data = await settingsService.updateSettings(generalForm)

      if (data.success) {
        toast.success('Settings saved successfully!')
        loadSettings()
      } else {
        toast.error(data.message || 'Failed to save settings')
      }
    } catch (error) {
      console.error('Error saving settings:', error)
      toast.error(error.response?.data?.message || 'Failed to save settings')
    } finally {
      setIsSaving(false)
    }
  }

  const updateField = (path, value) => {
    const keys = path.split('.')
    const newForm = { ...form }
    let current = newForm

    for (let i = 0; i < keys.length - 1; i++) {
      if (!current[keys[i]]) {
        current[keys[i]] = {}
      }
      current = current[keys[i]]
    }

    current[keys[keys.length - 1]] = value
    setForm(newForm)
  }

  const handleLogoUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return

    const formData = new FormData()
    formData.append('logo', file)

    try {
      const token = localStorage.getItem('token')
      const res = await fetch('http://localhost:5001/api/settings/upload-logo', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      })
      const data = await res.json()
      if (data.success) {
        updateField('institution.logo', data.data.url)
        toast.success('Logo uploaded!')
      } else {
        toast.error('Upload failed')
      }
    } catch (err) {
      console.error(err)
      toast.error('Error uploading logo')
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
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">General Settings</h1>
          <p className="text-sm text-gray-500 mt-1">Manage your school's configuration and preferences</p>
        </div>
        <button
          className="btn btn-primary"
          onClick={handleSave}
          disabled={isSaving}
        >
          <Save className="h-4 w-4 mr-2" />
          {isSaving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors',
                activeTab === tab.id
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              )}
            >
              <span className="mr-2">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <form onSubmit={handleSave}>
        <div className="bg-white rounded-lg shadow-sm p-6">
          {activeTab === 'institute' && (
            <InstituteProfileSection
              form={form}
              updateField={updateField}
              handleLogoUpload={handleLogoUpload}
            />
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
        </div>
      </form>
    </div>
  )
}

export default Settings
