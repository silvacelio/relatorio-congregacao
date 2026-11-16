import { CheckCheck, Copy, Download, FileText, MessageSquare, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { ActivityReport, Publisher } from '../types';
import { exportPendingCsv, exportReportToWord } from '../utils/exportData';
import { formatMonthLabel, normalizeText } from '../utils/formatters';

interface QuemFaltaTabProps {
  monthKey: string;
  publishers: Publisher[];
  reports: ActivityReport[];
  onQuickRegister: (publisher: Publisher) => void;
  onNotify: (text: string, tone?: 'success' | 'error' | 'info') => void;
}

export function QuemFaltaTab({
  monthKey,
  publishers,
  reports,
  onQuickRegister,
  onNotify,
}: QuemFaltaTabProps) {
  const [search, setSearch] = useState('');
  const [groupFilter, setGroupFilter] = useState('all');

  const submittedNormNames = useMemo(() => {
    const set = new Set<string>();
    reports
      .filter((r) => r.monthKey === monthKey)
      .forEach((r) => set.add(normalizeText(r.publisherName)));
    return set;
  }, [reports, monthKey]);

  const allMissing = useMemo(() => {
    return publishers
      .filter((p) => p.active)
      .filter((p) => !submittedNormNames.has(normalizeText(p.name)))
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  }, [publishers, submittedNormNames]);

  const groups = useMemo(() => {
    const set = new Set<string>();
    allMissing.forEach((p) => {
      if (p.group) set.add(p.group);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [allMissing]);

  const filteredMissing = useMemo(() => {
    const normQuery = normalizeText(search);
    return allMissing.filter((p) => {
      if (groupFilter !== 'all' && p.group !== groupFilter) return false;
      if (normQuery && !normalizeText(p.name).includes(normQuery)) return false;
      return true;
    });
  }, [allMissing, groupFilter, search]);

  const copyPlainList = async () => {
    if (filteredMissing.length === 0) return;
    const text = filteredMissing.map((p, i) => `${i + 1}. ${p.name}`).join('\n');
    await navigator.clipboard.writeText(text);
    onNotify(`${filteredMissing.length} nomes copiados para a área de transferência.`, 'success');
  };

  const copyWhatsAppMessage = async () => {
    if (filteredMissing.length === 0) return;
    const monthLabel = formatMonthLabel(monthKey);
    const listText = filteredMissing
      .map((p) => `• ${p.name}${p.group ? ` (${p.group})` : ''}`)
      .join('\n');
    const message = `*Relatório de Atividades — ${monthLabel}*\nAinda faltam enviar o relatório (${filteredMissing.length}):\n\n${listText}\n\nPor favor, lembre-se de enviar assim que possível.`;
    await navigator.clipboard.writeText(message);
    onNotify('Mensagem formatada para WhatsApp copiada.', 'success');
  };

  return (
    <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
      <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
            Quem Falta Entregar — {formatMonthLabel(monthKey)}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {allMissing.length === 0
              ? 'Todos os publicadores ativos já enviaram o relatório deste mês.'
              : `${allMissing.length} publicadores ativos ainda não constam nas respostas do mês.`}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-full sm:w-56">
            <Search className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar pendente..."
              className="w-full h-9 pl-9 pr-3 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>

          {groups.length > 0 && (
            <select
              value={groupFilter}
              onChange={(e) => setGroupFilter(e.target.value)}
              aria-label="Filtrar pendentes por grupo"
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

          <button
            type="button"
            disabled={filteredMissing.length === 0}
            onClick={copyPlainList}
            className="h-9 px-3 text-xs font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-40 transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Copy className="w-3.5 h-3.5" />
            Copiar Nomes
          </button>

          <button
            type="button"
            disabled={filteredMissing.length === 0}
            onClick={copyWhatsAppMessage}
            className="h-9 px-3 text-xs font-medium text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 rounded-md hover:bg-emerald-100 dark:hover:bg-emerald-900/60 disabled:opacity-40 transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <MessageSquare className="w-3.5 h-3.5" />
            Copiar p/ WhatsApp
          </button>

          <button
            type="button"
            disabled={allMissing.length === 0}
            onClick={() => exportReportToWord(monthKey, publishers, reports, 'quem_falta')}
            className="h-9 px-3 text-xs font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-40 transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <FileText className="w-3.5 h-3.5" />
            Word (.doc)
          </button>

          <button
            type="button"
            disabled={filteredMissing.length === 0}
            onClick={() => exportPendingCsv(monthKey, filteredMissing)}
            className="h-9 px-3 text-xs font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-40 transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            CSV
          </button>
        </div>
      </div>

      {allMissing.length === 0 ? (
        <div className="p-12 text-center">
          <CheckCheck className="w-10 h-10 text-emerald-600 dark:text-emerald-400 mx-auto" />
          <h3 className="mt-3 text-base font-semibold text-slate-900 dark:text-slate-100">
            100% dos relatórios recebidos
          </h3>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Não há nenhum publicador pendente em {formatMonthLabel(monthKey)}.
          </p>
        </div>
      ) : filteredMissing.length === 0 ? (
        <div className="p-10 text-center text-sm text-slate-500 dark:text-slate-400">
          Nenhum pendente encontrado para o filtro aplicado.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="bg-blue-700 dark:bg-blue-900 text-white text-xs font-semibold">
                <th className="py-2.5 px-4 w-12 text-right font-mono">#</th>
                <th className="py-2.5 px-4">NOME</th>
                <th className="py-2.5 px-4">Grupo</th>
                <th className="py-2.5 px-4">Privilégio</th>
                <th className="py-2.5 px-4">Situação</th>
                <th className="py-2.5 px-4 text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-red-200/70 dark:divide-red-900/50 text-sm">
              {filteredMissing.map((pub, index) => (
                <tr key={pub.id} className="bg-red-50/70 dark:bg-red-950/35 hover:bg-red-100/70 dark:hover:bg-red-950/60 transition-colors">
                  <td className="py-2.5 px-4 text-right text-xs text-red-700 dark:text-red-400 font-mono tabular-nums">
                    {index + 1}
                  </td>
                  <td className="py-2.5 px-4 font-semibold text-red-900 dark:text-red-200">
                    {pub.name}
                  </td>
                  <td className="py-2.5 px-4 text-xs text-red-800 dark:text-red-300">{pub.group}</td>
                  <td className="py-2.5 px-4 text-xs text-red-800 dark:text-red-300">{pub.privilege}</td>
                  <td className="py-2.5 px-4">
                    <span className="inline-block px-2 py-0.5 text-xs font-semibold bg-red-600 dark:bg-red-700 text-white rounded">
                      FALTA
                    </span>
                  </td>
                  <td className="py-2.5 px-4 text-right">
                    <button
                      type="button"
                      onClick={() => onQuickRegister(pub)}
                      className="px-3 py-1 text-xs font-medium text-white bg-blue-700 dark:bg-blue-600 rounded hover:bg-blue-800 dark:hover:bg-blue-500 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      Registrar Agora
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
