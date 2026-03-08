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
 * @param {object} schoolData - Optional tenant settings to render school header
 */
export const exportPDF = async (filename, headers, rows, schoolData = null) => {
  // Lazy-import to avoid bundle cost when not needed
  const { jsPDF } = await import('jspdf');
  const { default: autoTable } = await import('jspdf-autotable');

  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();

  let startY = 36;

  if (schoolData) {
    const centerX = pageWidth / 2;
    let currentY = 40;

    // School Name
    doc.setFontSize(24);
    doc.setTextColor(0, 0, 0); // Black
    doc.setFont('helvetica', 'bold');
    if (schoolData.name) {
      doc.text(schoolData.name, centerX, currentY, { align: 'center' });
      currentY += 16;
    }

    // Address
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    if (schoolData.address) {
      const { street, city, state, pincode, country } = schoolData.address;
      const addrParts = [street, city, state, pincode, country].filter(p => p && String(p).trim());
      if (addrParts.length > 0) {
        doc.text(addrParts.join(', '), centerX, currentY, { align: 'center' });
        currentY += 14;
      }
    }

    // Contact Details
    if (schoolData.contact) {
      const { phone, email } = schoolData.contact;
      const contactParts = [];
      if (phone) contactParts.push(`Phone: ${phone}`);
      if (email) contactParts.push(`Email: ${email}`);
      if (contactParts.length > 0) {
        doc.text(contactParts.join(' | '), centerX, currentY, { align: 'center' });
        currentY += 14;
      }
    }

    // Board & Affiliation Details
    const board = schoolData.board || '';
    const affiliationNumber = schoolData.affiliationNumber || '';
    const schoolCode = schoolData.schoolCode || '';
    const affiliationParts = [];
    if (board || affiliationNumber) {
      affiliationParts.push(`${board} Affiliation No: ${affiliationNumber}`.trim());
    }
    if (schoolCode) {
      affiliationParts.push(`School Code: ${schoolCode}`);
    }
    if (affiliationParts.length > 0) {
      doc.text(affiliationParts.join(' | '), centerX, currentY, { align: 'center' });
      currentY += 14;
    }

    // UDISE Code
    if (schoolData.udiseCode) {
      doc.text(`UDISE No: ${schoolData.udiseCode}`, centerX, currentY, { align: 'center' });
      currentY += 18;
    } else {
      currentY += 4;
    }

    // Logo Logic (Left Aligned)
    if (schoolData.logo) {
      try {
        const logoWidth = 70;
        const logoX = 60;
        const logoY = 30; // Aligned near top

        // Fetch image as blob to avoid canvas taint/CORS issues with jsPDF
        const res = await fetch(schoolData.logo);
        const blob = await res.blob();

        const base64data = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });

        // Wait for image loading
        const img = new Image();
        img.src = base64data;
        await new Promise((resolve, reject) => {
          img.onload = resolve;
          img.onerror = reject;
        });

        const logoHeight = (img.height * logoWidth) / img.width;
        const imageFormat = (schoolData.logo.toLowerCase().endsWith('.png')) ? 'PNG' : 'JPEG';
        doc.addImage(base64data, imageFormat, logoX, logoY, logoWidth, logoHeight);
      } catch (err) {
        console.warn('Failed to load logo for PDF:', err);
      }
    }

    // Separator Line
    doc.setLineWidth(1);
    doc.setDrawColor(0, 0, 0);
    doc.line(40, currentY, pageWidth - 40, currentY);
    currentY += 24;

    // Title
    doc.setFontSize(14);
    doc.setTextColor(15, 118, 110); // teal-600
    doc.setFont('helvetica', 'bold');
    doc.text('Student Export Report', centerX, currentY, { align: 'center' });
    currentY += 16;

    // Generated Date
    doc.setFontSize(9);
    doc.setTextColor(100);
    doc.setFont('helvetica', 'normal');
    doc.text(`Generated: ${new Date().toLocaleString()}`, centerX, currentY, { align: 'center' });

    startY = currentY + 14;

  } else {
    // Title (Fallback)
    doc.setFontSize(14);
    doc.setTextColor(15, 118, 110); // teal-600
    doc.text('Student Export Report', 40, 36);

    doc.setFontSize(9);
    doc.setTextColor(100);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 40, 52);

    startY = 64;
  }

  autoTable(doc, {
    startY: startY,
    head: [headers],
    body: rows,
    theme: 'grid',  // We can use grid or striped with white fills
    headStyles: {
      fillColor: [15, 118, 110],  // teal
      textColor: 255,
      fontStyle: 'bold',
      fontSize: 8,
    },
    bodyStyles: { fontSize: 7.5, textColor: 40, fillColor: [255, 255, 255] },
    alternateRowStyles: { fillColor: [255, 255, 255] }, // White rows everywhere
    margin: { left: 40, right: 40 },
    tableWidth: 'auto',
    styles: { overflow: 'linebreak', cellPadding: 3, lineColor: [220, 220, 220], lineWidth: 0.1 },
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
