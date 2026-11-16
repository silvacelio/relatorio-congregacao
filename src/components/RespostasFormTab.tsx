import { Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { ActivityReport } from '../types';
import { formatMonthLabel, formatTimestampPtBr, normalizeText } from '../utils/formatters';

interface RespostasFormTabProps {
  monthKey: string;
  reports: ActivityReport[];
  registeredNamesNorm: Set<string>;
  onAddReport: () => void;
  onEditReport: (report: ActivityReport) => void;
  onDeleteReport: (id: string) => void;
}

export function RespostasFormTab({
  monthKey,
  reports,
  registeredNamesNorm,
  onAddReport,
  onEditReport,
  onDeleteReport,
}: RespostasFormTabProps) {
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<'recent' | 'name' | 'hours'>('recent');

  const monthReports = useMemo(() => {
    const normQuery = normalizeText(search);
    const filtered = reports
      .filter((r) => r.monthKey === monthKey)
      .filter((r) => {
        if (!normQuery) return true;
        return (
          normalizeText(r.publisherName).includes(normQuery) ||
          normalizeText(r.notes).includes(normQuery)
        );
      });

    return [...filtered].sort((a, b) => {
      if (sortBy === 'name') {
        return a.publisherName.localeCompare(b.publisherName, 'pt-BR');
      }
      if (sortBy === 'hours') {
        return (b.hours ?? -1) - (a.hours ?? -1);
      }
      return b.timestamp.localeCompare(a.timestamp);
    });
  }, [reports, monthKey, search, sortBy]);

  return (
    <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
      <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
            Respostas ao Formulário — {formatMonthLabel(monthKey)}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Registros individuais recebidos no mês, ordenados por envio ou nome.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar resposta..."
              className="w-full h-9 pl-9 pr-3 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'recent' | 'name' | 'hours')}
            aria-label="Ordenar respostas"
            className="h-9 px-3 text-xs font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600"
          >
            <option value="recent">Mais recentes</option>
            <option value="name">Ordem alfabética</option>
            <option value="hours">Maior carga horária</option>
          </select>

          <button
            type="button"
            onClick={onAddReport}
            className="h-9 px-4 text-xs font-medium text-white bg-blue-700 dark:bg-blue-600 rounded-md hover:bg-blue-800 dark:hover:bg-blue-500 transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Nova Resposta
          </button>
        </div>
      </div>

      {monthReports.length === 0 ? (
        <div className="p-12 text-center">
          <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
            Nenhuma resposta registrada em {formatMonthLabel(monthKey)}
          </h3>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto">
            Lance a primeira atividade ministerial pelo formulário ou importe respostas de uma planilha/Word.
          </p>
          <button
            type="button"
            onClick={onAddReport}
            className="mt-4 px-4 py-2 text-sm font-medium text-white bg-blue-700 dark:bg-blue-600 rounded-md hover:bg-blue-800 dark:hover:bg-blue-500 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Lançar Primeira Resposta
          </button>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="bg-violet-950 dark:bg-violet-950/90 text-white text-xs font-medium">
                <th className="py-2.5 px-4 whitespace-nowrap">Carimbo de data/hora</th>
                <th className="py-2.5 px-4 whitespace-nowrap">NOME</th>
                <th className="py-2.5 px-4 whitespace-nowrap">Participou esse mês</th>
                <th className="py-2.5 px-4 text-right whitespace-nowrap">Horas (pioneiro)</th>
                <th className="py-2.5 px-4 text-right whitespace-nowrap">Estudos Bíblicos</th>
                <th className="py-2.5 px-4 whitespace-nowrap">Pioneiro Auxiliar</th>
                <th className="py-2.5 px-4 whitespace-nowrap">Observações</th>
                <th className="py-2.5 px-4 text-right whitespace-nowrap">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 text-sm">
              {monthReports.map((report) => {
                const isRegistered = registeredNamesNorm.has(normalizeText(report.publisherName));
                return (
                  <tr key={report.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="py-2.5 px-4 font-mono tabular-nums text-xs text-slate-600 dark:text-slate-400 whitespace-nowrap">
                      {formatTimestampPtBr(report.timestamp)}
                    </td>
                    <td className="py-2.5 px-4 font-medium text-slate-900 dark:text-slate-100">
                      <div className="flex items-center gap-2">
                        <span>{report.publisherName}</span>
                        {!isRegistered && (
                          <span className="text-[11px] font-medium text-amber-700 dark:text-amber-400">
                            (Fora do cadastro)
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-2.5 px-4">
                      {report.participated ? (
                        <span className="inline-block px-2 py-0.5 text-xs font-semibold bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 rounded border border-emerald-200 dark:border-emerald-800">
                          Sim
                        </span>
                      ) : (
                        <span className="inline-block px-2 py-0.5 text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded border border-slate-200 dark:border-slate-700">
                          Não
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono tabular-nums text-slate-900 dark:text-slate-100">
                      {report.hours !== null ? report.hours : ''}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono tabular-nums text-slate-900 dark:text-slate-100">
                      {report.bibleStudies !== null ? report.bibleStudies : ''}
                    </td>
                    <td className="py-2.5 px-4 text-xs text-slate-700 dark:text-slate-300">
                      {report.auxiliaryPioneer === 'Não' ? '' : report.auxiliaryPioneer}
                    </td>
                    <td className="py-2.5 px-4 text-xs text-slate-600 dark:text-slate-400 max-w-xs truncate" title={report.notes}>
                      {report.notes}
                    </td>
                    <td className="py-2.5 px-4 text-right">
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => onEditReport(report)}
                          aria-label={`Editar resposta de ${report.publisherName}`}
                          className="p-1.5 text-slate-500 dark:text-slate-400 hover:text-blue-700 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/60 rounded transition-colors cursor-pointer"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteReport(report.id)}
                          aria-label={`Excluir resposta de ${report.publisherName}`}
                          className="p-1.5 text-slate-500 dark:text-slate-400 hover:text-red-700 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/60 rounded transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
