import mammoth from 'mammoth';
import * as XLSX from 'xlsx';
import { AuxiliaryPioneerOption, PrivilegeType } from '../types';
import { cleanDisplayName, normalizeText } from './formatters';

export interface ParsedRow {
  name: string;
  group?: string;
  privilege?: PrivilegeType;
  participated?: boolean;
  hours?: number | null;
  bibleStudies?: number | null;
  auxiliaryPioneer?: AuxiliaryPioneerOption;
  notes?: string;
  timestamp?: string;
}

export interface ParsedSheetResult {
  sourceName: string;
  sheetNames: string[];
  selectedSheet: string;
  rawGrid: string[][];
  rows: ParsedRow[];
  hasStructuredColumns: boolean;
}

const IGNORED_HEADERS = new Set([
  'NOME',
  'NOMES',
  'PUBLICADOR',
  'PUBLICADORES',
  'CABECALHO',
  'LISTA',
  'PARTICIPANTES',
  'MEMBROS',
  'RELATORIO',
  'RELATORIO CONGREGACAO',
]);

function stripListPrefix(line: string): string {
  return line
    .replace(/^\s*(?:\d+[.)\-–]|\u2022|\*|-|–)\s+/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function parsePrivilege(raw?: string): PrivilegeType | undefined {
  if (!raw) return undefined;
  const n = normalizeText(raw);
  if (n.includes('ANCIAO') || n.includes('ANC')) return 'Ancião';
  if (n.includes('SERVO')) return 'Servo Ministerial';
  if (n.includes('REGULAR') || n === 'PR') return 'Pioneiro Regular';
  if (n.includes('AUXILIAR') || n === 'PA') return 'Pioneiro Auxiliar';
  if (n.includes('PUBLICADOR') || n === 'PUB') return 'Publicador';
  return undefined;
}

function parseParticipated(raw?: string): boolean | undefined {
  if (!raw) return undefined;
  const n = normalizeText(raw);
  if (n === 'SIM' || n === 'S' || n === 'YES' || n === 'TRUE' || n === 'X' || n === '1' || n.includes('PARTICIPOU')) {
    return true;
  }
  if (n === 'NAO' || n === 'N' || n === 'NO' || n === 'FALSE' || n === '0') {
    return false;
  }
  return undefined;
}

function parseAuxPioneer(raw?: string): AuxiliaryPioneerOption | undefined {
  if (!raw) return undefined;
  const n = normalizeText(raw);
  if (!n || n === 'NAO' || n === 'N' || n === '-') return 'Não';
  if (n.includes('15')) return '15 horas';
  if (n.includes('30')) return '30 horas';
  if (n.includes('CONTINU')) return 'Contínuo';
  if (n === 'SIM' || n === 'S') return '30 horas';
  return undefined;
}

function parseOptionalInt(raw?: string): number | null {
  if (!raw) return null;
  const cleaned = raw.replace(/[^\d.,-]/g, '').replace(',', '.').trim();
  if (!cleaned) return null;
  const val = Number(cleaned);
  return Number.isFinite(val) && val >= 0 ? Math.round(val) : null;
}

export function interpretGrid(grid: string[][]): { rows: ParsedRow[]; hasStructuredColumns: boolean } {
  const nonEmpty = grid
    .map((r) => r.map((c) => String(c ?? '').trim()))
    .filter((r) => r.some((cell) => cell.length > 0));

  if (nonEmpty.length === 0) {
    return { rows: [], hasStructuredColumns: false };
  }

  const maxCols = Math.max(...nonEmpty.map((r) => r.length));

  if (maxCols === 1) {
    const rows: ParsedRow[] = [];
    for (const r of nonEmpty) {
      const cleaned = stripListPrefix(r[0]);
      const norm = normalizeText(cleaned);
      if (!cleaned || IGNORED_HEADERS.has(norm) || norm.startsWith('CARIMBO')) continue;
      rows.push({ name: cleanDisplayName(cleaned) });
    }
    return { rows, hasStructuredColumns: false };
  }

  const firstRowNorm = nonEmpty[0].map((c) => normalizeText(c));
  const looksLikeHeader = firstRowNorm.some(
    (h) =>
      h.includes('NOME') ||
      h.includes('PUBLICADOR') ||
      h.includes('HORAS') ||
      h.includes('ESTUD') ||
      h.includes('PARTICIP') ||
      h.includes('CARIMBO') ||
      h.includes('GRUPO') ||
      h === 'CABECALHO',
  );

  let nameIdx = 0;
  let groupIdx = -1;
  let privilegeIdx = -1;
  let participatedIdx = -1;
  let hoursIdx = -1;
  let studiesIdx = -1;
  let auxIdx = -1;
  let notesIdx = -1;
  let timestampIdx = -1;

  if (looksLikeHeader) {
    firstRowNorm.forEach((h, idx) => {
      if (h.includes('NOME') || h.includes('PUBLICADOR') || h === 'CABECALHO') nameIdx = idx;
      else if (h.includes('GRUPO')) groupIdx = idx;
      else if (h.includes('PRIVILEG') || h.includes('DESIGNA')) privilegeIdx = idx;
      else if (h.includes('PARTICIP') || h.includes('MARQUE') || h === 'STATUS') participatedIdx = idx;
      else if (h.includes('HORA')) hoursIdx = idx;
      else if (h.includes('ESTUD')) studiesIdx = idx;
      else if (h.includes('AUXILIAR') || h.includes('PIONEIRO AUX')) auxIdx = idx;
      else if (h.includes('OBSERV') || h.includes('NOTA')) notesIdx = idx;
      else if (h.includes('CARIMBO') || h.includes('DATA')) timestampIdx = idx;
    });
  } else {
    // Heuristic: if col 0 looks like a date/timestamp and col 1 looks like text name
    const firstCell = nonEmpty[0][0] ?? '';
    if (/^\d{1,2}\/\d{1,2}\/\d{2,4}/.test(firstCell) && (nonEmpty[0][1] ?? '').length > 2) {
      timestampIdx = 0;
      nameIdx = 1;
      if (maxCols >= 3) participatedIdx = 2;
      if (maxCols >= 4) hoursIdx = 3;
      if (maxCols >= 5) studiesIdx = 4;
      if (maxCols >= 6) auxIdx = 5;
      if (maxCols >= 7) notesIdx = 6;
    }
  }

  const dataRows = looksLikeHeader ? nonEmpty.slice(1) : nonEmpty;
  const parsed: ParsedRow[] = [];

  for (const r of dataRows) {
    const rawName = stripListPrefix(r[nameIdx] ?? '');
    const normName = normalizeText(rawName);
    if (!rawName || IGNORED_HEADERS.has(normName)) continue;

    parsed.push({
      name: cleanDisplayName(rawName),
      group: groupIdx >= 0 && r[groupIdx] ? r[groupIdx].trim() : undefined,
      privilege: privilegeIdx >= 0 ? parsePrivilege(r[privilegeIdx]) : undefined,
      participated: participatedIdx >= 0 ? parseParticipated(r[participatedIdx]) : undefined,
      hours: hoursIdx >= 0 ? parseOptionalInt(r[hoursIdx]) : undefined,
      bibleStudies: studiesIdx >= 0 ? parseOptionalInt(r[studiesIdx]) : undefined,
      auxiliaryPioneer: auxIdx >= 0 ? parseAuxPioneer(r[auxIdx]) : undefined,
      notes: notesIdx >= 0 && r[notesIdx] ? r[notesIdx].trim() : undefined,
      timestamp: timestampIdx >= 0 && r[timestampIdx] ? r[timestampIdx].trim() : undefined,
    });
  }

  const hasStructured =
    looksLikeHeader || groupIdx >= 0 || hoursIdx >= 0 || participatedIdx >= 0 || studiesIdx >= 0;
  return { rows: parsed, hasStructuredColumns: hasStructured };
}

export async function parseSpreadsheetFile(
  file: File,
  preferredSheet?: string,
): Promise<ParsedSheetResult> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });
  const sheetNames = workbook.SheetNames;
  const selectedSheet =
    preferredSheet && sheetNames.includes(preferredSheet) ? preferredSheet : sheetNames[0];

  const sheet = workbook.Sheets[selectedSheet];
  const rawAoA = XLSX.utils.sheet_to_json<(string | number | boolean | null)[]>(sheet, {
    header: 1,
    defval: '',
  });
  const rawGrid = rawAoA.map((row) => row.map((cell) => String(cell ?? '').trim()));
  const { rows, hasStructuredColumns } = interpretGrid(rawGrid);

  return {
    sourceName: file.name,
    sheetNames,
    selectedSheet,
    rawGrid,
    rows,
    hasStructuredColumns,
  };
}

