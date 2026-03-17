import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Save, ArrowLeft, Loader2 } from 'lucide-react';
import certificateService from '../../services/certificateService';
import { toast } from 'react-hot-toast';

const defaultTemplates = {
    TC: { headerText: '', declarationText: '', footerText: '' },
    BONAFIDE: { headerText: '', declarationText: '', footerText: '' }
};

const TemplateSettings = () => {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const [activeTab, setActiveTab] = useState('TC'); // TC or BONAFIDE

    const [templates, setTemplates] = useState(defaultTemplates);

    const { data: templateData, isLoading: loading, isError } = useQuery({
        queryKey: ['certificate-templates'],
        queryFn: async () => {
            const data = await certificateService.getTemplates();
            return data || [];
        },
    });

    // Sync fetched template data into local editable state
    useEffect(() => {
        if (templateData) {
            const newTemplates = { ...defaultTemplates };
            templateData.forEach(t => {
                if (newTemplates[t.type]) {
                    newTemplates[t.type] = {
                        headerText: t.headerText || '',
                        declarationText: t.declarationText || '',
                        footerText: t.footerText || ''
                    };
                }
            });
            setTemplates(newTemplates);
        }
    }, [templateData]);

    // Show error toast on fetch failure
    useEffect(() => {
        if (isError) {
            toast.error('Failed to load templates');
        }
    }, [isError]);

    const saveMutation = useMutation({
        mutationFn: () => certificateService.saveTemplate({
            type: activeTab,
            ...templates[activeTab]
        }),
        onSuccess: () => {
            toast.success(`${activeTab} Template saved successfully`);
            queryClient.invalidateQueries({ queryKey: ['certificate-templates'] });
        },
        onError: () => {
            toast.error('Failed to save template');
        },
    });

    const handleSave = () => {
        saveMutation.mutate();
    };

    const saving = saveMutation.isPending;

    const handleChange = (field, value) => {
        setTemplates(prev => ({
            ...prev,
            [activeTab]: {
                ...prev[activeTab],
                [field]: value
            }
        }));
    };

    if (loading) return (
        <div className="flex items-center justify-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
        </div>
    );

    return (
        <div className="space-y-6 max-w-4xl">
            <div className="flex items-center gap-3">
                <button onClick={() => navigate('/app/certificates')} className="btn-icon flex-shrink-0">
                    <ArrowLeft size={20} />
                </button>
                <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white tracking-tight">Certificate Templates</h1>
            </div>

            <div className="card overflow-hidden">
                {/* Tabs */}
                <div className="flex gap-1 p-1.5 m-4 bg-gray-100 dark:bg-[#2C2C2E] rounded-xl w-full sm:w-fit overflow-x-auto">
                    <button
                        onClick={() => setActiveTab('TC')}
                        className={`px-5 py-2 text-sm font-medium rounded-lg transition-all duration-200 ${activeTab === 'TC'
                            ? 'bg-white dark:bg-[#1C1C1E] text-gray-900 dark:text-white shadow-sm'
                            : 'text-gray-500 hover:text-gray-700 dark:text-[#8E8E93] dark:hover:text-white'
                        }`}
                    >
                        School Leaving Certificate (TC)
                    </button>
                    <button
                        onClick={() => setActiveTab('BONAFIDE')}
                        className={`px-5 py-2 text-sm font-medium rounded-lg transition-all duration-200 ${activeTab === 'BONAFIDE'
                            ? 'bg-white dark:bg-[#1C1C1E] text-gray-900 dark:text-white shadow-sm'
                            : 'text-gray-500 hover:text-gray-700 dark:text-[#8E8E93] dark:hover:text-white'
                        }`}
                    >
                        Bonafide Certificate
                    </button>
                </div>

                <div className="px-4 sm:px-6 pb-6 pt-2 space-y-6">
                    <div>
                        <label className="label mb-1.5 block">Header Text</label>
                        <p className="text-xs text-gray-500 dark:text-[#8E8E93] mb-2">
                            Text displayed at the top of the certificate (school name, tagline, etc.).
                        </p>
                        <input
                            type="text"
                            value={templates[activeTab].headerText}
                            onChange={(e) => handleChange('headerText', e.target.value)}
                            className="input"
                            placeholder="e.g., This is to certify that..."
                        />
                    </div>

                    <div>
                        <label className="label mb-1.5 block">Declaration Text</label>
                        <p className="text-xs text-gray-500 dark:text-[#8E8E93] mb-2">
                            This text appears in the main body of the certificate.
                        </p>
                        <textarea
                            value={templates[activeTab].declarationText}
                            onChange={(e) => handleChange('declarationText', e.target.value)}
                            rows={6}
                            className="input min-h-[120px]"
                            placeholder="Enter declaration text..."
                        />
                    </div>

                    <div>
                        <label className="label mb-1.5 block">Footer Text</label>
                        <p className="text-xs text-gray-500 dark:text-[#8E8E93] mb-2">
                            Text displayed at the bottom of the certificate (signatures, stamps, disclaimers).
                        </p>
                        <input
                            type="text"
                            value={templates[activeTab].footerText}
                            onChange={(e) => handleChange('footerText', e.target.value)}
                            className="input"
                            placeholder="e.g., Principal's Signature"
                        />
                    </div>

                    <div className="pt-4 flex justify-end">
                        <button
                            onClick={handleSave}
                            disabled={saving}
                            className="btn btn-primary gap-2 w-full sm:w-auto"
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
