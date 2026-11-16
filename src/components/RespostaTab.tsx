import { Search, UserCheck } from 'lucide-react';
import { useMemo, useState } from 'react';
import { ActivityReport, Publisher } from '../types';
import { formatMonthLabel, formatPercentPtBr, normalizeText } from '../utils/formatters';

interface RespostaTabProps {
  monthKey: string;
  publishers: Publisher[];
  reports: ActivityReport[];
  onQuickRegister: (publisher: Publisher, existingReport?: ActivityReport) => void;
  onOpenImport: () => void;
}

export function RespostaTab({
  monthKey,
  publishers,
  reports,
  onQuickRegister,
  onOpenImport,
}: RespostaTabProps) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'sim' | 'nao'>('all');
  const [groupFilter, setGroupFilter] = useState<string>('all');

  const activePublishers = useMemo(
    () => publishers.filter((p) => p.active).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')),
    [publishers],
  );

  const monthReports = useMemo(
    () => reports.filter((r) => r.monthKey === monthKey),
    [reports, monthKey],
  );

  const reportByNormName = useMemo(() => {
    const map = new Map<string, ActivityReport>();
    monthReports.forEach((r) => {
      map.set(normalizeText(r.publisherName), r);
    });
    return map;
  }, [monthReports]);

  const groups = useMemo(() => {
    const set = new Set<string>();
    activePublishers.forEach((p) => {
      if (p.group) set.add(p.group);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [activePublishers]);

  const metrics = useMemo(() => {
    let received = 0;
    activePublishers.forEach((p) => {
      if (reportByNormName.has(normalizeText(p.name))) {
        received += 1;
      }
    });
    const total = activePublishers.length;
    const pending = total - received;
    const ratio = total > 0 ? received / total : 0;

    let participatedYes = 0;
    let totalHours = 0;
    let totalStudies = 0;
    let auxPioneers = 0;

    monthReports.forEach((r) => {
      if (r.participated) participatedYes += 1;
      if (typeof r.hours === 'number') totalHours += r.hours;
      if (typeof r.bibleStudies === 'number') totalStudies += r.bibleStudies;
      if (r.auxiliaryPioneer && r.auxiliaryPioneer !== 'Não') auxPioneers += 1;
    });

    return {
      received,
      pending,
      total,
      ratio,
      percentFormatted: formatPercentPtBr(ratio),
      participatedYes,
      totalHours,
      totalStudies,
      auxPioneers,
    };
  }, [activePublishers, monthReports, reportByNormName]);

  const rows = useMemo(() => {
    const normQuery = normalizeText(search);
    return activePublishers
      .map((pub) => {
        const report = reportByNormName.get(normalizeText(pub.name));
        return { pub, report, submitted: Boolean(report) };
      })
      .filter(({ pub, submitted }) => {
        if (statusFilter === 'sim' && !submitted) return false;
        if (statusFilter === 'nao' && submitted) return false;
        if (groupFilter !== 'all' && pub.group !== groupFilter) return false;
        if (normQuery && !normalizeText(pub.name).includes(normQuery)) return false;
        return true;
      });
  }, [activePublishers, reportByNormName, search, statusFilter, groupFilter]);

  return (
    <div className="space-y-6">
      {/* 4-Column KPI Strip: Recebidas / Pendentes / Total / Percentual */}
      <section aria-label="Indicadores do mês" className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-5">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">Recebidas</div>
          <div className="mt-2 flex items-baseline justify-between gap-2">
            <span className="text-3xl font-semibold tracking-tight text-emerald-700 dark:text-emerald-400 font-mono tabular-nums">
              {metrics.received}
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
              {metrics.participatedYes} participaram
            </span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-5">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">Pendentes</div>
          <div className="mt-2 flex items-baseline justify-between gap-2">
            <span className="text-3xl font-semibold tracking-tight text-red-700 dark:text-red-400 font-mono tabular-nums">
              {metrics.pending}
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
              aguardando envio
            </span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-5">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">Total Cadastrados</div>
          <div className="mt-2 flex items-baseline justify-between gap-2">
            <span className="text-3xl font-semibold tracking-tight text-slate-900 dark:text-slate-100 font-mono tabular-nums">
              {metrics.total}
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
              publicadores ativos
            </span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-5">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">Percentual Entregue</div>
          <div className="mt-2 flex items-baseline justify-between gap-2">
            <span className="text-3xl font-semibold tracking-tight text-blue-800 dark:text-blue-400 font-mono tabular-nums">
              {metrics.percentFormatted}
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
              {formatMonthLabel(monthKey)}
            </span>
          </div>
          <div className="mt-3 h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-sm overflow-hidden">
            <div
              className="h-full bg-blue-700 dark:bg-blue-500 transition-all duration-200"
              style={{ width: `${Math.min(100, Math.round(metrics.ratio * 100))}%` }}
            />
          </div>
        </div>
      </section>

      {/* Quiet Ministerial Summary Line */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-5 py-3 flex flex-wrap items-center justify-between gap-4 text-sm text-slate-600 dark:text-slate-400">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <span>
            Horas registradas:{' '}
            <strong className="font-mono tabular-nums text-slate-900 dark:text-slate-100">{metrics.totalHours}</strong>
          </span>
          <span aria-hidden="true" className="text-slate-300 dark:text-slate-700">
            ·
          </span>
          <span>
            Estudos bíblicos:{' '}
            <strong className="font-mono tabular-nums text-slate-900 dark:text-slate-100">{metrics.totalStudies}</strong>
          </span>
          <span aria-hidden="true" className="text-slate-300 dark:text-slate-700">
            ·
          </span>
          <span>
            Pioneiros auxiliares:{' '}
            <strong className="font-mono tabular-nums text-slate-900 dark:text-slate-100">{metrics.auxPioneers}</strong>
          </span>
        </div>
        <div className="text-xs text-slate-500 dark:text-slate-400">
          {monthReports.length} {monthReports.length === 1 ? 'registro lançado' : 'registros lançados'} no mês
        </div>
      </div>

      {/* Main Status Grid */}
      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-md">
              <button
                type="button"
                onClick={() => setStatusFilter('all')}
                className={`px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  statusFilter === 'all'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                }`}
              >
                Todos ({metrics.total})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('sim')}
                className={`px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  statusFilter === 'sim'
                    ? 'bg-white dark:bg-slate-900 text-emerald-800 dark:text-emerald-400 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                }`}
              >
                Recebidas ({metrics.received})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('nao')}
                className={`px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  statusFilter === 'nao'
                    ? 'bg-white dark:bg-slate-900 text-red-800 dark:text-red-400 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                }`}
              >
                Pendentes ({metrics.pending})
              </button>
            </div>

            {groups.length > 0 && (
              <select
                value={groupFilter}
                onChange={(e) => setGroupFilter(e.target.value)}
                aria-label="Filtrar por grupo"
                className="h-9 px-3 text-xs font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600"
              >
                <option value="all">Todos os grupos</option>
                {groups.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="relative w-full lg:w-72">
            <Search className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar publicador..."
              className="w-full h-9 pl-9 pr-3 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>
        </div>

        {activePublishers.length === 0 ? (
          <div className="p-12 text-center">
            <UserCheck className="w-10 h-10 text-slate-300 dark:text-slate-700 mx-auto" />
            <h3 className="mt-3 text-base font-semibold text-slate-900 dark:text-slate-100">
              Nenhum publicador cadastrado
            </h3>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto">
              Importe sua lista de nomes de um arquivo Word (.docx), planilha Excel (.xlsx) ou cole os nomes diretamente na aba Cadastro.
            </p>
            <button
              type="button"
              onClick={onOpenImport}
              className="mt-4 px-4 py-2 text-sm font-medium text-white bg-blue-700 dark:bg-blue-600 rounded-md hover:bg-blue-800 dark:hover:bg-blue-500 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Importar Word / Planilha
            </button>
          </div>
        ) : rows.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-500 dark:text-slate-400">
            Nenhum publicador encontrado com os filtros aplicados.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/70 border-b border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-600 dark:text-slate-300">
                  <th className="py-2.5 px-4 w-12 text-right font-mono">#</th>
                  <th className="py-2.5 px-4">Nome</th>
                  <th className="py-2.5 px-4">Grupo</th>
                  <th className="py-2.5 px-4">Privilégio</th>
                  <th className="py-2.5 px-4 w-28">Status</th>
                  <th className="py-2.5 px-4">Participou</th>
                  <th className="py-2.5 px-4 text-right">Horas</th>
                  <th className="py-2.5 px-4 text-right">Estudos</th>
                  <th className="py-2.5 px-4">Pioneiro Aux.</th>
                  <th className="py-2.5 px-4 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 text-sm">
                {rows.map(({ pub, report, submitted }, index) => (
                  <tr
                    key={pub.id}
                    className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors"
                  >
                    <td className="py-2.5 px-4 text-right text-xs text-slate-400 dark:text-slate-500 font-mono tabular-nums">
                      {index + 1}
                    </td>
                    <td className="py-2.5 px-4 font-medium text-slate-900 dark:text-slate-100">
                      {pub.name}
                    </td>
                    <td className="py-2.5 px-4 text-slate-600 dark:text-slate-400 text-xs whitespace-nowrap">
                      {pub.group || '—'}
                    </td>
                    <td className="py-2.5 px-4 text-slate-600 dark:text-slate-400 text-xs whitespace-nowrap">
                      {pub.privilege}
                    </td>
                    <td className="py-2.5 px-4">
                      {submitted ? (
                        <span className="inline-block px-2 py-0.5 text-xs font-semibold bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 rounded border border-emerald-200 dark:border-emerald-800">
                          SIM
                        </span>
                      ) : (
                        <span className="inline-block px-2 py-0.5 text-xs font-semibold bg-red-100 dark:bg-red-950/70 text-red-800 dark:text-red-300 rounded border border-red-200 dark:border-red-800">
                          NÃO
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-4 text-xs text-slate-700 dark:text-slate-300">
                      {report ? (report.participated ? 'Sim' : 'Não') : '—'}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono tabular-nums text-slate-800 dark:text-slate-200">
                      {report && report.hours !== null ? report.hours : '—'}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono tabular-nums text-slate-800 dark:text-slate-200">
                      {report && report.bibleStudies !== null ? report.bibleStudies : '—'}
                    </td>
                    <td className="py-2.5 px-4 text-xs text-slate-700 dark:text-slate-300">
                      {report && report.auxiliaryPioneer !== 'Não' ? report.auxiliaryPioneer : '—'}
                    </td>
                    <td className="py-2.5 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => onQuickRegister(pub, report)}
                        className={`px-3 py-1 text-xs font-medium rounded border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                          submitted
                            ? 'text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'
                            : 'text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/60 border-blue-200 dark:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-900/60'
                        }`}
                      >
                        {submitted ? 'Editar' : 'Registrar'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
