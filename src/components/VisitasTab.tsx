import {
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  MessageSquare,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  UserCheck,
  X,
} from 'lucide-react';
import { FormEvent, useMemo, useState } from 'react';
import {
  GroupVisit,
  ServiceGroup,
  ServiceOverseerSettings,
} from '../types';
import { generateId } from '../utils/formatters';
import { buildWhatsAppUrl } from '../utils/whatsapp';

interface VisitasTabProps {
  serviceGroups: ServiceGroup[];
  overseerSettings: ServiceOverseerSettings;
  groupVisits: GroupVisit[];
  onSaveOverseerSettings: (next: ServiceOverseerSettings) => void;
  onSaveVisit: (visit: GroupVisit) => void;
  onDeleteVisit: (visitId: string) => void;
  onNotify: (text: string, tone?: 'success' | 'error' | 'info') => void;
}

function formatDatePtBr(isoDate: string): string {
  if (!isoDate) return '—';
  const [y, m, d] = isoDate.split('-');
  if (!y || !m || !d) return isoDate;
  return `${d}/${m}/${y}`;
}

function getTodayIso(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function VisitasTab({
  serviceGroups,
  overseerSettings,
  groupVisits,
  onSaveOverseerSettings,
  onSaveVisit,
  onDeleteVisit,
  onNotify,
}: VisitasTabProps) {
  const orderedGroups = useMemo(
    () =>
      [...serviceGroups].sort(
        (a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, 'pt-BR'),
      ),
    [serviceGroups],
  );

  // Edição do Supervisor de Serviço e Ciclo
  const [editingSupervisor, setEditingSupervisor] = useState(false);
  const [supName, setSupName] = useState(overseerSettings.supervisorName);
  const [supWhatsapp, setSupWhatsapp] = useState(overseerSettings.supervisorWhatsapp);
  const [cycleLabel, setCycleLabel] = useState(overseerSettings.cycleLabel);
  const [cycleStartDate, setCycleStartDate] = useState(overseerSettings.cycleStartDate);

  // Formulário: Agendar Próxima Visita
  const [schedGroupId, setSchedGroupId] = useState<string>(orderedGroups[0]?.id ?? '');
  const [schedDate, setSchedDate] = useState<string>(getTodayIso());
  const [schedNotes, setSchedNotes] = useState<string>('');

  // Formulário: Registrar Visita Realizada no Histórico
  const [logGroupId, setLogGroupId] = useState<string>(orderedGroups[0]?.id ?? '');
  const [logDate, setLogDate] = useState<string>(getTodayIso());
  const [logVisitor, setLogVisitor] = useState<string>(overseerSettings.supervisorName);
  const [logNotes, setLogNotes] = useState<string>('');

  // Filtro do Histórico
  const [historyFilterGroupId, setHistoryFilterGroupId] = useState<string>('all');

  const groupNameById = useMemo(() => {
    const map = new Map<string, string>();
    orderedGroups.forEach((g) => map.set(g.id, g.name));
    return map;
  }, [orderedGroups]);

  const scheduledVisits = useMemo(
    () =>
      groupVisits
        .filter((v) => v.status === 'agendada')
        .sort((a, b) => a.visitDate.localeCompare(b.visitDate)),
    [groupVisits],
  );

  const completedVisits = useMemo(
    () =>
      groupVisits
        .filter((v) => v.status === 'realizada')
        .sort((a, b) => b.visitDate.localeCompare(a.visitDate)),
    [groupVisits],
  );

  const nextScheduledVisit = scheduledVisits[0] ?? null;

  const groupStatusRows = useMemo(() => {
    const cycleStart = overseerSettings.cycleStartDate || '0000-01-01';
    return orderedGroups.map((group) => {
      const visitsInCycle = completedVisits.filter(
        (v) => v.groupId === group.id && v.visitDate >= cycleStart,
      );
      const lastOverall = completedVisits.find((v) => v.groupId === group.id) ?? null;
      const nextScheduled = scheduledVisits.find((v) => v.groupId === group.id) ?? null;

      return {
        group,
        visitedInCycle: visitsInCycle.length > 0,
        lastCycleVisit: visitsInCycle[0] ?? null,
        lastOverall,
        nextScheduled,
      };
    });
  }, [orderedGroups, completedVisits, scheduledVisits, overseerSettings.cycleStartDate]);

  const visitedCount = groupStatusRows.filter((r) => r.visitedInCycle).length;
  const pendingCount = groupStatusRows.length - visitedCount;

  const filteredCompletedVisits = useMemo(() => {
    if (historyFilterGroupId === 'all') return completedVisits;
    return completedVisits.filter((v) => v.groupId === historyFilterGroupId);
  }, [completedVisits, historyFilterGroupId]);

  const handleOpenEditSupervisor = () => {
    setSupName(overseerSettings.supervisorName);
    setSupWhatsapp(overseerSettings.supervisorWhatsapp);
    setCycleLabel(overseerSettings.cycleLabel);
    setCycleStartDate(overseerSettings.cycleStartDate);
    setEditingSupervisor(true);
  };

  const handleSaveSupervisor = (e: FormEvent) => {
    e.preventDefault();
    onSaveOverseerSettings({
      ...overseerSettings,
      id: overseerSettings.id || 'default',
      supervisorName: supName.trim(),
      supervisorWhatsapp: supWhatsapp.trim(),
      cycleLabel: cycleLabel.trim() || 'Ciclo Atual',
      cycleStartDate: cycleStartDate || getTodayIso(),
    });
    setEditingSupervisor(false);
  };

  const handleStartNewCycle = () => {
    const today = getTodayIso();
    onSaveOverseerSettings({
      ...overseerSettings,
      cycleStartDate: today,
      cycleLabel: `Ciclo ${formatDatePtBr(today)}`,
    });
    onNotify('Novo ciclo de visitas iniciado. O histórico anterior foi preservado.');
  };

  const handleScheduleVisit = (e: FormEvent) => {
    e.preventDefault();
    const targetGroupId = schedGroupId || orderedGroups[0]?.id;
    const group = orderedGroups.find((g) => g.id === targetGroupId);
    if (!group) {
      onNotify('Cadastre ao menos um grupo antes de agendar.', 'error');
      return;
    }
    if (!schedDate) return;

    onSaveVisit({
      id: `vis-${generateId()}`,
      groupId: group.id,
      groupNameSnapshot: group.name,
      visitDate: schedDate,
      visitorName: overseerSettings.supervisorName,
      notes: schedNotes.trim(),
      status: 'agendada',
    });

    setSchedNotes('');
  };

  const handleLogCompletedVisit = (e: FormEvent) => {
    e.preventDefault();
    const targetGroupId = logGroupId || orderedGroups[0]?.id;
    const group = orderedGroups.find((g) => g.id === targetGroupId);
    if (!group) {
      onNotify('Cadastre ao menos um grupo antes de registrar uma visita.', 'error');
      return;
    }
    if (!logDate) return;

    onSaveVisit({
      id: `vis-${generateId()}`,
      groupId: group.id,
      groupNameSnapshot: group.name,
      visitDate: logDate,
      visitorName: logVisitor.trim() || overseerSettings.supervisorName,
      notes: logNotes.trim(),
      status: 'realizada',
    });

    setLogNotes('');
  };

  const handleMarkAsCompleted = (visit: GroupVisit) => {
    onSaveVisit({
      ...visit,
      status: 'realizada',
      visitorName: visit.visitorName || overseerSettings.supervisorName,
    });
  };

  const supervisorWaUrl = buildWhatsAppUrl(
    overseerSettings.supervisorWhatsapp,
    `Olá${overseerSettings.supervisorName ? `, ${overseerSettings.supervisorName}` : ''}! Segue acompanhamento das visitas aos grupos (${overseerSettings.cycleLabel}).`,
  );

  return (
    <div className="space-y-6">
      {/* 1. Supervisor de Serviço (Editável) e Painel Geral */}
      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-5 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-blue-700 dark:text-blue-400" />
              Visitas aos Grupos — Painel de Acompanhamento
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Controle independente de visitas do Superintendente de Serviço aos grupos da congregação.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {supervisorWaUrl && !editingSupervisor && (
              <a
                href={supervisorWaUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="h-8 px-3 text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded inline-flex items-center gap-1.5 whitespace-nowrap"
              >
                <MessageSquare className="w-3.5 h-3.5" />
                WhatsApp Supervisor
              </a>
            )}
            <button
              type="button"
              onClick={handleStartNewCycle}
              className="h-8 px-3 text-xs font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded hover:bg-slate-50 dark:hover:bg-slate-700 inline-flex items-center gap-1.5 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Iniciar Novo Ciclo
            </button>
            <button
              type="button"
              onClick={handleOpenEditSupervisor}
              className="h-8 px-3 text-xs font-medium text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 rounded hover:bg-blue-100 dark:hover:bg-blue-900/60 inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Pencil className="w-3.5 h-3.5" />
              Editar Supervisor / Ciclo
            </button>
          </div>
        </div>

        {editingSupervisor ? (
          <form
            onSubmit={handleSaveSupervisor}
            className="p-4 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-md grid grid-cols-1 md:grid-cols-12 gap-3"
          >
            <div className="md:col-span-4">
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                Supervisor de Serviço
              </label>
              <input
                type="text"
                value={supName}
                onChange={(e) => setSupName(e.target.value)}
                placeholder="Nome do supervisor"
                className="w-full h-9 px-3 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded text-slate-900 dark:text-slate-100"
              />
            </div>
            <div className="md:col-span-3">
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                WhatsApp
              </label>
              <input
                type="tel"
                inputMode="tel"
                value={supWhatsapp}
                onChange={(e) => setSupWhatsapp(e.target.value)}
                placeholder="(11) 99999-9999"
                className="w-full h-9 px-3 text-sm font-mono bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded text-slate-900 dark:text-slate-100"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                Nome do Ciclo
              </label>
              <input
                type="text"
                value={cycleLabel}
                onChange={(e) => setCycleLabel(e.target.value)}
                className="w-full h-9 px-3 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded text-slate-900 dark:text-slate-100"
              />
            </div>
            <div className="md:col-span-3 flex items-end gap-2">
              <div className="flex-1">
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Início do Ciclo
                </label>
                <input
                  type="date"
                  value={cycleStartDate}
                  onChange={(e) => setCycleStartDate(e.target.value)}
                  className="w-full h-9 px-2.5 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded text-slate-900 dark:text-slate-100"
                />
              </div>
              <button
                type="submit"
                className="h-9 px-3 text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded inline-flex items-center gap-1 cursor-pointer"
              >
                <Check className="w-3.5 h-3.5" />
                Salvar
              </button>
              <button
                type="button"
                onClick={() => setEditingSupervisor(false)}
                className="h-9 px-2 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </form>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-md p-3.5">
              <div className="text-xs text-slate-500 dark:text-slate-400">Supervisor de Serviço</div>
              <div className="mt-1 text-sm font-bold text-slate-900 dark:text-slate-100">
                {overseerSettings.supervisorName || 'Não definido'}
              </div>
              <div className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                {overseerSettings.cycleLabel} (desde {formatDatePtBr(overseerSettings.cycleStartDate)})
              </div>
            </div>

            <div className="bg-emerald-50/70 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-md p-3.5">
              <div className="text-xs text-emerald-800 dark:text-emerald-300">✅ Visitados no Ciclo</div>
              <div className="mt-1 text-2xl font-bold font-mono tabular-nums text-emerald-700 dark:text-emerald-400">
                {visitedCount} / {groupStatusRows.length}
              </div>
            </div>

            <div className="bg-red-50/70 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-md p-3.5">
              <div className="text-xs text-red-800 dark:text-red-300">❌ Pendentes de Visita</div>
              <div className="mt-1 text-2xl font-bold font-mono tabular-nums text-red-700 dark:text-red-400">
                {pendingCount}
              </div>
            </div>

            <div className="bg-blue-50/70 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 rounded-md p-3.5">
              <div className="text-xs text-blue-800 dark:text-blue-300 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" />
                Próxima Visita Agendada
              </div>
              {nextScheduledVisit ? (
                <>
                  <div className="mt-1 text-sm font-bold text-blue-950 dark:text-blue-100">
                    {groupNameById.get(nextScheduledVisit.groupId) ||
                      nextScheduledVisit.groupNameSnapshot}
                  </div>
                  <div className="mt-0.5 text-xs font-mono text-blue-700 dark:text-blue-300">
                    {formatDatePtBr(nextScheduledVisit.visitDate)}
                  </div>
                </>
              ) : (
                <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Nenhuma visita agendada
                </div>
              )}
            </div>
          </div>
        )}
      </section>

      {/* 2. Tabela de Status dos Grupos no Ciclo Atual */}
      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Situação por Grupo ({overseerSettings.cycleLabel})
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/70 border-b border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-600 dark:text-slate-300">
                <th className="py-2.5 px-4">Grupo</th>
                <th className="py-2.5 px-4">Responsável</th>
                <th className="py-2.5 px-4">Status no Ciclo</th>
                <th className="py-2.5 px-4">Última Visita Realizada</th>
                <th className="py-2.5 px-4">Próxima Agendada</th>
                <th className="py-2.5 px-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
              {groupStatusRows.map(
                ({ group, visitedInCycle, lastCycleVisit, lastOverall, nextScheduled }) => (
                  <tr
                    key={group.id}
                    className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    <td className="py-2.5 px-4 font-semibold text-slate-900 dark:text-slate-100">
                      {group.name}
                    </td>
                    <td className="py-2.5 px-4 text-xs text-slate-600 dark:text-slate-400">
                      {group.overseerName || '—'}
                    </td>
                    <td className="py-2.5 px-4 whitespace-nowrap">
                      {visitedInCycle ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold rounded bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300">
                          ✅ Visitado
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold rounded bg-red-100 dark:bg-red-950/60 text-red-800 dark:text-red-300">
                          ❌ Pendente
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-4 text-xs font-mono text-slate-600 dark:text-slate-400">
                      {lastCycleVisit
                        ? formatDatePtBr(lastCycleVisit.visitDate)
                        : lastOverall
                          ? `${formatDatePtBr(lastOverall.visitDate)} (ciclo ant.)`
                          : 'Nunca'}
                    </td>
                    <td className="py-2.5 px-4 text-xs font-mono text-blue-700 dark:text-blue-400">
                      {nextScheduled ? formatDatePtBr(nextScheduled.visitDate) : '—'}
                    </td>
                    <td className="py-2.5 px-4 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setSchedGroupId(group.id)}
                          className="h-7 px-2.5 text-xs font-medium text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800 rounded hover:bg-blue-100 cursor-pointer"
                        >
                          Agendar
                        </button>
                        <button
                          type="button"
                          onClick={() => setLogGroupId(group.id)}
                          className="h-7 px-2.5 text-xs font-medium text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 rounded hover:bg-emerald-100 cursor-pointer"
                        >
                          Registrar Visita
                        </button>
                      </div>
                    </td>
                  </tr>
                ),
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* 3. Agenda de Visitas (Próxima Visita) + Registro de Visita Realizada */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Agenda */}
        <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-5 space-y-4">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Clock className="w-4 h-4 text-blue-700 dark:text-blue-400" />
            Agenda de Visitas (Próximas Visitas)
          </h3>

          <form onSubmit={handleScheduleVisit} className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
            <div className="sm:col-span-5">
              <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                Grupo
              </label>
              <select
                value={schedGroupId}
                onChange={(e) => setSchedGroupId(e.target.value)}
                className="w-full h-9 px-2.5 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-slate-900 dark:text-slate-100"
              >
                {orderedGroups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-4">
              <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                Data Agendada
              </label>
              <input
                type="date"
                required
                value={schedDate}
                onChange={(e) => setSchedDate(e.target.value)}
                className="w-full h-9 px-2.5 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-slate-900 dark:text-slate-100"
              />
            </div>
            <div className="sm:col-span-3 flex items-end">
              <button
                type="submit"
                className="w-full h-9 px-3 text-xs font-medium text-white bg-blue-700 hover:bg-blue-800 rounded inline-flex items-center justify-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                Agendar
              </button>
            </div>
            <div className="sm:col-span-12">
              <input
                type="text"
                value={schedNotes}
                onChange={(e) => setSchedNotes(e.target.value)}
                placeholder="Observações do agendamento (opcional)"
                className="w-full h-8 px-2.5 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-slate-900 dark:text-slate-100"
              />
            </div>
          </form>

          <div className="divide-y divide-slate-100 dark:divide-slate-800 border-t border-slate-100 dark:border-slate-800">
            {scheduledVisits.length === 0 ? (
              <p className="py-4 text-xs text-slate-500 dark:text-slate-400">
                Nenhuma visita agendada no momento.
              </p>
            ) : (
              scheduledVisits.map((visit) => (
                <div
                  key={visit.id}
                  className="py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2"
                >
                  <div>
                    <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                      {groupNameById.get(visit.groupId) || visit.groupNameSnapshot}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      Data: <strong className="font-mono">{formatDatePtBr(visit.visitDate)}</strong>
                      {visit.notes ? ` • ${visit.notes}` : ''}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleMarkAsCompleted(visit)}
                      className="h-7 px-2.5 text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded inline-flex items-center gap-1 cursor-pointer"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Marcar Realizada
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteVisit(visit.id)}
                      aria-label="Excluir agendamento"
                      className="h-7 px-2 text-slate-500 hover:text-red-600 rounded cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        {/* Registrar Visita Realizada */}
        <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-5 space-y-4">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
            Registrar Visita Realizada
          </h3>

          <form onSubmit={handleLogCompletedVisit} className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
            <div className="sm:col-span-6">
              <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                Grupo Visitado
              </label>
              <select
                value={logGroupId}
                onChange={(e) => setLogGroupId(e.target.value)}
                className="w-full h-9 px-2.5 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-slate-900 dark:text-slate-100"
              >
                {orderedGroups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-6">
              <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                Data da Visita
              </label>
              <input
                type="date"
                required
                value={logDate}
                onChange={(e) => setLogDate(e.target.value)}
                className="w-full h-9 px-2.5 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-slate-900 dark:text-slate-100"
              />
            </div>
            <div className="sm:col-span-5">
              <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                Visitante
              </label>
              <input
                type="text"
                value={logVisitor}
                onChange={(e) => setLogVisitor(e.target.value)}
                placeholder={overseerSettings.supervisorName || 'Nome do visitante'}
                className="w-full h-9 px-2.5 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-slate-900 dark:text-slate-100"
              />
            </div>
            <div className="sm:col-span-7 flex items-end gap-2">
              <div className="flex-1">
                <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Observações
                </label>
                <input
                  type="text"
                  value={logNotes}
                  onChange={(e) => setLogNotes(e.target.value)}
                  placeholder="Considerações da visita"
                  className="w-full h-9 px-2.5 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-slate-900 dark:text-slate-100"
                />
              </div>
              <button
                type="submit"
                className="h-9 px-4 text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded inline-flex items-center gap-1 whitespace-nowrap cursor-pointer"
              >
                <Check className="w-3.5 h-3.5" />
                Salvar
              </button>
            </div>
          </form>
        </section>
      </div>

      {/* 4. Histórico de Visitas */}
      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Histórico de Visitas Realizadas ({filteredCompletedVisits.length})
          </h3>
          <select
            aria-label="Filtrar histórico por grupo"
            value={historyFilterGroupId}
            onChange={(e) => setHistoryFilterGroupId(e.target.value)}
            className="h-8 px-2.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-slate-900 dark:text-slate-100"
          >
            <option value="all">Todos os Grupos</option>
            {orderedGroups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        </div>

        {filteredCompletedVisits.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500 dark:text-slate-400">
            Nenhuma visita registrada no histórico até o momento.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/70 border-b border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-600 dark:text-slate-300">
                  <th className="py-2.5 px-4">Data</th>
                  <th className="py-2.5 px-4">Grupo</th>
                  <th className="py-2.5 px-4">Visitante</th>
                  <th className="py-2.5 px-4">Observações</th>
                  <th className="py-2.5 px-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
                {filteredCompletedVisits.map((visit) => (
                  <tr key={visit.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                    <td className="py-2.5 px-4 text-xs font-mono text-slate-700 dark:text-slate-300 whitespace-nowrap">
                      {formatDatePtBr(visit.visitDate)}
                    </td>
                    <td className="py-2.5 px-4 font-semibold text-slate-900 dark:text-slate-100">
                      {groupNameById.get(visit.groupId) || visit.groupNameSnapshot}
                    </td>
                    <td className="py-2.5 px-4 text-xs text-slate-700 dark:text-slate-300">
                      {visit.visitorName || '—'}
                    </td>
                    <td className="py-2.5 px-4 text-xs text-slate-600 dark:text-slate-400">
                      {visit.notes || '—'}
                    </td>
                    <td className="py-2.5 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => onDeleteVisit(visit.id)}
                        aria-label="Excluir registro de visita"
                        className="p-1.5 text-slate-500 hover:text-red-600 rounded cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
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
