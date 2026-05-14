/**
 * Utility functions for exporting data
 */

export interface ExportData {
  headers: string[];
  rows: string[][];
  filename: string;
}

/**
 * Convert data to CSV format and download it
 */
export const exportToCSV = (data: ExportData) => {
  const { headers, rows, filename } = data;

  // FIX M6: Sanitize cells to prevent CSV formula injection (=, +, -, @)
  const sanitizeCell = (cell: any): string => {
    if (typeof cell !== 'string') return String(cell ?? '');
    // Prefix dangerous formula characters with a single quote
    const sanitized = /^[=+\-@\t\r]/.test(cell) ? `'${cell}` : cell;
    // Escape commas, quotes, and tabs in cell content
    if (sanitized.includes(',') || sanitized.includes('"') || sanitized.includes('\t'))
      return `"${sanitized.replace(/"/g, '""')}"`;
    return sanitized;
  };

  // Create CSV content
  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(sanitizeCell).join(','))
  ].join('\n');

  // Create blob and download
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');

  if (link.download !== undefined) {
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `${filename}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    // FIX M7: Revoke object URL to prevent memory leak
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
};

/**
 * Convert data to JSON format and download it
 */
export const exportToJSON = (data: any, filename: string) => {
  const jsonContent = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonContent], { type: 'application/json;charset=utf-8;' });
  const link = document.createElement('a');

  if (link.download !== undefined) {
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `${filename}.json`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    // FIX M7: Revoke object URL to prevent memory leak
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
};

/**
 * Format date for export
 */
export const formatDateForExport = (date: Date | any): string => {
  if (!date) return '';

  // Handle Firestore Timestamp
  if (date.toDate) {
    return date.toDate().toISOString().split('T')[0];
  }

  // Handle regular Date
  if (date instanceof Date) {
    return date.toISOString().split('T')[0];
  }

  // Handle string date
  return new Date(date).toISOString().split('T')[0];
};

/**
 * Format cheque date for display as DD/MM/YY
 */
export const formatChequeDateForDisplay = (date: Date | any): string => {
  if (!date) return '';

  let dateObj: Date;

  // Handle Firestore Timestamp
  if (date.toDate) {
    dateObj = date.toDate();
  }
  // Handle regular Date
  else if (date instanceof Date) {
    dateObj = date;
  }
  // Handle string date
  else {
    dateObj = new Date(date);
  }

  // Format as DD/MM/YY
  const day = String(dateObj.getDate()).padStart(2, '0');
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const year = String(dateObj.getFullYear()).slice(-2);

  return `${day}/${month}/${year}`;
};


/**
 * Format currency for export
 */
export const formatCurrencyForExport = (amount: number): string => {
  return amount.toFixed(2);
};

/**
 * Prepare payment data for export
 */
export const preparePaymentDataForExport = (payments: any[]) => {
  return payments.map(payment => {
    // Prefix UTR/Cheque with tab to force text format in Excel
    const refNo = payment.utr || payment.chequeNumber || '';
    const formattedRefNo = refNo ? `\t${refNo}` : '';

    return [
      payment.id,
      formatDateForExport(payment.createdAt),
      payment.retailerName || 'Unknown',
      payment.lineWorkerName || 'Unknown',
      formatCurrencyForExport(payment.totalPaid),
      payment.method,
      payment.state,
      formattedRefNo,
      payment.bankName ? `${payment.bankName} (${payment.chequeDate ? formatChequeDateForDisplay(payment.chequeDate) : ''})` : '',
      payment.timeline?.completedAt ? formatDateForExport(payment.timeline.completedAt) : '',
      payment.timeline?.otpVerifiedAt ? formatDateForExport(payment.timeline.otpVerifiedAt) : ''
    ];
  });
};

/**
 * Prepare retailer data for export
 */
export const prepareRetailerDataForExport = (retailers: any[], areas: any[], lineWorkers: any[]) => {
  return retailers.map(retailer => {
    const area = areas.find(a => a.id === retailer.areaId);
    const assignedLineWorker = lineWorkers.find(lw => lw.uid === retailer.assignedLineWorkerId);

    return [
      retailer.id,
      retailer.name,
      retailer.phone,
      retailer.email,
      retailer.address,
      area?.name || 'Unassigned',
      assignedLineWorker?.name || assignedLineWorker?.email || 'Unassigned',
      retailer.active ? 'Active' : 'Inactive',
      formatDateForExport(retailer.createdAt)
    ];
  });
};

/**
 * Prepare line worker data for export
 */
export const prepareLineWorkerDataForExport = (lineWorkers: any[], areas: any[], retailers: any[]) => {
  return lineWorkers.map(worker => {
    const workerAreas = areas.filter(area => worker.assignedAreas?.includes(area.id));
    const workerRetailers = retailers.filter(r => r.assignedLineWorkerId === worker.uid);
    const workerPayments = workerRetailers.flatMap(r =>
      retailers.filter(ret => ret.id === r.id)
    ).map(r => r.payments || []).flat();

    const totalCollected = workerPayments
      .filter(p => p.state === 'COMPLETED')
      .reduce((sum, p) => sum + (p.totalPaid || 0), 0);

    return [
      worker.uid,
      worker.name,
      worker.email,
      worker.phone,
      workerAreas.map(a => a.name).join('; ') || 'None',
      workerRetailers.length.toString(),
      workerPayments.filter(p => p.state === 'COMPLETED').length.toString(),
      formatCurrencyForExport(totalCollected),
      worker.active ? 'Active' : 'Inactive',
      formatDateForExport(worker.createdAt)
    ];
  });
};