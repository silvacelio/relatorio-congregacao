import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  BookOpen,
  Calendar,
  CheckCircle2,
  Clock,
  RotateCcw,
  Search,
  Send,
  User,
} from 'lucide-react';
import { ActivityReport, AuxiliaryPioneerOption, Publisher } from '../types';
import { formatMonthLabel, normalizeText } from '../utils/formatters';

export interface EnviarRelatorioPayload {
  publisher: Publisher;
  participated: boolean;
  hours: number | null;
  bibleStudies: number | null;
  auxiliaryPioneer: AuxiliaryPioneerOption;
  notes: string;
}

interface EnviarRelatorioTabProps {
  monthKey: string;
  publishers: Publisher[];
  reports: ActivityReport[];
  onSubmitReport: (payload: EnviarRelatorioPayload) => void;
}

interface SubmittedReceipt {
  publisherName: string;
  privilegeLabel: string;
  monthLabel: string;
  isPioneer: boolean;
  participated: boolean;
  hours: number | null;
  bibleStudies: number | null;
  notes: string;
  updatedExisting: boolean;
}

export function EnviarRelatorioTab({
  monthKey,
  publishers,
  reports,
  onSubmitReport,
}: EnviarRelatorioTabProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPublisherId, setSelectedPublisherId] = useState<string>(() => {
    if (typeof window === 'undefined') return '';
    const param = new URLSearchParams(window.location.search).get('publicador');
    return param ?? '';
  });

  const [participatedChoice, setParticipatedChoice] = useState<'sim' | 'nao' | null>(null);
  const [hoursStr, setHoursStr] = useState('');
  const [studiesStr, setStudiesStr] = useState('');
  const [notes, setNotes] = useState('');
  const [formError, setFormError] = useState('');
  const [receipt, setReceipt] = useState<SubmittedReceipt | null>(null);

  const activePublishers = useMemo(() => {
    return publishers
      .filter((p) => p.active)
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  }, [publishers]);

  const filteredPublishers = useMemo(() => {
    const normQuery = normalizeText(searchQuery);
    if (!normQuery) return activePublishers;
    return activePublishers.filter(
      (p) =>
        p.id === selectedPublisherId ||
        normalizeText(p.name).includes(normQuery) ||
        normalizeText(p.group).includes(normQuery),
    );
  }, [activePublishers, searchQuery, selectedPublisherId]);

  const selectedPublisher = useMemo(() => {
    if (!selectedPublisherId) return null;
    return (
      activePublishers.find((p) => p.id === selectedPublisherId) ??
      activePublishers.find(
        (p) => normalizeText(p.name) === normalizeText(selectedPublisherId),
      ) ??
      null
    );
  }, [activePublishers, selectedPublisherId]);

  const existingReport = useMemo(() => {
    if (!selectedPublisher) return null;
    const normName = normalizeText(selectedPublisher.name);
    return (
      reports.find(
        (r) =>
          r.monthKey === monthKey &&
          (r.publisherId === selectedPublisher.id ||
            normalizeText(r.publisherName) === normName),
      ) ?? null
    );
  }, [reports, monthKey, selectedPublisher]);

  const isAuxiliaryPioneer = selectedPublisher?.privilege === 'Pioneiro Auxiliar';
  const isRegularPioneer =
    selectedPublisher?.privilege === 'Pioneiro Regular' ||
    Boolean(selectedPublisher?.isRegularPioneer);
  const isPioneer = Boolean(isAuxiliaryPioneer || isRegularPioneer);

  const displayRoleLabel = useMemo(() => {
    if (!selectedPublisher) return '';
    if (isRegularPioneer) return 'Pioneiro Regular';
    if (isAuxiliaryPioneer) return 'Pioneiro Auxiliar';
    return selectedPublisher.privilege || 'Publicador';
  }, [selectedPublisher, isRegularPioneer, isAuxiliaryPioneer]);

  useEffect(() => {
    setFormError('');
    if (!selectedPublisher) {
      setParticipatedChoice(null);
      setHoursStr('');
      setStudiesStr('');
      setNotes('');
      return;
    }

    if (existingReport) {
      setParticipatedChoice(existingReport.participated ? 'sim' : 'nao');
      setHoursStr(
        existingReport.hours !== null && existingReport.hours !== undefined
          ? String(existingReport.hours)
          : '',
      );
      setStudiesStr(
        existingReport.bibleStudies !== null && existingReport.bibleStudies !== undefined
          ? String(existingReport.bibleStudies)
          : '',
      );
      setNotes(existingReport.notes ?? '');
    } else {
      setParticipatedChoice(null);
      setHoursStr('');
      setStudiesStr('');
      setNotes('');
    }
  }, [selectedPublisher?.id, monthKey]);

  const handleSelectPublisher = (value: string) => {
    setSelectedPublisherId(value);
    setReceipt(null);
    setFormError('');
  };

  const handleResetForNewReport = () => {
    setReceipt(null);
    setSelectedPublisherId('');
    setSearchQuery('');
    setParticipatedChoice(null);
    setHoursStr('');
    setStudiesStr('');
    setNotes('');
    setFormError('');
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!selectedPublisher) {
      setFormError('Por favor, selecione o seu nome na lista antes de enviar.');
      return;
    }

    const trimmedStudies = studiesStr.trim();
    let parsedStudies: number | null = null;
    if (trimmedStudies !== '') {
      const n = Number(trimmedStudies);
      if (!Number.isFinite(n) || n < 0) {
        setFormError('Informe um número válido para Estudos Bíblicos (0 ou maior).');
        return;
      }
      parsedStudies = Math.round(n);
    }

    if (isPioneer) {
      const trimmedHours = hoursStr.trim();
      if (trimmedHours === '') {
        setFormError('Por favor, informe a quantidade de horas deste mês.');
        return;
      }
      const nHours = Number(trimmedHours);
      if (!Number.isFinite(nHours) || nHours < 0) {
        setFormError('Informe um número válido de horas (0 ou maior).');
        return;
      }
      const parsedHours = Math.round(nHours);

      const resolvedAuxiliary: AuxiliaryPioneerOption = isAuxiliaryPioneer
        ? existingReport?.auxiliaryPioneer && existingReport.auxiliaryPioneer !== 'Não'
          ? existingReport.auxiliaryPioneer
          : '30 horas'
        : existingReport?.auxiliaryPioneer ?? 'Não';

      const hadExisting = Boolean(existingReport);

      onSubmitReport({
        publisher: selectedPublisher,
        participated: parsedHours > 0,
        hours: parsedHours,
        bibleStudies: parsedStudies,
        auxiliaryPioneer: resolvedAuxiliary,
        notes: notes.trim(),
      });

      setReceipt({
        publisherName: selectedPublisher.name,
        privilegeLabel: displayRoleLabel,
        monthLabel: formatMonthLabel(monthKey),
        isPioneer: true,
        participated: parsedHours > 0,
        hours: parsedHours,
        bibleStudies: parsedStudies,
        notes: notes.trim(),
        updatedExisting: hadExisting,
      });
      return;
    }

    if (participatedChoice === null) {
      setFormError('Por favor, marque Sim ou Não para informar se participou da pregação neste mês.');
      return;
    }

    const participated = participatedChoice === 'sim';
    const hadExisting = Boolean(existingReport);

    onSubmitReport({
      publisher: selectedPublisher,
      participated,
      hours: null,
      bibleStudies: parsedStudies,
      auxiliaryPioneer: existingReport?.auxiliaryPioneer ?? 'Não',
      notes: notes.trim(),
    });

    setReceipt({
      publisherName: selectedPublisher.name,
      privilegeLabel: displayRoleLabel,
      monthLabel: formatMonthLabel(monthKey),
      isPioneer: false,
      participated,
      hours: null,
      bibleStudies: parsedStudies,
      notes: notes.trim(),
      updatedExisting: hadExisting,
    });
  };

  const monthLabel = formatMonthLabel(monthKey);

  if (receipt) {
    return (
      <div className="max-w-xl mx-auto py-2 sm:py-4">
        <div className="bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-800 rounded-2xl shadow-sm overflow-hidden">
          <div className="h-2.5 bg-emerald-600" />
          <div className="p-6 sm:p-8 space-y-5">
            <div className="flex items-start gap-3">
              <div className="w-11 h-11 rounded-full bg-emerald-100 dark:bg-emerald-950 flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100">
                  {receipt.updatedExisting
                    ? 'Relatório atualizado com sucesso!'
                    : 'Relatório enviado com sucesso!'}
                </h2>
                <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300 mt-1">
                  Os dados já foram registrados automaticamente no painel da congregação.
                </p>
              </div>
            </div>

            <div className="bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-xl p-4 sm:p-5 space-y-2.5 text-base">
              <div className="flex justify-between gap-4 border-b border-slate-200 dark:border-slate-700 pb-2">
                <span className="text-slate-500 dark:text-slate-400">Nome</span>
                <span className="font-semibold text-slate-900 dark:text-slate-100 text-right">
                  {receipt.publisherName}
                </span>
              </div>
              <div className="flex justify-between gap-4 border-b border-slate-200 dark:border-slate-700 pb-2">
                <span className="text-slate-500 dark:text-slate-400">Mês</span>
                <span className="font-medium text-slate-900 dark:text-slate-100">
                  {receipt.monthLabel}
                </span>
              </div>
              <div className="flex justify-between gap-4 border-b border-slate-200 dark:border-slate-700 pb-2">
                <span className="text-slate-500 dark:text-slate-400">Privilégio</span>
                <span className="font-medium text-slate-900 dark:text-slate-100">
                  {receipt.privilegeLabel}
                </span>
              </div>
              {receipt.isPioneer ? (
                <div className="flex justify-between gap-4 border-b border-slate-200 dark:border-slate-700 pb-2">
                  <span className="text-slate-500 dark:text-slate-400">Horas</span>
                  <span className="font-semibold text-slate-900 dark:text-slate-100">
                    {receipt.hours ?? 0}
                  </span>
                </div>
              ) : (
                <div className="flex justify-between gap-4 border-b border-slate-200 dark:border-slate-700 pb-2">
                  <span className="text-slate-500 dark:text-slate-400">
                    Participou da pregação
                  </span>
                  <span className="font-semibold text-slate-900 dark:text-slate-100">
                    {receipt.participated ? 'Sim' : 'Não'}
                  </span>
                </div>
              )}
              <div className="flex justify-between gap-4">
                <span className="text-slate-500 dark:text-slate-400">Estudos Bíblicos</span>
                <span className="font-medium text-slate-900 dark:text-slate-100">
                  {receipt.bibleStudies !== null ? receipt.bibleStudies : '0'}
                </span>
              </div>
              {receipt.notes && (
                <div className="pt-2 border-t border-slate-200 dark:border-slate-700">
                  <span className="block text-sm text-slate-500 dark:text-slate-400 mb-1">
                    Observações
                  </span>
                  <p className="text-sm text-slate-800 dark:text-slate-200 whitespace-pre-line">
                    {receipt.notes}
                  </p>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={handleResetForNewReport}
              className="w-full min-h-[52px] px-5 py-3 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-emerald-600 dark:hover:bg-emerald-500 text-white text-base font-semibold transition-colors flex items-center justify-center gap-2 cursor-pointer"
            >
              <RotateCcw className="w-5 h-5" />
              Enviar outro relatório
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto py-2 sm:py-4 space-y-4">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
        <div className="h-2.5 bg-indigo-600 dark:bg-indigo-500" />
        <div className="p-6 sm:p-7">
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-slate-100">
            Relatório Mensal
          </h1>
          <p className="text-base text-slate-600 dark:text-slate-300 mt-1.5 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
            <span>
              Mês de referência: <strong className="font-semibold">{monthLabel}</strong>
            </span>
          </p>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
            Selecione seu nome abaixo, preencha os campos solicitados e toque em{' '}
            <strong>Enviar Relatório</strong>.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 sm:p-7 shadow-sm space-y-4">
          <div>
            <label
              htmlFor="enviar-relatorio-nome"
              className="flex items-center gap-2 text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2"
            >
              <User className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              Nome:
            </label>

            <div className="relative mb-3">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Digite parte do nome para filtrar a lista (opcional)"
                className="w-full h-11 pl-10 pr-4 text-base bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <select
              id="enviar-relatorio-nome"
              value={selectedPublisher?.id ?? ''}
              onChange={(e) => handleSelectPublisher(e.target.value)}
              className="w-full min-h-[52px] px-4 py-3 text-base sm:text-lg font-medium bg-white dark:bg-slate-800 border-2 border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:border-indigo-600 dark:focus:border-indigo-400 cursor-pointer"
            >
              <option value="">▼ Selecionar Publicador</option>
              {filteredPublishers.map((pub) => (
                <option key={pub.id} value={pub.id}>
                  {pub.name}
                </option>
              ))}
            </select>

            {selectedPublisher && (
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 rounded-xl px-4 py-2.5">
                <span className="text-sm sm:text-base text-indigo-950 dark:text-indigo-200 font-medium">
                  Designação: <strong>{displayRoleLabel}</strong>
                </span>
                {selectedPublisher.group && (
                  <span className="text-sm text-indigo-800 dark:text-indigo-300">
                    Grupo: <strong>{selectedPublisher.group}</strong>
                  </span>
                )}
              </div>
            )}

            {existingReport && (
              <div className="mt-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl px-4 py-3 text-sm sm:text-base text-amber-900 dark:text-amber-200">
                Já existe um relatório enviado para este mês. Se você enviar novamente, os dados
                serão atualizados.
              </div>
            )}
          </div>
        </div>

        {selectedPublisher && (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 sm:p-7 shadow-sm space-y-6">
            {isPioneer ? (
              <div>
                <label
                  htmlFor="enviar-relatorio-horas"
                  className="flex items-center gap-2 text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2"
                >
                  <Clock className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                  Horas:
                </label>
                <input
                  id="enviar-relatorio-horas"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  step={1}
                  value={hoursStr}
                  onChange={(e) => {
                    setHoursStr(e.target.value);
                    setFormError('');
                  }}
                  placeholder="Ex: 30"
                  className="w-full min-h-[54px] px-4 py-3 text-lg bg-white dark:bg-slate-800 border-2 border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:border-indigo-600 dark:focus:border-indigo-400"
                />
              </div>
            ) : (
              <div>
                <span className="block text-lg font-semibold text-slate-900 dark:text-slate-100 mb-3">
                  Participou da pregação neste mês?
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label
                    className={`min-h-[58px] px-5 py-3.5 rounded-xl border-2 flex items-center gap-3.5 cursor-pointer transition-colors ${
                      participatedChoice === 'sim'
                        ? 'border-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-950 dark:text-emerald-100'
                        : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/80'
                    }`}
                  >
                    <input
                      type="radio"
                      name="participated-month"
                      value="sim"
                      checked={participatedChoice === 'sim'}
                      onChange={() => {
                        setParticipatedChoice('sim');
                        setFormError('');
                      }}
                      className="w-5 h-5 accent-emerald-600 cursor-pointer"
                    />
                    <span className="text-lg font-semibold">Sim</span>
                  </label>

                  <label
                    className={`min-h-[58px] px-5 py-3.5 rounded-xl border-2 flex items-center gap-3.5 cursor-pointer transition-colors ${
                      participatedChoice === 'nao'
                        ? 'border-amber-600 bg-amber-50 dark:bg-amber-950/40 text-amber-950 dark:text-amber-100'
                        : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/80'
                    }`}
                  >
                    <input
                      type="radio"
                      name="participated-month"
                      value="nao"
                      checked={participatedChoice === 'nao'}
                      onChange={() => {
                        setParticipatedChoice('nao');
                        setFormError('');
                      }}
                      className="w-5 h-5 accent-amber-600 cursor-pointer"
                    />
                    <span className="text-lg font-semibold">Não</span>
                  </label>
                </div>
              </div>
            )}

            <div>
              <label
                htmlFor="enviar-relatorio-estudos"
                className="flex items-center gap-2 text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2"
              >
                <BookOpen className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                Estudos Bíblicos:
              </label>
              <input
                id="enviar-relatorio-estudos"
                type="number"
                inputMode="numeric"
                min={0}
                step={1}
                value={studiesStr}
                onChange={(e) => {
                  setStudiesStr(e.target.value);
                  setFormError('');
                }}
                placeholder="Ex: 0"
                className="w-full min-h-[54px] px-4 py-3 text-lg bg-white dark:bg-slate-800 border-2 border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:border-indigo-600 dark:focus:border-indigo-400"
              />
            </div>

            <div>
              <label
                htmlFor="enviar-relatorio-observacoes"
                className="block text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2"
              >
                Observações:
              </label>
              <textarea
                id="enviar-relatorio-observacoes"
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Escreva alguma observação, se necessário (opcional)"
                className="w-full p-4 text-base bg-white dark:bg-slate-800 border-2 border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:border-indigo-600 dark:focus:border-indigo-400 resize-y"
              />
            </div>

            {formError && (
              <div
                role="alert"
                className="flex items-start gap-2.5 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-200 rounded-xl px-4 py-3 text-base"
              >
                <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                <span>{formError}</span>
              </div>
            )}

            <button
              type="submit"
              className="w-full min-h-[56px] px-6 py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white text-lg font-bold shadow-sm transition-colors flex items-center justify-center gap-2.5 cursor-pointer"
            >
              <Send className="w-5 h-5" />
              Enviar Relatório
            </button>
          </div>
        )}
      </form>
    </div>
  );
}
