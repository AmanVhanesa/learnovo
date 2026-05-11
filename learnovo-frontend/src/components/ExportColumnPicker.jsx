import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Check, Download, FileText, FileSpreadsheet, FileType } from 'lucide-react';
import toast from 'react-hot-toast';
import { exportCSV, exportReport, exportPDF } from '../utils/exportHelpers';
import { useSettings } from '../contexts/SettingsContext';

/**
 * Generic Export Column Picker
 *
 * Renders a download button. When clicked, opens a modal that lets the user
 * pick which columns to include, optionally apply a preset, and choose a
 * format (Excel / CSV / PDF). The download is built client-side from the
 * `data` prop using each column's `getValue` function.
 *
 * Props:
 *  - data:        Array of records (already loaded in the page).
 *  - columns:     Array of column metadata objects:
 *                   { key, label, group?, getValue(row), defaultSelected? }
 *                 `group` is used to render columns under category headings.
 *                 `defaultSelected` (default true) controls whether the column
 *                 is checked when no preset is applied.
 *  - filename:    Base filename (no extension). A date suffix is appended.
 *  - presets:     Optional object: { presetKey: { label, fields: [colKey...] } }.
 *                 A "Select All" / "Deselect All" pair is always added.
 *  - formats:     Optional array of allowed formats. Default: ['excel','csv','pdf'].
 *  - title:       Optional modal title (default "Export").
 *  - buttonLabel: Optional button label (default "Export").
 *  - buttonClassName: Optional className override for the trigger button.
 *  - sheetName:   Optional Excel sheet name (default "Sheet1").
 *  - disabled:    Disable the button.
 *  - emptyMessage: Toast message when data is empty (default "No data to export").
 */
