import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

/**
 * Generates a high-quality (~300 DPI) PDF from a DOM element and opens
 * the browser print dialog with the PDF loaded — bypassing window.print()
 * so output quality is baked into the file itself.
 *
 * @param {HTMLElement} element - DOM element to capture
 * @param {string} [filename='document'] - PDF filename without extension
 * @param {Object} [options]
 * @param {number} [options.scale=3] - Canvas scale factor (3 ≈ 288 DPI)
 * @param {'a4'|'a5'|'letter'} [options.format='a4'] - Page format
 * @param {'portrait'|'landscape'} [options.orientation='portrait']
 * @param {number} [options.margin=10] - Page margin in mm
 * @returns {Promise<void>}
 */
export async function highQualityPrint(element, filename = 'document', options = {}) {
  const {
    scale = 3,
    format = 'a4',
    orientation = 'portrait',
    margin = 10,
  } = options;

  if (!element) {
    throw new Error('highQualityPrint: No element provided');
  }

  // 1. Capture element as high-resolution canvas
  const canvas = await html2canvas(element, {
    scale,
    useCORS: true,
    allowTaint: true,
    backgroundColor: '#f9fafb',
    logging: false,
    width: element.scrollWidth,
    height: element.scrollHeight,
    windowWidth: element.scrollWidth,
    windowHeight: element.scrollHeight,
    onclone: (_clonedDoc, clonedEl) => {
      // Ensure print colors are preserved
      clonedEl.style.webkitPrintColorAdjust = 'exact';
      clonedEl.style.printColorAdjust = 'exact';
      clonedEl.style.overflow = 'visible';
      clonedEl.style.height = 'auto';
      clonedEl.style.maxHeight = 'none';
      clonedEl.style.position = 'relative';
      // Force all images to render
      const images = clonedEl.querySelectorAll('img');
      images.forEach(img => {
        img.crossOrigin = 'anonymous';
        img.style.imageRendering = 'high-quality';
      });
    },
  });

  // 2. Create PDF
  const pdf = new jsPDF({
    orientation,
    unit: 'mm',
    format,
    compress: true,
  });

  const pageWidth = pdf.internal.pageSize.getWidth() - margin * 2;
  const pageHeight = pdf.internal.pageSize.getHeight() - margin * 2;

  const imgWidth = pageWidth;
  const imgHeight = (canvas.height * imgWidth) / canvas.width;

  // 3. Multi-page handling — slice canvas into page-sized chunks
  const totalPages = Math.max(1, Math.ceil(imgHeight / pageHeight));
  const canvasPageHeight = Math.floor(canvas.height / totalPages);

  for (let page = 0; page < totalPages; page++) {
    if (page > 0) pdf.addPage();

    const pageCanvas = document.createElement('canvas');
    pageCanvas.width = canvas.width;

    // Last page may have remaining pixels
    const isLastPage = page === totalPages - 1;
    pageCanvas.height = isLastPage
      ? canvas.height - page * canvasPageHeight
      : canvasPageHeight;

    const ctx = pageCanvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
    ctx.drawImage(
      canvas,
      0, page * canvasPageHeight,
      canvas.width, pageCanvas.height,
      0, 0,
      pageCanvas.width, pageCanvas.height
    );

    const pageImgData = pageCanvas.toDataURL('image/png', 1.0);
    const sliceImgHeight = (pageCanvas.height * imgWidth) / pageCanvas.width;

    pdf.addImage(
      pageImgData,
      'PNG',
      margin,
      margin,
      imgWidth,
      sliceImgHeight,
      undefined,
      'NONE'
    );
  }

  // 4. Download PDF for best print quality via system's native PDF viewer
  const pdfBlob = pdf.output('blob');
  const pdfUrl = URL.createObjectURL(pdfBlob);

  const link = document.createElement('a');
  link.href = pdfUrl;
  link.download = `${filename}.pdf`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  // 5. Cleanup
  setTimeout(() => URL.revokeObjectURL(pdfUrl), 60000);
}

/**
 * Print an existing certificate by fetching its PDF from the backend
 * and opening the browser's print dialog.
 *
 * This bypasses html2canvas entirely — the backend Puppeteer-rendered
 * PDF is the source of truth, so output is pixel-perfect.
 *
 * Opens the PDF in a new window and triggers the system print dialog,
 * allowing users to print directly without downloading first.
 *
 * @param {string} certId - Certificate ID
 * @param {string} [filename='certificate.pdf'] - Filename for print dialog
 * @returns {Promise<void>}
 */
export async function printCertificatePdf(certId, filename = 'certificate.pdf') {
  const token = localStorage.getItem('token');
  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

  const response = await fetch(`${API_URL}/certificates/${certId}/download`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    throw new Error('Failed to fetch certificate PDF');
  }

  const blob = await response.blob();
  const pdfUrl = URL.createObjectURL(blob);

  // Open the PDF in a new window so the browser's native print dialog
  // can be triggered. This allows users to print directly.
  const printWindow = window.open(pdfUrl);

  if (printWindow) {
    // Wait a moment for the PDF to load, then trigger print dialog
    printWindow.onload = () => {
      printWindow.print();
    };
  } else {
    // Fallback if popup is blocked: download instead
    const link = document.createElement('a');
    link.href = pdfUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  // Clean up after 2 minutes (print typically finishes quickly)
  setTimeout(() => URL.revokeObjectURL(pdfUrl), 120000);
}
