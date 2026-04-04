/* ==========================================================================
   Export utilities — PDF, CSV, and XLS report generation
   ========================================================================== */

export function exportToCSV(data, filename = 'report') {
  if (!data || data.length === 0) return;
  const headers = Object.keys(data[0]);
  const csvRows = [
    headers.join(','),
    ...data.map(row =>
      headers.map(h => {
        let val = row[h] ?? '';
        if (typeof val === 'string' && (val.includes(',') || val.includes('"'))) {
          val = `"${val.replace(/"/g, '""')}"`;
        }
        return val;
      }).join(',')
    )
  ];
  const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
  downloadBlob(blob, `${filename}.csv`);
}

/** Export as XLS (Excel XML Spreadsheet 2003 — universally supported) */
export function exportToXLS(data, filename = 'report', sheetName = 'Report') {
  if (!data || data.length === 0) return;
  const headers = Object.keys(data[0]);

  const xmlRows = data.map(row =>
    `<Row>${headers.map(h => {
      const val = row[h] ?? '';
      const isNum = typeof val === 'number' || (typeof val === 'string' && !isNaN(val) && val !== '');
      return `<Cell><Data ss:Type="${isNum ? 'Number' : 'String'}">${String(val).replace(/[<>&"']/g, c =>
        ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' }[c])
      )}</Data></Cell>`;
    }).join('')}</Row>`
  ).join('');

  const headerRow = `<Row>${headers.map(h =>
    `<Cell ss:StyleID="header"><Data ss:Type="String">${h}</Data></Cell>`
  ).join('')}</Row>`;

  const xlsContent = `<?xml version="1.0"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <Styles>
  <Style ss:ID="header">
   <Font ss:Bold="1" ss:Color="#FFFFFF"/>
   <Interior ss:Color="#714CF5" ss:Pattern="Solid"/>
  </Style>
 </Styles>
 <Worksheet ss:Name="${sheetName}">
  <Table>
   ${headerRow}
   ${xmlRows}
  </Table>
 </Worksheet>
</Workbook>`;

  const blob = new Blob([xlsContent], { type: 'application/vnd.ms-excel;charset=utf-8;' });
  downloadBlob(blob, `${filename}.xls`);
}

export function exportToPDF(title, headers, rows) {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>${title}</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 20px; color: #333; }
        h1 { color: #714CF5; margin-bottom: 20px; font-size: 22px; }
        .meta { color: #666; margin-bottom: 20px; font-size: 12px; }
        table { width: 100%; border-collapse: collapse; }
        th { background: #714CF5; color: white; padding: 10px 12px; text-align: left; font-size: 13px; }
        td { padding: 8px 12px; border-bottom: 1px solid #eee; font-size: 12px; }
        tr:nth-child(even) { background: #f9f9ff; }
        .footer { margin-top: 30px; text-align: center; color: #999; font-size: 11px; }
        @media print { body { margin: 0; } }
      </style>
    </head>
    <body>
      <h1>${title}</h1>
      <div class="meta">Generated: ${new Date().toLocaleString()} | Odoo POS Cafe</div>
      <table>
        <thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead>
        <tbody>${rows.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody>
      </table>
      <div class="footer">Odoo POS Cafe — Report</div>
    </body>
    </html>
  `;

  const printWindow = window.open('', '_blank');
  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.focus();
  setTimeout(() => printWindow.print(), 500);
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
