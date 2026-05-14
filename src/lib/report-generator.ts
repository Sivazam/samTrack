/**
 * Professional Report Generator
 * Shared utility for Excel, CSV, and PDF generation across all dashboards.
 * Features:
 *  - A4 Portrait PDF with autoTable, method grouping with spacing
 *  - Professionally styled Excel with colored headers and method-group spacing
 *  - Clean CSV with method-group spacing
 *  - Consistent formatting across all export types
 */

import { formatTimestamp, formatTimestampWithTime, formatDateForExport } from '@/lib/timestamp-utils';
import { formatPaymentMethod } from '@/lib/utils';
import { formatChequeDateForDisplay } from '@/lib/export-utils';
import { LOGO_BASE64 } from '@/constants/assets';

// ─── Types ──────────────────────────────────────────────────────────────────────

export interface ReportRow {
  date: string;
  rawDate: number;
  retailerCode: string;
  retailerName: string;
  amount: number;
  method: string;        // e.g. 'CASH', 'UPI', 'CHEQUE', 'BANK_TRANSFER'
  methodDisplay: string; // e.g. 'Cash', 'UPI', 'Cheque', 'NEFT/RTGS'
  utr: string;
  chequeNumber: string;
  bankName: string;
  chequeDate: string;
  lineWorkerName: string;
  serviceArea: string;
  status: string;
}

export interface ReportConfig {
  title: string;              // e.g. 'Day Sheet', 'Payment Collections'
  dateRange: { startDate: Date; endDate: Date };
  filterLines: string[];      // e.g. ['Line Worker: Ram', 'Area: Pune']
  showLineWorkerColumn: boolean;
  showAreaColumn: boolean;
  businessName: string;       // Wholesaler name
  fileName: string;           // Without extension
  noPaymentRows?: NoPaymentReportRow[];  // Optional: no-payment visits section
}

export interface NoPaymentReportRow {
  date: string;
  retailerName: string;
  reason: string;
  notes: string;
  lineWorkerName: string;
  area: string;
}

// ─── Method Order ────────────────────────────────────────────────────────────────

const METHOD_ORDER = ['CASH', 'UPI', 'CHEQUE', 'BANK_TRANSFER'];

function methodSortKey(method: string): number {
  const idx = METHOD_ORDER.indexOf(method);
  return idx >= 0 ? idx : 99;
}

/** Sort rows by method order, then by date within each method */
export function sortByMethodThenDate(rows: ReportRow[]): ReportRow[] {
  return [...rows].sort((a, b) => {
    const ma = methodSortKey(a.method);
    const mb = methodSortKey(b.method);
    if (ma !== mb) return ma - mb;
    return a.rawDate - b.rawDate;
  });
}

/** Group rows by method with blank separator rows for display */
function groupWithSpacing<T>(rows: T[], getMethod: (r: T) => string): (T | null)[] {
  if (rows.length === 0) return [];
  const result: (T | null)[] = [];
  let lastMethod = '';
  for (const row of rows) {
    const m = getMethod(row);
    if (lastMethod && m !== lastMethod) {
      result.push(null); // blank separator
      result.push(null); // two blank lines
    }
    result.push(row);
    lastMethod = m;
  }
  return result;
}

// ─── Summary Helpers ─────────────────────────────────────────────────────────────

interface MethodTotal {
  label: string;
  method: string;
  amount: number;
  count: number;
}

function calculateTotals(rows: ReportRow[]): { methodTotals: MethodTotal[]; grandTotal: number; totalCount: number } {
  const map: Record<string, { amount: number; count: number; label: string }> = {};
  const labels: Record<string, string> = {
    'CASH': 'Cash',
    'UPI': 'UPI',
    'CHEQUE': 'Cheque',
    'BANK_TRANSFER': 'NEFT/RTGS',
  };

  for (const r of rows) {
    if (!map[r.method]) {
      map[r.method] = { amount: 0, count: 0, label: labels[r.method] || r.method };
    }
    map[r.method].amount += r.amount;
    map[r.method].count += 1;
  }

  const methodTotals: MethodTotal[] = METHOD_ORDER
    .filter(m => map[m])
    .map(m => ({ label: map[m].label, method: m, amount: map[m].amount, count: map[m].count }));

  // Add any methods not in the standard order
  for (const m of Object.keys(map)) {
    if (!METHOD_ORDER.includes(m)) {
      methodTotals.push({ label: map[m].label, method: m, amount: map[m].amount, count: map[m].count });
    }
  }

  const grandTotal = rows.reduce((s, r) => s + r.amount, 0);
  return { methodTotals, grandTotal, totalCount: rows.length };
}

