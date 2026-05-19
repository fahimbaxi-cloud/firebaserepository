'use client';

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

/**
 * Utility to generate and download a branded PDF report.
 * 
 * @param title - The main heading of the report.
 * @param head - Array of arrays for table headers.
 * @param body - Array of arrays for table rows.
 * @param filename - The name of the downloaded file (without extension).
 */
export function downloadPDF(title: string, head: string[][], body: any[][], filename: string) {
  const doc = new jsPDF();
  
  // Branded Header
  doc.setFontSize(22);
  doc.setTextColor(235, 126, 71); // #EB7E47 - BacchaBite Primary
  doc.text('BacchaBite', 14, 22);
  
  doc.setFontSize(14);
  doc.setTextColor(50, 50, 50);
  doc.text(title, 14, 32);
  
  doc.setFontSize(10);
  doc.setTextColor(150, 150, 150);
  doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 38);
  
  // Table Styling
  autoTable(doc, {
    startY: 45,
    head: head,
    body: body,
    theme: 'striped',
    headStyles: { 
      fillColor: [235, 126, 71], 
      textColor: [255, 255, 255],
      fontSize: 10,
      fontStyle: 'bold'
    },
    bodyStyles: { 
      fontSize: 9,
      textColor: [80, 80, 80]
    },
    alternateRowStyles: { 
      fillColor: [250, 245, 243] 
    },
    margin: { top: 45 },
    styles: { 
      cellPadding: 3,
      overflow: 'linebreak'
    },
  });
  
  // Footer
  const pageCount = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(180, 180, 180);
    doc.text(
      `Page ${i} of ${pageCount} - BacchaBite Food Services Platform`,
      doc.internal.pageSize.getWidth() / 2,
      doc.internal.pageSize.getHeight() - 10,
      { align: 'center' }
    );
  }
  
  doc.save(`${filename}.pdf`);
}
