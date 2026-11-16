import { X } from 'lucide-react';
import { FormEvent, useMemo, useState } from 'react';
import {
  ActivityReport,
  AuxiliaryPioneerOption,
  Publisher,
} from '../types';
import { cleanDisplayName, formatMonthLabel, normalizeText } from '../utils/formatters';

interface ReportModalProps {
  monthKey: string;
  publishers: Publisher[];
  submittedNormNames: Set<string>;
  initialPublisher?: Publisher | null;
  editingReport?: ActivityReport | null;
  onClose: () => void;
  onSave: (
    data: {
      publisherName: string;
      publisherId?: string;
      participated: boolean;
      hours: number | null;
      bibleStudies: number | null;
      auxiliaryPioneer: AuxiliaryPioneerOption;
      notes: string;
    },
    addToCadastroIfMissing: boolean,
  ) => void;
}

const AUX_OPTIONS: AuxiliaryPioneerOption[] = ['Não', '15 horas', '30 horas', 'Contínuo'];

export function ReportModal({
  monthKey,
  publishers,
  submittedNormNames,
  initialPublisher,
  editingReport,
  onClose,
  onSave,
}: ReportModalProps) {
  const [name, setName] = useState(
    editingReport?.publisherName ?? initialPublisher?.name ?? '',
  );
  const [participated, setParticipated] = useState<boolean>(
    editingReport ? editingReport.participated : true,
  );
  const [hoursStr, setHoursStr] = useState<string>(
    editingReport?.hours !== null && editingReport?.hours !== undefined
      ? String(editingReport.hours)
      : '',
  );
  const [studiesStr, setStudiesStr] = useState<string>(
    editingReport?.bibleStudies !== null && editingReport?.bibleStudies !== undefined
      ? String(editingReport.bibleStudies)
      : '',
  );
  const [auxPioneer, setAuxPioneer] = useState<AuxiliaryPioneerOption>(
    editingReport?.auxiliaryPioneer ?? 'Não',
  );
  const [notes, setNotes] = useState<string>(editingReport?.notes ?? '');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [addToCadastro, setAddToCadastro] = useState(true);

  const matchedPublisher = useMemo(() => {
    const norm = normalizeText(name);
    if (!norm) return undefined;
    return publishers.find((p) => normalizeText(p.name) === norm);
  }, [name, publishers]);

  const suggestions = useMemo(() => {
    const norm = normalizeText(name);
    return publishers
      .filter((p) => p.active)
      .filter((p) => !norm || normalizeText(p.name).includes(norm))
      .sort((a, b) => {
        const aSent = submittedNormNames.has(normalizeText(a.name)) ? 1 : 0;
        const bSent = submittedNormNames.has(normalizeText(b.name)) ? 1 : 0;
        if (aSent !== bSent) return aSent - bSent;
        return a.name.localeCompare(b.name, 'pt-BR');
      })
      .slice(0, 8);
  }, [name, publishers, submittedNormNames]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const cleaned = cleanDisplayName(name);
    if (!cleaned) return;

    const parsedHours = hoursStr.trim() === '' ? null : Math.max(0, Math.round(Number(hoursStr)));
    const parsedStudies =
      studiesStr.trim() === '' ? null : Math.max(0, Math.round(Number(studiesStr)));

    onSave(
      {
        publisherName: cleaned,
        publisherId: matchedPublisher?.id,
        participated,
        hours: Number.isFinite(parsedHours) ? parsedHours : null,
        bibleStudies: Number.isFinite(parsedStudies) ? parsedStudies : null,
        auxiliaryPioneer: auxPioneer,
        notes: notes.trim(),
      },
      !matchedPublisher && addToCadastro,
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/60 dark:bg-black/70 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="report-modal-title"
    >
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg w-full max-w-lg shadow-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div>
            <h2 id="report-modal-title" className="text-base font-semibold text-slate-900 dark:text-slate-100">
              {editingReport ? 'Editar Relatório de Atividade' : 'Registrar Atividade Ministerial'}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Mês de referência: {formatMonthLabel(monthKey)}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar janela"
            className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Publisher Name with autocomplete */}
          <div className="relative">
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Nome do Publicador
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setShowSuggestions(true);
              }}
              onFocus={() => setShowSuggestions(true)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
              placeholder="Digite ou selecione um nome do cadastro..."
              required
              disabled={Boolean(editingReport)}
              className="w-full h-10 px-3 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-600 disabled:bg-slate-50 dark:disabled:bg-slate-800/60"
            />

            {showSuggestions && !editingReport && suggestions.length > 0 && (
              <div className="absolute z-20 left-0 right-0 mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md shadow-lg max-h-48 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-700">
                {suggestions.map((pub) => {
                  const alreadySent = submittedNormNames.has(normalizeText(pub.name));
                  return (
                    <button
                      key={pub.id}
                      type="button"
                      onMouseDown={() => {
                        setName(pub.name);
                        setShowSuggestions(false);
                      }}
                      className="w-full px-3 py-2 text-left text-xs hover:bg-blue-50 dark:hover:bg-blue-950/60 flex items-center justify-between gap-2 cursor-pointer"
                    >
                      <span className="font-medium text-slate-900 dark:text-slate-100 truncate">{pub.name}</span>
                      <span
                        className={`shrink-0 font-medium ${
                          alreadySent ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-700 dark:text-red-400'
                        }`}
                      >
                        {alreadySent ? 'Já enviou' : 'Pendente'}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            {!editingReport && name.trim().length > 2 && !matchedPublisher && (
              <label className="mt-2 flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400 cursor-pointer">
                <input
                  type="checkbox"
                  checked={addToCadastro}
                  onChange={(e) => setAddToCadastro(e.target.checked)}
                  className="rounded border-slate-300 dark:border-slate-600 text-blue-700 focus:ring-blue-600"
                />
                <span>Adicionar este nome automaticamente ao Cadastro</span>
              </label>
            )}
          </div>

          {/* Participated */}
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Marque se você participou esse mês
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setParticipated(true)}
                className={`h-10 px-4 text-sm font-medium rounded-md border transition-colors cursor-pointer ${
                  participated
                    ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-500 text-emerald-900 dark:text-emerald-300'
                    : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'
                }`}
              >
                Sim (Participou)
              </button>
              <button
                type="button"
                onClick={() => setParticipated(false)}
                className={`h-10 px-4 text-sm font-medium rounded-md border transition-colors cursor-pointer ${
                  !participated
                    ? 'bg-slate-100 dark:bg-slate-800 border-slate-500 text-slate-900 dark:text-slate-100'
                    : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'
                }`}
              >
                Não participou
              </button>
            </div>
          </div>

          {/* Hours, Studies, Aux Pioneer */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Horas (Pioneiro)
              </label>
              <input
                type="number"
                min={0}
                max={744}
                value={hoursStr}
                onChange={(e) => setHoursStr(e.target.value)}
                placeholder="Ex.: 50"
                className="w-full h-10 px-3 text-sm font-mono tabular-nums bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Estudos Bíblicos
              </label>
              <input
                type="number"
                min={0}
                max={100}
                value={studiesStr}
                onChange={(e) => setStudiesStr(e.target.value)}
                placeholder="Ex.: 2"
                className="w-full h-10 px-3 text-sm font-mono tabular-nums bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Pioneiro Auxiliar
              </label>
              <select
                value={auxPioneer}
                onChange={(e) => setAuxPioneer(e.target.value as AuxiliaryPioneerOption)}
                className="w-full h-10 px-3 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600"
              >
                {AUX_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Observações
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Anotações opcionais sobre o relatório..."
              className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>

          <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="h-9 px-4 text-xs font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="h-9 px-5 text-xs font-medium text-white bg-blue-700 dark:bg-blue-600 rounded-md hover:bg-blue-800 dark:hover:bg-blue-500 cursor-pointer"
            >
              {editingReport ? 'Salvar Alterações' : 'Registrar Resposta'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
