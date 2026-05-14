import * as XLSX from 'xlsx';

const HEADER_MAP: Record<string, string> = {
  'sequence': 'uniqueLeadId', 's.no': 'uniqueLeadId', 'sno': 'uniqueLeadId', 's no': 'uniqueLeadId',
  'parent name': 'parentName', 'parent': 'parentName',
  'student name': 'studentName', 'student': 'studentName',
  'parent phone': 'parentPhone', 'parent mobile': 'parentPhone', 'parent contact': 'parentPhone',
  'student phone': 'studentPhone', 'student mobile': 'studentPhone',
  'group': 'intermediateGroup', 'intermediate group': 'intermediateGroup',
  'address': 'address', 'area': 'address',
  'division': 'divisionName', 'city': 'divisionName', 'zone': 'divisionName',
};

export function mapHeaders(headers: string[]): Record<string, string> {
  const mapping: Record<string, string> = {};
  for (const header of headers) {
    const lower = header.toLowerCase().trim();
    if (HEADER_MAP[lower]) {
      mapping[header] = HEADER_MAP[lower];
    }
  }
  return mapping;
}

export function parseXlsxFile(file: File): Promise<{ headers: string[]; rows: any[]; headerMapping: Record<string, string> }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json(sheet, { defval: '' });
        if (json.length === 0) {
          reject(new Error('File is empty'));
          return;
        }
        const headers = Object.keys(json[0] as object);
        const headerMapping = mapHeaders(headers);
        resolve({ headers, rows: json, headerMapping });
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsArrayBuffer(file);
  });
}