const ExportColumnPicker = ({
    data = [],
    columns = [],
    filename = 'export',
    presets = {},
    formats = ['excel', 'csv', 'pdf'],
    title = 'Export',
    buttonLabel = 'Export',
    buttonClassName = '',
    sheetName = 'Sheet1',
    disabled = false,
    emptyMessage = 'No data to export',
    // Optional: async function returning the full dataset matching current
    // filters (across all pages). When provided, the modal shows a "Export all
    // matching filters" toggle that uses this instead of the paged `data`.
    fetchAllData,
    // Optional total count for the "all matching" option label.
    totalRecords,
    // Controlled-mode props: when `externalOpen` is provided (not undefined),
    // the modal's open state is driven by the parent. `hideTrigger` optionally
    // hides the built-in button so the parent can provide its own trigger.
    externalOpen,
    onExternalClose,
    hideTrigger = false
}) => {
    const { settings } = useSettings();
    const isControlled = externalOpen !== undefined;
    const [internalOpen, setInternalOpen] = useState(false);
    const isOpen = isControlled ? externalOpen : internalOpen;
    const setIsOpen = (next) => {
        if (isControlled) {
            if (!next && onExternalClose) onExternalClose();
        } else {
            setInternalOpen(next);
        }
    };
    const [exporting, setExporting] = useState(false);
    const [selectedFormat, setSelectedFormat] = useState(formats[0] || 'excel');
    const [exportAll, setExportAll] = useState(false);

    // Default selection: any column with defaultSelected !== false
    const defaultKeys = useMemo(
        () => columns.filter(c => c.defaultSelected !== false).map(c => c.key),
        [columns]
    );
    const [selectedKeys, setSelectedKeys] = useState(defaultKeys);

    // Reset selection when columns change (e.g. parent re-renders with new config)
    useEffect(() => {
        setSelectedKeys(defaultKeys);
    }, [defaultKeys]);

    // Group columns by `group` field for rendering
    const grouped = useMemo(() => {
        const groups = {};
        columns.forEach(col => {
            const g = col.group || 'General';
            if (!groups[g]) groups[g] = [];
            groups[g].push(col);
        });
        return groups;
    }, [columns]);

    const openModal = () => {
        if (!data || data.length === 0) {
            toast.error(emptyMessage);
            return;
        }
        setIsOpen(true);
    };

    // In controlled mode, guard against being opened with empty data
    useEffect(() => {
        if (isControlled && externalOpen && (!data || data.length === 0)) {
            toast.error(emptyMessage);
            if (onExternalClose) onExternalClose();
        }
    }, [externalOpen, isControlled]); // eslint-disable-line react-hooks/exhaustive-deps

    const toggleKey = (key) => {
        setSelectedKeys(prev =>
            prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
        );
    };

    const selectAll = () => setSelectedKeys(columns.map(c => c.key));
    const deselectAll = () => setSelectedKeys([]);
    const applyPreset = (presetKey) => {
        const preset = presets[presetKey];
        if (preset && Array.isArray(preset.fields)) {
            setSelectedKeys(preset.fields.filter(k => columns.some(c => c.key === k)));
        }
    };

    const handleExport = async () => {
        if (selectedKeys.length === 0) {
            toast.error('Select at least one column');
            return;
        }
        const orderedCols = columns.filter(c => selectedKeys.includes(c.key));
        const headers = orderedCols.map(c => c.label);
        const dateStr = new Date().toISOString().split('T')[0];
        const safeBase = filename.replace(/\s+/g, '_');
        const toastId = `${safeBase}-export`;

        let exportData = data;
        if (exportAll && typeof fetchAllData === 'function') {
            try {
                setExporting(true);
                toast.loading('Loading all records…', { id: toastId });
                const all = await fetchAllData();
                if (!Array.isArray(all) || all.length === 0) {
                    toast.error(emptyMessage, { id: toastId });
                    setExporting(false);
                    return;
                }
                exportData = all;
            } catch (err) {
                toast.error('Failed to load all records', { id: toastId });
                setExporting(false);
                return;
            }
        }

        const rows = exportData.map(row =>
            orderedCols.map(c => {
                try {
                    const v = c.getValue ? c.getValue(row) : row[c.key];
                    return v == null ? '' : v;
                } catch {
                    return '';
                }
            })
        );

        try {
            setExporting(true);
            toast.loading(`Generating ${selectedFormat.toUpperCase()}…`, { id: toastId });

            if (selectedFormat === 'excel' || selectedFormat === 'xlsx') {
                await exportReport(`${safeBase}_${dateStr}.xlsx`, {
                    schoolName: settings?.institution?.name,
                    reportTitle: title || 'Export',
                    headers, rows, sheetName,
                });
            } else if (selectedFormat === 'csv') {
                exportCSV(`${safeBase}_${dateStr}.csv`, [headers, ...rows]);
            } else if (selectedFormat === 'pdf') {
                await exportPDF(`${safeBase}_${dateStr}.pdf`, headers, rows, settings?.institution);
            }

            toast.success(`${selectedFormat.toUpperCase()} downloaded`, { id: toastId });
            setIsOpen(false);
        } catch (err) {
            toast.error(`Failed to generate ${selectedFormat.toUpperCase()}`, { id: toastId });
        } finally {
            setExporting(false);
        }
    };

    const formatOptions = [
        { key: 'excel', label: 'Excel', Icon: FileSpreadsheet, color: 'text-green-600' },
        { key: 'csv', label: 'CSV', Icon: FileType, color: 'text-blue-600' },
        { key: 'pdf', label: 'PDF', Icon: FileText, color: 'text-red-500' }
    ].filter(f => formats.includes(f.key));

    return (
        <>
            {!hideTrigger && (
                <button
                    type="button"
                    onClick={openModal}
                    disabled={disabled}
                    className={
                        buttonClassName ||
                        'inline-flex items-center justify-center gap-2 px-4 py-2 border border-gray-300 dark:border-[#38383A] text-gray-700 dark:text-[#8E8E93] rounded-lg hover:bg-gray-50 dark:hover:bg-[#2C2C2E] disabled:opacity-50'
                    }
                >
                    <Download className="w-4 h-4" />
                    {buttonLabel}
                </button>
            )}

            {isOpen && createPortal(
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999] p-4">
                    <div className="bg-white dark:bg-[#1C1C1E] rounded-2xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
                        {/* Header */}
                        <div className="flex items-center justify-between p-5 border-b border-gray-200 dark:border-[#38383A] shrink-0">
                            <div>
                                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{title}</h2>
                                <p className="text-xs text-gray-500 dark:text-[#8E8E93] mt-0.5">
                                    {data.length} record{data.length !== 1 ? 's' : ''} • Pick columns and format
                                </p>
                            </div>
                            <button
                                onClick={() => setIsOpen(false)}
                                className="text-gray-400 hover:text-gray-600 dark:hover:text-white"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        {/* Body */}
                        <div className="p-5 overflow-y-auto flex-1">
                            {/* Presets */}
                            <div className="mb-5">
                                <h3 className="text-xs font-semibold text-gray-700 dark:text-[#8E8E93] uppercase tracking-wide mb-2">
                                    Quick Select
                                </h3>
                                <div className="flex flex-wrap gap-2">
                                    {Object.entries(presets).map(([k, p]) => (
                                        <button
                                            key={k}
                                            type="button"
                                            onClick={() => applyPreset(k)}
                                            className="px-3 py-1.5 text-xs font-medium bg-primary-50 dark:bg-[rgba(62,196,177,0.12)] text-primary-700 dark:text-[#3EC4B1] rounded-md hover:bg-primary-100 dark:hover:bg-[rgba(62,196,177,0.2)]"
                                        >
                                            {p.label}
                                        </button>
                                    ))}
                                    <button
                                        type="button"
                                        onClick={selectAll}
                                        className="px-3 py-1.5 text-xs font-medium bg-gray-100 dark:bg-[#2C2C2E] text-gray-700 dark:text-[#8E8E93] rounded-md hover:bg-gray-200 dark:hover:bg-[#38383A]"
                                    >
                                        Select All
                                    </button>
                                    <button
                                        type="button"
                                        onClick={deselectAll}
                                        className="px-3 py-1.5 text-xs font-medium bg-gray-100 dark:bg-[#2C2C2E] text-gray-700 dark:text-[#8E8E93] rounded-md hover:bg-gray-200 dark:hover:bg-[#38383A]"
                                    >
                                        Deselect All
                                    </button>
                                </div>
                            </div>

                            {/* Column groups */}
                            <div className="space-y-4">
                                {Object.entries(grouped).map(([groupName, cols]) => (
                                    <div
                                        key={groupName}
                                        className="border border-gray-200 dark:border-[#38383A] rounded-xl p-4"
                                    >
                                        <h3 className="text-xs font-semibold text-gray-900 dark:text-white uppercase tracking-wide mb-3">
                                            {groupName}
                                        </h3>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                            {cols.map(col => {
                                                const checked = selectedKeys.includes(col.key);
                                                return (
                                                    <label
                                                        key={col.key}
                                                        className="flex items-center cursor-pointer hover:bg-gray-50 dark:hover:bg-[#2C2C2E] p-2 rounded-md"
                                                    >
                                                        <div className="relative flex items-center justify-center w-4 h-4">
                                                            <input
                                                                type="checkbox"
                                                                checked={checked}
                                                                onChange={() => toggleKey(col.key)}
                                                                className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 dark:border-[#38383A] rounded"
                                                            />
                                                            {checked && (
                                                                <Check className="h-3 w-3 text-white absolute pointer-events-none" />
                                                            )}
                                                        </div>
                                                        <span className="ml-2 text-sm text-gray-700 dark:text-white">
                                                            {col.label}
                                                        </span>
                                                    </label>
                                                );
                                            })}
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Format selection */}
                            <div className="mt-5">
                                <h3 className="text-xs font-semibold text-gray-700 dark:text-[#8E8E93] uppercase tracking-wide mb-2">
                                    Format
                                </h3>
                                <div className="flex flex-wrap gap-2">
                                    {formatOptions.map(({ key, label, Icon, color }) => {
                                        const active = selectedFormat === key;
                                        return (
                                            <button
                                                key={key}
                                                type="button"
                                                onClick={() => setSelectedFormat(key)}
                                                className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
                                                    active
                                                        ? 'border-primary-500 bg-primary-50 dark:bg-[rgba(62,196,177,0.12)] text-primary-700 dark:text-[#3EC4B1]'
                                                        : 'border-gray-300 dark:border-[#38383A] text-gray-700 dark:text-[#8E8E93] hover:bg-gray-50 dark:hover:bg-[#2C2C2E]'
                                                }`}
                                            >
                                                <Icon className={`w-4 h-4 ${active ? '' : color}`} />
                                                {label}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Scope toggle */}
                            {typeof fetchAllData === 'function' && (
                                <div className="mt-5">
                                    <h3 className="text-xs font-semibold text-gray-700 dark:text-[#8E8E93] uppercase tracking-wide mb-2">
                                        Records to Export
                                    </h3>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                        <button
                                            type="button"
                                            onClick={() => setExportAll(false)}
                                            className={`text-left px-4 py-3 rounded-lg border text-sm transition-colors ${
                                                !exportAll
                                                    ? 'border-primary-500 bg-primary-50 dark:bg-[rgba(62,196,177,0.12)] text-primary-700 dark:text-[#3EC4B1]'
                                                    : 'border-gray-300 dark:border-[#38383A] text-gray-700 dark:text-[#8E8E93] hover:bg-gray-50 dark:hover:bg-[#2C2C2E]'
                                            }`}
                                        >
                                            <div className="font-medium">Current page</div>
                                            <div className="text-xs opacity-75 mt-0.5">{data.length} record{data.length !== 1 ? 's' : ''}</div>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setExportAll(true)}
                                            className={`text-left px-4 py-3 rounded-lg border text-sm transition-colors ${
                                                exportAll
                                                    ? 'border-primary-500 bg-primary-50 dark:bg-[rgba(62,196,177,0.12)] text-primary-700 dark:text-[#3EC4B1]'
                                                    : 'border-gray-300 dark:border-[#38383A] text-gray-700 dark:text-[#8E8E93] hover:bg-gray-50 dark:hover:bg-[#2C2C2E]'
                                            }`}
                                        >
                                            <div className="font-medium">All matching filters</div>
                                            <div className="text-xs opacity-75 mt-0.5">
                                                {typeof totalRecords === 'number' ? `${totalRecords} record${totalRecords !== 1 ? 's' : ''}` : 'Fetches across all pages'}
                                            </div>
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* Selected count */}
                            <div className="mt-5 p-3 bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 rounded-md">
                                <p className="text-xs text-blue-900 dark:text-blue-400">
                                    <span className="font-semibold">{selectedKeys.length}</span> of{' '}
                                    <span className="font-semibold">{columns.length}</span> columns selected
                                </p>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="flex items-center justify-end gap-3 p-5 border-t border-gray-200 dark:border-[#38383A] bg-gray-50 dark:bg-[#2C2C2E] shrink-0">
                            <button
                                type="button"
                                onClick={() => setIsOpen(false)}
                                disabled={exporting}
                                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-[#8E8E93] bg-white dark:bg-[#1C1C1E] border border-gray-300 dark:border-[#38383A] rounded-md hover:bg-gray-50 dark:hover:bg-[#38383A] disabled:opacity-50"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleExport}
                                disabled={exporting || selectedKeys.length === 0}
                                className="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-md hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
                            >
                                <Download className="w-4 h-4" />
                                {exporting
                                    ? 'Exporting…'
                                    : (() => {
                                        const cnt = exportAll && typeof totalRecords === 'number' ? totalRecords : data.length;
                                        return `Export ${cnt} Record${cnt !== 1 ? 's' : ''} • ${selectedKeys.length} Column${selectedKeys.length !== 1 ? 's' : ''}`;
                                    })()}
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </>
    );
};

export default ExportColumnPicker;
