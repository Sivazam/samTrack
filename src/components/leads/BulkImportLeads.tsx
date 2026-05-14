'use client';

import React, { useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Upload, FileSpreadsheet, AlertTriangle, CheckCircle, Loader2 } from 'lucide-react';
import { bulkCreateLeadsViaCloudFunction } from '@/lib/cloud-functions';
import * as XLSX from 'xlsx';

interface BulkImportLeadsProps {
  onClose: () => void;
}

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

function mapHeaders(headers: string[]): Record<string, string> {
  const mapping: Record<string, string> = {};
  for (const header of headers) {
    const lower = header.toLowerCase().trim();
    if (HEADER_MAP[lower]) {
      mapping[header] = HEADER_MAP[lower];
    }
  }
  return mapping;
}

export function BulkImportLeads({ onClose }: BulkImportLeadsProps) {
  const { user } = useAuth();
  const [rows, setRows] = useState<any[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [headerMapping, setHeaderMapping] = useState<Record<string, string>>({});
  const [filename, setFilename] = useState('');
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFile = useCallback((file: File) => {
    setFilename(file.name);
    setError(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json(sheet, { defval: '' });
        if (json.length === 0) { setError('File is empty'); return; }
        const fileHeaders = Object.keys(json[0] as object);
        setHeaders(fileHeaders);
        setHeaderMapping(mapHeaders(fileHeaders));
        setRows(json);
      } catch (e: any) {
        setError('Failed to parse file: ' + e.message);
      }
    };
    reader.readAsArrayBuffer(file);
  }, []);

  const handleImport = async () => {
    if (rows.length === 0) return;
    setImporting(true);
    setError(null);
    try {
      const mappedRows = rows.map(row => {
        const mapped: Record<string, any> = {};
        for (const [origHeader, targetField] of Object.entries(headerMapping)) {
          if (row[origHeader] !== undefined) mapped[targetField] = String(row[origHeader]);
        }
        return mapped;
      });
      const res = await bulkCreateLeadsViaCloudFunction({
        rows: mappedRows,
        sourceFilename: filename,
        mode: 'skip',
      });
      setResult(res);
    } catch (e: any) {
      setError(e.message || 'Import failed');
    } finally {
      setImporting(false);
    }
  };

  return (
    <Dialog open={true} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base">Import Leads from XLSX/CSV</DialogTitle>
        </DialogHeader>

        {!result ? (
          <div className="space-y-4">
            {/* File Input */}
            <div className="border-2 border-dashed rounded-lg p-6 text-center">
              <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm text-muted-foreground mb-2">Drag & drop or click to upload</p>
              <input type="file" accept=".xlsx,.csv,.xls" onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} className="mx-auto" />
            </div>

            {error && <Alert variant="destructive"><AlertTriangle className="h-4 w-4" /><AlertDescription className="text-xs">{error}</AlertDescription></Alert>}

            {/* Preview */}
            {rows.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium"><FileSpreadsheet className="h-4 w-4 inline mr-1" />{filename} — {rows.length} rows</p>
                <p className="text-xs text-muted-foreground">Column mapping (auto-detected):</p>
                <div className="space-y-1">
                  {headers.map(h => (
                    <div key={h} className="flex items-center gap-2 text-xs">
                      <Badge variant="outline">{h}</Badge>
                      <span>→</span>
                      <Badge variant={headerMapping[h] ? 'default' : 'secondary'}>{headerMapping[h] || 'unmapped'}</Badge>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">Preview (first 5 rows):</p>
                <div className="border rounded overflow-x-auto text-xs">
                  <table className="w-full">
                    <thead><tr className="bg-muted">{headers.slice(0, 6).map(h => <th key={h} className="p-1 text-left">{h}</th>)}</tr></thead>
                    <tbody>
                      {rows.slice(0, 5).map((row, i) => (
                        <tr key={i} className="border-t">{headers.slice(0, 6).map(h => <td key={h} className="p-1">{String(row[h] || '')}</td>)}</tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <Alert><CheckCircle className="h-4 w-4" /><AlertDescription className="text-xs">Import completed!</AlertDescription></Alert>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div><p className="text-2xl font-bold">{result.successCount}</p><p className="text-xs text-muted-foreground">Success</p></div>
              <div><p className="text-2xl font-bold text-red-500">{result.errorCount}</p><p className="text-xs text-muted-foreground">Errors</p></div>
              <div><p className="text-2xl font-bold">{rows.length}</p><p className="text-xs text-muted-foreground">Total</p></div>
            </div>
            {result.errors?.length > 0 && (
              <div className="max-h-32 overflow-y-auto text-xs space-y-1">
                {result.errors.map((e: any, i: number) => (
                  <p key={i} className="text-red-500">Row {e.row}: {e.reason}</p>
                ))}
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Close</Button>
          {!result && rows.length > 0 && (
            <Button onClick={handleImport} disabled={importing}>
              {importing ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Upload className="h-4 w-4 mr-1" />}
              Import {rows.length} Leads
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
