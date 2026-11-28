import {
  Check,
  CheckCheck,
  Copy,
  Download,
  FileText,
  Link2,
  MessageSquare,
  Save,
  Search,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { ActivityReport, PrivilegeType, Publisher } from '../types';
import { exportPendingCsv, exportReportToWord } from '../utils/exportData';
import { formatMonthLabel, normalizeText } from '../utils/formatters';
import {
  buildPublisherSelfReportUrl,
  buildReminderWhatsAppUrl,
  buildSelfReportWhatsAppUrl,
  isValidWhatsAppPhone,
  normalizePhoneDigits,
} from '../utils/whatsapp';

interface QuemFaltaTabProps {
  monthKey: string;
  publishers: Publisher[];
  reports: ActivityReport[];
  onQuickRegister: (publisher: Publisher) => void;
  onSavePhone: (publisher: Publisher, phone: string) => Promise<boolean>;
  onNotify: (text: string, tone?: 'success' | 'error' | 'info') => void;
}

function getPrivilegeBadgeClasses(privilege: PrivilegeType): string {
  switch (privilege) {
    case 'Pioneiro Regular':
      return 'bg-amber-100 dark:bg-amber-950/70 text-amber-900 dark:text-amber-300 border-amber-200 dark:border-amber-800';
    case 'Pioneiro Auxiliar':
      return 'bg-sky-100 dark:bg-sky-950/70 text-sky-900 dark:text-sky-300 border-sky-200 dark:border-sky-800';
    case 'Ancião':
      return 'bg-violet-100 dark:bg-violet-950/70 text-violet-900 dark:text-violet-300 border-violet-200 dark:border-violet-800';
    case 'Servo Ministerial':
      return 'bg-indigo-100 dark:bg-indigo-950/70 text-indigo-900 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800';
    default:
      return 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border-slate-200 dark:border-slate-700';
  }
}

export function QuemFaltaTab({
  monthKey,
  publishers,
  reports,
  onQuickRegister,
  onSavePhone,
  onNotify,
}: QuemFaltaTabProps) {
  const [search, setSearch] = useState('');
  const [groupFilter, setGroupFilter] = useState('all');
  const [draftPhones, setDraftPhones] = useState<Record<string, string>>({});
  const [savingIds, setSavingIds] = useState<Record<string, boolean>>({});
  const [savedIds, setSavedIds] = useState<Record<string, boolean>>({});

  const activePublishers = useMemo(
    () => publishers.filter((p) => p.active),
    [publishers],
  );

  const submittedNormNames = useMemo(() => {
    const set = new Set<string>();
    reports
      .filter((r) => r.monthKey === monthKey)
      .forEach((r) => set.add(normalizeText(r.publisherName)));
    return set;
  }, [reports, monthKey]);

  const summary = useMemo(() => {
    const totalActive = activePublishers.length;
    const received = activePublishers.filter((p) =>
      submittedNormNames.has(normalizeText(p.name)),
    ).length;
    const pending = totalActive - received;
    const phonesCount = activePublishers.filter((p) => isValidWhatsAppPhone(p.phone)).length;

    const regularPioneers = activePublishers.filter((p) => p.privilege === 'Pioneiro Regular').length;
    const auxPioneers = activePublishers.filter((p) => p.privilege === 'Pioneiro Auxiliar').length;
    const publishersOnly = activePublishers.filter((p) => p.privilege === 'Publicador').length;
    const eldersAndServants = activePublishers.filter(
      (p) => p.privilege === 'Ancião' || p.privilege === 'Servo Ministerial',
    ).length;

    return {
      totalActive,
      received,
      pending,
      phonesCount,
      regularPioneers,
      auxPioneers,
      publishersOnly,
      eldersAndServants,
    };
  }, [activePublishers, submittedNormNames]);

  const allMissing = useMemo(() => {
    return activePublishers
      .filter((p) => !submittedNormNames.has(normalizeText(p.name)))
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  }, [activePublishers, submittedNormNames]);

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

  const getPhoneValue = (pub: Publisher): string => {
    if (Object.prototype.hasOwnProperty.call(draftPhones, pub.id)) {
      return draftPhones[pub.id];
    }
    return pub.phone ?? '';
  };

  const handlePhoneChange = (pubId: string, value: string) => {
    setDraftPhones((prev) => ({ ...prev, [pubId]: value }));
    setSavedIds((prev) => {
      if (!prev[pubId]) return prev;
      const next = { ...prev };
      delete next[pubId];
      return next;
    });
  };

  const handleSaveNumber = async (pub: Publisher) => {
    const rawValue = getPhoneValue(pub).trim();
    if (rawValue && !isValidWhatsAppPhone(rawValue)) {
      onNotify(
        `Número inválido para ${pub.name}. Informe DDD + número (ex.: 11 99999-9999).`,
        'error',
      );
      return;
    }

    setSavingIds((prev) => ({ ...prev, [pub.id]: true }));
    const ok = await onSavePhone(pub, rawValue);
    setSavingIds((prev) => ({ ...prev, [pub.id]: false }));

    if (ok) {
      setDraftPhones((prev) => {
        const next = { ...prev };
        delete next[pub.id];
        return next;
      });
      setSavedIds((prev) => ({ ...prev, [pub.id]: true }));
      setTimeout(() => {
        setSavedIds((prev) => {
          const next = { ...prev };
          delete next[pub.id];
          return next;
        });
      }, 2500);
    }
  };

  const handleCopyPublisherLink = async (pub: Publisher) => {
    const url = buildPublisherSelfReportUrl(pub.id, monthKey);
    try {
      await navigator.clipboard.writeText(url);
      onNotify(`Link pessoal de ${pub.name} copiado para colar no WhatsApp.`, 'success');
    } catch {
      onNotify('Não foi possível copiar o link.', 'error');
    }
  };

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
    <div className="space-y-6">
      {/* Painel de Resumo do Mês */}
      <section
        aria-label="Resumo do Mês"
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden"
      >
        <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            📊 Resumo do Mês — {formatMonthLabel(monthKey)}
          </h2>
          <div className="text-xs text-slate-500 dark:text-slate-400">
            Total ativos:{' '}
            <strong className="font-mono tabular-nums text-slate-900 dark:text-slate-100">
              {summary.totalActive}
            </strong>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 divide-y sm:divide-y-0 sm:divide-x divide-slate-200 dark:divide-slate-800">
          <div className="p-4">
            <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
              ✅ Relatórios Recebidos
            </div>
            <div className="mt-1.5 text-2xl font-semibold text-emerald-700 dark:text-emerald-400 font-mono tabular-nums">
              {summary.received}
            </div>
          </div>

          <div className="p-4">
            <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
              ❌ Relatórios Pendentes
            </div>
            <div className="mt-1.5 text-2xl font-semibold text-red-700 dark:text-red-400 font-mono tabular-nums">
              {summary.pending}
            </div>
          </div>

          <div className="p-4">
            <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
              👥 Publicadores
            </div>
            <div className="mt-1.5 flex items-baseline gap-2">
              <span className="text-2xl font-semibold text-slate-900 dark:text-slate-100 font-mono tabular-nums">
                {summary.publishersOnly}
              </span>
              {summary.eldersAndServants > 0 && (
                <span className="text-[11px] text-slate-500 dark:text-slate-400 whitespace-nowrap">
                  +{summary.eldersAndServants} anc./servos
                </span>
              )}
            </div>
          </div>

          <div className="p-4">
            <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
              ✨ Pioneiros Auxiliares
            </div>
            <div className="mt-1.5 text-2xl font-semibold text-sky-700 dark:text-sky-400 font-mono tabular-nums">
              {summary.auxPioneers}
            </div>
          </div>

          <div className="p-4">
            <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
              ⭐ Pioneiros Regulares
            </div>
            <div className="mt-1.5 text-2xl font-semibold text-amber-700 dark:text-amber-400 font-mono tabular-nums">
              {summary.regularPioneers}
            </div>
          </div>

          <div className="p-4">
            <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
              📱 Telefones Cadastrados
            </div>
            <div className="mt-1.5 text-2xl font-semibold text-blue-700 dark:text-blue-400 font-mono tabular-nums">
              {summary.phonesCount}
            </div>
          </div>
        </div>
      </section>

      {/* Lista de Pendentes com Cadastro de WhatsApp, Lembrete e Envio do Link */}
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
                  <th className="py-2.5 px-3 w-10 text-right font-mono">#</th>
                  <th className="py-2.5 px-3">NOME</th>
                  <th className="py-2.5 px-3 whitespace-nowrap">Privilégio</th>
                  <th className="py-2.5 px-3 whitespace-nowrap">WhatsApp</th>
                  <th className="py-2.5 px-3 whitespace-nowrap">Status</th>
                  <th className="py-2.5 px-3 text-right whitespace-nowrap">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-red-200/70 dark:divide-red-900/50 text-sm">
                {filteredMissing.map((pub, index) => {
                  const phoneDraft = getPhoneValue(pub);
                  const savedPhone = pub.phone ?? '';
                  const isDirty = phoneDraft.trim() !== savedPhone.trim();
                  const isSaving = Boolean(savingIds[pub.id]);
                  const isJustSaved = Boolean(savedIds[pub.id]);
                  const waUrl = buildReminderWhatsAppUrl(phoneDraft);
                  const selfReportUrl = buildPublisherSelfReportUrl(pub.id, monthKey);
                  const selfWaUrl = buildSelfReportWhatsAppUrl(phoneDraft, pub.name, selfReportUrl);
                  const normalizedPreview = normalizePhoneDigits(phoneDraft);

                  return (
                    <tr
                      key={pub.id}
                      className="bg-red-50/70 dark:bg-red-950/35 hover:bg-red-100/70 dark:hover:bg-red-950/60 transition-colors"
                    >
                      <td className="py-2.5 px-3 text-right text-xs text-red-700 dark:text-red-400 font-mono tabular-nums">
                        {index + 1}
                      </td>
                      <td className="py-2.5 px-3 font-semibold text-red-950 dark:text-red-100">
                        <div>{pub.name}</div>
                        {pub.group && (
                          <div className="text-[11px] font-normal text-red-800/80 dark:text-red-300/80">
                            {pub.group}
                          </div>
                        )}
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <span
                          className={`inline-block px-2 py-0.5 text-xs font-medium rounded border ${getPrivilegeBadgeClasses(pub.privilege)}`}
                        >
                          {pub.privilege}
                        </span>
                      </td>
                      <td className="py-2 px-3">
                        <div className="flex items-center gap-1.5 min-w-[180px]">
                          <input
                            type="tel"
                            inputMode="tel"
                            value={phoneDraft}
                            onChange={(e) => handlePhoneChange(pub.id, e.target.value)}
                            placeholder="(11) 99999-9999"
                            aria-label={`WhatsApp de ${pub.name}`}
                            title={
                              normalizedPreview
                                ? `wa.me/${normalizedPreview}`
                                : 'Informe DDD + número'
                            }
                            className="w-40 h-8 px-2.5 text-xs font-mono tabular-nums bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-600"
                          />
                        </div>
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <span className="inline-block px-2 py-0.5 text-xs font-semibold bg-red-600 dark:bg-red-700 text-white rounded">
                          ❌ Não Relatou
                        </span>
                      </td>
                      <td className="py-2 px-3 text-right">
                        <div className="inline-flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            disabled={isSaving || !isDirty}
                            onClick={() => handleSaveNumber(pub)}
                            className={`h-8 px-2.5 text-xs font-medium rounded border transition-colors inline-flex items-center gap-1 whitespace-nowrap shrink-0 ${
                              isJustSaved
                                ? 'bg-emerald-600 text-white border-emerald-600 cursor-default'
                                : isDirty
                                  ? 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer'
                                  : savedPhone
                                    ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800 cursor-default'
                                    : 'bg-slate-50 dark:bg-slate-800/50 text-slate-400 dark:text-slate-500 border-slate-200 dark:border-slate-700 opacity-70 cursor-not-allowed'
                            }`}
                          >
                            {isJustSaved ? (
                              <>
                                <Check className="w-3.5 h-3.5" />
                                Salvo
                              </>
                            ) : isSaving ? (
                              'Salvando...'
                            ) : !isDirty && savedPhone ? (
                              <>
                                <Check className="w-3.5 h-3.5" />
                                Salvo
                              </>
                            ) : (
                              <>
                                <Save className="w-3.5 h-3.5" />
                                Salvar Número
                              </>
                            )}
                          </button>

                          {selfWaUrl ? (
                            <a
                              href={selfWaUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={() => {
                                if (isDirty && !isSaving) {
                                  void handleSaveNumber(pub);
                                }
                              }}
                              title="Enviar link pessoal pelo WhatsApp para o publicador preencher"
                              className="h-8 px-2.5 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-600 dark:hover:bg-indigo-500 rounded transition-colors inline-flex items-center gap-1 whitespace-nowrap shrink-0"
                            >
                              <Link2 className="w-3.5 h-3.5" />
                              Enviar Link
                            </a>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleCopyPublisherLink(pub)}
                              title="Copiar link pessoal para colar no WhatsApp"
                              className="h-8 px-2.5 text-xs font-medium text-indigo-800 dark:text-indigo-200 bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 rounded transition-colors inline-flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer"
                            >
                              <Link2 className="w-3.5 h-3.5" />
                              Copiar Link
                            </button>
                          )}

                          {waUrl ? (
                            <a
                              href={waUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={() => {
                                if (isDirty && !isSaving) {
                                  void handleSaveNumber(pub);
                                }
                              }}
                              className="h-8 px-3 text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-700 dark:hover:bg-emerald-600 rounded transition-colors inline-flex items-center gap-1 whitespace-nowrap shrink-0"
                            >
                              📱 Enviar Lembrete
                            </a>
                          ) : (
                            <button
                              type="button"
                              disabled
                              title="Informe um número com DDD para habilitar o lembrete"
                              className="h-8 px-3 text-xs font-medium text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded opacity-60 cursor-not-allowed inline-flex items-center gap-1 whitespace-nowrap shrink-0"
                            >
                              📱 Enviar Lembrete
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => onQuickRegister(pub)}
                            className="h-8 px-2.5 text-xs font-medium text-white bg-blue-700 dark:bg-blue-600 rounded hover:bg-blue-800 dark:hover:bg-blue-500 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                          >
                            Registrar Agora
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
    </div>
  );
}
