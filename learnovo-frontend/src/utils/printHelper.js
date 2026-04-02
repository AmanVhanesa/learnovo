/**
 * Shared high-quality print utility for Learnovo.
 * Opens a new window with the provided HTML and triggers browser print.
 * All templates use @page { margin: 0 } to suppress browser headers/footers.
 */

import { CERT_COLORS as C } from './certificateColors';

export function openPrintWindow(html) {
  // Use document.write instead of blob URL to avoid "about:blank" / "blob:..." in print headers
  const win = window.open('', '_blank', 'width=900,height=700');
  if (!win) {
    // Fallback: download as HTML file if popup is blocked
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'print-document.html';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 120000);
    return;
  }
  win.document.write(html);
  win.document.close();
}

/* ═══════════════════════════════════════════════════════════
   TC / BONAFIDE — Print HTML that EXACTLY matches
   CertificatePreviewContent.jsx (same sizes, colors, spacing)
   ═══════════════════════════════════════════════════════════ */

export function buildCertificatePrintHTML({ type, data, certificateNumber }) {
  const d = data || {};
  const isTC = type === 'TC';
  const title = isTC ? 'School Leaving Certificate' : 'Bonafide Certificate';
  const watermark = isTC ? 'LEAVING CERTIFICATE' : 'BONAFIDE';

  // TC table rows — same as CertificatePreviewContent
  const tcRows = [
    ['Name of the Student', d.studentName, true],
    ["Father's / Guardian's Name", d.fatherName],
    ["Mother's Name", d.motherName],
    ['Nationality', d.nationality],
    ['Category (Gen / SC / ST / OBC)', d.category],
    ['Date of Birth', d.dob, true],
    ['PEN Number', d.penNumber],
    ['Date of First Admission in School', d.admissionDate],
    ['Class in which Last Studied', d.class, true],
    ['Board Examination Last Taken', d.boardResult],
    ['Whether Qualified for Promotion', d.promotionStatus],
    ['Subjects Studied', d.subjects],
    ['Month up to which Fees Paid', d.feeStatus],
    ['General Conduct', d.conduct],
    ['Date of Application for Certificate', d.applicationDate],
    ['Date of Issue of Certificate', d.issueDate],
    ['Reason for Leaving the School', d.leavingReason, true],
    ['Any Other Remarks', d.remarks],
  ];

  const tcTableRows = tcRows.map(([label, value, bold], i) => {
    const bg = i % 2 === 0 ? C.tableRowAlt : C.tableRowWhite;
    const border = i < tcRows.length - 1 ? `border-bottom:1px solid ${C.tableBorder};` : '';
    const valColor = bold ? C.valueTextBold : C.valueText;
    const valWeight = bold ? 700 : 500;
    const subjectStyle = label === 'Subjects Studied' ? 'font-size:8px;line-height:1.5;' : '';
    return `<tr style="background:${bg};-webkit-print-color-adjust:exact;print-color-adjust:exact">
      <td style="width:22px;padding:4px 8px;${border}border-right:1px solid ${C.tableBorder};font-weight:600;color:${C.tableNumberCol};text-align:center;font-size:9px;vertical-align:middle;line-height:1.3">${String(i + 1).padStart(2, '0')}</td>
      <td style="width:42%;padding:4px 10px;${border}border-right:1px solid ${C.tableBorder};font-weight:600;color:${C.tableLabelText};font-size:10px;vertical-align:middle;line-height:1.3">${label}</td>
      <td style="padding:4px 10px;${border}color:${valColor};font-weight:${valWeight};font-size:10px;vertical-align:middle;line-height:1.3;${subjectStyle}">${value || '-'}</td>
    </tr>`;
  }).join('');

  // Bonafide details — same as CertificatePreviewContent
  const bonafideDetails = [
    ['Student Name', d.studentName],
    ['Admission Number', d.admissionNumber],
    ["Father's Name", d.fatherName],
    ["Mother's Name", d.motherName],
    ['Class & Section', `${d.class || ''} - ${d.section || ''}`],
    ['Date of Birth', d.dob],
    ['Academic Session', d.academicYear],
    ['Board / Affiliation', d.schoolBoard || d.board || '-'],
  ];

  const bonafideGrid = bonafideDetails.map(([label, value]) =>
    `<div style="display:flex;flex-direction:column;gap:2px">
      <span style="font-size:7px;font-weight:600;color:${C.bonafideDetailLabel};text-transform:uppercase;letter-spacing:0.8px">${label}</span>
      <span style="font-size:10px;font-weight:700;color:${C.valueTextBold}">${value || '-'}</span>
    </div>`
  ).join('');

  const hl = (text) => `<span style="font-weight:700;color:${C.valueTextBold};border-bottom:1.5px solid ${C.highlightUnderline}">${text || '-'}</span>`;

  // School header
  const phoneEmail = [
    d.schoolPhone ? `Phone: ${d.schoolPhone}` : '',
    d.schoolEmail ? `Email: ${d.schoolEmail}` : '',
  ].filter(Boolean).join(' | ');

  const logoHtml = d.schoolLogo
    ? `<div style="position:absolute;left:20px;top:10px;width:78px;height:78px;display:flex;align-items:center;justify-content:center;border-radius:6px;overflow:hidden"><img src="${d.schoolLogo}" style="width:78px;height:78px;object-fit:contain" /></div>`
    : '';

  const principalSigHtml = d.principalSignature
    ? `<img src="${d.principalSignature}" style="max-height:52px;max-width:120px;object-fit:contain;margin:0 auto 3px;display:block" />`
    : '';

  const affiliationRow = (d.affiliationNumber || d.schoolCode || d.udiseCode)
    ? `<div style="display:flex;justify-content:center;gap:15px;margin-top:5px;flex-wrap:wrap">
        ${d.affiliationNumber ? `<span style="font-size:8px;color:${C.secondaryText};font-weight:500;line-height:1.7">Affiliation No: <strong style="font-weight:700;color:${C.valueTextBold}">${d.affiliationNumber}</strong></span>` : ''}
        ${d.schoolCode ? `<span style="font-size:8px;color:${C.secondaryText};font-weight:500;line-height:1.7">School Code: <strong style="font-weight:700;color:${C.valueTextBold}">${d.schoolCode}</strong></span>` : ''}
        ${d.udiseCode ? `<span style="font-size:8px;color:${C.secondaryText};font-weight:500;line-height:1.7">UDISE: <strong style="font-weight:700;color:${C.valueTextBold}">${d.udiseCode}</strong></span>` : ''}
      </div>` : '';

  // TC content
  const tcContent = `
    <div style="margin:6px 14px 0;border-radius:6px;overflow:hidden;border:1px solid ${C.tableBorder};flex-shrink:0">
      <table style="width:100%;border-collapse:separate;border-spacing:0;font-size:10px"><tbody>${tcTableRows}</tbody></table>
    </div>
    <div style="margin:5px 14px 0;flex-shrink:0">
      <div style="background:${C.noteBg};border:1px solid ${C.noteBorder};border-radius:5px;padding:5px 10px">
        <div style="font-size:8px;font-weight:700;color:${C.noteTitle};text-transform:uppercase;letter-spacing:0.5px">Important Note</div>
        <p style="font-size:8px;font-weight:500;color:${C.noteText};line-height:1.5;margin-top:1px">This certificate is issued based on school records. No alteration shall be made on this certificate. Erasing or overwriting renders it invalid.</p>
      </div>
    </div>
    <div style="padding:6px 20px 0;flex-shrink:0">
      <p style="font-size:8px;color:${C.certText};font-weight:500;font-style:italic;line-height:1.45;max-width:100%">Certified that the above information is in accordance with school records. This certificate does not entitle the holder to any benefits unless countersigned by competent authority.</p>
      <div style="font-size:9px;color:${C.valueTextBold};font-weight:600;margin-top:3px">Place: ${d.place || d.schoolAddress?.split(',').pop()?.trim() || '-'}</div>
    </div>`;

  // Bonafide content
  const bonafideContent = `
    <div style="padding:16px 22px 0;flex-shrink:0">
      <div style="font-family:Georgia,'Times New Roman',serif;font-size:12px;font-weight:600;color:${C.bonafideSubheading};text-align:center;letter-spacing:2px;text-transform:uppercase;margin-bottom:14px;position:relative">
        To Whom It May Concern
        <div style="width:40px;height:2px;margin:6px auto 0;background:${C.accentGradient};border-radius:2px"></div>
      </div>
      <p style="font-size:11px;line-height:2;color:${C.valueText};font-weight:500;text-align:justify">
        This is to certify that ${hl(d.studentName)},
        Son/Daughter of Shri ${hl(d.fatherName)}
        and Smt. ${hl(d.motherName)},
        is a bonafide student of this institution. He/She is currently studying in
        Class ${hl(`${d.class || '-'} (${d.section || '-'})`)}
        for the Academic Session ${hl(d.academicYear)}.
        His/Her date of birth as per our school records is ${hl(d.dob)}.
      </p>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px 22px;margin-top:16px;padding:14px 18px;background:${C.bonafideDetailBg};border-radius:8px;border:1px solid ${C.bonafideDetailBorder}">
        ${bonafideGrid}
      </div>
    </div>
    <div style="padding:12px 22px 0;flex-shrink:0">
      <p style="font-size:10px;color:${C.secondaryText};font-weight:500;line-height:1.8;text-align:justify">
        This certificate is issued on the request of the student/parent for the purpose of <span style="font-weight:700;color:${C.valueTextBold}">${d.purpose || '-'}</span>.
        No fees are due from the student at the time of issue of this certificate.
      </p>
    </div>
    <div style="padding:10px 22px 0;flex-shrink:0">
      <div style="font-size:9px;color:${C.valueTextBold};font-weight:600">Place: ${d.place || d.schoolAddress?.split(',').pop()?.trim() || '-'}</div>
    </div>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>${title} ${certificateNumber ? '\u2014 ' + certificateNumber : ''}</title>
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;800;900&display=swap" rel="stylesheet">
<style>
  *{margin:0;padding:0;box-sizing:border-box;-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important;color-adjust:exact!important}
  @page{size:A4 portrait;margin:0}
  body{font-family:'Helvetica Neue',Arial,'Noto Sans',sans-serif;background:#e5e7eb;color:${C.labelText};font-size:13px;-webkit-font-smoothing:antialiased}
  /* Outer container */
  .page{width:595px;min-height:842px;position:relative;overflow:hidden;background:#f9fafb;margin:0 auto}
  /* White card */
  .card{position:absolute;top:10px;left:10px;right:10px;bottom:10px;background:#fff;border-radius:14px;box-shadow:0 2px 24px rgba(0,0,0,0.07);overflow:hidden;display:flex;flex-direction:column}
  /* Decorative shapes */
  .deco{position:absolute;top:0;right:0;width:100%;height:100%;pointer-events:none;z-index:0;overflow:hidden;border-radius:14px}
  .deco .c1{position:absolute;top:-60px;right:-40px;width:240px;height:240px;background:${C.decoCircle1};border-radius:50%}
  .deco .c2{position:absolute;top:60px;right:-60px;width:180px;height:340px;background:${C.decoCircle4};transform:rotate(-25deg);border-radius:60px}
  .deco .c3{position:absolute;bottom:-40px;left:-45px;width:195px;height:195px;background:${C.decoCircle3};border-radius:50%}
  .deco .c4{position:absolute;bottom:90px;left:30px;width:120px;height:225px;background:${C.decoCircle2};transform:rotate(20deg);border-radius:45px}
  /* Watermark */
  .watermark{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%) rotate(-35deg);font-family:Georgia,'Times New Roman',serif;font-size:${isTC ? 44 : 54}px;font-weight:700;color:${C.watermarkColor};letter-spacing:${isTC ? 10 : 14}px;white-space:nowrap;z-index:0;pointer-events:none;text-transform:uppercase}
  .content{position:relative;z-index:1;display:flex;flex-direction:column;flex:1}
  /* Toolbar */
  .toolbar{position:fixed;top:0;left:0;right:0;background:#1C1C1E;color:#fff;padding:10px 24px;display:flex;gap:10px;align-items:center;z-index:999;font-family:'Helvetica Neue',Arial,sans-serif}
  .toolbar-title{flex:1;font-size:13px;font-weight:500}
  .tbtn{padding:7px 18px;border:none;border-radius:8px;cursor:pointer;font-size:12px;font-weight:600;font-family:inherit;transition:opacity .15s}
  .tbtn:hover{opacity:.85}
  .tbtn-print{background:${C.headerBg};color:#fff}
  .tbtn-close{background:#38383A;color:#8E8E93}
  .page-body{padding-top:54px;display:flex;justify-content:center;padding-bottom:40px}
  @media print{
    *{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important;color-adjust:exact!important}
    .toolbar{display:none!important}
    .page-body{padding:0!important}
    body{background:#fff}
    .page{box-shadow:none;margin:0 auto}
  }
</style>
</head>
<body>
<div class="toolbar">
  <span class="toolbar-title">${title} ${certificateNumber ? '\u2014 ' + certificateNumber : ''}</span>
  <button class="tbtn tbtn-print" onclick="window.print()">Print</button>
  <button class="tbtn tbtn-close" onclick="window.close()">Close</button>
</div>
<div class="page-body">
<div class="page">
  <div class="card">
    <div class="deco"><div class="c1"></div><div class="c2"></div><div class="c3"></div><div class="c4"></div></div>
    <div class="watermark">${watermark}</div>
    <div class="content">
      <!-- Header -->
      <div style="position:relative;padding:16px 20px 8px;text-align:center;flex-shrink:0">
        ${logoHtml}
        <div style="font-family:'Playfair Display',Georgia,'Times New Roman',serif;font-size:21px;font-weight:800;color:${C.schoolNameText};letter-spacing:2px;line-height:1.1;text-transform:uppercase;white-space:nowrap">${d.schoolName || 'School Name'}</div>
        <div style="font-size:9px;color:${C.secondaryText};font-weight:500;margin-top:3px">${d.schoolAddress || ''}</div>
        ${phoneEmail ? `<div style="font-size:9px;color:${C.secondaryText};font-weight:500;margin-top:2px">${phoneEmail}</div>` : ''}
        ${affiliationRow}
      </div>
      <!-- Divider -->
      <div style="height:1px;background:${C.borderColor};margin:0 20px;flex-shrink:0"></div>
      <!-- Title badge — dark solid background -->
      <div style="padding:14px 20px;text-align:center;display:flex;flex-direction:column;align-items:center;flex-shrink:0">
        <div style="background:${C.titleBadgeBg};border-radius:10px;padding:10px 24px 12px;display:inline-flex;flex-direction:column;align-items:center">
          <div style="font-family:'Helvetica Neue',Arial,sans-serif;font-size:13px;font-weight:700;color:${C.titleBadgeText};letter-spacing:3.5px;text-transform:uppercase;line-height:1">${title}</div>
          <div style="width:45px;height:2px;margin-top:6px;background:linear-gradient(90deg,transparent,rgba(255,255,255,0.5),transparent);border-radius:2px"></div>
        </div>
      </div>
      <!-- Meta row -->
      <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 20px;background:${C.metaBg};border-top:1px solid ${C.metaBorder};border-bottom:1px solid ${C.metaBorder};flex-shrink:0">
        <div style="font-size:10px;font-weight:700;color:${C.labelText}"><span style="color:${C.accentColor}">#</span> ${certificateNumber || 'To be assigned'}</div>
        <div style="font-size:10px;color:${C.valueText};font-weight:500">${isTC ? 'Admission No' : 'Date of Issue'}: <strong style="font-weight:700;color:${C.labelText}">${isTC ? (d.admissionNumber || '-') : (d.issueDate || '-')}</strong></div>
      </div>
      <!-- Document content -->
      ${isTC ? tcContent : bonafideContent}
      <!-- Spacer -->
      <div style="flex:1;min-height:6px"></div>
      <!-- Signatures -->
      <div style="padding:0 20px 10px;flex-shrink:0">
        <div style="display:flex;justify-content:space-between;align-items:flex-end;margin-top:6px;height:75px">
          <div style="text-align:center;width:130px;display:flex;flex-direction:column;align-items:center;justify-content:flex-end">
            <div style="width:85px;height:1.5px;background:${C.signatureLine};margin-bottom:3px"></div>
            <div style="font-size:9px;font-weight:700;color:${C.sigLabelText};text-transform:uppercase;letter-spacing:0.8px">Class Teacher</div>
          </div>
          <div style="text-align:center;width:85px;display:flex;flex-direction:column;align-items:center;justify-content:flex-end">
            <div style="width:82px;height:82px;border:2px dashed ${C.borderLight};border-radius:50%"></div>
          </div>
          <div style="text-align:center;width:130px;display:flex;flex-direction:column;align-items:center;justify-content:flex-end">
            ${principalSigHtml}
            <div style="width:85px;height:1.5px;background:${C.signatureLine};margin-bottom:3px"></div>
            <div style="font-size:9px;font-weight:700;color:${C.sigLabelText};text-transform:uppercase;letter-spacing:0.8px">Principal</div>
          </div>
        </div>
      </div>
      <!-- Footer -->
      <div style="padding:6px 20px;border-top:1px solid ${C.footerBorder};text-align:center;flex-shrink:0">
        <span style="font-size:7px;color:${C.footerText};font-weight:500;text-transform:uppercase;letter-spacing:1.5px">Powered by <span style="font-weight:600;color:${C.footerAccent}">Learnovo</span> \u2014 School Management System</span>
      </div>
    </div>
  </div>
</div>
</div>
</body>
</html>`;
}
