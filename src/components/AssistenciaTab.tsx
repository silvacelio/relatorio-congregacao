import {
  BarChart3,
  Calendar,
  FileSpreadsheet,
  FileUp,
  Printer,
  Save,
  Trash2,
} from 'lucide-react';
import { ChangeEvent, useMemo, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { MeetingAttendance } from '../types';
import { normalizeText } from '../utils/formatters';

interface AssistenciaTabProps {
  activeMonth: string;
  attendanceRecords: MeetingAttendance[];
  onSaveAttendance: (record: MeetingAttendance) => void;
  onBulkImportAttendance: (records: MeetingAttendance[]) => void;
  onDeleteAttendance: (id: string) => void;
  onNotify: (text: string, tone?: 'success' | 'error' | 'info') => void;
}

const MONTH_NAMES = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
];

const SERVICE_MONTH_ORDER = [9, 10, 11, 12, 1, 2, 3, 4, 5, 6, 7, 8];

function getDefaultServiceYear(monthKey: string): number {
  const [yStr, mStr] = monthKey.split('-');
  const y = Number(yStr);
  const m = Number(mStr);
  if (!Number.isFinite(y) || !Number.isFinite(m)) return 2027;
  return m >= 9 ? y + 1 : y;
}

function getServiceYearMonths(serviceYear: number): { monthKey: string; label: string }[] {
  return SERVICE_MONTH_ORDER.map((m) => {
    const calendarYear = m >= 9 ? serviceYear - 1 : serviceYear;
    const monthKey = `${calendarYear}-${String(m).padStart(2, '0')}`;
    const label = `${MONTH_NAMES[m - 1]} ${calendarYear}`;
    return { monthKey, label };
  });
}

function calcStats(weeks: (number | null)[]): { count: number; total: number; avg: number } {
  const valid = weeks.filter((v): v is number => typeof v === 'number' && Number.isFinite(v) && v > 0);
  const count = valid.length;
  const total = valid.reduce((sum, v) => sum + v, 0);
  const avg = count > 0 ? Math.round(total / count) : 0;
  return { count, total, avg };
}

function parseMonthCell(raw: string, fallbackYear: number): { monthNum: number; year: number } | null {
  const n = normalizeText(raw);
  if (!n) return null;
  let monthNum = 0;
  for (let i = 0; i < MONTH_NAMES.length; i++) {
    const mNorm = normalizeText(MONTH_NAMES[i]);
    if (n.includes(mNorm)) {
      monthNum = i + 1;
      break;
    }
  }
  if (!monthNum) return null;
  const yearMatch = n.match(/20\d{2}/);
  const year = yearMatch ? Number(yearMatch[0]) : fallbackYear;
  return { monthNum, year };
}

function toOptionalNum(val: unknown): number | null {
  if (val === null || val === undefined || val === '') return null;
  const num = Number(String(val).replace(',', '.').trim());
  return Number.isFinite(num) && num >= 0 ? Math.round(num) : null;
}

