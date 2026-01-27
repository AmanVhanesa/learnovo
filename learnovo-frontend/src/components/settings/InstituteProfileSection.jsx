import React from 'react'
import { Building2 } from 'lucide-react'

const InstituteProfileSection = ({ form, updateField, handleLogoUpload }) => {
    return (
        <div className="space-y-6">
            <div className="flex items-center gap-3 mb-6">
                <Building2 className="h-6 w-6 text-primary-600" />
                <div>
                    <h2 className="text-xl font-semibold text-gray-900">Institute Profile</h2>
                    <p className="text-sm text-gray-500">Manage your institution's basic information and branding</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Left Column */}
                <div className="space-y-4">
                    <div>
                        <label className="label">Institution Name *</label>
                        <input
                            type="text"
                            className="input"
                            value={form.institution?.name || ''}
                            onChange={(e) => updateField('institution.name', e.target.value)}
                            required
                            placeholder="Enter institution name"
                        />
                    </div>

                    <div>
                        <label className="label">Tagline / Motto</label>
                        <input
                            type="text"
                            className="input"
                            value={form.institution?.tagline || ''}
                            onChange={(e) => updateField('institution.tagline', e.target.value)}
                            placeholder="e.g., Excellence in Education"
                        />
                    </div>

                    <div>
                        <label className="label">Phone Number</label>
                        <input
                            type="tel"
                            className="input"
                            value={form.institution?.contact?.phone || ''}
                            onChange={(e) => updateField('institution.contact.phone', e.target.value)}
                            placeholder="+91 1234567890"
                        />
                    </div>

                    <div>
                        <label className="label">Email</label>
                        <input
                            type="email"
                            className="input"
                            value={form.institution?.contact?.email || ''}
                            onChange={(e) => updateField('institution.contact.email', e.target.value)}
                            placeholder="info@school.com"
                        />
                    </div>

                    <div>
                        <label className="label">Website</label>
                        <input
                            type="url"
                            className="input"
                            value={form.institution?.contact?.website || ''}
                            onChange={(e) => updateField('institution.contact.website', e.target.value)}
                            placeholder="https://www.school.com"
                        />
                    </div>
                </div>

                {/* Right Column */}
                <div className="space-y-4">
                    <div>
                        <label className="label">Address</label>
                        <div className="space-y-2">
                            <input
                                type="text"
                                className="input"
                                placeholder="Street Address"
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
                                    value={form.institution?.address?.country || 'India'}
                                    onChange={(e) => updateField('institution.address.country', e.target.value)}
                                />
                            </div>
                        </div>
                    </div>

                    <div>
                        <label className="label">Institution Logo</label>
                        <div className="mt-2 flex items-center gap-4">
                            <div className="h-24 w-24 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center overflow-hidden bg-gray-50">
                                {form.institution?.logo ? (
                                    <img
                                        src={`http://localhost:5001${form.institution.logo}`}
                                        alt="School Logo"
                                        className="h-full w-full object-contain"
                                        onError={(e) => e.target.style.display = 'none'}
                                    />
                                ) : (
                                    <span className="text-gray-400 text-xs text-center px-2">No Logo</span>
                                )}
                            </div>
                            <div className="flex flex-col gap-2">
                                <input
                                    type="file"
                                    id="logo-upload"
                                    className="hidden"
                                    accept="image/*"
                                    onChange={handleLogoUpload}
                                />
                                <label
                                    htmlFor="logo-upload"
                                    className="btn btn-outline cursor-pointer"
                                >
                                    Change Logo
                                </label>
                                <p className="text-xs text-gray-500">Recommended: 200x200px PNG/JPG</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default InstituteProfileSection
