import {
  Check,
  MessageSquare,
  Pencil,
  Plus,
  Save,
  Trash2,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { FormEvent, useMemo, useState } from 'react';
import {
  ActivityReport,
  PrivilegeType,
  Publisher,
  ServiceGroup,
} from '../types';
import { formatMonthLabel, generateId, normalizeText } from '../utils/formatters';
import {
  buildReminderWhatsAppUrl,
  buildWhatsAppUrl,
  normalizePhoneDigits,
} from '../utils/whatsapp';

interface GruposTabProps {
  monthKey: string;
  publishers: Publisher[];
  reports: ActivityReport[];
  serviceGroups: ServiceGroup[];
  onSaveGroup: (group: ServiceGroup, previousName?: string) => void;
  onDeleteGroup: (groupId: string) => void;
  onAssignPublisherGroup: (publisher: Publisher, group: ServiceGroup) => void;
  onQuickRegister: (publisher: Publisher) => void;
  onSavePhone: (publisher: Publisher, phone: string) => Promise<boolean>;
  onNotify: (text: string, tone?: 'success' | 'error' | 'info') => void;
}

function getPrivilegeBadgeClasses(privilege: PrivilegeType): string {
  switch (privilege) {
    case 'Ancião':
      return 'bg-blue-50 text-blue-800 border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800';
    case 'Servo Ministerial':
      return 'bg-indigo-50 text-indigo-800 border-indigo-200 dark:bg-indigo-950/60 dark:text-indigo-300 dark:border-indigo-800';
    case 'Pioneiro Regular':
      return 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800';
    case 'Pioneiro Auxiliar':
      return 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800';
    default:
      return 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700';
  }
}

export function publisherBelongsToGroup(pub: Publisher, group: ServiceGroup): boolean {
  if (pub.groupId) {
    return pub.groupId === group.id;
  }
  return normalizeText(pub.group || '') === normalizeText(group.name);
}

export function GruposTab({
  monthKey,
  publishers,
  reports,
  serviceGroups,
  onSaveGroup,
  onDeleteGroup,
  onAssignPublisherGroup,
  onQuickRegister,
  onSavePhone,
  onNotify,
}: GruposTabProps) {
  const [selectedGroupId, setSelectedGroupId] = useState<string>('all');
  const [showGroupManager, setShowGroupManager] = useState(false);

  const [newGroupName, setNewGroupName] = useState('');
  const [newOverseerName, setNewOverseerName] = useState('');
  const [newOverseerWhatsapp, setNewOverseerWhatsapp] = useState('');
  const [newGroupNotes, setNewGroupNotes] = useState('');

  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editOverseerName, setEditOverseerName] = useState('');
  const [editOverseerWhatsapp, setEditOverseerWhatsapp] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const [assignSelectByGroup, setAssignSelectByGroup] = useState<Record<string, string>>({});

  const [phoneDrafts, setPhoneDrafts] = useState<Record<string, string>>({});
  const [savingIds, setSavingIds] = useState<Record<string, boolean>>({});
  const [savedIds, setSavedIds] = useState<Record<string, boolean>>({});

  const submittedNormNames = useMemo(() => {
    const set = new Set<string>();
    reports
      .filter((r) => r.monthKey === monthKey)
      .forEach((r) => set.add(normalizeText(r.publisherName)));
    return set;
  }, [reports, monthKey]);

  const activePublishers = useMemo(
    () =>
      publishers
        .filter((p) => p.active)
        .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')),
    [publishers],
  );

  const orderedGroups = useMemo(
    () =>
      [...serviceGroups].sort(
        (a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, 'pt-BR'),
      ),
    [serviceGroups],
  );

  const groupStats = useMemo(() => {
    return orderedGroups.map((group) => {
      const members = activePublishers.filter((p) => publisherBelongsToGroup(p, group));
      const received = members.filter((p) =>
        submittedNormNames.has(normalizeText(p.name)),
      );
      const pending = members.filter(
        (p) => !submittedNormNames.has(normalizeText(p.name)),
      );
      return {
        group,
        members,
        received,
        pending,
      };
    });
  }, [orderedGroups, activePublishers, submittedNormNames]);

  const unassignedPublishers = useMemo(() => {
    return activePublishers.filter(
      (pub) => !orderedGroups.some((g) => publisherBelongsToGroup(pub, g)),
    );
  }, [activePublishers, orderedGroups]);

  const totals = useMemo(() => {
    const total = activePublishers.length;
    const received = activePublishers.filter((p) =>
      submittedNormNames.has(normalizeText(p.name)),
    ).length;
    return {
      total,
      received,
      pending: total - received,
    };
  }, [activePublishers, submittedNormNames]);

  const visibleGroupStats = useMemo(() => {
    if (selectedGroupId === 'all') return groupStats;
    return groupStats.filter((item) => item.group.id === selectedGroupId);
  }, [groupStats, selectedGroupId]);

  const handleCreateGroup = (e: FormEvent) => {
    e.preventDefault();
    const trimmedName = newGroupName.trim();
    if (!trimmedName) return;

    const duplicate = orderedGroups.some(
      (g) => normalizeText(g.name) === normalizeText(trimmedName),
    );
    if (duplicate) {
      onNotify('Já existe um grupo com esse nome.', 'error');
      return;
    }

    const nextOrder =
      orderedGroups.reduce((max, g) => Math.max(max, g.sortOrder), 0) + 1;

    onSaveGroup({
      id: `grp-${generateId()}`,
      name: trimmedName,
      overseerName: newOverseerName.trim(),
      overseerWhatsapp: newOverseerWhatsapp.trim(),
      notes: newGroupNotes.trim(),
      sortOrder: nextOrder,
    });

    setNewGroupName('');
    setNewOverseerName('');
    setNewOverseerWhatsapp('');
    setNewGroupNotes('');
    setShowGroupManager(false);
  };

  const startEditGroup = (group: ServiceGroup) => {
    setEditingGroupId(group.id);
    setEditName(group.name);
    setEditOverseerName(group.overseerName);
    setEditOverseerWhatsapp(group.overseerWhatsapp);
    setEditNotes(group.notes);
    setConfirmDeleteId(null);
  };

  const handleSaveGroupEdit = (group: ServiceGroup) => {
    const trimmedName = editName.trim();
    if (!trimmedName) {
      onNotify('O nome do grupo não pode ficar vazio.', 'error');
      return;
    }

    onSaveGroup(
      {
        ...group,
        name: trimmedName,
        overseerName: editOverseerName.trim(),
        overseerWhatsapp: editOverseerWhatsapp.trim(),
        notes: editNotes.trim(),
      },
      group.name,
    );
    setEditingGroupId(null);
  };

  const getPhoneValue = (pub: Publisher) =>
    phoneDrafts[pub.id] !== undefined ? phoneDrafts[pub.id] : (pub.phone ?? '');

  const handlePhoneChange = (pubId: string, value: string) => {
    setPhoneDrafts((prev) => ({ ...prev, [pubId]: value }));
    setSavedIds((prev) => ({ ...prev, [pubId]: false }));
  };

  const handleSaveNumber = async (pub: Publisher) => {
    const draft = getPhoneValue(pub).trim();
    setSavingIds((prev) => ({ ...prev, [pub.id]: true }));
    const ok = await onSavePhone(pub, draft);
    setSavingIds((prev) => ({ ...prev, [pub.id]: false }));
    if (ok) {
      setPhoneDrafts((prev) => {
        const next = { ...prev };
        delete next[pub.id];
        return next;
      });
      setSavedIds((prev) => ({ ...prev, [pub.id]: true }));
      setTimeout(() => {
        setSavedIds((prev) => ({ ...prev, [pub.id]: false }));
      }, 2500);
    }
  };

  const buildOverseerWhatsAppUrl = (
    group: ServiceGroup,
    total: number,
    received: number,
    pending: Publisher[],
  ): string | null => {
    const greeting = group.overseerName
      ? `Olá, ${group.overseerName}!`
      : `Olá, responsável pelo grupo ${group.name}!`;

    const lines = [
      greeting,
      '',
      `Resumo dos relatórios — *${group.name}* (${formatMonthLabel(monthKey)}):`,
      `• Publicadores ativos: ${total}`,
      `• Recebidos: ${received}`,
      `• Pendentes: ${pending.length}`,
    ];

    if (pending.length > 0) {
      lines.push('', '*Quem falta relatar:*');
      pending.forEach((p) => lines.push(`• ${p.name}`));
    } else {
      lines.push('', 'Todos os publicadores do grupo já relataram este mês!');
    }

    return buildWhatsAppUrl(group.overseerWhatsapp, lines.join('\n'));
  };

  return (
    <div className="space-y-6">
      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Users className="w-4 h-4 text-blue-700 dark:text-blue-400" />
              Relatórios por Grupo de Serviço — {formatMonthLabel(monthKey)}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Totais calculados automaticamente com base nos publicadores ativos e relatórios recebidos no mês.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setShowGroupManager((prev) => !prev)}
              className="h-9 px-3.5 text-xs font-medium text-white bg-blue-700 dark:bg-blue-600 rounded-md hover:bg-blue-800 dark:hover:bg-blue-500 transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              {showGroupManager ? 'Fechar Novo Grupo' : 'Novo Grupo'}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-md p-3.5">
            <div className="text-xs text-slate-500 dark:text-slate-400">Grupos Cadastrados</div>
            <div className="mt-1 text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100">
              {orderedGroups.length}
            </div>
          </div>
          <div className="bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-md p-3.5">
            <div className="text-xs text-slate-500 dark:text-slate-400">Publicadores Ativos</div>
            <div className="mt-1 text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100">
              {totals.total}
            </div>
          </div>
          <div className="bg-emerald-50/70 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-md p-3.5">
            <div className="text-xs text-emerald-800 dark:text-emerald-300">✅ Relatórios Recebidos</div>
            <div className="mt-1 text-2xl font-bold font-mono tabular-nums text-emerald-700 dark:text-emerald-400">
              {totals.received}
            </div>
          </div>
          <div className="bg-red-50/70 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-md p-3.5">
            <div className="text-xs text-red-800 dark:text-red-300">❌ Relatórios Pendentes</div>
            <div className="mt-1 text-2xl font-bold font-mono tabular-nums text-red-700 dark:text-red-400">
              {totals.pending}
            </div>
          </div>
        </div>

        {showGroupManager && (
          <form
            onSubmit={handleCreateGroup}
            className="pt-4 border-t border-slate-200 dark:border-slate-800 grid grid-cols-1 md:grid-cols-12 gap-3"
          >
            <div className="md:col-span-3">
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                Nome do Grupo *
              </label>
              <input
                type="text"
                required
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                placeholder="Ex.: Salão do Reino 1"
                className="w-full h-9 px-3 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>
            <div className="md:col-span-3">
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                Responsável pelo Grupo
              </label>
              <input
                type="text"
                value={newOverseerName}
                onChange={(e) => setNewOverseerName(e.target.value)}
                placeholder="Nome do responsável"
                className="w-full h-9 px-3 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>
            <div className="md:col-span-3">
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                WhatsApp do Responsável
              </label>
              <input
                type="tel"
                inputMode="tel"
                value={newOverseerWhatsapp}
                onChange={(e) => setNewOverseerWhatsapp(e.target.value)}
                placeholder="(11) 99999-9999"
                className="w-full h-9 px-3 text-sm font-mono bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>
            <div className="md:col-span-3 flex items-end gap-2">
              <div className="flex-1">
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Observações
                </label>
                <input
                  type="text"
                  value={newGroupNotes}
                  onChange={(e) => setNewGroupNotes(e.target.value)}
                  placeholder="Opcional"
                  className="w-full h-9 px-3 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>
              <button
                type="submit"
                className="h-9 px-4 text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                Adicionar
              </button>
            </div>
          </form>
        )}
      </section>

      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {groupStats.map(({ group, members, received, pending }) => {
          const isSelected = selectedGroupId === group.id;
          const pct = members.length > 0 ? Math.round((received.length / members.length) * 100) : 0;

          return (
            <div
              key={group.id}
              onClick={() =>
                setSelectedGroupId((prev) => (prev === group.id ? 'all' : group.id))
              }
              className={`text-left bg-white dark:bg-slate-900 rounded-lg border p-4 transition-all cursor-pointer ${
                isSelected
                  ? 'border-blue-600 ring-2 ring-blue-500/20 dark:border-blue-400'
                  : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    {group.name}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Responsável: {group.overseerName || 'Não definido'}
                  </p>
                </div>
                <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                  {pct}%
                </span>
              </div>

              <div className="mt-3 h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-600 dark:bg-emerald-500 transition-all"
                  style={{ width: `${pct}%` }}
                />
              </div>

              <div className="mt-3 flex items-center justify-between text-xs">
                <span className="text-slate-600 dark:text-slate-400">
                  Total: <strong className="font-mono text-slate-900 dark:text-slate-100">{members.length}</strong>
                </span>
                <span className="text-emerald-700 dark:text-emerald-400 font-medium">
                  ✅ {received.length}
                </span>
                <span className="text-red-700 dark:text-red-400 font-medium">
                  ❌ {pending.length}
                </span>
              </div>
            </div>
          );
        })}
      </section>

      {selectedGroupId !== 'all' && (
        <div className="flex items-center justify-between bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 rounded-md px-4 py-2 text-xs text-blue-900 dark:text-blue-200">
          <span>Exibindo apenas o grupo selecionado.</span>
          <button
            type="button"
            onClick={() => setSelectedGroupId('all')}
            className="font-semibold underline hover:no-underline cursor-pointer"
          >
            Mostrar todos os grupos
          </button>
        </div>
      )}

      {unassignedPublishers.length > 0 && (
        <section className="bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-4 space-y-3">
          <div>
            <h3 className="text-sm font-semibold text-amber-950 dark:text-amber-200">
              Publicadores sem Grupo Vinculado ({unassignedPublishers.length})
            </h3>
            <p className="text-xs text-amber-800 dark:text-amber-300 mt-0.5">
              Vincule cada publicador abaixo ao seu grupo de serviço (ou edite diretamente na aba Cadastro).
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {unassignedPublishers.map((pub) => (
              <div
                key={pub.id}
                className="flex items-center justify-between gap-2 bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-800/70 rounded-md px-3 py-2"
              >
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate">
                    {pub.name}
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                    Atual: {pub.group || 'Sem Grupo'}
                  </div>
                </div>
                <select
                  aria-label={`Vincular ${pub.name} a um grupo`}
                  defaultValue=""
                  onChange={(e) => {
                    const target = orderedGroups.find((g) => g.id === e.target.value);
                    if (target) onAssignPublisherGroup(pub, target);
                  }}
                  className="h-8 px-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded text-slate-900 dark:text-slate-100 max-w-[155px]"
                >
                  <option value="" disabled>
                    Escolher grupo...
                  </option>
                  {orderedGroups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="space-y-6">
        {visibleGroupStats.map(({ group, members, received, pending }) => {
          const isEditing = editingGroupId === group.id;
          const isConfirmingDelete = confirmDeleteId === group.id;
          const overseerWaUrl = buildOverseerWhatsAppUrl(
            group,
            members.length,
            received.length,
            pending,
          );
          const availableToAdd = activePublishers.filter(
            (p) => !publisherBelongsToGroup(p, group),
          );
          const selectedAssignPubId = assignSelectByGroup[group.id] || '';

          return (
            <section
              key={group.id}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden"
            >
              <div className="px-5 py-4 bg-slate-50 dark:bg-slate-900/70 border-b border-slate-200 dark:border-slate-800">
                {isEditing ? (
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                    <div className="md:col-span-3">
                      <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
                        Nome do Grupo
                      </label>
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="w-full h-8 px-2.5 text-sm bg-white dark:bg-slate-800 border border-blue-400 rounded text-slate-900 dark:text-slate-100"
                      />
                    </div>
                    <div className="md:col-span-3">
                      <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
                        Responsável
                      </label>
                      <input
                        type="text"
                        value={editOverseerName}
                        onChange={(e) => setEditOverseerName(e.target.value)}
                        placeholder="Nome do responsável"
                        className="w-full h-8 px-2.5 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded text-slate-900 dark:text-slate-100"
                      />
                    </div>
                    <div className="md:col-span-3">
                      <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
                        WhatsApp do Responsável
                      </label>
                      <input
                        type="tel"
                        inputMode="tel"
                        value={editOverseerWhatsapp}
                        onChange={(e) => setEditOverseerWhatsapp(e.target.value)}
                        placeholder="(11) 99999-9999"
                        className="w-full h-8 px-2.5 text-sm font-mono bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded text-slate-900 dark:text-slate-100"
                      />
                    </div>
                    <div className="md:col-span-3 flex items-end gap-2">
                      <div className="flex-1">
                        <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
                          Observações
                        </label>
                        <input
                          type="text"
                          value={editNotes}
                          onChange={(e) => setEditNotes(e.target.value)}
                          className="w-full h-8 px-2.5 text-sm bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded text-slate-900 dark:text-slate-100"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => handleSaveGroupEdit(group)}
                        className="h-8 px-2.5 text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded inline-flex items-center gap-1 cursor-pointer"
                      >
                        <Check className="w-3.5 h-3.5" />
                        Salvar
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingGroupId(null)}
                        className="h-8 px-2 text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 rounded cursor-pointer"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2.5">
                        <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                          {group.name}
                        </h3>
                        <span className="px-2 py-0.5 text-xs font-medium rounded bg-slate-200/70 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                          {members.length} publicadores
                        </span>
                        <span className="px-2 py-0.5 text-xs font-medium rounded bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300">
                          ✅ {received.length} recebidos
                        </span>
                        <span className="px-2 py-0.5 text-xs font-medium rounded bg-red-100 dark:bg-red-950/60 text-red-800 dark:text-red-300">
                          ❌ {pending.length} pendentes
                        </span>
                      </div>
                      <div className="mt-1 text-xs text-slate-600 dark:text-slate-400 flex flex-wrap gap-x-4 gap-y-1">
                        <span>
                          <strong>Responsável:</strong> {group.overseerName || 'Não informado'}
                        </span>
                        {group.overseerWhatsapp && (
                          <span className="font-mono">
                            <strong>WhatsApp:</strong> {group.overseerWhatsapp}
                          </span>
                        )}
                        {group.notes && (
                          <span>
                            <strong>Obs.:</strong> {group.notes}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {overseerWaUrl && (
                        <a
                          href={overseerWaUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="h-8 px-3 text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded transition-colors inline-flex items-center gap-1.5 whitespace-nowrap"
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                          Resumo ao Responsável
                        </a>
                      )}
                      <button
                        type="button"
                        onClick={() => startEditGroup(group)}
                        className="h-8 px-2.5 text-xs font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded hover:bg-slate-100 dark:hover:bg-slate-700 inline-flex items-center gap-1 cursor-pointer"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                        Editar Grupo
                      </button>

                      {isConfirmingDelete ? (
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              onDeleteGroup(group.id);
                              setConfirmDeleteId(null);
                              if (selectedGroupId === group.id) {
                                setSelectedGroupId('all');
                              }
                            }}
                            className="h-8 px-2.5 text-xs font-medium text-white bg-red-600 hover:bg-red-700 rounded cursor-pointer"
                          >
                            Confirmar Exclusão
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(null)}
                            className="h-8 px-2 text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 rounded cursor-pointer"
                          >
                            Cancelar
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(group.id)}
                          aria-label={`Excluir grupo ${group.name}`}
                          className="h-8 px-2.5 text-xs font-medium text-red-700 dark:text-red-400 bg-white dark:bg-slate-800 border border-red-200 dark:border-red-900 rounded hover:bg-red-50 dark:hover:bg-red-950/50 inline-flex items-center gap-1 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Excluir
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="px-5 py-3 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="text-xs font-medium text-slate-600 dark:text-slate-400">
                  Membros do Grupo ({members.length})
                </div>
                {availableToAdd.length > 0 && (
                  <div className="flex items-center gap-2">
                    <select
                      aria-label={`Selecionar publicador para ${group.name}`}
                      value={selectedAssignPubId}
                      onChange={(e) =>
                        setAssignSelectByGroup((prev) => ({
                          ...prev,
                          [group.id]: e.target.value,
                        }))
                      }
                      className="h-8 px-2.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded text-slate-900 dark:text-slate-100 max-w-[240px]"
                    >
                      <option value="">Adicionar publicador a este grupo...</option>
                      {availableToAdd.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({p.group || 'Sem Grupo'})
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      disabled={!selectedAssignPubId}
                      onClick={() => {
                        const pub = availableToAdd.find((p) => p.id === selectedAssignPubId);
                        if (!pub) return;
                        onAssignPublisherGroup(pub, group);
                        setAssignSelectByGroup((prev) => ({ ...prev, [group.id]: '' }));
                      }}
                      className="h-8 px-3 text-xs font-medium text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 rounded hover:bg-blue-100 dark:hover:bg-blue-900/60 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-1 cursor-pointer"
                    >
                      <UserPlus className="w-3.5 h-3.5" />
                      Vincular
                    </button>
                  </div>
                )}
              </div>

              {members.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-500 dark:text-slate-400">
                  Nenhum publicador vinculado a este grupo ainda. Selecione um publicador acima ou na aba Cadastro.
                </div>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {pending.length > 0 ? (
                    <div className="p-5 bg-red-50/40 dark:bg-red-950/15 space-y-3">
                      <h4 className="text-xs font-semibold uppercase tracking-wide text-red-800 dark:text-red-300">
                        ❌ Quem Falta Relatar ({pending.length})
                      </h4>
                      <div className="overflow-x-auto">
                        <table className="w-full border-collapse text-left">
                          <thead>
                            <tr className="text-[11px] font-semibold text-red-900 dark:text-red-200 border-b border-red-200 dark:border-red-900/60">
                              <th className="py-2 pr-3">Publicador</th>
                              <th className="py-2 px-3">Privilégio</th>
                              <th className="py-2 px-3">WhatsApp</th>
                              <th className="py-2 pl-3 text-right">Ações</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-red-200/60 dark:divide-red-900/40 text-xs">
                            {pending.map((pub) => {
                              const phoneDraft = getPhoneValue(pub);
                              const savedPhone = pub.phone ?? '';
                              const isDirty = phoneDraft.trim() !== savedPhone.trim();
                              const isSaving = Boolean(savingIds[pub.id]);
                              const isJustSaved = Boolean(savedIds[pub.id]);
                              const waUrl = buildReminderWhatsAppUrl(phoneDraft);
                              const normalizedPreview = normalizePhoneDigits(phoneDraft);

                              return (
                                <tr key={pub.id}>
                                  <td className="py-2 pr-3 font-semibold text-red-950 dark:text-red-100">
                                    • {pub.name}
                                  </td>
                                  <td className="py-2 px-3 whitespace-nowrap">
                                    <span
                                      className={`inline-block px-2 py-0.5 text-[11px] font-medium rounded border ${getPrivilegeBadgeClasses(pub.privilege)}`}
                                    >
                                      {pub.privilege}
                                    </span>
                                  </td>
                                  <td className="py-2 px-3">
                                    <input
                                      type="tel"
                                      inputMode="tel"
                                      value={phoneDraft}
                                      onChange={(e) => handlePhoneChange(pub.id, e.target.value)}
                                      placeholder="(11) 99999-9999"
                                      title={
                                        normalizedPreview
                                          ? `wa.me/${normalizedPreview}`
                                          : 'Informe DDD + número'
                                      }
                                      className="w-36 h-7 px-2 text-xs font-mono bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded text-slate-900 dark:text-slate-100"
                                    />
                                  </td>
                                  <td className="py-2 pl-3 text-right">
                                    <div className="inline-flex items-center justify-end gap-1.5">
                                      <button
                                        type="button"
                                        disabled={isSaving || !isDirty}
                                        onClick={() => handleSaveNumber(pub)}
                                        className={`h-7 px-2 text-[11px] font-medium rounded border inline-flex items-center gap-1 whitespace-nowrap ${
                                          isJustSaved
                                            ? 'bg-emerald-600 text-white border-emerald-600'
                                            : isDirty
                                              ? 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 border-slate-300 dark:border-slate-600 cursor-pointer'
                                              : 'bg-slate-50 dark:bg-slate-800/50 text-slate-400 border-slate-200 dark:border-slate-700 opacity-70 cursor-not-allowed'
                                        }`}
                                      >
                                        <Save className="w-3 h-3" />
                                        {isSaving ? '...' : isJustSaved ? 'Salvo' : 'Salvar'}
                                      </button>

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
                                          className="h-7 px-2.5 text-[11px] font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded inline-flex items-center gap-1 whitespace-nowrap"
                                        >
                                          📱 Lembrete
                                        </a>
                                      ) : (
                                        <button
                                          type="button"
                                          disabled
                                          title="Informe um número com DDD"
                                          className="h-7 px-2.5 text-[11px] font-medium text-slate-400 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded opacity-60 cursor-not-allowed whitespace-nowrap"
                                        >
                                          📱 Lembrete
                                        </button>
                                      )}

                                      <button
                                        type="button"
                                        onClick={() => onQuickRegister(pub)}
                                        className="h-7 px-2.5 text-[11px] font-medium text-white bg-blue-700 hover:bg-blue-800 rounded whitespace-nowrap cursor-pointer"
                                      >
                                        Registrar
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ) : (
                    <div className="px-5 py-3 bg-emerald-50/60 dark:bg-emerald-950/20 text-xs font-medium text-emerald-800 dark:text-emerald-300">
                      ✅ Todos os {members.length} publicadores deste grupo já entregaram o relatório!
                    </div>
                  )}

                  {received.length > 0 && (
                    <div className="px-5 py-3">
                      <h4 className="text-xs font-semibold uppercase tracking-wide text-emerald-800 dark:text-emerald-300 mb-2">
                        ✅ Já Relataram ({received.length})
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {received.map((pub) => (
                          <span
                            key={pub.id}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs bg-emerald-50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-800 rounded"
                          >
                            • {pub.name}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
