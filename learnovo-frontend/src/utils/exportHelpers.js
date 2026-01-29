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
  // Create a new workbook
  const wb = XLSX.utils.book_new();

  // Convert rows to worksheet
  const ws = XLSX.utils.aoa_to_sheet(rows);

  // Add worksheet to workbook
  XLSX.utils.book_append_sheet(wb, ws, sheetName);

  // Generate Excel file and trigger download
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