function formatINR(amount: number): string {
  return 'Rs. ' + amount.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

// ─── Build data columns for a row ────────────────────────────────────────────────

function buildRowCells(row: ReportRow, config: ReportConfig): string[] {
  let refNo = row.utr || '';
  let details = '';

  if (row.method === 'CHEQUE') {
    refNo = row.chequeNumber || '';
    details = `${row.bankName || ''}${row.chequeDate ? ` (${row.chequeDate})` : ''}`;
  } else if (row.method === 'UPI') {
    refNo = row.utr || '';
  } else {
    refNo = row.utr || '';
    details = row.bankName || '';
  }

  const cells: string[] = [
    row.date,
    row.retailerCode,
    row.retailerName,
    row.amount.toLocaleString('en-IN'),
    row.methodDisplay,
    refNo,
    details,
  ];
  if (config.showLineWorkerColumn) cells.push(row.lineWorkerName);
  if (config.showAreaColumn) cells.push(row.serviceArea);
  return cells;
}

function getHeaders(config: ReportConfig): string[] {
  const h = ['Date', 'Code', 'Retailer Name', 'Amount', 'Method', 'Ref No / Cheque No', 'Bank / Details'];
  if (config.showLineWorkerColumn) h.push('Line Worker');
  if (config.showAreaColumn) h.push('Service Area');
  return h;
}

// ══════════════════════════════════════════════════════════════════════════════════
// PDF GENERATION — A4 Portrait, professional, method-grouped with spacing
// ══════════════════════════════════════════════════════════════════════════════════

export async function generateProfessionalPDF(rows: ReportRow[], config: ReportConfig): Promise<void> {
  const { jsPDF } = await import('jspdf');
  const autoTableModule = await import('jspdf-autotable');
  const autoTable = autoTableModule.default;

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();       // 210
  const pageHeight = doc.internal.pageSize.getHeight();     // 297
  const margin = 12;

  // ── Brand Colors ──
  const brandGreen: [number, number, number] = [13, 124, 63];   // #0d7c3f
  const darkGray: [number, number, number] = [55, 65, 81];
  const lightGray: [number, number, number] = [243, 244, 246];
  const white: [number, number, number] = [255, 255, 255];

  // ── Header Bar ──
  doc.setFillColor(...brandGreen);
  doc.rect(0, 0, pageWidth, 28, 'F');

  // Logo
  if (LOGO_BASE64) {
    try {
      doc.addImage(LOGO_BASE64, 'PNG', margin, 3, 22, 22);
    } catch { /* skip logo if error */ }
  }

  // Title text
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(...white);
  doc.text(`Report: ${config.title}`, margin + 26, 14);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(config.businessName, margin + 26, 21);

  // Date stamp right-aligned
  doc.setFontSize(7);
  const dateStamp = `Generated: ${new Date().toLocaleDateString('en-IN')} ${new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`;
  doc.text(dateStamp, pageWidth - margin, 8, { align: 'right' });

  // ── Sub-header: Date Range & Filters ──
  let curY = 33;

  doc.setFillColor(...lightGray);
  const subHeaderHeight = 6 + config.filterLines.length * 4;
  doc.rect(margin, curY, pageWidth - margin * 2, subHeaderHeight, 'F');

  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...darkGray);
  doc.text(`Period: ${formatTimestamp(config.dateRange.startDate)} – ${formatTimestamp(config.dateRange.endDate)}`, margin + 3, curY + 4);

  if (config.filterLines.length > 0) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    config.filterLines.forEach((line, i) => {
      doc.text(line, margin + 3, curY + 8 + i * 4);
    });
  }

  curY += subHeaderHeight + 4;

  // ── Table ──
  const headers = getHeaders(config);
  const sorted = sortByMethodThenDate(rows);
  const grouped = groupWithSpacing(sorted, r => r.method);

  // Build table body with blank separator rows
  const tableBody: string[][] = [];
  for (const item of grouped) {
    if (item === null) {
      tableBody.push(headers.map(() => '')); // blank row
    } else {
      tableBody.push(buildRowCells(item, config));
    }
  }

  // Column widths for portrait A4 (186mm usable)
  const usable = pageWidth - margin * 2;
  // Use proportional widths
  const baseWidths = [16, 11, 0, 16, 16, 22, 28]; // 0 = auto for Name
  let extraCols = 0;
  if (config.showLineWorkerColumn) { baseWidths.push(22); extraCols++; }
  if (config.showAreaColumn) { baseWidths.push(22); extraCols++; }
  const fixedSum = baseWidths.reduce((s, w) => s + w, 0);
  const nameWidth = usable - fixedSum;
  baseWidths[2] = Math.max(nameWidth, 20);

  const colStyles: Record<number, any> = {};
  baseWidths.forEach((w, i) => {
    colStyles[i] = { cellWidth: w };
  });
  // Amount right-aligned
  colStyles[3] = { cellWidth: baseWidths[3], halign: 'right' };
  // Method centered
  colStyles[4] = { cellWidth: baseWidths[4], halign: 'center' };

  autoTable(doc, {
    startY: curY,
    margin: { left: margin, right: margin },
    head: [headers],
    body: tableBody,
    theme: 'grid',
    styles: {
      fontSize: 7,
      cellPadding: 1.5,
      overflow: 'linebreak',
      lineColor: [200, 200, 200],
      lineWidth: 0.2,
      textColor: [30, 30, 30],
    },
    headStyles: {
      fillColor: brandGreen,
      textColor: white,
      fontSize: 7,
      fontStyle: 'bold',
      halign: 'center',
      valign: 'middle',
      cellPadding: 2,
    },
    alternateRowStyles: {
      fillColor: [249, 250, 251],
    },
    columnStyles: colStyles,
    didParseCell: function (data: any) {
      // Make blank separator rows have minimal height
      if (data.section === 'body') {
        const rowData = data.row.raw as string[];
        if (rowData && rowData.every((c: string) => c === '')) {
          data.cell.styles.cellPadding = 0.5;
          data.cell.styles.minCellHeight = 2;
          data.cell.styles.fillColor = [255, 255, 255];
          data.cell.styles.lineWidth = 0;
        }
      }
    },
    didDrawPage: function (data: any) {
      // Page footer
      const pageNum = (doc as any).internal.getNumberOfPages();
      doc.setFontSize(7);
      doc.setTextColor(150, 150, 150);
      doc.text(`Page ${pageNum}`, margin, pageHeight - 6);
      doc.text('Samhitha', pageWidth - margin, pageHeight - 6, { align: 'right' });
    },
  });

  // ── Summary Box ──
  const { methodTotals, grandTotal, totalCount } = calculateTotals(rows);
  let summaryY = (doc as any).lastAutoTable?.finalY ? (doc as any).lastAutoTable.finalY + 8 : curY + 20;

  // Check if summary fits; if not, new page
  const summaryHeight = 12 + methodTotals.length * 6 + 10;
  if (summaryY + summaryHeight > pageHeight - 15) {
    doc.addPage();
    summaryY = 20;
  }

  // Summary header bar
  doc.setFillColor(...brandGreen);
  doc.rect(margin, summaryY, pageWidth - margin * 2, 8, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...white);
  doc.text('Summary', margin + 3, summaryY + 5.5);
  doc.text(`${totalCount} transactions`, pageWidth - margin - 3, summaryY + 5.5, { align: 'right' });

  summaryY += 12;

  // Method totals
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  for (const mt of methodTotals) {
    doc.setTextColor(...darkGray);
    doc.text(`${mt.label} (${mt.count})`, margin + 4, summaryY);
    doc.setTextColor(0, 0, 0);
    doc.text(formatINR(mt.amount), pageWidth - margin - 4, summaryY, { align: 'right' });
    summaryY += 6;
  }

  // Grand total
  summaryY += 2;
  doc.setFillColor(...lightGray);
  doc.rect(margin, summaryY - 4, pageWidth - margin * 2, 9, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...brandGreen);
  doc.text('Grand Total', margin + 4, summaryY + 2);
  doc.text(formatINR(grandTotal), pageWidth - margin - 4, summaryY + 2, { align: 'right' });

  // ── No-Payment Visits Section (optional) ──
  if (config.noPaymentRows && config.noPaymentRows.length > 0) {
    let npvY = summaryY + 16;

    // Check if section fits; if not, new page
    const npvHeight = 14 + config.noPaymentRows.length * 8;
    if (npvY + npvHeight > pageHeight - 15) {
      doc.addPage();
      npvY = 20;
    }

    // Section header
    const orange: [number, number, number] = [234, 88, 12];
    doc.setFillColor(...orange);
    doc.rect(margin, npvY, pageWidth - margin * 2, 8, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...white);
    doc.text('No-Payment Visits', margin + 3, npvY + 5.5);
    doc.text(`${config.noPaymentRows.length} visit${config.noPaymentRows.length !== 1 ? 's' : ''}`, pageWidth - margin - 3, npvY + 5.5, { align: 'right' });

    npvY += 12;

    const npvHeaders = ['Date', 'Retailer', 'Reason', 'Notes', 'Line Worker', 'Area'];
    const npvBody = config.noPaymentRows.map(r => [r.date, r.retailerName, r.reason, r.notes || '—', r.lineWorkerName, r.area]);

    autoTable(doc, {
      startY: npvY,
      margin: { left: margin, right: margin },
      head: [npvHeaders],
      body: npvBody,
      theme: 'grid',
      styles: {
        fontSize: 7,
        cellPadding: 1.5,
        overflow: 'linebreak',
        lineColor: [200, 200, 200],
        lineWidth: 0.2,
        textColor: [30, 30, 30],
      },
      headStyles: {
        fillColor: orange,
        textColor: white,
        fontSize: 7,
        fontStyle: 'bold',
        halign: 'center',
      },
      alternateRowStyles: {
        fillColor: [255, 247, 237],
      },
    });
  }

  // Save
  doc.save(`${config.fileName}.pdf`);
}

