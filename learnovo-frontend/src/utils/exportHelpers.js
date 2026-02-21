import * as XLSX from 'xlsx';

export const exportCSV = (filename, rows) => {
  const processRow = (row) => row.map((v) => '"' + String(v ?? '').replaceAll('"', '""') + '"').join(',')
  const csvContent = rows.map(processRow).join('\n')
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  const url = URL.createObjectURL(blob)
  link.setAttribute('href', url)
  link.setAttribute('download', filename)
  link.click()
  URL.revokeObjectURL(url)
}

export const exportExcel = (filename, rows, sheetName = 'Sheet1') => {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, filename);
}

// Export data in both CSV and Excel formats
export const exportData = (baseFilename, rows, format = 'csv') => {
  const filenameWithoutExt = baseFilename.replace(/\.(csv|xlsx)$/i, '');

  if (format === 'excel' || format === 'xlsx') {
    exportExcel(`${filenameWithoutExt}.xlsx`, rows);
  } else {
    exportCSV(`${filenameWithoutExt}.csv`, rows);
  }
}

/**
 * Export data as PDF using jsPDF + autoTable (client-side)
 * @param {string} filename  - e.g. "students_export_2026-02-21.pdf"
 * @param {string[]} headers - Column header labels
 * @param {string[][]} rows  - 2-D array of cell values
 */
export const exportPDF = async (filename, headers, rows) => {
  // Lazy-import to avoid bundle cost when not needed
  const { jsPDF } = await import('jspdf');
  const { default: autoTable } = await import('jspdf-autotable');

  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });

  // Title
  doc.setFontSize(14);
  doc.setTextColor(15, 118, 110); // teal-600
  doc.text('Student Export Report', 40, 36);

  doc.setFontSize(9);
  doc.setTextColor(100);
  doc.text(`Generated: ${new Date().toLocaleString()}`, 40, 52);

  autoTable(doc, {
    startY: 64,
    head: [headers],
    body: rows,
    theme: 'striped',
    headStyles: {
      fillColor: [15, 118, 110],  // teal
      textColor: 255,
      fontStyle: 'bold',
      fontSize: 8,
    },
    bodyStyles: { fontSize: 7.5, textColor: 40 },
    alternateRowStyles: { fillColor: [240, 253, 250] },
    margin: { left: 40, right: 40 },
    tableWidth: 'auto',
    styles: { overflow: 'linebreak', cellPadding: 3 },
  });

  doc.save(filename);
}

export const exportPNGPlaceholder = (filename) => {
  const canvas = document.createElement('canvas')
  canvas.width = 1200
  canvas.height = 600
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.fillStyle = '#111827'
  ctx.font = '20px sans-serif'
  ctx.fillText('Export placeholder. Replace with chart library export.', 40, 60)
  canvas.toBlob((blob) => {
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.href = url
    link.download = filename
    link.click()
    URL.revokeObjectURL(url)
  })
}
