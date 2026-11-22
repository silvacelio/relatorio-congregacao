import { Calendar, FileSpreadsheet, FileText, FileUp, Moon, Plus, Printer, Settings, Sun } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { AccessGate } from './components/AccessGate';
import { CadastroTab } from './components/CadastroTab';
import { ImportModal } from './components/ImportModal';
import { QuemFaltaTab } from './components/QuemFaltaTab';
import { ReportModal } from './components/ReportModal';
import { RespostaTab } from './components/RespostaTab';
import { RespostasFormTab } from './components/RespostasFormTab';
import { SettingsModal } from './components/SettingsModal';
import {
  DEFAULT_MONTH_KEY,
  INITIAL_PUBLISHERS,
  INITIAL_REPORTS,
} from './data/initialData';
import {
  DEFAULT_PORTAL_SETTINGS,
  dbClearPublishers,
  dbDeletePublisher,
  dbDeleteReport,
  dbFetchAll,
  dbFetchPortalSettings,
  dbSavePortalSettings,
  dbUpsertPublishers,
  dbUpsertReports,
  isSupabaseConfigured,
  supabase,
} from './lib/supabase';
import {
  ActivityReport,
  AuxiliaryPioneerOption,
  PortalSettings,
  PrivilegeType,
  Publisher,
  TabKey,
  ToastMessage,
} from './types';
import { exportFullWorkbookXlsx, exportReportToWord } from './utils/exportData';
import {
  cleanDisplayName,
  formatMonthLabel,
  generateId,
  getMonthOptions,
  normalizeText,
} from './utils/formatters';
import { ParsedRow } from './utils/importParsers';

const STORAGE_PUBLISHERS_KEY = 'relatorio_congregacao_publishers_v1';
const STORAGE_REPORTS_KEY = 'relatorio_congregacao_reports_v1';
const STORAGE_MONTH_KEY = 'relatorio_congregacao_month_v1';
const STORAGE_THEME_KEY = 'relatorio_congregacao_theme_v1';
const STORAGE_PORTAL_SETTINGS_KEY = 'relatorio_portal_settings_v1';
const STORAGE_SESSION_UNLOCKED_KEY = 'relatorio_portal_unlocked_v1';

function loadStored<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function loadStoredPublishers(): Publisher[] {
  try {
    const raw = localStorage.getItem(STORAGE_PUBLISHERS_KEY);
    if (!raw) return INITIAL_PUBLISHERS;
    const parsed = JSON.parse(raw) as Publisher[];
    // Auto-upgrade from earlier 20-name preview seed to complete 101-name official list
    if (
      Array.isArray(parsed) &&
      parsed.length === 20 &&
      parsed.every((p, idx) => p.id === `pub-${idx + 1}`)
    ) {
      return INITIAL_PUBLISHERS;
    }
    return parsed;
  } catch {
    return INITIAL_PUBLISHERS;
  }
}

