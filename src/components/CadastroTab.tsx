import { Check, FileUp, Pencil, Plus, Search, Trash2, X } from 'lucide-react';
import { FormEvent, useMemo, useState } from 'react';
import { PrivilegeType, Publisher, ServiceGroup } from '../types';
import { cleanDisplayName, normalizeText } from '../utils/formatters';

interface CadastroTabProps {
  publishers: Publisher[];
  serviceGroups?: ServiceGroup[];
  submittedNormNames: Set<string>;
  onAddPublisher: (pub: Omit<Publisher, 'id'>) => void;
  onUpdatePublisher: (pub: Publisher) => void;
  onDeletePublisher: (id: string) => void;
  onClearAllPublishers: () => void;
  onRestoreDefaultList: () => void;
  onOpenImport: () => void;
}

const PRIVILEGES: PrivilegeType[] = [
  'Publicador',
  'Pioneiro Auxiliar',
  'Pioneiro Regular',
  'Servo Ministerial',
  'Ancião',
];

export function CadastroTab({
  publishers,
  serviceGroups = [],
  submittedNormNames,
  onAddPublisher,
  onUpdatePublisher,
  onDeletePublisher,
  onClearAllPublishers,
  onRestoreDefaultList,
  onOpenImport,
}: CadastroTabProps) {
  const [search, setSearch] = useState('');
  const [newName, setNewName] = useState('');
  const [newGroupId, setNewGroupId] = useState('');
  const [newPrivilege, setNewPrivilege] = useState<PrivilegeType>('Publicador');
  const [duplicateMatch, setDuplicateMatch] = useState<{
    existing: Publisher;
    nextGroup: string;
    nextGroupId?: string;
    nextPrivilege: PrivilegeType;
  } | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editGroupId, setEditGroupId] = useState('');
  const [editLegacyGroup, setEditLegacyGroup] = useState('');
  const [editPrivilege, setEditPrivilege] = useState<PrivilegeType>('Publicador');
  const [confirmClear, setConfirmClear] = useState(false);

  const orderedGroups = useMemo(
    () =>
      [...serviceGroups].sort(
        (a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, 'pt-BR'),
      ),
    [serviceGroups],
  );

  const groupById = useMemo(() => {
    const map = new Map<string, ServiceGroup>();
    orderedGroups.forEach((g) => map.set(g.id, g));
    return map;
  }, [orderedGroups]);

  const resolveGroupName = (pub: Publisher): string => {
    if (pub.groupId) {
      const found = groupById.get(pub.groupId);
      if (found) return found.name;
    }
    return pub.group || 'Sem Grupo';
  };

  const sortedPublishers = useMemo(() => {
    const normQuery = normalizeText(search);
    return [...publishers]
      .filter((p) => {
        if (!normQuery) return true;
        const resolvedGroup = resolveGroupName(p);
        return (
          normalizeText(p.name).includes(normQuery) ||
          normalizeText(resolvedGroup).includes(normQuery) ||
          normalizeText(p.privilege).includes(normQuery)
        );
      })
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  }, [publishers, search, groupById]);

  const handleAddSubmit = (e: FormEvent) => {
    e.preventDefault();
    const cleaned = cleanDisplayName(newName);
    if (!cleaned) return;

    const chosenGroup = newGroupId ? groupById.get(newGroupId) : undefined;
    const nextGroup = chosenGroup ? chosenGroup.name : 'Sem Grupo';
    const nextGroupId = chosenGroup ? chosenGroup.id : undefined;

    const existing = publishers.find(
      (p) => normalizeText(p.name) === normalizeText(cleaned),
    );
    if (existing) {
      setDuplicateMatch({
        existing,
        nextGroup,
        nextGroupId,
        nextPrivilege: newPrivilege,
      });
      return;
    }

    setDuplicateMatch(null);
    onAddPublisher({
      name: cleaned,
      group: nextGroup,
      groupId: nextGroupId,
      privilege: newPrivilege,
      active: true,
    });
    setNewName('');
  };

  const handleConfirmUpdateDuplicate = () => {
    if (!duplicateMatch) return;
    onUpdatePublisher({
      ...duplicateMatch.existing,
      group: duplicateMatch.nextGroup,
      groupId: duplicateMatch.nextGroupId,
      privilege: duplicateMatch.nextPrivilege,
      active: true,
    });
    setDuplicateMatch(null);
    setNewName('');
  };

  const startEdit = (pub: Publisher) => {
    setEditingId(pub.id);
    setEditName(pub.name);
    setEditPrivilege(pub.privilege);

    if (pub.groupId && groupById.has(pub.groupId)) {
      setEditGroupId(pub.groupId);
      setEditLegacyGroup('');
      return;
    }

    const matchedByName = orderedGroups.find(
      (g) => normalizeText(g.name) === normalizeText(pub.group || ''),
    );
    if (matchedByName) {
      setEditGroupId(matchedByName.id);
      setEditLegacyGroup('');
    } else if (pub.group && normalizeText(pub.group) !== 'SEM GRUPO') {
      setEditGroupId('__legacy__');
      setEditLegacyGroup(pub.group);
    } else {
      setEditGroupId('');
      setEditLegacyGroup('');
    }
  };

  const saveEdit = (pub: Publisher) => {
    const cleaned = cleanDisplayName(editName);
    if (!cleaned) return;

    let nextGroup = 'Sem Grupo';
    let nextGroupId: string | undefined;

    if (editGroupId === '__legacy__') {
      nextGroup = editLegacyGroup || pub.group || 'Sem Grupo';
      nextGroupId = undefined;
    } else if (editGroupId) {
      const chosen = groupById.get(editGroupId);
      if (chosen) {
        nextGroup = chosen.name;
        nextGroupId = chosen.id;
      }
    }

    onUpdatePublisher({
      ...pub,
      name: cleaned,
      group: nextGroup,
      groupId: nextGroupId,
      privilege: editPrivilege,
    });
    setEditingId(null);
  };

  const activeCount = publishers.filter((p) => p.active).length;

  return (
    <div className="space-y-6">
      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              Cadastrar Novo Publicador
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Adicione manualmente ou importe uma lista completa de um arquivo Word (.docx) ou planilha.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onRestoreDefaultList}
              className="h-9 px-3 text-xs font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Restaurar Lista Oficial (101)
            </button>
            <button
              type="button"
              onClick={onOpenImport}
              className="h-9 px-4 text-xs font-medium text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 rounded-md hover:bg-blue-100 dark:hover:bg-blue-900/60 transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <FileUp className="w-4 h-4" />
              Importar Word / Excel
            </button>
          </div>
        </div>

        <form onSubmit={handleAddSubmit} className="grid grid-cols-1 md:grid-cols-12 gap-3">
          <div className="md:col-span-5">
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
              Nome completo
            </label>
            <input
              type="text"
              value={newName}
              onChange={(e) => {
                setNewName(e.target.value);
                if (duplicateMatch) setDuplicateMatch(null);
              }}
              placeholder="Ex.: MARIA JOSÉ DA SILVA"
              required
              className="w-full h-9 px-3 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>
          <div className="md:col-span-3">
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
              Grupo de Serviço
            </label>
            <select
              value={newGroupId}
              onChange={(e) => setNewGroupId(e.target.value)}
              className="w-full h-9 px-3 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600"
            >
              <option value="">Sem Grupo</option>
              {orderedGroups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
              Privilégio
            </label>
            <select
              value={newPrivilege}
              onChange={(e) => setNewPrivilege(e.target.value as PrivilegeType)}
              className="w-full h-9 px-3 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600"
            >
              {PRIVILEGES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
          <div className="md:col-span-2 flex items-end">
            <button
              type="submit"
              className="w-full h-9 px-4 text-xs font-medium text-white bg-blue-700 dark:bg-blue-600 rounded-md hover:bg-blue-800 dark:hover:bg-blue-500 transition-colors flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Adicionar
            </button>
          </div>
        </form>

        {duplicateMatch && (
          <div className="mt-3 p-3.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-md flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="text-xs text-amber-950 dark:text-amber-200">
              <strong>{duplicateMatch.existing.name}</strong> já está na lista de cadastro (Grupo atual:{' '}
              <strong>{resolveGroupName(duplicateMatch.existing)}</strong> · Privilégio atual:{' '}
              <strong>{duplicateMatch.existing.privilege}</strong>). Deseja atualizar para{' '}
              <strong>{duplicateMatch.nextGroup}</strong> / <strong>{duplicateMatch.nextPrivilege}</strong>?
            </div>
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleConfirmUpdateDuplicate}
                className="h-8 px-3 text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded cursor-pointer"
              >
                Atualizar Cadastro Existente
              </button>
              <button
                type="button"
                onClick={() => {
                  setSearch(duplicateMatch.existing.name);
                  startEdit(duplicateMatch.existing);
                  setDuplicateMatch(null);
                }}
                className="h-8 px-3 text-xs font-medium text-amber-900 dark:text-amber-200 bg-white dark:bg-slate-800 border border-amber-300 dark:border-amber-700 rounded hover:bg-amber-100/70 cursor-pointer"
              >
                Localizar na Lista
              </button>
              <button
                type="button"
                onClick={() => setDuplicateMatch(null)}
                className="h-8 px-2.5 text-xs text-slate-600 dark:text-slate-300 hover:bg-amber-100/60 dark:hover:bg-slate-800 rounded cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </div>
        )}
      </section>

      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3 text-sm text-slate-700 dark:text-slate-300">
            <span className="font-semibold text-slate-900 dark:text-slate-100">Lista de Cadastro</span>
            <span aria-hidden="true" className="text-slate-300 dark:text-slate-700">
              ·
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
              {activeCount} ativos / {publishers.length} total
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Filtrar cadastro..."
                className="w-full h-9 pl-9 pr-3 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>

            {publishers.length > 0 && !confirmClear && (
              <button
                type="button"
                onClick={() => setConfirmClear(true)}
                className="h-9 px-3 text-xs font-medium text-red-700 dark:text-red-400 bg-white dark:bg-slate-800 border border-red-200 dark:border-red-900/60 rounded-md hover:bg-red-50 dark:hover:bg-red-950/50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                Limpar Cadastro
              </button>
            )}

            {confirmClear && (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    onClearAllPublishers();
                    setConfirmClear(false);
                  }}
                  className="h-9 px-3 text-xs font-medium text-white bg-red-600 rounded-md hover:bg-red-700 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  Confirmar Limpeza
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmClear(false)}
                  className="h-9 px-3 text-xs font-medium text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 rounded-md hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  Cancelar
                </button>
              </div>
            )}
          </div>
        </div>

        {publishers.length === 0 ? (
          <div className="p-12 text-center">
            <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">Cadastro vazio</h3>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto">
              Use o formulário acima para cadastrar manualmente ou clique em Importar Word / Excel para carregar sua planilha.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="bg-emerald-50 dark:bg-emerald-950/60 border-b border-emerald-200 dark:border-emerald-900 text-xs font-semibold text-emerald-950 dark:text-emerald-200">
                  <th className="py-2.5 px-4 w-12 text-right font-mono">#</th>
                  <th className="py-2.5 px-4">CABEÇALHO / NOME</th>
                  <th className="py-2.5 px-4">Grupo</th>
                  <th className="py-2.5 px-4">Privilégio</th>
                  <th className="py-2.5 px-4">Situação</th>
                  <th className="py-2.5 px-4">Relatório Mês</th>
                  <th className="py-2.5 px-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 text-sm">
                {sortedPublishers.map((pub, index) => {
                  const isEditing = editingId === pub.id;
                  const hasReported = submittedNormNames.has(normalizeText(pub.name));
                  return (
                    <tr key={pub.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors">
                      <td className="py-2.5 px-4 text-right text-xs text-slate-400 dark:text-slate-500 font-mono tabular-nums">
                        {index + 1}
                      </td>
                      <td className="py-2.5 px-4 font-medium text-slate-900 dark:text-slate-100">
                        {isEditing ? (
                          <input
                            type="text"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            className="w-full h-8 px-2 text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 border border-blue-400 dark:border-blue-500 rounded focus:outline-none focus:ring-2 focus:ring-blue-600"
                          />
                        ) : (
                          pub.name
                        )}
                      </td>
                      <td className="py-2.5 px-4 text-xs text-slate-600 dark:text-slate-400">
                        {isEditing ? (
                          <select
                            value={editGroupId}
                            onChange={(e) => setEditGroupId(e.target.value)}
                            className="h-8 px-2 text-xs bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 border border-blue-400 dark:border-blue-500 rounded focus:outline-none focus:ring-2 focus:ring-blue-600"
                          >
                            {editLegacyGroup && (
                              <option value="__legacy__">
                                Atual ({editLegacyGroup})
                              </option>
                            )}
                            <option value="">Sem Grupo</option>
                            {orderedGroups.map((g) => (
                              <option key={g.id} value={g.id}>
                                {g.name}
                              </option>
                            ))}
                          </select>
                        ) : (
                          resolveGroupName(pub)
                        )}
                      </td>
                      <td className="py-2.5 px-4 text-xs text-slate-600 dark:text-slate-400">
                        {isEditing ? (
                          <select
                            value={editPrivilege}
                            onChange={(e) => setEditPrivilege(e.target.value as PrivilegeType)}
                            className="h-8 px-2 text-xs bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 border border-blue-400 dark:border-blue-500 rounded focus:outline-none focus:ring-2 focus:ring-blue-600"
                          >
                            {PRIVILEGES.map((p) => (
                              <option key={p} value={p}>
                                {p}
                              </option>
                            ))}
                          </select>
                        ) : (
                          pub.privilege
                        )}
                      </td>
                      <td className="py-2.5 px-4">
                        <button
                          type="button"
                          onClick={() => onUpdatePublisher({ ...pub, active: !pub.active })}
                          className={`px-2 py-0.5 text-xs font-medium rounded border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                            pub.active
                              ? 'bg-emerald-50 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 dark:hover:bg-emerald-900/60'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700'
                          }`}
                        >
                          {pub.active ? 'Ativo' : 'Inativo'}
                        </button>
                      </td>
                      <td className="py-2.5 px-4 text-xs">
                        {!pub.active ? (
                          <span className="text-slate-400 dark:text-slate-600">—</span>
                        ) : hasReported ? (
                          <span className="text-emerald-700 dark:text-emerald-400 font-medium">Entregue</span>
                        ) : (
                          <span className="text-red-700 dark:text-red-400 font-medium">Pendente</span>
                        )}
                      </td>
                      <td className="py-2.5 px-4 text-right">
                        {isEditing ? (
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => saveEdit(pub)}
                              aria-label="Salvar edição"
                              className="p-1.5 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/60 rounded cursor-pointer"
                            >
                              <Check className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingId(null)}
                              aria-label="Cancelar edição"
                              className="p-1.5 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded cursor-pointer"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => startEdit(pub)}
                              aria-label={`Editar ${pub.name}`}
                              className="p-1.5 text-slate-500 dark:text-slate-400 hover:text-blue-700 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/60 rounded cursor-pointer"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => onDeletePublisher(pub.id)}
                              aria-label={`Remover ${pub.name}`}
                              className="p-1.5 text-slate-500 dark:text-slate-400 hover:text-red-700 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/60 rounded cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        )}
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
