/**
 * Shared high-quality print utility for Learnovo.
 * Opens a new window with the provided HTML and triggers browser print.
 * All templates use @page { margin: 0 } to suppress browser headers/footers.
 */

export function openPrintWindow(html) {
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const win = window.open(url, '_blank');
  if (!win) {
    // Popup blocked — download as HTML fallback
    const a = document.createElement('a');
    a.href = url;
    a.download = 'print-document.html';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }
  setTimeout(() => URL.revokeObjectURL(url), 120000);
}

/* ═══════════════════════════════════════════════════════════
   TC / BONAFIDE — High-quality print HTML builder
   ═══════════════════════════════════════════════════════════ */

export function buildCertificatePrintHTML({ type, data, certificateNumber }) {
  const d = data || {};
  const isTC = type === 'TC';
  const title = isTC ? 'School Leaving Certificate' : 'Bonafide Certificate';
  const watermark = isTC ? 'LEAVING CERTIFICATE' : 'BONAFIDE';

  // TC table rows
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
    const bg = i % 2 === 0 ? '#f0fdfa' : '#ffffff';
    const border = i < tcRows.length - 1 ? 'border-bottom:1px solid #c8d6d4;' : '';
    const valStyle = bold ? 'color:#111827;font-weight:700;' : 'color:#1f2937;font-weight:500;';
    const subjectStyle = label === 'Subjects Studied' ? 'font-size:9px;line-height:1.5;' : '';
    return `<tr style="background:${bg};-webkit-print-color-adjust:exact;print-color-adjust:exact">
      <td style="width:26px;padding:5px 8px;${border}border-right:1px solid #c8d6d4;font-weight:700;color:#374151;text-align:center;font-size:10px;vertical-align:middle">${String(i + 1).padStart(2, '0')}</td>
      <td style="width:42%;padding:5px 10px;${border}border-right:1px solid #c8d6d4;font-weight:700;color:#111827;font-size:11px;vertical-align:middle">${label}</td>
      <td style="padding:5px 10px;${border}${valStyle}font-size:11px;vertical-align:middle;${subjectStyle}">${value || '\u2014'}</td>
    </tr>`;
  }).join('');

  // Bonafide details
  const bonafideDetails = [
    ['Student Name', d.studentName],
    ['Admission Number', d.admissionNumber],
    ["Father's Name", d.fatherName],
    ["Mother's Name", d.motherName],
    ['Class & Section', `${d.class || ''} \u2013 ${d.section || ''}`],
    ['Date of Birth', d.dob],
    ['Academic Session', d.academicYear],
    ['Board / Affiliation', d.schoolBoard || d.board || '\u2014'],
  ];

  const bonafideGrid = bonafideDetails.map(([label, value]) =>
    `<div style="display:flex;flex-direction:column;gap:2px">
      <span style="font-size:9px;font-weight:700;color:#374151;text-transform:uppercase;letter-spacing:0.8px">${label}</span>
      <span style="font-size:12px;font-weight:700;color:#111827">${value || '\u2014'}</span>
    </div>`
  ).join('');

  const hl = (text) => `<span style="font-weight:700;color:#111827;border-bottom:1.5px solid rgba(62,196,177,0.5)">${text}</span>`;

  // School header info
  const schoolHeader = `
    <div style="font-family:Georgia,'Times New Roman',serif;font-size:24px;font-weight:800;color:#1A2E5A;letter-spacing:2px;line-height:1.1;text-transform:uppercase">${d.schoolName || 'School Name'}</div>
    <div style="font-size:11px;color:#1f2937;font-weight:500;margin-top:4px">${d.schoolAddress || ''}</div>
    ${(d.schoolPhone || d.schoolEmail) ? `<div style="font-size:11px;color:#1f2937;font-weight:500;margin-top:2px">${d.schoolPhone ? 'Phone: ' + d.schoolPhone : ''}${d.schoolPhone && d.schoolEmail ? ' | ' : ''}${d.schoolEmail ? 'Email: ' + d.schoolEmail : ''}</div>` : ''}
    ${(d.affiliationNumber || d.schoolCode || d.udiseCode) ? `<div style="display:flex;justify-content:center;gap:18px;margin-top:5px;flex-wrap:wrap">
      ${d.affiliationNumber ? `<span style="font-size:10px;color:#1f2937;font-weight:500">Affiliation No: <strong style="font-weight:700;color:#111827">${d.affiliationNumber}</strong></span>` : ''}
      ${d.schoolCode ? `<span style="font-size:10px;color:#1f2937;font-weight:500">School Code: <strong style="font-weight:700;color:#111827">${d.schoolCode}</strong></span>` : ''}
      ${d.udiseCode ? `<span style="font-size:10px;color:#1f2937;font-weight:500">UDISE: <strong style="font-weight:700;color:#111827">${d.udiseCode}</strong></span>` : ''}
    </div>` : ''}`;

  // TC content
  const tcContent = `
    <div style="margin:8px 18px 0;border-radius:6px;overflow:hidden;border:1.5px solid #c8d6d4">
      <table style="width:100%;border-collapse:separate;border-spacing:0;font-size:11px">${tcTableRows}</table>
    </div>
    <div style="margin:8px 18px 0">
      <div style="background:#f3f4f6;border:1.5px solid #d1d5db;border-radius:5px;padding:6px 12px">
        <div style="font-size:9px;font-weight:700;color:#111827;text-transform:uppercase;letter-spacing:0.5px">Important Note</div>
        <p style="font-size:9px;font-weight:500;color:#374151;line-height:1.5;margin-top:2px">This certificate is issued based on school records. No alteration shall be made on this certificate. Erasing or overwriting renders it invalid.</p>
      </div>
    </div>
    <div style="padding:8px 24px 0">
      <p style="font-size:10px;color:#374151;font-weight:500;font-style:italic;line-height:1.5">Certified that the above information is in accordance with school records. This certificate does not entitle the holder to any benefits unless countersigned by competent authority.</p>
      <div style="font-size:11px;color:#111827;font-weight:700;margin-top:4px">Place: ${d.place || d.schoolAddress?.split(',').pop()?.trim() || '\u2014'}</div>
    </div>`;

  // Bonafide content
  const bonafideContent = `
    <div style="padding:20px 26px 0">
      <div style="font-family:Georgia,'Times New Roman',serif;font-size:14px;font-weight:700;color:#0a5c56;text-align:center;letter-spacing:2.5px;text-transform:uppercase;margin-bottom:16px;position:relative">
        To Whom It May Concern
        <div style="width:50px;height:2px;margin:7px auto 0;background:linear-gradient(90deg,transparent,#3EC4B1,transparent);border-radius:2px"></div>
      </div>
      <p style="font-size:13px;line-height:2.1;color:#1f2937;font-weight:500;text-align:justify">
        This is to certify that ${hl(d.studentName || '\u2014')},
        Son/Daughter of Shri ${hl(d.fatherName || '\u2014')}
        and Smt. ${hl(d.motherName || '\u2014')},
        is a bonafide student of this institution. He/She is currently studying in
        Class ${hl(`${d.class || '\u2014'} (${d.section || '\u2014'})`)}
        for the Academic Session ${hl(d.academicYear || '\u2014')}.
        His/Her date of birth as per our school records is ${hl(d.dob || '\u2014')}.
      </p>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px 26px;margin-top:18px;padding:16px 20px;background:#f0fdfa;border-radius:8px;border:1.5px solid #d1d5db">
        ${bonafideGrid}
      </div>
    </div>
    <div style="padding:14px 26px 0">
      <p style="font-size:12px;color:#374151;font-weight:500;line-height:1.8;text-align:justify">
        This certificate is issued on the request of the student/parent for the purpose of <span style="font-weight:700;color:#111827">${d.purpose || '\u2014'}</span>.
        No fees are due from the student at the time of issue of this certificate.
      </p>
    </div>
    <div style="padding:12px 26px 0">
      <div style="font-size:11px;color:#111827;font-weight:700">Place: ${d.place || d.schoolAddress?.split(',').pop()?.trim() || '\u2014'}</div>
    </div>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>${title} ${certificateNumber ? '— ' + certificateNumber : ''}</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box;-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}
  @page{size:A4 portrait;margin:0}
  body{font-family:'Helvetica Neue',Arial,'Noto Sans',sans-serif;background:#f3f4f6;color:#111827;-webkit-font-smoothing:antialiased}
  .page{width:210mm;min-height:297mm;margin:0 auto;background:#fff;position:relative;overflow:hidden}
  .card{position:absolute;top:8mm;left:8mm;right:8mm;bottom:8mm;background:#fff;border-radius:14px;border:1.5px solid #d1d5db;display:flex;flex-direction:column;overflow:hidden}
  /* Decorative shapes */
  .deco{position:absolute;top:0;right:0;width:100%;height:100%;pointer-events:none;z-index:0;overflow:hidden;border-radius:14px}
  .deco .c1{position:absolute;top:-60px;right:-40px;width:240px;height:240px;background:rgba(62,196,177,0.06);border-radius:50%}
  .deco .c2{position:absolute;top:60px;right:-60px;width:180px;height:340px;background:rgba(62,196,177,0.04);transform:rotate(-25deg);border-radius:60px}
  .deco .c3{position:absolute;bottom:-40px;left:-45px;width:195px;height:195px;background:rgba(62,196,177,0.05);border-radius:50%}
  .deco .c4{position:absolute;bottom:90px;left:30px;width:120px;height:225px;background:rgba(62,196,177,0.03);transform:rotate(20deg);border-radius:45px}
  /* Watermark */
  .watermark{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%) rotate(-35deg);font-family:Georgia,'Times New Roman',serif;font-size:${isTC ? 44 : 54}px;font-weight:700;color:rgba(62,196,177,0.05);letter-spacing:${isTC ? 10 : 14}px;white-space:nowrap;z-index:0;pointer-events:none;text-transform:uppercase}
  .content{position:relative;z-index:1;display:flex;flex-direction:column;flex:1}
  .header{padding:18px 24px 10px;text-align:center;flex-shrink:0}
  .divider{height:1.5px;background:#9ca3af;margin:0 22px;flex-shrink:0}
  .title-badge{padding:14px 22px;text-align:center;display:flex;flex-direction:column;align-items:center;flex-shrink:0}
  .badge-box{background:#edf9f7;border-radius:10px;padding:9px 24px 11px;display:inline-flex;flex-direction:column;align-items:center;border:1px solid #d1fae5}
  .badge-text{font-size:14px;font-weight:700;color:#0a5c56;letter-spacing:3.5px;text-transform:uppercase;line-height:1}
  .badge-line{width:50px;height:2px;margin-top:7px;background:linear-gradient(90deg,transparent,#3EC4B1,transparent);border-radius:2px}
  .meta-row{display:flex;justify-content:space-between;align-items:center;padding:8px 22px;background:#f3f4f6;border-top:1.5px solid #d1d5db;border-bottom:1.5px solid #d1d5db;flex-shrink:0}
  .meta-left{font-size:12px;font-weight:700;color:#111827}
  .meta-left .hash{color:#3EC4B1}
  .meta-right{font-size:11px;color:#374151;font-weight:600}
  .meta-right strong{font-weight:700;color:#111827}
  .spacer{flex:1;min-height:8px}
  /* Signatures */
  .sigs{padding:0 24px 12px;flex-shrink:0}
  .sigs-inner{display:flex;justify-content:space-between;align-items:flex-end;height:80px}
  .sig-block{text-align:center;width:140px;display:flex;flex-direction:column;align-items:center;justify-content:flex-end}
  .sig-line-el{width:90px;height:1.5px;background:#374151;margin-bottom:4px}
  .sig-label{font-size:10px;font-weight:700;color:#111827;text-transform:uppercase;letter-spacing:0.8px}
  .stamp-circle{width:80px;height:80px;border:2px dashed #9ca3af;border-radius:50%}
  .stamp-block{text-align:center;width:85px;display:flex;flex-direction:column;align-items:center;justify-content:flex-end}
  /* Footer */
  .cert-footer{padding:7px 22px;border-top:1.5px solid #9ca3af;text-align:center;flex-shrink:0}
  .cert-footer span{font-size:8px;color:#374151;font-weight:500;text-transform:uppercase;letter-spacing:1.5px}
  .cert-footer .brand{font-weight:700;color:#0f766e}
  /* Toolbar */
  .toolbar{position:fixed;top:0;left:0;right:0;background:#1C1C1E;color:#fff;padding:10px 24px;display:flex;gap:10px;align-items:center;z-index:999;font-family:'Helvetica Neue',Arial,sans-serif}
  .toolbar-title{flex:1;font-size:13px;font-weight:500}
  .tbtn{padding:7px 18px;border:none;border-radius:8px;cursor:pointer;font-size:12px;font-weight:600;font-family:inherit;transition:opacity .15s}
  .tbtn:hover{opacity:.85}
  .tbtn-print{background:#3EC4B1;color:#fff}
  .tbtn-close{background:#38383A;color:#8E8E93}
  .page-body{padding-top:54px}
  @media print{
    .toolbar{display:none!important}
    .page-body{padding-top:0!important}
    body{background:#fff}
    .page{border:none;box-shadow:none}
  }
</style>
</head>
<body>
<div class="toolbar">
  <span class="toolbar-title">${title} ${certificateNumber ? '— ' + certificateNumber : ''}</span>
  <button class="tbtn tbtn-print" onclick="window.print()">Print</button>
  <button class="tbtn tbtn-close" onclick="window.close()">Close</button>
</div>
<div class="page-body">
<div class="page">
  <div class="card">
    <div class="deco"><div class="c1"></div><div class="c2"></div><div class="c3"></div><div class="c4"></div></div>
    <div class="watermark">${watermark}</div>
    <div class="content">
      <div class="header">${schoolHeader}</div>
      <div class="divider"></div>
      <div class="title-badge"><div class="badge-box"><div class="badge-text">${title}</div><div class="badge-line"></div></div></div>
      <div class="meta-row">
        <div class="meta-left"><span class="hash">#</span> ${certificateNumber || 'To be assigned'}</div>
        <div class="meta-right">${isTC ? 'Admission No' : 'Date of Issue'}: <strong>${isTC ? (d.admissionNumber || '\u2014') : (d.issueDate || '\u2014')}</strong></div>
      </div>
      ${isTC ? tcContent : bonafideContent}
      <div class="spacer"></div>
      <div class="sigs"><div class="sigs-inner">
        <div class="sig-block"><div class="sig-line-el"></div><div class="sig-label">Class Teacher</div></div>
        <div class="stamp-block"><div class="stamp-circle"></div></div>
        <div class="sig-block"><div class="sig-line-el"></div><div class="sig-label">Principal</div></div>
      </div></div>
      <div class="cert-footer"><span>Powered by <span class="brand">Learnovo</span> \u2014 School Management System</span></div>
    </div>
  </div>
</div>
</div>
</body>
</html>`;
}