// ══════════════════════════════════════════════════════════════════════════════════
// EXCEL GENERATION — Professional, colored headers, method-grouped spacing
// ══════════════════════════════════════════════════════════════════════════════════

export async function generateProfessionalExcel(rows: ReportRow[], config: ReportConfig): Promise<void> {
  const XLSX = await import('xlsx');
  const { saveAs } = await import('file-saver');

  const wb = XLSX.utils.book_new();
  const wsData: any[][] = [];

  // Title
  wsData.push([`Report: ${config.title}`]);
  wsData.push([`Date Range: ${formatTimestamp(config.dateRange.startDate)} – ${formatTimestamp(config.dateRange.endDate)}`]);
  if (config.businessName) wsData.push([config.businessName]);
  config.filterLines.forEach(line => wsData.push([line]));
  wsData.push([]); // spacer

  // Headers
  const headers = getHeaders(config);
  wsData.push(headers);
  const headerRowIdx = wsData.length; // 1-based for cell ref

  // Data rows with method-group spacing
  const sorted = sortByMethodThenDate(rows);
  const grouped = groupWithSpacing(sorted, r => r.method);

  for (const item of grouped) {
    if (item === null) {
      wsData.push(headers.map(() => '')); // blank row
    } else {
      const cells: any[] = [
        item.date,
        item.retailerCode,
        item.retailerName,
        item.amount,
        item.methodDisplay,
        { t: 's', v: item.method === 'CHEQUE' ? (item.chequeNumber || '') : (item.utr || '') }, // Force string
        item.method === 'CHEQUE' ? `${item.bankName || ''}${item.chequeDate ? ` (${item.chequeDate})` : ''}` : (item.bankName || ''),
      ];
      if (config.showLineWorkerColumn) cells.push(item.lineWorkerName);
      if (config.showAreaColumn) cells.push(item.serviceArea);
      wsData.push(cells);
    }
  }

  // Spacer before summary
  wsData.push([]);
  wsData.push([]);

  // Summary
  const { methodTotals, grandTotal, totalCount } = calculateTotals(rows);

  for (const mt of methodTotals) {
    const row: any[] = ['', `Total ${mt.label}`, `(${mt.count})`, mt.amount, '', '', ''];
    if (config.showLineWorkerColumn) row.push('');
    if (config.showAreaColumn) row.push('');
    wsData.push(row);
  }

  // Grand total
  wsData.push([]);
  const gtRow: any[] = ['', 'GRAND TOTAL', `(${totalCount})`, grandTotal, '', '', ''];
  if (config.showLineWorkerColumn) gtRow.push('');
  if (config.showAreaColumn) gtRow.push('');
  wsData.push(gtRow);

  // No-Payment Visits section (optional)
  if (config.noPaymentRows && config.noPaymentRows.length > 0) {
    wsData.push([]);
    wsData.push([]);
    wsData.push(['No-Payment Visits']);
    wsData.push(['Date', 'Retailer', 'Reason', 'Notes', 'Line Worker', 'Area']);
    for (const r of config.noPaymentRows) {
      wsData.push([r.date, r.retailerName, r.reason, r.notes || '', r.lineWorkerName, r.area]);
    }
  }

  const ws = XLSX.utils.aoa_to_sheet(wsData);

  // Column widths
  const colWidths = [
    { wch: 18 }, // Date
    { wch: 12 }, // Code
    { wch: 28 }, // Name
    { wch: 16 }, // Amount
    { wch: 14 }, // Method
    { wch: 20 }, // Ref No
    { wch: 28 }, // Bank / Details
  ];
  if (config.showLineWorkerColumn) colWidths.push({ wch: 20 });
  if (config.showAreaColumn) colWidths.push({ wch: 20 });
  ws['!cols'] = colWidths;

  XLSX.utils.book_append_sheet(wb, ws, config.title.substring(0, 31)); // sheet name max 31 chars
  const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const data = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  saveAs(data, `${config.fileName}.xlsx`);
}