export async function parseWordDocxFile(file: File): Promise<ParsedSheetResult> {
  const buffer = await file.arrayBuffer();
  const htmlResult = await mammoth.convertToHtml({ arrayBuffer: buffer });
  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlResult.value, 'text/html');

  const tables = Array.from(doc.querySelectorAll('table'));
  let grid: string[][] = [];

  if (tables.length > 0) {
    // Combine rows from tables (choosing the largest table or merging tables with same columns)
    const largestTable = tables.reduce((best, cur) =>
      cur.querySelectorAll('tr').length > best.querySelectorAll('tr').length ? cur : best,
    );
    const trs = Array.from(largestTable.querySelectorAll('tr'));
    grid = trs.map((tr) =>
      Array.from(tr.querySelectorAll('th, td')).map((cell) =>
        (cell.textContent ?? '').replace(/\s+/g, ' ').trim(),
      ),
    );
  } else {
    const textResult = await mammoth.extractRawText({ arrayBuffer: buffer });
    const lines = textResult.value
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0);
    grid = lines.map((line) => parseSingleTextLine(line));
  }

  const { rows, hasStructuredColumns } = interpretGrid(grid);
  return {
    sourceName: file.name,
    sheetNames: ['Documento Word'],
    selectedSheet: 'Documento Word',
    rawGrid: grid,
    rows,
    hasStructuredColumns,
  };
}

function parseSingleTextLine(line: string): string[] {
  if (line.includes('\t')) {
    return line.split('\t').map((s) => s.trim());
  }
  if (line.includes(';')) {
    return line.split(';').map((s) => s.trim());
  }
  if (line.includes(',') && line.split(',').length >= 2) {
    return line.split(',').map((s) => s.trim());
  }
  return [line.trim()];
}

export function parsePastedText(text: string): ParsedSheetResult {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const grid = lines.map((line) => parseSingleTextLine(line));
  const { rows, hasStructuredColumns } = interpretGrid(grid);

  return {
    sourceName: 'Texto Colado',
    sheetNames: ['Texto Colado'],
    selectedSheet: 'Texto Colado',
    rawGrid: grid,
    rows,
    hasStructuredColumns,
  };
}
