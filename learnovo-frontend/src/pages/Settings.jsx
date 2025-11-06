import React, { useState, useEffect } from 'react'
import { Settings as SettingsIcon, Save, Loader } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { settingsService } from '../services/settingsService'
import toast from 'react-hot-toast'

const Settings = () => {
  const { tenant } = useAuth()
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [form, setForm] = useState({
    institution: {
      name: '',
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
      }
    },
    currency: {
      default: 'INR',
      symbol: '₹',
      position: 'before'
    }
  })

  useEffect(() => {
    loadSettings()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const loadSettings = async () => {
    try {
      setIsLoading(true)
      console.log('Loading settings for tenant:', tenant)
      const data = await settingsService.getSettings()
      console.log('Settings loaded:', data)
      
      if (data.success && data.data) {
        setForm(data.data)
        console.log('Form set with data:', data.data)
      } else {
        console.log('No settings data received, using tenant data')
        // If no settings exist yet, initialize from tenant
        if (tenant) {
          setForm({
            institution: {
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
            },
            currency: {
              default: tenant.settings?.currency || 'INR',
              symbol: tenant.settings?.currency === 'INR' ? '₹' : 
                      tenant.settings?.currency === 'USD' ? '$' : 
                      tenant.settings?.currency === 'EUR' ? '€' : 
                      tenant.settings?.currency === 'GBP' ? '£' : '₹',
              position: 'before'
            }
          })
        }
      }
    } catch (error) {
      console.error('Error loading settings:', error)
      console.error('Error details:', error.response?.data)
      // Set default values from tenant if available
      if (tenant) {
        setForm({
          institution: {
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
          },
          currency: {
            default: tenant.settings?.currency || 'INR',
            symbol: tenant.settings?.currency === 'INR' ? '₹' : 
                    tenant.settings?.currency === 'USD' ? '$' : 
                    tenant.settings?.currency === 'EUR' ? '€' : 
                    tenant.settings?.currency === 'GBP' ? '£' : '₹',
            position: 'before'
          }
        })
      }
    } finally {
      setIsLoading(false)
    }
  }

  const handleSave = async (e) => {
    e.preventDefault()
    try {
      setIsSaving(true)
      const data = await settingsService.updateSettings(form)

      if (data.success) {
        toast.success('Settings saved successfully!')
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
      current = current[keys[i]]
    }
    
    current[keys[keys.length - 1]] = value
    setForm(newForm)
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
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <button className="btn btn-primary" onClick={handleSave} disabled={isSaving}>
          <Save className="h-4 w-4 mr-2" />
          {isSaving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>

      <form onSubmit={handleSave}>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Institution Information</h3>
          <div className="space-y-4">
            <div>
              <label className="label">Institution Name</label>
                <input 
                  type="text" 
                  className="input" 
                  value={form.institution?.name || ''} 
                  onChange={(e) => updateField('institution.name', e.target.value)}
                  required
                />
            </div>
            <div>
              <label className="label">Address</label>
                <div className="space-y-2">
                  <input 
                    type="text" 
                    className="input" 
                    placeholder="Street" 
                    value={form.institution?.address?.street || ''}
                    onChange={(e) => updateField('institution.address.street', e.target.value)}
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <input 
                      type="text" 
                      className="input" 
                      placeholder="City" 
                      value={form.institution?.address?.city || ''}
                      onChange={(e) => updateField('institution.address.city', e.target.value)}
                    />
                    <input 
                      type="text" 
                      className="input" 
                      placeholder="State" 
                      value={form.institution?.address?.state || ''}
                      onChange={(e) => updateField('institution.address.state', e.target.value)}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <input 
                      type="text" 
                      className="input" 
                      placeholder="Pincode" 
                      value={form.institution?.address?.pincode || ''}
                      onChange={(e) => updateField('institution.address.pincode', e.target.value)}
                    />
                    <input 
                      type="text" 
                      className="input" 
                      placeholder="Country" 
                      value={form.institution?.address?.country || ''}
                      onChange={(e) => updateField('institution.address.country', e.target.value)}
                    />
                  </div>
                </div>
            </div>
            <div>
              <label className="label">Phone</label>
                <input 
                  type="tel" 
                  className="input" 
                  value={form.institution?.contact?.phone || ''} 
                  onChange={(e) => updateField('institution.contact.phone', e.target.value)}
                />
            </div>
            <div>
              <label className="label">Email</label>
                <input 
                  type="email" 
                  className="input" 
                  value={form.institution?.contact?.email || ''} 
                  onChange={(e) => updateField('institution.contact.email', e.target.value)}
                />
              </div>
              <div>
                <label className="label">Website</label>
                <input 
                  type="url" 
                  className="input" 
                  placeholder="https://example.com"
                  value={form.institution?.contact?.website || ''} 
                  onChange={(e) => updateField('institution.contact.website', e.target.value)}
                />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Currency Settings</h3>
          <div className="space-y-4">
            <div>
              <label className="label">Default Currency</label>
                <select 
                  className="input"
                  value={form.currency?.default || 'INR'}
                  onChange={(e) => {
                    const symbolMap = {
                      'INR': '₹',
                      'USD': '$',
                      'EUR': '€',
                      'GBP': '£'
                    }
                    updateField('currency.default', e.target.value)
                    updateField('currency.symbol', symbolMap[e.target.value] || '₹')
                  }}
                >
                <option value="INR">Indian Rupee (₹)</option>
                <option value="USD">US Dollar ($)</option>
                <option value="EUR">Euro (€)</option>
                <option value="GBP">British Pound (£)</option>
              </select>
            </div>
            <div>
              <label className="label">Currency Symbol</label>
                <input 
                  type="text" 
                  className="input" 
                  value={form.currency?.symbol || '₹'} 
                  onChange={(e) => updateField('currency.symbol', e.target.value)}
                />
            </div>
            <div>
              <label className="label">Symbol Position</label>
                <select 
                  className="input"
                  value={form.currency?.position || 'before'}
                  onChange={(e) => updateField('currency.position', e.target.value)}
                >
                <option value="before">Before Amount</option>
                <option value="after">After Amount</option>
              </select>
            </div>
          </div>
        </div>
      </div>
      </form>
    </div>
  )
}

export default Settings