// ══════════════════════════════════════════════════════════════════════════════════
// CSV GENERATION — Clean, method-grouped spacing
// ══════════════════════════════════════════════════════════════════════════════════

export async function generateProfessionalCSV(rows: ReportRow[], config: ReportConfig): Promise<void> {
  const { saveAs } = await import('file-saver');

  const csvRows: string[] = [];
  // CSV injection prevention: prefix formula-triggering chars with ' (same as server-side sanitizeCsvCell)
  const esc = (v: string | number) => {
    let s = String(v).replace(/"/g, '""');
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
    return `"${s}"`;
  };

  // Header
  csvRows.push(`Report: ${config.title}`);
  csvRows.push(esc(`Date Range: ${formatTimestamp(config.dateRange.startDate)} – ${formatTimestamp(config.dateRange.endDate)}`));
  if (config.businessName) csvRows.push(esc(config.businessName));
  config.filterLines.forEach(line => csvRows.push(esc(line)));
  csvRows.push('');

  // Column headers
  const headers = getHeaders(config);
  csvRows.push(headers.join(','));

  // Data with method spacing
  const sorted = sortByMethodThenDate(rows);
  const grouped = groupWithSpacing(sorted, r => r.method);

  for (const item of grouped) {
    if (item === null) {
      csvRows.push(''); // blank row
    } else {
      const cells = buildRowCells(item, config);
      csvRows.push(cells.map(c => esc(c)).join(','));
    }
  }

  // Summary
  csvRows.push('');
  csvRows.push('');

  const { methodTotals, grandTotal, totalCount } = calculateTotals(rows);

  for (const mt of methodTotals) {
    const row: string[] = ['', `Total ${mt.label}`, `(${mt.count})`, String(mt.amount), '', '', ''];
    if (config.showLineWorkerColumn) row.push('');
    if (config.showAreaColumn) row.push('');
    csvRows.push(row.join(','));
  }

  csvRows.push('');
  const gtRow: string[] = ['', 'GRAND TOTAL', `(${totalCount})`, String(grandTotal), '', '', ''];
  if (config.showLineWorkerColumn) gtRow.push('');
  if (config.showAreaColumn) gtRow.push('');
  csvRows.push(gtRow.join(','));

  // No-Payment Visits section (optional)
  if (config.noPaymentRows && config.noPaymentRows.length > 0) {
    csvRows.push('');
    csvRows.push('');
    csvRows.push('No-Payment Visits');
    csvRows.push(['Date', 'Retailer', 'Reason', 'Notes', 'Line Worker', 'Area'].join(','));
    for (const r of config.noPaymentRows) {
      csvRows.push([esc(r.date), esc(r.retailerName), esc(r.reason), esc(r.notes || ''), esc(r.lineWorkerName), esc(r.area)].join(','));
    }
  }

  const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
  saveAs(blob, `${config.fileName}.csv`);
}
