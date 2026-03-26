import React, { useMemo, useState } from 'react';

export interface FilterOption {
  label: string;
  value: string | number;
}

export interface ChartWithFiltersProps<T> {
  title: string;
  data: T[];
  dateAccessor: (item: T) => Date;
  valueAccessor: (item: T) => number;
  classOptions?: FilterOption[];
  teacherOptions?: FilterOption[];
  sectionOptions?: FilterOption[];
  onExport?: (format: 'png' | 'pdf' | 'csv') => void;
}

export const ChartWithFilters = <T,>({
  title,
  data,
  dateAccessor,
  valueAccessor,
  classOptions = [],
  teacherOptions = [],
  sectionOptions = [],
  onExport
}: ChartWithFiltersProps<T>) => {
  const [range, setRange] = useState<'7d' | '30d' | '90d' | 'ytd' | 'all'>('30d');
  const [klass, setKlass] = useState<string | number>('all');
  const [teacher, setTeacher] = useState<string | number>('all');
  const [section, setSection] = useState<string | number>('all');

  const filtered = useMemo(() => {
    const now = new Date();
    const start = new Date(now);
    if (range === '7d') start.setDate(now.getDate() - 7);
    else if (range === '30d') start.setDate(now.getDate() - 30);
    else if (range === '90d') start.setDate(now.getDate() - 90);
    else if (range === 'ytd') start.setMonth(0, 1);
    else start.setFullYear(1970, 0, 1);

    return data.filter((d) => dateAccessor(d) >= start);
  }, [data, range, dateAccessor]);

  const total = useMemo(() => filtered.reduce((acc, d) => acc + valueAccessor(d), 0), [filtered, valueAccessor]);

  return (
    <section className="rounded-lg bg-white shadow-card p-4">
      <header className="flex items-center justify-between gap-2">
        <h3 className="text-base font-semibold text-slate-900">{title}</h3>
        <div className="flex items-center gap-2">
          <select aria-label="Date range" className="rounded-md border border-slate-200 px-2 py-1 text-sm" value={range} onChange={(e) => setRange(e.target.value as any)}>
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
            <option value="ytd">Year to date</option>
            <option value="all">All time</option>
          </select>
          {!!classOptions.length && (
            <select aria-label="Class" className="rounded-md border border-slate-200 px-2 py-1 text-sm" value={klass} onChange={(e) => setKlass(e.target.value)}>
              <option value="all">All classes</option>
              {classOptions.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          )}
          {!!teacherOptions.length && (
            <select aria-label="Teacher" className="rounded-md border border-slate-200 px-2 py-1 text-sm" value={teacher} onChange={(e) => setTeacher(e.target.value)}>
              <option value="all">All teachers</option>
              {teacherOptions.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          )}
          {!!sectionOptions.length && (
            <select aria-label="Section" className="rounded-md border border-slate-200 px-2 py-1 text-sm" value={section} onChange={(e) => setSection(e.target.value)}>
              <option value="all">All sections</option>
              {sectionOptions.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          )}
          {onExport && (
            <div className="relative">
              <button className="rounded-md bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-200 focus:ring-2 focus:ring-brand">Export</button>
              {/* Consumers can implement menu; keeping simple here */}
            </div>
          )}
        </div>
      </header>
      <div className="mt-4 h-40 rounded-md bg-slate-50 flex items-center justify-center text-slate-400">
        {/* Placeholder for chart library e.g. ApexCharts/Recharts */}
        Chart placeholder – total: {total}
      </div>
    </section>
  );
};

export default ChartWithFilters;


