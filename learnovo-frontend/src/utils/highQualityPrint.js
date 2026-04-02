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
 * @param {'a4'|'letter'} [options.format='a4'] - Page format
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
    allowTaint: false,
    backgroundColor: '#ffffff',
    logging: false,
    windowWidth: element.scrollWidth,
    windowHeight: element.scrollHeight,
    onclone: (_clonedDoc, clonedEl) => {
      clonedEl.style.webkitPrintColorAdjust = 'exact';
      clonedEl.style.printColorAdjust = 'exact';
      clonedEl.style.overflow = 'visible';
      clonedEl.style.height = 'auto';
      clonedEl.style.maxHeight = 'none';
      clonedEl.style.position = 'relative';
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

  // 4. Open PDF in new tab and trigger print
  const pdfBlob = pdf.output('blob');
  const pdfUrl = URL.createObjectURL(pdfBlob);
  const printWindow = window.open(pdfUrl, '_blank');

  if (printWindow) {
    printWindow.addEventListener('load', () => {
      setTimeout(() => {
        printWindow.focus();
        printWindow.print();
      }, 500);
    });
  } else {
    // Popup blocked — fallback to download
    const link = document.createElement('a');
    link.href = pdfUrl;
    link.download = `${filename}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  // 5. Cleanup
  setTimeout(() => URL.revokeObjectURL(pdfUrl), 60000);
}