export default function App() {
  const [publishers, setPublishers] = useState<Publisher[]>(loadStoredPublishers);
  const [reports, setReports] = useState<ActivityReport[]>(() =>
    loadStored<ActivityReport[]>(STORAGE_REPORTS_KEY, INITIAL_REPORTS),
  );
  const [activeMonth, setActiveMonth] = useState<string>(() =>
    loadStored<string>(STORAGE_MONTH_KEY, DEFAULT_MONTH_KEY),
  );
  const [activeTab, setActiveTab] = useState<TabKey>('resposta');
  const [isDark, setIsDark] = useState<boolean>(() => {
    try {
      return localStorage.getItem(STORAGE_THEME_KEY) === 'dark';
    } catch {
      return false;
    }
  });

  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [modalInitialPublisher, setModalInitialPublisher] = useState<Publisher | null>(null);
  const [editingReport, setEditingReport] = useState<ActivityReport | null>(null);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [loadingCloud, setLoadingCloud] = useState<boolean>(isSupabaseConfigured);

  const [isUnlocked, setIsUnlocked] = useState<boolean>(() => {
    try {
      return sessionStorage.getItem(STORAGE_SESSION_UNLOCKED_KEY) === '1';
    } catch {
      return false;
    }
  });
  const [portalSettings, setPortalSettings] = useState<PortalSettings>(() =>
    loadStored<PortalSettings>(STORAGE_PORTAL_SETTINGS_KEY, DEFAULT_PORTAL_SETTINGS),
  );
  const [loadingSettings, setLoadingSettings] = useState<boolean>(isSupabaseConfigured);

  useEffect(() => {
    if (isSupabaseConfigured) return;
    try {
      localStorage.setItem(STORAGE_PUBLISHERS_KEY, JSON.stringify(publishers));
    } catch {
      // Ignore storage quota errors
    }
  }, [publishers]);

  useEffect(() => {
    if (isSupabaseConfigured) return;
    try {
      localStorage.setItem(STORAGE_REPORTS_KEY, JSON.stringify(reports));
    } catch {
      // Ignore storage quota errors
    }
  }, [reports]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_MONTH_KEY, JSON.stringify(activeMonth));
    } catch {
      // Ignore storage quota errors
    }
  }, [activeMonth]);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark);
    try {
      localStorage.setItem(STORAGE_THEME_KEY, isDark ? 'dark' : 'light');
    } catch {
      // Ignore storage quota errors
    }
  }, [isDark]);

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) return;
    let active = true;

    dbFetchPortalSettings()
      .then((settings) => {
        if (!active) return;
        setPortalSettings(settings);
        try {
          localStorage.setItem(STORAGE_PORTAL_SETTINGS_KEY, JSON.stringify(settings));
        } catch {
          // Ignore storage quota errors
        }
      })
      .catch(() => {
        // Fallback para padrão local caso offline ou tabela ainda não criada
      })
      .finally(() => {
        if (active) setLoadingSettings(false);
      });

    const loadFromSupabase = async () => {
      try {
        const data = await dbFetchAll();
        if (!active) return;

        const alreadySeeded = localStorage.getItem('relatorio_supabase_seeded_v1') === '1';
        if (data.publishers.length === 0 && data.reports.length === 0 && !alreadySeeded) {
          await dbUpsertPublishers(INITIAL_PUBLISHERS);
          await dbUpsertReports(INITIAL_REPORTS);
          localStorage.setItem('relatorio_supabase_seeded_v1', '1');
          if (!active) return;
          setPublishers(INITIAL_PUBLISHERS);
          setReports(INITIAL_REPORTS);
        } else {
          setPublishers(data.publishers);
          setReports(data.reports);
        }
      } catch (err) {
        if (active) {
          const msg = err instanceof Error ? err.message : 'Erro ao conectar ao Supabase.';
          notify(`Erro Supabase: ${msg}`, 'error');
        }
      } finally {
        if (active) setLoadingCloud(false);
      }
    };

    loadFromSupabase();

    const channel = supabase
      .channel('congregacao-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'publishers' },
        () => {
          dbFetchAll()
            .then((d) => {
              if (active) setPublishers(d.publishers);
            })
            .catch(() => {});
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'activity_reports' },
        () => {
          dbFetchAll()
            .then((d) => {
              if (active) setReports(d.reports);
            })
            .catch(() => {});
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'portal_settings' },
        () => {
          dbFetchPortalSettings()
            .then((settings) => {
              if (active) {
                setPortalSettings(settings);
                try {
                  localStorage.setItem(STORAGE_PORTAL_SETTINGS_KEY, JSON.stringify(settings));
                } catch {
                  // Ignore storage quota errors
                }
              }
            })
            .catch(() => {});
        },
      )
      .subscribe();

    return () => {
      active = false;
      supabase?.removeChannel(channel);
    };
  }, []);

  const notify = (text: string, tone: 'success' | 'error' | 'info' = 'success') => {
    const id = generateId();
    setToasts((prev) => [...prev, { id, text, tone }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3600);
  };

  const monthOptions = useMemo(
    () =>
      getMonthOptions(
        activeMonth,
        reports.map((r) => r.monthKey),
      ),
    [activeMonth, reports],
  );

  const registeredNamesNorm = useMemo(
    () => new Set(publishers.map((p) => normalizeText(p.name))),
    [publishers],
  );

  const submittedNormNames = useMemo(() => {
    const set = new Set<string>();
    reports
      .filter((r) => r.monthKey === activeMonth)
      .forEach((r) => set.add(normalizeText(r.publisherName)));
    return set;
  }, [reports, activeMonth]);

  const openNewReportModal = (publisher?: Publisher | null, existing?: ActivityReport | null) => {
    setModalInitialPublisher(publisher ?? null);
    setEditingReport(existing ?? null);
    setReportModalOpen(true);
  };

  const handleUnlock = () => {
    try {
      sessionStorage.setItem(STORAGE_SESSION_UNLOCKED_KEY, '1');
    } catch {
      // Ignore storage errors
    }
    setIsUnlocked(true);
  };

  const handleLockPortal = () => {
    try {
      sessionStorage.removeItem(STORAGE_SESSION_UNLOCKED_KEY);
    } catch {
      // Ignore storage errors
    }
    setSettingsModalOpen(false);
    setIsUnlocked(false);
  };

  const handleSavePortalSettings = async (next: PortalSettings): Promise<boolean> => {
    try {
      if (isSupabaseConfigured) {
        await dbSavePortalSettings(next);
      }
      setPortalSettings(next);
      try {
        localStorage.setItem(STORAGE_PORTAL_SETTINGS_KEY, JSON.stringify(next));
      } catch {
        // Ignore storage quota errors
      }
      notify('Códigos de acesso atualizados com sucesso.');
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao salvar configurações.';
      notify(`Erro ao salvar códigos: ${msg}`, 'error');
      return false;
    }
  };

  const handleUpdateAccessCode = async (newCode: string): Promise<boolean> => {
    return handleSavePortalSettings({
      ...portalSettings,
      accessCode: newCode,
    });
  };

  const handleSaveReport = (
    data: {
      publisherName: string;
      publisherId?: string;
      privilegeSnapshot: PrivilegeType;
      participated: boolean;
      hours: number | null;
      bibleStudies: number | null;
      auxiliaryPioneer: AuxiliaryPioneerOption;
      notes: string;
    },
    addToCadastroIfMissing: boolean,
    newPublisherPrivilege: PrivilegeType,
  ) => {
    let resolvedPubId = data.publisherId;

    if (addToCadastroIfMissing && !registeredNamesNorm.has(normalizeText(data.publisherName))) {
      const newPub: Publisher = {
        id: generateId(),
        name: cleanDisplayName(data.publisherName),
        group: 'Grupo 1',
        privilege: newPublisherPrivilege,
        active: true,
      };
      setPublishers((prev) => [...prev, newPub]);
      resolvedPubId = newPub.id;
      dbUpsertPublishers([newPub]).catch((err) =>
        notify(`Erro ao salvar publicador: ${err.message}`, 'error'),
      );
    }

    if (editingReport) {
      const updatedReport: ActivityReport = {
        ...editingReport,
        privilegeSnapshot: data.privilegeSnapshot,
        participated: data.participated,
        hours: data.hours,
        bibleStudies: data.bibleStudies,
        auxiliaryPioneer: data.auxiliaryPioneer,
        notes: data.notes,
      };
      setReports((prev) => prev.map((r) => (r.id === editingReport.id ? updatedReport : r)));
      dbUpsertReports([updatedReport]).catch((err) =>
        notify(`Erro ao atualizar relatório: ${err.message}`, 'error'),
      );
      notify(`Relatório de ${data.publisherName} atualizado.`);
    } else {
      const existingSameMonth = reports.find(
        (r) =>
          r.monthKey === activeMonth &&
          normalizeText(r.publisherName) === normalizeText(data.publisherName),
      );

      if (existingSameMonth) {
        const updatedReport: ActivityReport = {
          ...existingSameMonth,
          timestamp: new Date().toISOString(),
          publisherId: resolvedPubId ?? existingSameMonth.publisherId,
          privilegeSnapshot: data.privilegeSnapshot,
          participated: data.participated,
          hours: data.hours,
          bibleStudies: data.bibleStudies,
          auxiliaryPioneer: data.auxiliaryPioneer,
          notes: data.notes,
        };
        setReports((prev) =>
          prev.map((r) => (r.id === existingSameMonth.id ? updatedReport : r)),
        );
        dbUpsertReports([updatedReport]).catch((err) =>
          notify(`Erro ao atualizar relatório: ${err.message}`, 'error'),
        );
        notify(`Relatório de ${data.publisherName} atualizado para ${formatMonthLabel(activeMonth)}.`);
      } else {
        const newReport: ActivityReport = {
          id: generateId(),
          monthKey: activeMonth,
          timestamp: new Date().toISOString(),
          publisherName: cleanDisplayName(data.publisherName),
          publisherId: resolvedPubId,
          privilegeSnapshot: data.privilegeSnapshot,
          participated: data.participated,
          hours: data.hours,
          bibleStudies: data.bibleStudies,
          auxiliaryPioneer: data.auxiliaryPioneer,
          notes: data.notes,
        };
        setReports((prev) => [newReport, ...prev]);
        dbUpsertReports([newReport]).catch((err) =>
          notify(`Erro ao salvar relatório: ${err.message}`, 'error'),
        );
        notify(`Atividade de ${data.publisherName} registrada.`);
      }
    }

    setReportModalOpen(false);
    setEditingReport(null);
    setModalInitialPublisher(null);
  };

  const handleDeleteReport = (id: string) => {
    setReports((prev) => prev.filter((r) => r.id !== id));
    dbDeleteReport(id).catch((err) =>
      notify(`Erro ao excluir relatório: ${err.message}`, 'error'),
    );
    notify('Registro removido.', 'info');
  };

  const handleAddPublisher = (pub: Omit<Publisher, 'id'>) => {
    const newPub: Publisher = { ...pub, id: generateId() };
    setPublishers((prev) => [...prev, newPub]);
    dbUpsertPublishers([newPub]).catch((err) =>
      notify(`Erro ao adicionar publicador: ${err.message}`, 'error'),
    );
    notify(`${pub.name} adicionado ao cadastro.`);
  };

  const handleUpdatePublisher = (updated: Publisher) => {
    setPublishers((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
    dbUpsertPublishers([updated]).catch((err) =>
      notify(`Erro ao atualizar publicador: ${err.message}`, 'error'),
    );
    notify(`${updated.name} atualizado.`);
  };

  const handleSavePublisherPhone = async (
    publisher: Publisher,
    rawPhone: string,
  ): Promise<boolean> => {
    const cleanedPhone = rawPhone.trim();
    const updated: Publisher = {
      ...publisher,
      phone: cleanedPhone.length > 0 ? cleanedPhone : undefined,
    };

    setPublishers((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));

    try {
      await dbUpsertPublishers([updated]);
      notify(
        cleanedPhone
          ? `WhatsApp de ${publisher.name} salvo.`
          : `Número de ${publisher.name} removido.`,
      );
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Falha ao salvar no Supabase.';
      notify(`Erro ao salvar telefone: ${msg}`, 'error');
      return false;
    }
  };

  const handleDeletePublisher = (id: string) => {
    setPublishers((prev) => prev.filter((p) => p.id !== id));
    dbDeletePublisher(id).catch((err) =>
      notify(`Erro ao remover publicador: ${err.message}`, 'error'),
    );
    notify('Publicador removido do cadastro.', 'info');
  };

  const handleClearAllPublishers = () => {
    setPublishers([]);
    if (isSupabaseConfigured) {
      localStorage.setItem('relatorio_supabase_seeded_v1', '1');
      dbClearPublishers().catch((err) =>
        notify(`Erro ao limpar cadastro: ${err.message}`, 'error'),
      );
    }
    notify('Lista de cadastro limpa.', 'info');
  };

  const handleRestoreDefaultList = () => {
    setPublishers(INITIAL_PUBLISHERS);
    dbUpsertPublishers(INITIAL_PUBLISHERS).catch((err) =>
      notify(`Erro ao restaurar lista: ${err.message}`, 'error'),
    );
    notify('Lista oficial com 101 nomes restaurada.');
  };

  const handleImportToCadastro = (rows: ParsedRow[], mode: 'append' | 'replace') => {
    const seen = new Set<string>(
      mode === 'append' ? publishers.map((p) => normalizeText(p.name)) : [],
    );

    const newEntries: Publisher[] = [];
    rows.forEach((row) => {
      const cleaned = cleanDisplayName(row.name);
      const norm = normalizeText(cleaned);
      if (!cleaned || seen.has(norm)) return;
      seen.add(norm);
      newEntries.push({
        id: generateId(),
        name: cleaned,
        group: row.group || 'Grupo 1',
        privilege: row.privilege || 'Publicador',
        active: true,
      });
    });

    if (mode === 'replace') {
      setPublishers(newEntries);
      if (isSupabaseConfigured) {
        localStorage.setItem('relatorio_supabase_seeded_v1', '1');
        dbClearPublishers()
          .then(() => dbUpsertPublishers(newEntries))
          .catch((err) => notify(`Erro ao salvar no Supabase: ${err.message}`, 'error'));
      }
      notify(`Cadastro substituído com ${newEntries.length} nomes.`);
    } else {
      setPublishers((prev) => [...prev, ...newEntries]);
      dbUpsertPublishers(newEntries).catch((err) =>
        notify(`Erro ao salvar no Supabase: ${err.message}`, 'error'),
      );
      notify(`${newEntries.length} novos publicadores importados.`);
    }

    setImportModalOpen(false);
    setActiveTab('cadastro');
  };

  const handleImportToReports = (rows: ParsedRow[], autoAddMissingToCadastro: boolean) => {
    const currentNormSet = new Set(publishers.map((p) => normalizeText(p.name)));
    const addedPublishers: Publisher[] = [];

    if (autoAddMissingToCadastro) {
      rows.forEach((row) => {
        const cleaned = cleanDisplayName(row.name);
        const norm = normalizeText(cleaned);
        if (cleaned && !currentNormSet.has(norm)) {
          currentNormSet.add(norm);
          addedPublishers.push({
            id: generateId(),
            name: cleaned,
            group: row.group || 'Grupo 1',
            privilege: row.privilege || 'Publicador',
            active: true,
          });
        }
      });
    }

    if (addedPublishers.length > 0) {
      setPublishers((prev) => [...prev, ...addedPublishers]);
      dbUpsertPublishers(addedPublishers).catch((err) =>
        notify(`Erro ao cadastrar nomes no Supabase: ${err.message}`, 'error'),
      );
    }

    const pubByNorm = new Map<string, Publisher>();
    publishers.forEach((p) => pubByNorm.set(normalizeText(p.name), p));
    addedPublishers.forEach((p) => pubByNorm.set(normalizeText(p.name), p));

    const upsertedReports: ActivityReport[] = [];
    setReports((prev) => {
      const next = [...prev];
      rows.forEach((row) => {
        const cleaned = cleanDisplayName(row.name);
        const norm = normalizeText(cleaned);
        if (!cleaned) return;

        const idx = next.findIndex(
          (r) => r.monthKey === activeMonth && normalizeText(r.publisherName) === norm,
        );
        const matchedPub = pubByNorm.get(norm);

        const reportPayload: ActivityReport = {
          id: idx >= 0 ? next[idx].id : generateId(),
          monthKey: activeMonth,
          timestamp: new Date().toISOString(),
          publisherName: cleaned,
          publisherId: matchedPub?.id,
          privilegeSnapshot: matchedPub?.privilege ?? row.privilege ?? 'Publicador',
          participated: row.participated ?? true,
          hours: row.hours ?? null,
          bibleStudies: row.bibleStudies ?? null,
          auxiliaryPioneer: row.auxiliaryPioneer ?? 'Não',
          notes: row.notes ?? '',
        };

        upsertedReports.push(reportPayload);
        if (idx >= 0) {
          next[idx] = reportPayload;
        } else {
          next.unshift(reportPayload);
        }
      });
      return next;
    });

    if (upsertedReports.length > 0) {
      dbUpsertReports(upsertedReports).catch((err) =>
        notify(`Erro ao salvar respostas no Supabase: ${err.message}`, 'error'),
      );
    }

    notify(
      `${rows.length} respostas importadas para ${formatMonthLabel(activeMonth)}${
        addedPublishers.length > 0 ? ` (${addedPublishers.length} adicionados ao cadastro)` : ''
      }.`,
    );
    setImportModalOpen(false);
    setActiveTab('resposta');
  };

  const navItems: { key: TabKey; label: string }[] = [
    { key: 'resposta', label: 'Resposta' },
    { key: 'respostas', label: 'Respostas ao Formulário' },
    { key: 'cadastro', label: 'Cadastro' },
    { key: 'quem_falta', label: 'Quem Falta' },
  ];

  const activePublishersCount = publishers.filter((p) => p.active).length;
  const receivedCount = publishers.filter(
    (p) => p.active && submittedNormNames.has(normalizeText(p.name)),
  ).length;
  const pendingCount = activePublishersCount - receivedCount;

  if (!isUnlocked) {
    return (
      <AccessGate
        portalSettings={portalSettings}
        loadingSettings={loadingSettings}
        isDark={isDark}
        onToggleDark={() => setIsDark((prev) => !prev)}
        onUnlock={handleUnlock}
        onUpdateAccessCode={handleUpdateAccessCode}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100 flex flex-col transition-colors">
      {/* Top Bar Contract: [Brand title] — [4 nav links] — [1 primary action] */}
      <header className="no-print bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-8">
          <a
            href="#top"
            onClick={(e) => {
              e.preventDefault();
              setActiveTab('resposta');
            }}
            className="font-display text-lg font-bold tracking-tight text-slate-900 dark:text-slate-100 whitespace-nowrap shrink-0"
          >
            Relatório Congregação
          </a>

          <nav
            aria-label="Abas da planilha"
            className="hidden md:flex items-center gap-6 text-sm font-medium"
          >
            {navItems.map((item) => {
              const isActive = activeTab === item.key;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setActiveTab(item.key)}
                  className={`py-1 border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    isActive
                      ? 'border-blue-700 text-blue-800 dark:border-blue-400 dark:text-blue-400 font-semibold'
                      : 'border-transparent text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </nav>

          <div className="shrink-0">
            <button
              type="button"
              onClick={() => openNewReportModal(null, null)}
              className="h-9 px-4 text-xs font-medium text-white bg-blue-700 dark:bg-blue-600 rounded-md hover:bg-blue-800 dark:hover:bg-blue-500 transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Registrar Atividade
            </button>
          </div>
        </div>

        {/* Mobile Nav Strip */}
        <div className="md:hidden border-t border-slate-100 dark:border-slate-800 px-4 py-2 flex items-center gap-2 overflow-x-auto">
          {navItems.map((item) => {
            const isActive = activeTab === item.key;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => setActiveTab(item.key)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap shrink-0 cursor-pointer ${
                  isActive
                    ? 'bg-blue-50 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 font-semibold'
                    : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      </header>

      {/* Main Content Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Workspace Toolbar (Month Selector + Word/Excel Import & Export + Theme Toggle) */}
        <div className="no-print bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-4 py-3 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-slate-500 dark:text-slate-400 shrink-0" />
              <label htmlFor="month-select" className="text-xs font-medium text-slate-600 dark:text-slate-400 whitespace-nowrap">
                Mês de referência:
              </label>
              <select
                id="month-select"
                value={activeMonth}
                onChange={(e) => setActiveMonth(e.target.value)}
                className="h-8 px-2.5 text-xs font-semibold text-slate-900 dark:text-slate-100 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600"
              >
                {monthOptions.map((m) => (
                  <option key={m} value={m}>
                    {formatMonthLabel(m)}
                  </option>
                ))}
              </select>
            </div>

            <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2">
              <span className="font-mono tabular-nums text-slate-700 dark:text-slate-200 font-medium">
                {receivedCount}/{activePublishersCount}
              </span>
              <span>recebidas</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums text-red-700 dark:text-red-400 font-medium">
                {pendingCount}
              </span>
              <span>faltam</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setImportModalOpen(true)}
              className="h-8 px-3 text-xs font-medium text-blue-800 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 rounded-md hover:bg-blue-100 dark:hover:bg-blue-900/60 transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <FileUp className="w-3.5 h-3.5" />
              Importar Word / Planilha
            </button>

            <button
              type="button"
              onClick={() => exportFullWorkbookXlsx(activeMonth, publishers, reports)}
              className="h-8 px-3 text-xs font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400" />
              Exportar Excel
            </button>

            <button
              type="button"
              onClick={() => exportReportToWord(activeMonth, publishers, reports, 'completo')}
              className="h-8 px-3 text-xs font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <FileText className="w-3.5 h-3.5 text-blue-700 dark:text-blue-400" />
              Exportar Word
            </button>

            <button
              type="button"
              onClick={() => window.print()}
              className="h-8 px-3 text-xs font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              Imprimir
            </button>

            <button
              type="button"
              onClick={() => setIsDark((prev) => !prev)}
              aria-label={isDark ? 'Ativar modo claro' : 'Ativar modo escuro'}
              className="h-8 px-3 text-xs font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
            >
              {isDark ? <Sun className="w-3.5 h-3.5 text-amber-400" /> : <Moon className="w-3.5 h-3.5 text-slate-600" />}
              {isDark ? 'Modo Claro' : 'Modo Escuro'}
            </button>

            <button
              type="button"
              onClick={() => setSettingsModalOpen(true)}
              aria-label="Abrir configurações de acesso"
              className="h-8 px-3 text-xs font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Settings className="w-3.5 h-3.5 text-slate-600 dark:text-slate-300" />
              Configurações
            </button>
          </div>
        </div>

        {/* Active Tab Viewport */}
        <div className="print-container">
          {loadingCloud ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[0, 1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="h-24 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-5 animate-pulse"
                  />
                ))}
              </div>
              <div className="h-64 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg animate-pulse" />
            </div>
          ) : (
            <>
              {activeTab === 'resposta' && (
                <RespostaTab
                  monthKey={activeMonth}
                  publishers={publishers}
                  reports={reports}
                  onQuickRegister={(pub, existing) => openNewReportModal(pub, existing ?? null)}
                  onOpenImport={() => setImportModalOpen(true)}
                />
              )}

          {activeTab === 'respostas' && (
            <RespostasFormTab
              monthKey={activeMonth}
              publishers={publishers}
              reports={reports}
              registeredNamesNorm={registeredNamesNorm}
              onAddReport={() => openNewReportModal(null, null)}
              onEditReport={(rep) => openNewReportModal(null, rep)}
              onDeleteReport={handleDeleteReport}
            />
          )}

          {activeTab === 'cadastro' && (
            <CadastroTab
              publishers={publishers}
              submittedNormNames={submittedNormNames}
              onAddPublisher={handleAddPublisher}
              onUpdatePublisher={handleUpdatePublisher}
              onDeletePublisher={handleDeletePublisher}
              onClearAllPublishers={handleClearAllPublishers}
              onRestoreDefaultList={handleRestoreDefaultList}
              onOpenImport={() => setImportModalOpen(true)}
            />
          )}

              {activeTab === 'quem_falta' && (
                <QuemFaltaTab
                  monthKey={activeMonth}
                  publishers={publishers}
                  reports={reports}
                  onQuickRegister={(pub) => openNewReportModal(pub, null)}
                  onSavePhone={handleSavePublisherPhone}
                  onNotify={notify}
                />
              )}
            </>
          )}
        </div>
      </main>

      {/* Modals */}
      {reportModalOpen && (
        <ReportModal
          monthKey={activeMonth}
          publishers={publishers}
          submittedNormNames={submittedNormNames}
          initialPublisher={modalInitialPublisher}
          editingReport={editingReport}
          onClose={() => {
            setReportModalOpen(false);
            setEditingReport(null);
            setModalInitialPublisher(null);
          }}
          onSave={handleSaveReport}
        />
      )}

      {importModalOpen && (
        <ImportModal
          monthKey={activeMonth}
          existingPublishers={publishers}
          onClose={() => setImportModalOpen(false)}
          onImportToCadastro={handleImportToCadastro}
          onImportToReports={handleImportToReports}
        />
      )}

      {settingsModalOpen && (
        <SettingsModal
          portalSettings={portalSettings}
          onClose={() => setSettingsModalOpen(false)}
          onSaveSettings={handleSavePortalSettings}
          onLockPortal={handleLockPortal}
        />
      )}

      {/* Toast Notifications */}
      {toasts.length > 0 && (
        <div className="no-print fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm">
          {toasts.map((toast) => (
            <div
              key={toast.id}
              className={`px-4 py-2.5 rounded-md border text-xs font-medium shadow-md ${
                toast.tone === 'error'
                  ? 'bg-red-50 border-red-200 text-red-900 dark:bg-red-950 dark:border-red-800 dark:text-red-200'
                  : toast.tone === 'info'
                    ? 'bg-slate-900 border-slate-800 text-white dark:bg-slate-800 dark:border-slate-700 dark:text-slate-100'
                    : 'bg-emerald-50 border-emerald-200 text-emerald-900 dark:bg-emerald-950 dark:border-emerald-800 dark:text-emerald-200'
              }`}
            >
              {toast.text}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
