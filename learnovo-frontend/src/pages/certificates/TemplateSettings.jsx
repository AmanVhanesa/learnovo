import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Save, ArrowLeft, Loader2 } from 'lucide-react';
import certificateService from '../../services/certificateService';
import { toast } from 'react-hot-toast';

const TemplateSettings = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [activeTab, setActiveTab] = useState('TC'); // TC or BONAFIDE

    const [templates, setTemplates] = useState({
        TC: { headerText: '', declarationText: '', footerText: '' },
        BONAFIDE: { headerText: '', declarationText: '', footerText: '' }
    });

    useEffect(() => {
        fetchTemplates();
    }, []);

    const fetchTemplates = async () => {
        try {
            const data = await certificateService.getTemplates();
            const newTemplates = { ...templates };

            data.forEach(t => {
                if (newTemplates[t.type]) {
                    newTemplates[t.type] = {
                        headerText: t.headerText || '',
                        declarationText: t.declarationText || '',
                        footerText: t.footerText || ''
                    };
                }
            });
            setTemplates(newTemplates);
        } catch (error) {
            toast.error('Failed to load templates');
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            await certificateService.saveTemplate({
                type: activeTab,
                ...templates[activeTab]
            });
            toast.success(`${activeTab} Template saved successfully`);
        } catch (error) {
            toast.error('Failed to save template');
        } finally {
            setSaving(false);
        }
    };

    const handleChange = (field, value) => {
        setTemplates(prev => ({
            ...prev,
            [activeTab]: {
                ...prev[activeTab],
                [field]: value
            }
        }));
    };

    if (loading) return <div className="p-10 text-center">Loading settings...</div>;

    return (
        <div className="p-6 max-w-4xl mx-auto">
            <div className="flex items-center gap-4 mb-6">
                <button onClick={() => navigate('/app/certificates')} className="text-gray-500 hover:text-gray-700">
                    <ArrowLeft size={24} />
                </button>
                <h1 className="text-2xl font-bold text-gray-800">Certificate Templates</h1>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                {/* Tabs */}
                <div className="flex border-b border-gray-100">
                    <button
                        onClick={() => setActiveTab('TC')}
                        className={`px-6 py-4 font-medium transition-colors ${activeTab === 'TC'
                            ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50'
                            : 'text-gray-600 hover:bg-gray-50'
                            }`}
                    >
                        School Leaving Certificate (TC)
                    </button>
                    <button
                        onClick={() => setActiveTab('BONAFIDE')}
                        className={`px-6 py-4 font-medium transition-colors ${activeTab === 'BONAFIDE'
                            ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50'
                            : 'text-gray-600 hover:bg-gray-50'
                            }`}
                    >
                        Bonafide Certificate
                    </button>
                </div>

                <div className="p-8 space-y-6">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Declaration Text
                        </label>
                        <p className="text-xs text-gray-500 mb-2">
                            This text appears in the main body of the certificate.
                        </p>
                        <textarea
                            value={templates[activeTab].declarationText}
                            onChange={(e) => handleChange('declarationText', e.target.value)}
                            rows={6}
                            className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder="Enter declaration text..."
                        />
                    </div>

                    {/* Only show header/footer fields if needed. For now keeping simple. */}

                    <div className="pt-4 flex justify-end">
                        <button
                            onClick={handleSave}
                            disabled={saving}
                            className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                        >
                            {saving ? (
                                <>
                                    <Loader2 size={18} className="animate-spin" />
                                    Saving...
                                </>
                            ) : (
                                <>
                                    <Save size={18} />
                                    Save Configuration
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TemplateSettings;
