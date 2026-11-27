import {
  Check,
  CreditCard,
  FileSpreadsheet,
  FileUp,
  Pencil,
  Printer,
  Search,
  X,
} from 'lucide-react';
import { ChangeEvent, FormEvent, useMemo, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import {
  ActivityReport,
  AuxiliaryPioneerOption,
  PrivilegeType,
  Publisher,
  PublisherGender,
  PublisherHope,
  ServiceGroup,
  SpecialRoleType,
} from '../types';
import { cleanDisplayName, generateId, normalizeText } from '../utils/formatters';

interface CartoesTabProps {
  activeMonth: string;
  publishers: Publisher[];
  reports: ActivityReport[];
  serviceGroups: ServiceGroup[];
  onUpdatePublisher: (pub: Publisher) => void;
  onBulkImportCartoes: (
    importedPublishers: Publisher[],
    importedReports: ActivityReport[],
  ) => void;
  onEditMonthReport: (
    publisher: Publisher,
    monthKey: string,
    existing?: ActivityReport | null,
  ) => void;
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

function getServiceYearMonths(serviceYear: number): { monthKey: string; name: string; year: number }[] {
  return SERVICE_MONTH_ORDER.map((m) => {
    const calendarYear = m >= 9 ? serviceYear - 1 : serviceYear;
    return {
      monthKey: `${calendarYear}-${String(m).padStart(2, '0')}`,
      name: MONTH_NAMES[m - 1],
      year: calendarYear,
    };
  });
}

function isTruthyCell(val: unknown): boolean {
  if (val === true || val === 1) return true;
  if (typeof val === 'string') {
    const n = normalizeText(val);
    return n === 'TRUE' || n === 'VERDADEIRO' || n === 'SIM' || n === 'S' || n === 'X' || n === '1';
  }
  return false;
}

function formatExcelDate(val: unknown): string {
  if (val === null || val === undefined || val === '') return '';
  if (typeof val === 'number' && Number.isFinite(val) && val > 1000) {
    const parsed = XLSX.SSF.parse_date_code(val);
    if (parsed && parsed.y && parsed.m && parsed.d) {
      return `${String(parsed.d).padStart(2, '0')}/${String(parsed.m).padStart(2, '0')}/${parsed.y}`;
    }
  }
  const str = String(val).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    const [y, m, d] = str.split('-');
    return `${d}/${m}/${y}`;
  }
  return str;
}

function parseMonthHeader(raw: string): string | null {
  const n = normalizeText(raw);
  if (!n) return null;
  let monthNum = 0;
  for (let i = 0; i < MONTH_NAMES.length; i++) {
    if (n.includes(normalizeText(MONTH_NAMES[i]))) {
      monthNum = i + 1;
      break;
    }
  }
  if (!monthNum) return null;
  const yearMatch = n.match(/20\d{2}/);
  if (!yearMatch) return null;
  return `${yearMatch[0]}-${String(monthNum).padStart(2, '0')}`;
}

function parseGroupCode(rawGroup: string, serviceGroups: ServiceGroup[]): { group: string; groupId?: string } {
  const raw = rawGroup.trim();
  if (!raw) return { group: 'Sem Grupo' };
  const n = normalizeText(raw);

  const aliasKeywords: Record<string, string[]> = {
    MC: ['MARIO CARPENTER'],
    S1: ['SALAO DO REINO 1', 'SALAO 1'],
    S2: ['SALAO DO REINO 2', 'SALAO 2'],
    JR: ['JOSE DOS REIS'],
    FC: ['FERNAO CARDIM'],
  };

  const direct = serviceGroups.find((g) => normalizeText(g.name) === n);
  if (direct) return { group: direct.name, groupId: direct.id };

  const keywords = aliasKeywords[n];
  if (keywords) {
    const matched = serviceGroups.find((g) => {
      const gn = normalizeText(g.name);
      return keywords.some((kw) => gn.includes(kw));
    });
    if (matched) return { group: matched.name, groupId: matched.id };
  }

  return { group: raw };
}

function parseAuxCell(val: unknown): AuxiliaryPioneerOption {
  if (val === true || val === 1) return '30 horas';
  const s = normalizeText(String(val ?? ''));
  if (!s || s === 'NAO' || s === 'N' || s === 'FALSE' || s === 'FALSO' || s === '-') return 'Não';
  if (s.includes('15')) return '15 horas';
  if (s.includes('30')) return '30 horas';
  if (s.includes('CONTINU')) return 'Contínuo';
  if (s === 'SIM' || s === 'S' || s === 'X' || s === 'TRUE' || s === 'VERDADEIRO' || s === 'PA') {
    return '30 horas';
  }
  return 'Não';
}

function parseIntCell(val: unknown): number | null {
  if (val === null || val === undefined || val === '') return null;
  const num = Number(String(val).replace(',', '.').trim());
  return Number.isFinite(num) && num >= 0 ? Math.round(num) : null;
}

function CheckBoxBadge({ checked, label }: { checked: boolean; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-slate-800 dark:text-slate-200">
      <span
        className={`w-4 h-4 rounded-sm border inline-flex items-center justify-center text-[10px] font-bold ${
          checked
            ? 'bg-slate-800 border-slate-800 text-white dark:bg-blue-600 dark:border-blue-600'
            : 'bg-white border-slate-400 dark:bg-slate-800 dark:border-slate-600'
        }`}
      >
        {checked ? '✓' : ''}
      </span>
      <span>{label}</span>
    </span>
  );
}

export function CartoesTab({
  activeMonth,
  publishers,
  reports,
  serviceGroups,
  onUpdatePublisher,
  onBulkImportCartoes,
  onEditMonthReport,
  onNotify,
}: CartoesTabProps) {
  const [search, setSearch] = useState('');
  const [groupFilter, setGroupFilter] = useState<string>('all');
  const [serviceYear, setServiceYear] = useState<number>(() => getDefaultServiceYear(activeMonth));
  const [selectedPubId, setSelectedPubId] = useState<string>(() => publishers[0]?.id ?? '');
  const [editingCard, setEditingCard] = useState(false);

  // Campos de edição do cabeçalho S-21
  const [editCode, setEditCode] = useState('');
  const [editBirth, setEditBirth] = useState('');
  const [editBaptism, setEditBaptism] = useState('');
  const [editGender, setEditGender] = useState<PublisherGender | ''>('');
  const [editHope, setEditHope] = useState<PublisherHope | ''>('');
  const [editPrivilege, setEditPrivilege] = useState<PrivilegeType>('Publicador');
  const [editIsRegPioneer, setEditIsRegPioneer] = useState(false);
  const [editSpecialRole, setEditSpecialRole] = useState<SpecialRoleType>('Nenhum');
  const [editGroupId, setEditGroupId] = useState('');

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const orderedGroups = useMemo(
    () =>
      [...serviceGroups].sort(
        (a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, 'pt-BR'),
      ),
    [serviceGroups],
  );

  const filteredPublishers = useMemo(() => {
    const q = normalizeText(search);
    return [...publishers]
      .filter((p) => {
        if (groupFilter !== 'all') {
          const matchesGroup =
            p.groupId === groupFilter ||
            (!p.groupId &&
              orderedGroups.some(
                (g) => g.id === groupFilter && normalizeText(g.name) === normalizeText(p.group || ''),
              ));
          if (!matchesGroup) return false;
        }
        if (!q) return true;
        return (
          normalizeText(p.name).includes(q) ||
          normalizeText(p.publisherCode || '').includes(q) ||
          normalizeText(p.group || '').includes(q)
        );
      })
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  }, [publishers, search, groupFilter, orderedGroups]);

  const selectedPublisher = useMemo(() => {
    return (
      publishers.find((p) => p.id === selectedPubId) ??
      filteredPublishers[0] ??
      publishers[0] ??
      null
    );
  }, [publishers, selectedPubId, filteredPublishers]);

  const serviceYearOptions = useMemo(() => {
    const set = new Set<number>([2025, 2026, 2027, 2028, serviceYear]);
    reports.forEach((r) => set.add(getDefaultServiceYear(r.monthKey)));
    return Array.from(set).sort((a, b) => b - a);
  }, [reports, serviceYear]);

  const cardMonths = useMemo(() => getServiceYearMonths(serviceYear), [serviceYear]);

  const cardRows = useMemo(() => {
    if (!selectedPublisher) return [];
    const normName = normalizeText(selectedPublisher.name);
    return cardMonths.map((m) => {
      const report =
        reports.find(
          (r) =>
            r.monthKey === m.monthKey &&
            (r.publisherId === selectedPublisher.id || normalizeText(r.publisherName) === normName),
        ) ?? null;
      return { ...m, report };
    });
  }, [selectedPublisher, cardMonths, reports]);

  const cardTotals = useMemo(() => {
    let participatedMonths = 0;
    let totalStudies = 0;
    let totalHours = 0;
    let auxMonths = 0;

    cardRows.forEach(({ report }) => {
      if (!report) return;
      if (report.participated) participatedMonths += 1;
      totalStudies += report.bibleStudies ?? 0;
      totalHours += report.hours ?? 0;
      if (report.auxiliaryPioneer && report.auxiliaryPioneer !== 'Não') auxMonths += 1;
    });

    return { participatedMonths, totalStudies, totalHours, auxMonths };
  }, [cardRows]);

  const openEditCard = () => {
    if (!selectedPublisher) return;
    setEditCode(selectedPublisher.publisherCode ?? '');
    setEditBirth(selectedPublisher.birthDate ?? '');
    setEditBaptism(selectedPublisher.baptismDate ?? '');
    setEditGender(selectedPublisher.gender ?? '');
    setEditHope(selectedPublisher.hope ?? '');
    setEditPrivilege(selectedPublisher.privilege);
    setEditIsRegPioneer(
      Boolean(
        selectedPublisher.isRegularPioneer || selectedPublisher.privilege === 'Pioneiro Regular',
      ),
    );
    setEditSpecialRole(selectedPublisher.specialRole ?? 'Nenhum');

    const matchedGroup =
      orderedGroups.find((g) => g.id === selectedPublisher.groupId) ??
      orderedGroups.find(
        (g) => normalizeText(g.name) === normalizeText(selectedPublisher.group || ''),
      );
    setEditGroupId(matchedGroup?.id ?? '');
    setEditingCard(true);
  };

  const handleSaveCardMetadata = (e: FormEvent) => {
    e.preventDefault();
    if (!selectedPublisher) return;
    const chosenGroup = editGroupId ? orderedGroups.find((g) => g.id === editGroupId) : undefined;

    onUpdatePublisher({
      ...selectedPublisher,
      publisherCode: editCode.trim() || undefined,
      birthDate: editBirth.trim() || undefined,
      baptismDate: editBaptism.trim() || undefined,
      gender: editGender || undefined,
      hope: editHope || undefined,
      privilege: editPrivilege,
      isRegularPioneer: editIsRegPioneer || editPrivilege === 'Pioneiro Regular',
      specialRole: editSpecialRole,
      group: chosenGroup ? chosenGroup.name : selectedPublisher.group,
      groupId: chosenGroup ? chosenGroup.id : selectedPublisher.groupId,
    });
    setEditingCard(false);
  };

  const handleImportCartoesExcel = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: 'array' });

      const dadosSheetName =
        wb.SheetNames.find((s) => normalizeText(s) === 'DADOS') ?? wb.SheetNames[0];
      const sheet = wb.Sheets[dadosSheetName];
      const aoa = XLSX.utils.sheet_to_json<(string | number | boolean | null)[]>(sheet, {
        header: 1,
        defval: '',
      });

      // Localizar linha de cabeçalho contendo NOMES / NOME
      let headerRowIdx = -1;
      for (let r = 0; r < Math.min(10, aoa.length); r++) {
        const hasName = aoa[r].some((c) => {
          const n = normalizeText(String(c ?? ''));
          return n.includes('NOMES') || n === 'NOME' || n.includes('PUBLICADOR');
        });
        if (hasName) {
          headerRowIdx = r;
          break;
        }
      }

      if (headerRowIdx < 0) {
        onNotify('Não foi possível encontrar a coluna NOMES na aba Dados desse Excel.', 'error');
        return;
      }

      const headerRow = aoa[headerRowIdx].map((c) => normalizeText(String(c ?? '')));
      const findCol = (preds: ((h: string) => boolean)[]) =>
        headerRow.findIndex((h) => preds.some((fn) => fn(h)));

      const flagCol = findCol([(h) => h.includes('IN IR')]);
      const groupCol = findCol([(h) => h === 'GRUPO' || h.includes('GRUPO')]);
      const idCol = findCol([(h) => h === 'ID']);
      const nameCol = findCol([(h) => h.includes('NOMES') || h === 'NOME' || h.includes('PUBLICADOR')]);
      const birthCol = findCol([(h) => h.includes('NASC')]);
      const baptCol = findCol([(h) => h.includes('BATIS')]);
      const mascCol = findCol([(h) => h.includes('MASC')]);
      const femCol = findCol([(h) => h.includes('FEMIN')]);
      const ancCol = findCol([(h) => h.includes('ANCIAO')]);
      const smCol = findCol([(h) => h.includes('MINISTERIAL') || h.includes('S.MINISTERIAL')]);
      const ooCol = findCol([(h) => h.includes('OVELHAS') || h.includes('O.OVELHAS')]);
      const ungCol = findCol([(h) => h.includes('UNGID')]);
      const prCol = findCol([(h) => h.includes('P.REGULAR') || h.includes('PIONEIRO REGULAR')]);

      // Mapear blocos mensais nas linhas acima do cabeçalho (ex: SETEMBRO (2026))
      const monthBlocks: {
        monthKey: string;
        partCol: number;
        studiesCol: number;
        auxCol: number;
        hoursCol: number;
      }[] = [];

      const maxCols = Math.max(...aoa.slice(0, headerRowIdx + 1).map((r) => r.length));
      let currentBlockMonth: string | null = null;

      for (let c = 0; c < maxCols; c++) {
        for (let r = 0; r < headerRowIdx; r++) {
          const mk = parseMonthHeader(String(aoa[r]?.[c] ?? ''));
          if (mk) {
            currentBlockMonth = mk;
          }
        }
        const subH = headerRow[c] || '';
        if (currentBlockMonth && subH.includes('PARTICIP')) {
          monthBlocks.push({
            monthKey: currentBlockMonth,
            partCol: c,
            studiesCol: headerRow[c + 1]?.includes('ESTUD') ? c + 1 : -1,
            auxCol: headerRow[c + 2]?.includes('AUX') ? c + 2 : -1,
            hoursCol: headerRow[c + 3]?.includes('HORA') ? c + 3 : -1,
          });
        }
      }

      const existingByNorm = new Map<string, Publisher>();
      publishers.forEach((p) => existingByNorm.set(normalizeText(p.name), p));

      const importedPubs: Publisher[] = [];
      const importedReps: ActivityReport[] = [];

      for (let r = headerRowIdx + 1; r < aoa.length; r++) {
        const row = aoa[r];
        const rawName = String(row[nameCol] ?? '').trim();
        if (!rawName || normalizeText(rawName).includes('NOMES')) continue;

        const cleanedName = cleanDisplayName(rawName);
        const normName = normalizeText(cleanedName);
        const existingPub = existingByNorm.get(normName);

        const rawGroup = groupCol >= 0 ? String(row[groupCol] ?? '').trim() : '';
        const resolvedGroup = rawGroup
          ? parseGroupCode(rawGroup, serviceGroups)
          : {
              group: existingPub?.group || 'Sem Grupo',
              groupId: existingPub?.groupId,
            };

        const isMasc = mascCol >= 0 && isTruthyCell(row[mascCol]);
        const isFem = femCol >= 0 && isTruthyCell(row[femCol]);
        const isAnc = ancCol >= 0 && isTruthyCell(row[ancCol]);
        const isSm = smCol >= 0 && isTruthyCell(row[smCol]);
        const isOo = ooCol >= 0 && isTruthyCell(row[ooCol]);
        const isUng = ungCol >= 0 && isTruthyCell(row[ungCol]);
        const isPr = prCol >= 0 && isTruthyCell(row[prCol]);

        let privilege: PrivilegeType = existingPub?.privilege ?? 'Publicador';
        if (isAnc) privilege = 'Ancião';
        else if (isSm) privilege = 'Servo Ministerial';
        else if (isPr) privilege = 'Pioneiro Regular';

        const flagsStr = flagCol >= 0 ? String(row[flagCol] ?? '').trim() : '';
        const isInactive = normalizeText(flagsStr) === 'IN';

        const pubId = existingPub?.id ?? generateId();
        const mergedPub: Publisher = {
          id: pubId,
          name: cleanedName,
          group: resolvedGroup.group,
          groupId: resolvedGroup.groupId,
          privilege,
          active: existingPub ? existingPub.active && !isInactive : !isInactive,
          phone: existingPub?.phone,
          publisherCode: idCol >= 0 && row[idCol] !== '' ? String(row[idCol]).trim() : existingPub?.publisherCode,
          statusFlags: flagsStr || existingPub?.statusFlags,
          birthDate: birthCol >= 0 ? formatExcelDate(row[birthCol]) || existingPub?.birthDate : existingPub?.birthDate,
          baptismDate: baptCol >= 0 ? formatExcelDate(row[baptCol]) || existingPub?.baptismDate : existingPub?.baptismDate,
          gender: isMasc ? 'Masculino' : isFem ? 'Feminino' : existingPub?.gender,
          hope: isUng ? 'Ungido' : isOo ? 'Outras Ovelhas' : existingPub?.hope,
          isRegularPioneer: isPr || Boolean(existingPub?.isRegularPioneer),
          specialRole: existingPub?.specialRole ?? 'Nenhum',
        };

        importedPubs.push(mergedPub);

        monthBlocks.forEach((blk) => {
          const rawPart = row[blk.partCol];
          const rawStud = blk.studiesCol >= 0 ? row[blk.studiesCol] : '';
          const rawAux = blk.auxCol >= 0 ? row[blk.auxCol] : '';
          const rawHrs = blk.hoursCol >= 0 ? row[blk.hoursCol] : '';

          const partChecked = isTruthyCell(rawPart);
          const studies = parseIntCell(rawStud);
          const hours = parseIntCell(rawHrs);
          const aux = parseAuxCell(rawAux);

          if (!partChecked && studies === null && hours === null && aux === 'Não') {
            return;
          }

          const existingRep = reports.find(
            (rep) =>
              rep.monthKey === blk.monthKey && normalizeText(rep.publisherName) === normName,
          );

          importedReps.push({
            id: existingRep?.id ?? generateId(),
            monthKey: blk.monthKey,
            timestamp: existingRep?.timestamp ?? new Date().toISOString(),
            publisherName: cleanedName,
            publisherId: pubId,
            privilegeSnapshot: privilege,
            participated: partChecked || (hours !== null && hours > 0),
            hours,
            bibleStudies: studies,
            auxiliaryPioneer: aux,
            notes: existingRep?.notes ?? '',
          });
        });
      }

      if (importedPubs.length === 0) {
        onNotify('Nenhum publicador encontrado na planilha.', 'error');
        return;
      }

      onBulkImportCartoes(importedPubs, importedReps);
      onNotify(
        `Importação concluída: ${importedPubs.length} publicadores e ${importedReps.length} lançamentos mensais!`,
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Falha ao ler arquivo Excel.';
      onNotify(`Erro na importação: ${msg}`, 'error');
    }
  };

  const handleExportCardExcel = () => {
    if (!selectedPublisher) return;
    const wb = XLSX.utils.book_new();

    const s21Rows: (string | number)[][] = [
      ['REGISTRO DE PUBLICADOR DE CONGREGAÇÃO', '', '', '', '', selectedPublisher.publisherCode ?? ''],
      ['Nome:', selectedPublisher.name],
      [
        'Data de nascimento:',
        selectedPublisher.birthDate || '—',
        'Sexo:',
        selectedPublisher.gender || '—',
      ],
      [
        'Data de batismo:',
        selectedPublisher.baptismDate || '—',
        'Esperança:',
        selectedPublisher.hope || '—',
      ],
      [
        'Privilégio:',
        selectedPublisher.privilege,
        'Grupo:',
        selectedPublisher.group,
      ],
      [],
      [
        `Ano de serviço ${serviceYear}`,
        'Participou no ministério',
        'Estudos bíblicos',
        'Pioneiro auxiliar',
        'Horas',
        'Observações',
      ],
      ...cardRows.map((row) => [
        `${row.name} ${row.year}`,
        row.report ? (row.report.participated ? 'Sim' : 'Não') : '',
        row.report?.bibleStudies ?? '',
        row.report && row.report.auxiliaryPioneer !== 'Não' ? row.report.auxiliaryPioneer : '',
        row.report?.hours ?? '',
        row.report?.notes ?? '',
      ]),
      [
        'Total',
        `${cardTotals.participatedMonths} meses`,
        cardTotals.totalStudies,
        `${cardTotals.auxMonths} meses`,
        cardTotals.totalHours,
        '',
      ],
    ];

    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(s21Rows), 'S-21');
    XLSX.writeFile(
      wb,
      `cartao-s21-${selectedPublisher.name.toLowerCase().replace(/\s+/g, '-')}-${serviceYear}.xlsx`,
    );
  };

  return (
    <div className="space-y-6">
      {/* Barra de Seleção e Importação Excel CARTÕES */}
      <section className="no-print bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-5 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-blue-700 dark:text-blue-400" />
              Cartões S-21 — Registro de Publicador de Congregação
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Preenchido automaticamente pelos relatórios mensais e compatível com a planilha CARTÕES (aba Dados).
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              onChange={handleImportCartoesExcel}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="h-8 px-3 text-xs font-medium text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 rounded hover:bg-blue-100 inline-flex items-center gap-1.5 cursor-pointer"
            >
              <FileUp className="w-3.5 h-3.5" />
              Importar Excel CARTÕES (Dados)
            </button>
            <button
              type="button"
              disabled={!selectedPublisher}
              onClick={handleExportCardExcel}
              className="h-8 px-3 text-xs font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded hover:bg-slate-50 disabled:opacity-40 inline-flex items-center gap-1.5 cursor-pointer"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
              Exportar Cartão
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="h-8 px-3 text-xs font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded hover:bg-slate-50 inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              Imprimir Cartão
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          <div className="md:col-span-3 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar publicador ou ID..."
              className="w-full h-9 pl-9 pr-3 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-slate-900 dark:text-slate-100"
            />
          </div>
          <div className="md:col-span-3">
            <select
              aria-label="Filtrar por grupo"
              value={groupFilter}
              onChange={(e) => setGroupFilter(e.target.value)}
              className="w-full h-9 px-3 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-slate-900 dark:text-slate-100"
            >
              <option value="all">Todos os Grupos ({publishers.length})</option>
              {orderedGroups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </div>
          <div className="md:col-span-4">
            <select
              aria-label="Selecionar Publicador"
              value={selectedPublisher?.id ?? ''}
              onChange={(e) => {
                setSelectedPubId(e.target.value);
                setEditingCard(false);
              }}
              className="w-full h-9 px-3 text-sm font-semibold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-slate-900 dark:text-slate-100"
            >
              {filteredPublishers.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.publisherCode ? `#${p.publisherCode} — ` : ''}
                  {p.name} ({p.group})
                </option>
              ))}
            </select>
          </div>
          <div className="md:col-span-2">
            <select
              aria-label="Selecionar Ano de Serviço"
              value={serviceYear}
              onChange={(e) => setServiceYear(Number(e.target.value))}
              className="w-full h-9 px-3 text-sm font-semibold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-slate-900 dark:text-slate-100"
            >
              {serviceYearOptions.map((y) => (
                <option key={y} value={y}>
                  Ano {y}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      {/* Cartão S-21 */}
      {!selectedPublisher ? (
        <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-10 text-center text-sm text-slate-500">
          Nenhum publicador encontrado com o filtro atual.
        </section>
      ) : (
        <section className="bg-white dark:bg-slate-900 border-2 border-slate-800 dark:border-slate-700 rounded-lg p-6 space-y-5 shadow-sm">
          {/* Título Oficial S-21 */}
          <div className="flex items-center justify-between border-b-2 border-slate-800 dark:border-slate-700 pb-3">
            <div className="text-xs font-mono text-slate-500 dark:text-slate-400">
              {selectedPublisher.group}
            </div>
            <h3 className="text-base sm:text-lg font-extrabold tracking-wide text-center text-slate-900 dark:text-slate-100 uppercase">
              REGISTRO DE PUBLICADOR DE CONGREGAÇÃO
            </h3>
            <div className="flex items-center gap-2">
              {selectedPublisher.publisherCode && (
                <span className="text-sm font-bold font-mono text-slate-800 dark:text-slate-200">
                  #{selectedPublisher.publisherCode}
                </span>
              )}
              <button
                type="button"
                onClick={editingCard ? () => setEditingCard(false) : openEditCard}
                className="no-print h-7 px-2.5 text-xs font-medium text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 rounded inline-flex items-center gap-1 cursor-pointer"
              >
                {editingCard ? <X className="w-3.5 h-3.5" /> : <Pencil className="w-3.5 h-3.5" />}
                {editingCard ? 'Cancelar' : 'Editar Dados do Cartão'}
              </button>
            </div>
          </div>

          {editingCard ? (
            <form
              onSubmit={handleSaveCardMetadata}
              className="no-print p-4 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-md grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3"
            >
              <div>
                <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                  ID / Nº do Cartão
                </label>
                <input
                  type="text"
                  value={editCode}
                  onChange={(e) => setEditCode(e.target.value)}
                  placeholder="Ex.: 2"
                  className="w-full h-8 px-2.5 text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Data de nascimento
                </label>
                <input
                  type="text"
                  value={editBirth}
                  onChange={(e) => setEditBirth(e.target.value)}
                  placeholder="DD/MM/AAAA"
                  className="w-full h-8 px-2.5 text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Data de batismo
                </label>
                <input
                  type="text"
                  value={editBaptism}
                  onChange={(e) => setEditBaptism(e.target.value)}
                  placeholder="DD/MM/AAAA"
                  className="w-full h-8 px-2.5 text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Grupo
                </label>
                <select
                  value={editGroupId}
                  onChange={(e) => setEditGroupId(e.target.value)}
                  className="w-full h-8 px-2.5 text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded"
                >
                  <option value="">Sem alteração ({selectedPublisher.group})</option>
                  {orderedGroups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Sexo
                </label>
                <select
                  value={editGender}
                  onChange={(e) => setEditGender(e.target.value as PublisherGender | '')}
                  className="w-full h-8 px-2.5 text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded"
                >
                  <option value="">Não informado</option>
                  <option value="Masculino">Masculino</option>
                  <option value="Feminino">Feminino</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Esperança
                </label>
                <select
                  value={editHope}
                  onChange={(e) => setEditHope(e.target.value as PublisherHope | '')}
                  className="w-full h-8 px-2.5 text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded"
                >
                  <option value="">Não informado</option>
                  <option value="Outras Ovelhas">Outras Ovelhas</option>
                  <option value="Ungido">Ungido</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Privilégio Principal
                </label>
                <select
                  value={editPrivilege}
                  onChange={(e) => setEditPrivilege(e.target.value as PrivilegeType)}
                  className="w-full h-8 px-2.5 text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded"
                >
                  <option value="Publicador">Publicador</option>
                  <option value="Pioneiro Auxiliar">Pioneiro Auxiliar</option>
                  <option value="Pioneiro Regular">Pioneiro Regular</option>
                  <option value="Servo Ministerial">Servo Ministerial</option>
                  <option value="Ancião">Ancião</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Designação Especial
                </label>
                <select
                  value={editSpecialRole}
                  onChange={(e) => setEditSpecialRole(e.target.value as SpecialRoleType)}
                  className="w-full h-8 px-2.5 text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded"
                >
                  <option value="Nenhum">Nenhuma</option>
                  <option value="Pioneiro especial">Pioneiro especial</option>
                  <option value="Missionário em campo">Missionário em campo</option>
                </select>
              </div>

              <div className="sm:col-span-2 lg:col-span-4 flex flex-wrap items-center justify-between gap-3 pt-2">
                <label className="inline-flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editIsRegPioneer || editPrivilege === 'Pioneiro Regular'}
                    onChange={(e) => setEditIsRegPioneer(e.target.checked)}
                  />
                  <span>Também serve como Pioneiro Regular</span>
                </label>
                <button
                  type="submit"
                  className="h-8 px-4 text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded inline-flex items-center gap-1 cursor-pointer"
                >
                  <Check className="w-3.5 h-3.5" />
                  Salvar Cartão
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-12 gap-3 text-sm">
                <div className="md:col-span-7 space-y-1.5">
                  <div>
                    <span className="font-bold text-slate-700 dark:text-slate-300">Nome: </span>
                    <span className="font-bold italic text-slate-900 dark:text-slate-100">
                      {selectedPublisher.name}
                    </span>
                  </div>
                  <div>
                    <span className="font-bold text-slate-700 dark:text-slate-300">Data de nascimento: </span>
                    <span className="font-mono text-slate-900 dark:text-slate-100">
                      {selectedPublisher.birthDate || '—'}
                    </span>
                  </div>
                  <div>
                    <span className="font-bold text-slate-700 dark:text-slate-300">Data de batismo: </span>
                    <span className="font-mono text-slate-900 dark:text-slate-100">
                      {selectedPublisher.baptismDate || '—'}
                    </span>
                  </div>
                </div>

                <div className="md:col-span-5 space-y-2 flex flex-col justify-center">
                  <div className="flex flex-wrap items-center gap-4">
                    <CheckBoxBadge
                      checked={selectedPublisher.gender === 'Masculino'}
                      label="Masculino"
                    />
                    <CheckBoxBadge
                      checked={selectedPublisher.gender === 'Feminino'}
                      label="Feminino"
                    />
                  </div>
                  <div className="flex flex-wrap items-center gap-4">
                    <CheckBoxBadge
                      checked={selectedPublisher.hope === 'Outras Ovelhas'}
                      label="Outras Ovelhas"
                    />
                    <CheckBoxBadge
                      checked={selectedPublisher.hope === 'Ungido'}
                      label="Ungido"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center gap-5">
                <CheckBoxBadge
                  checked={selectedPublisher.privilege === 'Ancião'}
                  label="Ancião"
                />
                <CheckBoxBadge
                  checked={selectedPublisher.privilege === 'Servo Ministerial'}
                  label="Servo ministerial"
                />
                <CheckBoxBadge
                  checked={
                    selectedPublisher.privilege === 'Pioneiro Regular' ||
                    Boolean(selectedPublisher.isRegularPioneer)
                  }
                  label="Pioneiro regular"
                />
                <CheckBoxBadge
                  checked={selectedPublisher.specialRole === 'Pioneiro especial'}
                  label="Pioneiro especial"
                />
                <CheckBoxBadge
                  checked={selectedPublisher.specialRole === 'Missionário em campo'}
                  label="Missionário em campo"
                />
              </div>
            </div>
          )}

          {/* Tabela 12 Meses do Ano de Serviço */}
          <div className="overflow-x-auto">
            <table className="w-full border-collapse border border-slate-800 dark:border-slate-700 text-xs">
              <thead>
                <tr className="bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-center font-bold">
                  <th className="border border-slate-800 dark:border-slate-700 py-2.5 px-3 text-left">
                    Ano de serviço <span className="italic">{serviceYear}</span>
                  </th>
                  <th className="border border-slate-800 dark:border-slate-700 py-2.5 px-3">
                    Participou no ministério
                  </th>
                  <th className="border border-slate-800 dark:border-slate-700 py-2.5 px-3">
                    Estudos bíblicos
                  </th>
                  <th className="border border-slate-800 dark:border-slate-700 py-2.5 px-3">
                    Pioneiro auxiliar
                  </th>
                  <th className="border border-slate-800 dark:border-slate-700 py-2.5 px-3">
                    Horas
                    <div className="text-[10px] font-normal text-slate-600 dark:text-slate-400">
                      (Se for pioneiro ou missionário em campo)
                    </div>
                  </th>
                  <th className="border border-slate-800 dark:border-slate-700 py-2.5 px-3 text-left">
                    Observações
                  </th>
                  <th className="no-print border border-slate-800 dark:border-slate-700 py-2.5 px-2">
                    Ação
                  </th>
                </tr>
              </thead>
              <tbody>
                {cardRows.map(({ monthKey, name, year, report }) => (
                  <tr
                    key={monthKey}
                    className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    <td className="border border-slate-300 dark:border-slate-700 py-2 px-3 font-medium text-slate-900 dark:text-slate-100 whitespace-nowrap">
                      {name}{' '}
                      <span className="text-[10px] text-slate-400 font-mono">{year}</span>
                    </td>
                    <td className="border border-slate-300 dark:border-slate-700 py-2 px-3 text-center">
                      {report ? (
                        report.participated ? (
                          <span className="inline-block px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 font-bold">
                            ✓ Sim
                          </span>
                        ) : (
                          <span className="text-slate-400">Não</span>
                        )
                      ) : (
                        <span className="text-slate-300 dark:text-slate-700">—</span>
                      )}
                    </td>
                    <td className="border border-slate-300 dark:border-slate-700 py-2 px-3 text-center font-mono">
                      {report?.bibleStudies ?? ''}
                    </td>
                    <td className="border border-slate-300 dark:border-slate-700 py-2 px-3 text-center">
                      {report && report.auxiliaryPioneer !== 'Não' ? (
                        <span className="inline-block px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 font-semibold">
                          ✓ {report.auxiliaryPioneer}
                        </span>
                      ) : (
                        ''
                      )}
                    </td>
                    <td className="border border-slate-300 dark:border-slate-700 py-2 px-3 text-center font-mono font-semibold">
                      {report?.hours ?? ''}
                    </td>
                    <td className="border border-slate-300 dark:border-slate-700 py-2 px-3 text-slate-700 dark:text-slate-300">
                      {report?.notes ?? ''}
                    </td>
                    <td className="no-print border border-slate-300 dark:border-slate-700 py-1.5 px-2 text-center">
                      <button
                        type="button"
                        onClick={() => onEditMonthReport(selectedPublisher, monthKey, report)}
                        className="px-2 py-1 text-[11px] font-medium text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-950/50 rounded cursor-pointer"
                      >
                        {report ? 'Editar' : 'Lançar'}
                      </button>
                    </td>
                  </tr>
                ))}

                <tr className="bg-slate-100 dark:bg-slate-800 font-bold text-slate-900 dark:text-slate-100">
                  <td className="border border-slate-800 dark:border-slate-700 py-2.5 px-3">
                    Total
                  </td>
                  <td className="border border-slate-800 dark:border-slate-700 py-2.5 px-3 text-center font-mono">
                    {cardTotals.participatedMonths} meses
                  </td>
                  <td className="border border-slate-800 dark:border-slate-700 py-2.5 px-3 text-center font-mono">
                    {cardTotals.totalStudies}
                  </td>
                  <td className="border border-slate-800 dark:border-slate-700 py-2.5 px-3 text-center font-mono">
                    {cardTotals.auxMonths > 0 ? `${cardTotals.auxMonths} meses` : '—'}
                  </td>
                  <td className="border border-slate-800 dark:border-slate-700 py-2.5 px-3 text-center font-mono">
                    {cardTotals.totalHours}
                  </td>
                  <td className="border border-slate-800 dark:border-slate-700 py-2.5 px-3" />
                  <td className="no-print border border-slate-800 dark:border-slate-700" />
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