export function AssistenciaTab({
  activeMonth,
  attendanceRecords,
  onSaveAttendance,
  onBulkImportAttendance,
  onDeleteAttendance,
  onNotify,
}: AssistenciaTabProps) {
  const [serviceYear, setServiceYear] = useState<number>(() => getDefaultServiceYear(activeMonth));
  const [viewMode, setViewMode] = useState<'semanal' | 'resumo'>('semanal');
  const [drafts, setDrafts] = useState<Record<string, MeetingAttendance>>({});
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const recordByMonth = useMemo(() => {
    const map = new Map<string, MeetingAttendance>();
    attendanceRecords.forEach((rec) => map.set(rec.monthKey, rec));
    return map;
  }, [attendanceRecords]);

  const serviceYearOptions = useMemo(() => {
    const years = new Set<number>([2025, 2026, 2027, 2028, serviceYear]);
    attendanceRecords.forEach((rec) => {
      years.add(getDefaultServiceYear(rec.monthKey));
    });
    return Array.from(years).sort((a, b) => b - a);
  }, [attendanceRecords, serviceYear]);

  const monthsCurrent = useMemo(() => getServiceYearMonths(serviceYear), [serviceYear]);
  const monthsPrev = useMemo(() => getServiceYearMonths(serviceYear - 1), [serviceYear]);

  const getRowData = (monthKey: string): MeetingAttendance => {
    if (drafts[monthKey]) return drafts[monthKey];
    const existing = recordByMonth.get(monthKey);
    if (existing) {
      return {
        ...existing,
        midweekWeeks: [0, 1, 2, 3, 4].map((i) => existing.midweekWeeks[i] ?? null),
        weekendWeeks: [0, 1, 2, 3, 4].map((i) => existing.weekendWeeks[i] ?? null),
      };
    }
    return {
      id: monthKey,
      monthKey,
      midweekWeeks: [null, null, null, null, null],
      weekendWeeks: [null, null, null, null, null],
      notes: '',
    };
  };

  const handleWeekChange = (
    monthKey: string,
    type: 'midweek' | 'weekend',
    weekIdx: number,
    rawVal: string,
  ) => {
    const base = getRowData(monthKey);
    const parsed = rawVal.trim() === '' ? null : Math.max(0, Math.round(Number(rawVal)));
    const nextVal = parsed !== null && !Number.isFinite(parsed) ? null : parsed;

    const nextMid = [...base.midweekWeeks];
    const nextEnd = [...base.weekendWeeks];
    if (type === 'midweek') nextMid[weekIdx] = nextVal;
    else nextEnd[weekIdx] = nextVal;

    setDrafts((prev) => ({
      ...prev,
      [monthKey]: {
        ...base,
        midweekWeeks: nextMid,
        weekendWeeks: nextEnd,
      },
    }));
  };

  const handleSaveMonth = (monthKey: string) => {
    const row = getRowData(monthKey);
    onSaveAttendance(row);
    setDrafts((prev) => {
      const next = { ...prev };
      delete next[monthKey];
      return next;
    });
  };

  const handleSaveAllDrafts = () => {
    const dirtyKeys = Object.keys(drafts);
    if (dirtyKeys.length === 0) return;
    dirtyKeys.forEach((k) => onSaveAttendance(drafts[k]));
    setDrafts({});
  };

  const summarizeYear = (monthsList: { monthKey: string; label: string }[]) => {
    let midTotal = 0;
    let midMeetings = 0;
    let endTotal = 0;
    let endMeetings = 0;

    const rows = monthsList.map(({ monthKey, label }) => {
      const rec = getRowData(monthKey);
      const mid = calcStats(rec.midweekWeeks);
      const end = calcStats(rec.weekendWeeks);
      midTotal += mid.total;
      midMeetings += mid.count;
      endTotal += end.total;
      endMeetings += end.count;
      return { monthKey, label, mid, end };
    });

    return {
      rows,
      midTotal,
      midMeetings,
      midAvg: midMeetings > 0 ? Math.round(midTotal / midMeetings) : 0,
      endTotal,
      endMeetings,
      endAvg: endMeetings > 0 ? Math.round(endTotal / endMeetings) : 0,
    };
  };

  const prevSummary = useMemo(() => summarizeYear(monthsPrev), [monthsPrev, recordByMonth, drafts]);
  const currSummary = useMemo(() => summarizeYear(monthsCurrent), [monthsCurrent, recordByMonth, drafts]);

  const handleImportExcel = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: 'array' });
      const mapImported = new Map<string, MeetingAttendance>();

      wb.SheetNames.forEach((sheetName) => {
        const sheet = wb.Sheets[sheetName];
        const aoa = XLSX.utils.sheet_to_json<(string | number | boolean | null)[]>(sheet, {
          header: 1,
          defval: '',
        });
        if (aoa.length === 0) return;

        // Detect weekly layout: columns with "1ª semana" .. "5ª semana"
        let weekStartCol = -1;
        for (let r = 0; r < Math.min(5, aoa.length); r++) {
          for (let c = 0; c < aoa[r].length; c++) {
            const cellNorm = normalizeText(String(aoa[r][c] ?? ''));
            if (cellNorm.includes('1A SEMANA') || cellNorm.includes('1 SEMANA')) {
              weekStartCol = c;
              break;
            }
          }
          if (weekStartCol >= 0) break;
        }

        if (weekStartCol < 0) return;

        const sheetYearMatch = sheetName.match(/20\d{2}/);
        let runningYear = sheetYearMatch ? Number(sheetYearMatch[0]) - 1 : serviceYear - 1;
        let lastMonthNum = 0;
        let currentMonthKey = '';

        for (let r = 0; r < aoa.length; r++) {
          const row = aoa[r];
          const colA = String(row[0] ?? '').trim();
          const colB = String(row[1] ?? '').trim();
          const joined = `${colA} ${colB}`;
          const rowNorm = normalizeText(joined);

          const parsedMonth = parseMonthCell(colA, runningYear);
          if (parsedMonth) {
            if (!colA.match(/20\d{2}/) && lastMonthNum > 0 && parsedMonth.monthNum < lastMonthNum) {
              runningYear += 1;
              parsedMonth.year = runningYear;
            } else {
              runningYear = parsedMonth.year;
            }
            lastMonthNum = parsedMonth.monthNum;
            currentMonthKey = `${parsedMonth.year}-${String(parsedMonth.monthNum).padStart(2, '0')}`;
          }

          if (!currentMonthKey) continue;

          const isMid = rowNorm.includes('MEIO DA SEMANA');
          const isEnd = rowNorm.includes('FIM DE SEMANA');
          if (!isMid && !isEnd) continue;

          const existing =
            mapImported.get(currentMonthKey) ??
            recordByMonth.get(currentMonthKey) ?? {
              id: currentMonthKey,
              monthKey: currentMonthKey,
              midweekWeeks: [null, null, null, null, null],
              weekendWeeks: [null, null, null, null, null],
              notes: '',
            };

          const weeks = [0, 1, 2, 3, 4].map((offset) => toOptionalNum(row[weekStartCol + offset]));
          const updated: MeetingAttendance = {
            ...existing,
            midweekWeeks: isMid ? weeks : existing.midweekWeeks,
            weekendWeeks: isEnd ? weeks : existing.weekendWeeks,
          };
          mapImported.set(currentMonthKey, updated);
        }
      });

      const imported = Array.from(mapImported.values());
      if (imported.length === 0) {
        onNotify('Nenhum dado semanal encontrado nesse Excel. Verifique se há abas com "1ª semana" e "Reunião do meio/fim de semana".', 'error');
        return;
      }

      onBulkImportAttendance(imported);
      setDrafts({});
      onNotify(`${imported.length} meses de assistência importados com sucesso!`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Falha ao ler arquivo Excel.';
      onNotify(`Erro na importação: ${msg}`, 'error');
    }
  };

  const handleExportExcel = () => {
    const wb = XLSX.utils.book_new();

    // Sheet 1: Semanal
    const weeklyRows: (string | number)[][] = [
      [`ASSISTÊNCIA ÀS REUNIÕES — ANO DE SERVIÇO ${serviceYear}`],
      ['Mês', 'Reunião', '1ª semana', '2ª semana', '3ª semana', '4ª semana', '5ª semana', 'Qtd. Reuniões', 'Assistência Total', 'Média Semanal'],
    ];

    monthsCurrent.forEach(({ monthKey, label }) => {
      const rec = getRowData(monthKey);
      const mid = calcStats(rec.midweekWeeks);
      const end = calcStats(rec.weekendWeeks);
      weeklyRows.push([
        label,
        'Reunião do meio da semana',
        ...rec.midweekWeeks.map((v) => v ?? ''),
        mid.count,
        mid.total,
        mid.avg,
      ]);
      weeklyRows.push([
        label,
        'Reunião do fim de semana',
        ...rec.weekendWeeks.map((v) => v ?? ''),
        end.count,
        end.total,
        end.avg,
      ]);
    });

    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(weeklyRows), `Semanas ${serviceYear}`);

    // Sheet 2: Resumo Comparativo
    const summaryRows: (string | number)[][] = [
      ['REGISTRO DE ASSISTÊNCIA ÀS REUNIÕES CONGREGACIONAIS'],
      ['Reunião no meio da semana'],
      [
        `Ano de serviço ${serviceYear - 1}`,
        'Quantidade de reuniões',
        'Assistência total',
        'Assistência média por semana',
        `Ano de serviço ${serviceYear}`,
        'Quantidade de reuniões',
        'Assistência total',
        'Assistência média por semana',
      ],
      ...currSummary.rows.map((currRow, idx) => {
        const prevRow = prevSummary.rows[idx];
        return [
          prevRow.label,
          prevRow.mid.count,
          prevRow.mid.total,
          prevRow.mid.avg,
          currRow.label,
          currRow.mid.count,
          currRow.mid.total,
          currRow.mid.avg,
        ];
      }),
      [
        'Assistência média por mês',
        prevSummary.midMeetings,
        prevSummary.midTotal,
        prevSummary.midAvg,
        'Assistência média por mês',
        currSummary.midMeetings,
        currSummary.midTotal,
        currSummary.midAvg,
      ],
      [],
      ['Reunião no fim de semana'],
      [
        `Ano de serviço ${serviceYear - 1}`,
        'Quantidade de reuniões',
        'Assistência total',
        'Assistência média por semana',
        `Ano de serviço ${serviceYear}`,
        'Quantidade de reuniões',
        'Assistência total',
        'Assistência média por semana',
      ],
      ...currSummary.rows.map((currRow, idx) => {
        const prevRow = prevSummary.rows[idx];
        return [
          prevRow.label,
          prevRow.end.count,
          prevRow.end.total,
          prevRow.end.avg,
          currRow.label,
          currRow.end.count,
          currRow.end.total,
          currRow.end.avg,
        ];
      }),
      [
        'Assistência média por mês',
        prevSummary.endMeetings,
        prevSummary.endTotal,
        prevSummary.endAvg,
        'Assistência média por mês',
        currSummary.endMeetings,
        currSummary.endTotal,
        currSummary.endAvg,
      ],
    ];

    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.aoa_to_sheet(summaryRows),
      `${serviceYear - 1}-${String(serviceYear).slice(-2)}`,
    );

    XLSX.writeFile(wb, `assistencia-reunioes-${serviceYear}.xlsx`);
  };

  const dirtyCount = Object.keys(drafts).length;

  return (
    <div className="space-y-6">
      {/* Cabeçalho e KPIs */}
      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-5 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-blue-700 dark:text-blue-400" />
              Registro de Assistência às Reuniões Congregacionais
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Lance a assistência da 1ª à 5ª semana para Meio de Semana e Fim de Semana — médias calculadas automaticamente.
            </p>
          </div>

          <div className="no-print flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-slate-500" />
              <select
                aria-label="Selecionar Ano de Serviço"
                value={serviceYear}
                onChange={(e) => setServiceYear(Number(e.target.value))}
                className="h-8 px-2.5 text-xs font-semibold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-slate-900 dark:text-slate-100"
              >
                {serviceYearOptions.map((y) => (
                  <option key={y} value={y}>
                    Ano de Serviço {y} (Set/{y - 1} – Ago/{y})
                  </option>
                ))}
              </select>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              onChange={handleImportExcel}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="h-8 px-3 text-xs font-medium text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 rounded hover:bg-blue-100 inline-flex items-center gap-1.5 cursor-pointer"
            >
              <FileUp className="w-3.5 h-3.5" />
              Importar Excel Assistência
            </button>
            <button
              type="button"
              onClick={handleExportExcel}
              className="h-8 px-3 text-xs font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded hover:bg-slate-50 inline-flex items-center gap-1.5 cursor-pointer"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
              Exportar Excel
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="h-8 px-3 text-xs font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded hover:bg-slate-50 inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              Imprimir
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-md p-3.5">
            <div className="text-xs text-slate-500 dark:text-slate-400">Média Meio de Semana ({serviceYear})</div>
            <div className="mt-1 text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100">
              {currSummary.midAvg}
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400">
              {currSummary.midMeetings} reuniões · {currSummary.midTotal} total
            </div>
          </div>
          <div className="bg-emerald-50/70 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-md p-3.5">
            <div className="text-xs text-emerald-800 dark:text-emerald-300">Média Fim de Semana ({serviceYear})</div>
            <div className="mt-1 text-2xl font-bold font-mono tabular-nums text-emerald-700 dark:text-emerald-400">
              {currSummary.endAvg}
            </div>
            <div className="text-[11px] text-emerald-800/80 dark:text-emerald-300/80">
              {currSummary.endMeetings} reuniões · {currSummary.endTotal} total
            </div>
          </div>
          <div className="bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-md p-3.5">
            <div className="text-xs text-slate-500 dark:text-slate-400">Média Meio de Semana ({serviceYear - 1})</div>
            <div className="mt-1 text-2xl font-bold font-mono tabular-nums text-slate-700 dark:text-slate-300">
              {prevSummary.midAvg}
            </div>
          </div>
          <div className="bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-md p-3.5">
            <div className="text-xs text-slate-500 dark:text-slate-400">Média Fim de Semana ({serviceYear - 1})</div>
            <div className="mt-1 text-2xl font-bold font-mono tabular-nums text-slate-700 dark:text-slate-300">
              {prevSummary.endAvg}
            </div>
          </div>
        </div>

        {/* Sub-abas */}
        <div className="no-print flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
          <div className="inline-flex rounded-md border border-slate-200 dark:border-slate-700 overflow-hidden">
            <button
              type="button"
              onClick={() => setViewMode('semanal')}
              className={`px-3.5 py-1.5 text-xs font-medium cursor-pointer ${
                viewMode === 'semanal'
                  ? 'bg-blue-700 text-white'
                  : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50'
              }`}
            >
              Lançamento Semanal ({serviceYear})
            </button>
            <button
              type="button"
              onClick={() => setViewMode('resumo')}
              className={`px-3.5 py-1.5 text-xs font-medium cursor-pointer ${
                viewMode === 'resumo'
                  ? 'bg-blue-700 text-white'
                  : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50'
              }`}
            >
              Resumo Comparativo ({serviceYear - 1} vs {serviceYear})
            </button>
          </div>

          {dirtyCount > 0 && (
            <button
              type="button"
              onClick={handleSaveAllDrafts}
              className="h-8 px-3.5 text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              Salvar {dirtyCount} {dirtyCount === 1 ? 'mês alterado' : 'meses alterados'}
            </button>
          )}
        </div>
      </section>

      {viewMode === 'semanal' ? (
        <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="bg-slate-100 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200">
                  <th className="py-2.5 px-3">Mês</th>
                  <th className="py-2.5 px-3">Reunião</th>
                  <th className="py-2.5 px-2 text-center">1ª sem.</th>
                  <th className="py-2.5 px-2 text-center">2ª sem.</th>
                  <th className="py-2.5 px-2 text-center">3ª sem.</th>
                  <th className="py-2.5 px-2 text-center">4ª sem.</th>
                  <th className="py-2.5 px-2 text-center">5ª sem.</th>
                  <th className="py-2.5 px-3 text-right">Qtd.</th>
                  <th className="py-2.5 px-3 text-right">Total</th>
                  <th className="py-2.5 px-3 text-right">Média</th>
                  <th className="no-print py-2.5 px-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-xs">
                {monthsCurrent.map(({ monthKey, label }, idx) => {
                  const row = getRowData(monthKey);
                  const mid = calcStats(row.midweekWeeks);
                  const end = calcStats(row.weekendWeeks);
                  const isDirty = Boolean(drafts[monthKey]);
                  const hasSaved = recordByMonth.has(monthKey);
                  const tint =
                    idx % 2 === 0
                      ? 'bg-white dark:bg-slate-900'
                      : 'bg-slate-50/60 dark:bg-slate-900/50';

                  return (
                    <>
                      <tr key={`${monthKey}-mid`} className={tint}>
                        <td
                          rowSpan={2}
                          className="py-2.5 px-3 font-bold text-slate-900 dark:text-slate-100 border-r border-slate-200 dark:border-slate-800 align-middle whitespace-nowrap"
                        >
                          {label}
                        </td>
                        <td className="py-2 px-3 font-medium text-blue-800 dark:text-blue-300 whitespace-nowrap">
                          Reunião do meio da semana
                        </td>
                        {[0, 1, 2, 3, 4].map((wIdx) => (
                          <td key={wIdx} className="py-1.5 px-1.5 text-center">
                            <input
                              type="number"
                              min={0}
                              value={row.midweekWeeks[wIdx] ?? ''}
                              onChange={(e) =>
                                handleWeekChange(monthKey, 'midweek', wIdx, e.target.value)
                              }
                              aria-label={`${label} meio de semana ${wIdx + 1}ª semana`}
                              className="w-16 h-8 px-2 text-center font-mono bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600"
                            />
                          </td>
                        ))}
                        <td className="py-2 px-3 text-right font-mono text-slate-600 dark:text-slate-400">
                          {mid.count}
                        </td>
                        <td className="py-2 px-3 text-right font-mono font-semibold text-slate-900 dark:text-slate-100">
                          {mid.total}
                        </td>
                        <td className="py-2 px-3 text-right font-mono font-bold text-blue-700 dark:text-blue-400">
                          {mid.avg}
                        </td>
                        <td
                          rowSpan={2}
                          className="no-print py-2 px-3 text-right align-middle border-l border-slate-200 dark:border-slate-800"
                        >
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              disabled={!isDirty}
                              onClick={() => handleSaveMonth(monthKey)}
                              className={`h-8 px-2.5 text-xs font-medium rounded inline-flex items-center gap-1 ${
                                isDirty
                                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer'
                                  : 'bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
                              }`}
                            >
                              <Save className="w-3.5 h-3.5" />
                              Salvar
                            </button>
                            {hasSaved && (
                              <button
                                type="button"
                                onClick={() => onDeleteAttendance(monthKey)}
                                aria-label={`Limpar dados de ${label}`}
                                className="p-1.5 text-slate-400 hover:text-red-600 rounded cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                      <tr key={`${monthKey}-end`} className={tint}>
                        <td className="py-2 px-3 font-medium text-emerald-800 dark:text-emerald-300 whitespace-nowrap">
                          Reunião do fim de semana
                        </td>
                        {[0, 1, 2, 3, 4].map((wIdx) => (
                          <td key={wIdx} className="py-1.5 px-1.5 text-center">
                            <input
                              type="number"
                              min={0}
                              value={row.weekendWeeks[wIdx] ?? ''}
                              onChange={(e) =>
                                handleWeekChange(monthKey, 'weekend', wIdx, e.target.value)
                              }
                              aria-label={`${label} fim de semana ${wIdx + 1}ª semana`}
                              className="w-16 h-8 px-2 text-center font-mono bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                            />
                          </td>
                        ))}
                        <td className="py-2 px-3 text-right font-mono text-slate-600 dark:text-slate-400">
                          {end.count}
                        </td>
                        <td className="py-2 px-3 text-right font-mono font-semibold text-slate-900 dark:text-slate-100">
                          {end.total}
                        </td>
                        <td className="py-2 px-3 text-right font-mono font-bold text-emerald-700 dark:text-emerald-400">
                          {end.avg}
                        </td>
                      </tr>
                    </>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      ) : (
        <div className="space-y-6">
          {/* Tabela Comparativa: Meio da Semana */}
          <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
            <div className="px-5 py-3 bg-blue-50 dark:bg-blue-950/50 border-b border-blue-200 dark:border-blue-900 text-sm font-bold text-blue-950 dark:text-blue-200">
              Reunião no meio da semana — Comparativo {serviceYear - 1} vs {serviceYear}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 font-semibold text-slate-700 dark:text-slate-200">
                    <th className="py-2.5 px-3">Ano de serviço {serviceYear - 1}</th>
                    <th className="py-2.5 px-3 text-right">Qtd. reuniões</th>
                    <th className="py-2.5 px-3 text-right">Assist. total</th>
                    <th className="py-2.5 px-3 text-right border-r border-slate-200 dark:border-slate-700">Média semanal</th>
                    <th className="py-2.5 px-3">Ano de serviço {serviceYear}</th>
                    <th className="py-2.5 px-3 text-right">Qtd. reuniões</th>
                    <th className="py-2.5 px-3 text-right">Assist. total</th>
                    <th className="py-2.5 px-3 text-right">Média semanal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {currSummary.rows.map((currRow, idx) => {
                    const prevRow = prevSummary.rows[idx];
                    return (
                      <tr key={currRow.monthKey} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                        <td className="py-2 px-3 font-medium text-slate-900 dark:text-slate-100">{prevRow.label}</td>
                        <td className="py-2 px-3 text-right font-mono">{prevRow.mid.count}</td>
                        <td className="py-2 px-3 text-right font-mono">{prevRow.mid.total}</td>
                        <td className="py-2 px-3 text-right font-mono font-bold border-r border-slate-200 dark:border-slate-700">{prevRow.mid.avg}</td>
                        <td className="py-2 px-3 font-medium text-slate-900 dark:text-slate-100">{currRow.label}</td>
                        <td className="py-2 px-3 text-right font-mono">{currRow.mid.count}</td>
                        <td className="py-2 px-3 text-right font-mono">{currRow.mid.total}</td>
                        <td className="py-2 px-3 text-right font-mono font-bold text-blue-700 dark:text-blue-400">{currRow.mid.avg}</td>
                      </tr>
                    );
                  })}
                  <tr className="bg-slate-100 dark:bg-slate-800 font-bold">
                    <td className="py-2.5 px-3">Assistência média por mês</td>
                    <td className="py-2.5 px-3 text-right font-mono">{prevSummary.midMeetings}</td>
                    <td className="py-2.5 px-3 text-right font-mono">{prevSummary.midTotal}</td>
                    <td className="py-2.5 px-3 text-right font-mono border-r border-slate-200 dark:border-slate-700">{prevSummary.midAvg}</td>
                    <td className="py-2.5 px-3">Assistência média por mês</td>
                    <td className="py-2.5 px-3 text-right font-mono">{currSummary.midMeetings}</td>
                    <td className="py-2.5 px-3 text-right font-mono">{currSummary.midTotal}</td>
                    <td className="py-2.5 px-3 text-right font-mono text-blue-700 dark:text-blue-400">{currSummary.midAvg}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          {/* Tabela Comparativa: Fim de Semana */}
          <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
            <div className="px-5 py-3 bg-emerald-50 dark:bg-emerald-950/50 border-b border-emerald-200 dark:border-emerald-900 text-sm font-bold text-emerald-950 dark:text-emerald-200">
              Reunião no fim de semana — Comparativo {serviceYear - 1} vs {serviceYear}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 font-semibold text-slate-700 dark:text-slate-200">
                    <th className="py-2.5 px-3">Ano de serviço {serviceYear - 1}</th>
                    <th className="py-2.5 px-3 text-right">Qtd. reuniões</th>
                    <th className="py-2.5 px-3 text-right">Assist. total</th>
                    <th className="py-2.5 px-3 text-right border-r border-slate-200 dark:border-slate-700">Média semanal</th>
                    <th className="py-2.5 px-3">Ano de serviço {serviceYear}</th>
                    <th className="py-2.5 px-3 text-right">Qtd. reuniões</th>
                    <th className="py-2.5 px-3 text-right">Assist. total</th>
                    <th className="py-2.5 px-3 text-right">Média semanal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {currSummary.rows.map((currRow, idx) => {
                    const prevRow = prevSummary.rows[idx];
                    return (
                      <tr key={currRow.monthKey} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                        <td className="py-2 px-3 font-medium text-slate-900 dark:text-slate-100">{prevRow.label}</td>
                        <td className="py-2 px-3 text-right font-mono">{prevRow.end.count}</td>
                        <td className="py-2 px-3 text-right font-mono">{prevRow.end.total}</td>
                        <td className="py-2 px-3 text-right font-mono font-bold border-r border-slate-200 dark:border-slate-700">{prevRow.end.avg}</td>
                        <td className="py-2 px-3 font-medium text-slate-900 dark:text-slate-100">{currRow.label}</td>
                        <td className="py-2 px-3 text-right font-mono">{currRow.end.count}</td>
                        <td className="py-2 px-3 text-right font-mono">{currRow.end.total}</td>
                        <td className="py-2 px-3 text-right font-mono font-bold text-emerald-700 dark:text-emerald-400">{currRow.end.avg}</td>
                      </tr>
                    );
                  })}
                  <tr className="bg-slate-100 dark:bg-slate-800 font-bold">
                    <td className="py-2.5 px-3">Assistência média por mês</td>
                    <td className="py-2.5 px-3 text-right font-mono">{prevSummary.endMeetings}</td>
                    <td className="py-2.5 px-3 text-right font-mono">{prevSummary.endTotal}</td>
                    <td className="py-2.5 px-3 text-right font-mono border-r border-slate-200 dark:border-slate-700">{prevSummary.endAvg}</td>
                    <td className="py-2.5 px-3">Assistência média por mês</td>
                    <td className="py-2.5 px-3 text-right font-mono">{currSummary.endMeetings}</td>
                    <td className="py-2.5 px-3 text-right font-mono">{currSummary.endTotal}</td>
                    <td className="py-2.5 px-3 text-right font-mono text-emerald-700 dark:text-emerald-400">{currSummary.endAvg}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
