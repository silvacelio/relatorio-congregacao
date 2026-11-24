import { createClient, SupabaseClient } from '@supabase/supabase-js';
import {
  ActivityReport,
  AuxiliaryPioneerOption,
  GroupVisit,
  GroupVisitStatus,
  PortalSettings,
  PrivilegeType,
  Publisher,
  ServiceGroup,
  ServiceOverseerSettings,
} from '../types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const isSupabaseConfigured = Boolean(
  supabaseUrl && supabaseUrl.trim() && supabaseAnonKey && supabaseAnonKey.trim(),
);

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(supabaseUrl!.trim(), supabaseAnonKey!.trim())
  : null;

export const DEFAULT_PORTAL_SETTINGS: PortalSettings = {
  id: 'default',
  accessCode: 'PortalJDR26',
  recoveryCode: 'CelioJDR2026',
};

export const DEFAULT_SERVICE_GROUPS: ServiceGroup[] = [
  { id: 'grp-salao-1', name: 'Salão do Reino 1', overseerName: '', overseerWhatsapp: '', notes: '', sortOrder: 1 },
  { id: 'grp-salao-2', name: 'Salão do Reino 2', overseerName: '', overseerWhatsapp: '', notes: '', sortOrder: 2 },
  { id: 'grp-jose-dos-reis', name: 'José dos Reis', overseerName: '', overseerWhatsapp: '', notes: '', sortOrder: 3 },
  { id: 'grp-fernao-cardim', name: 'Fernão Cardim', overseerName: '', overseerWhatsapp: '', notes: '', sortOrder: 4 },
  { id: 'grp-mario-carpenter', name: 'Mário Carpenter', overseerName: '', overseerWhatsapp: '', notes: '', sortOrder: 5 },
];

export const DEFAULT_SERVICE_OVERSEER: ServiceOverseerSettings = {
  id: 'default',
  supervisorName: 'Aílton Brandão',
  supervisorWhatsapp: '',
  cycleLabel: 'Ciclo Atual',
  cycleStartDate: `${new Date().toISOString().slice(0, 7)}-01`,
};

interface DbPublisherRow {
  id: string;
  name: string;
  group_name: string;
  group_id?: string | null;
  privilege: string;
  active: boolean;
  phone: string | null;
}

interface DbReportRow {
  id: string;
  month_key: string;
  timestamp: string;
  publisher_name: string;
  publisher_id: string | null;
  privilege_snapshot?: string | null;
  participated: boolean;
  hours: number | null;
  bible_studies: number | null;
  auxiliary_pioneer: string;
  notes: string;
}

interface DbPortalSettingsRow {
  id: string;
  access_code: string;
  recovery_code: string;
  updated_at?: string;
}

interface DbServiceGroupRow {
  id: string;
  name: string;
  overseer_name: string;
  overseer_whatsapp: string;
  notes: string;
  sort_order: number;
}

interface DbServiceOverseerRow {
  id: string;
  supervisor_name: string;
  supervisor_whatsapp: string;
  cycle_label: string;
  cycle_start_date: string | null;
}

interface DbGroupVisitRow {
  id: string;
  group_id: string;
  group_name_snapshot: string;
  visit_date: string;
  visitor_name: string;
  notes: string;
  status: string;
}

function mapPublisherFromDb(row: DbPublisherRow): Publisher {
  return {
    id: row.id,
    name: row.name,
    group: row.group_name || 'Congregação',
    groupId: row.group_id ?? undefined,
    privilege: (row.privilege as PrivilegeType) || 'Publicador',
    active: row.active,
    phone: row.phone ?? undefined,
  };
}

function mapPublisherToDb(pub: Publisher, includeGroupId = true): DbPublisherRow {
  const row: DbPublisherRow = {
    id: pub.id,
    name: pub.name,
    group_name: pub.group || 'Congregação',
    privilege: pub.privilege || 'Publicador',
    active: pub.active,
    phone: pub.phone ?? null,
  };
  if (includeGroupId) {
    row.group_id = pub.groupId ?? null;
  }
  return row;
}

function mapReportFromDb(row: DbReportRow): ActivityReport {
  return {
    id: row.id,
    monthKey: row.month_key,
    timestamp: row.timestamp,
    publisherName: row.publisher_name,
    publisherId: row.publisher_id ?? undefined,
    privilegeSnapshot: (row.privilege_snapshot as PrivilegeType | undefined) || undefined,
    participated: row.participated,
    hours: row.hours,
    bibleStudies: row.bible_studies,
    auxiliaryPioneer: (row.auxiliary_pioneer as AuxiliaryPioneerOption) || 'Não',
    notes: row.notes || '',
  };
}

function mapReportToDb(report: ActivityReport, includeSnapshot = true): DbReportRow {
  const base: DbReportRow = {
    id: report.id,
    month_key: report.monthKey,
    timestamp: report.timestamp,
    publisher_name: report.publisherName,
    publisher_id: report.publisherId ?? null,
    participated: report.participated,
    hours: report.hours,
    bible_studies: report.bibleStudies,
    auxiliary_pioneer: report.auxiliaryPioneer || 'Não',
    notes: report.notes || '',
  };
  if (includeSnapshot) {
    base.privilege_snapshot = report.privilegeSnapshot ?? null;
  }
  return base;
}

function mapServiceGroupFromDb(row: DbServiceGroupRow): ServiceGroup {
  return {
    id: row.id,
    name: row.name,
    overseerName: row.overseer_name || '',
    overseerWhatsapp: row.overseer_whatsapp || '',
    notes: row.notes || '',
    sortOrder: Number.isFinite(row.sort_order) ? row.sort_order : 0,
  };
}

function mapServiceGroupToDb(g: ServiceGroup): DbServiceGroupRow {
  return {
    id: g.id,
    name: g.name,
    overseer_name: g.overseerName || '',
    overseer_whatsapp: g.overseerWhatsapp || '',
    notes: g.notes || '',
    sort_order: g.sortOrder || 0,
  };
}

function mapGroupVisitFromDb(row: DbGroupVisitRow): GroupVisit {
  return {
    id: row.id,
    groupId: row.group_id,
    groupNameSnapshot: row.group_name_snapshot || '',
    visitDate: row.visit_date,
    visitorName: row.visitor_name || '',
    notes: row.notes || '',
    status: (row.status === 'agendada' ? 'agendada' : 'realizada') as GroupVisitStatus,
  };
}

function mapGroupVisitToDb(v: GroupVisit): DbGroupVisitRow {
  return {
    id: v.id,
    group_id: v.groupId,
    group_name_snapshot: v.groupNameSnapshot || '',
    visit_date: v.visitDate,
    visitor_name: v.visitorName || '',
    notes: v.notes || '',
    status: v.status,
  };
}

export async function dbFetchAll(): Promise<{
  publishers: Publisher[];
  reports: ActivityReport[];
}> {
  if (!supabase) {
    throw new Error('Supabase não configurado.');
  }

  const [pubRes, repRes] = await Promise.all([
    supabase.from('publishers').select('*').order('name', { ascending: true }),
    supabase.from('activity_reports').select('*').order('timestamp', { ascending: false }),
  ]);

  if (pubRes.error) throw pubRes.error;
  if (repRes.error) throw repRes.error;

  return {
    publishers: ((pubRes.data ?? []) as DbPublisherRow[]).map(mapPublisherFromDb),
    reports: ((repRes.data ?? []) as DbReportRow[]).map(mapReportFromDb),
  };
}

export async function dbFetchPortalSettings(): Promise<PortalSettings> {
  if (!supabase) {
    return DEFAULT_PORTAL_SETTINGS;
  }

  const { data, error } = await supabase
    .from('portal_settings')
    .select('*')
    .eq('id', 'default')
    .maybeSingle();

  if (error) {
    return DEFAULT_PORTAL_SETTINGS;
  }

  if (!data) {
    await supabase
      .from('portal_settings')
      .upsert(
        {
          id: 'default',
          access_code: DEFAULT_PORTAL_SETTINGS.accessCode,
          recovery_code: DEFAULT_PORTAL_SETTINGS.recoveryCode,
        },
        { onConflict: 'id' },
      );
    return DEFAULT_PORTAL_SETTINGS;
  }

  const row = data as DbPortalSettingsRow;
  return {
    id: row.id,
    accessCode: row.access_code || DEFAULT_PORTAL_SETTINGS.accessCode,
    recoveryCode: row.recovery_code || DEFAULT_PORTAL_SETTINGS.recoveryCode,
    updatedAt: row.updated_at,
  };
}

export async function dbSavePortalSettings(settings: PortalSettings): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from('portal_settings').upsert(
    {
      id: settings.id || 'default',
      access_code: settings.accessCode,
      recovery_code: settings.recoveryCode,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'id' },
  );
  if (error) throw error;
}

export async function dbUpsertPublishers(items: Publisher[]): Promise<void> {
  if (!supabase || items.length === 0) return;
  const { error } = await supabase
    .from('publishers')
    .upsert(items.map((p) => mapPublisherToDb(p, true)), { onConflict: 'id' });
  if (error) {
    const msg = (error.message ?? '').toLowerCase();
    if (msg.includes('group_id') || error.code === '42703' || error.code === 'PGRST204') {
      const retry = await supabase
        .from('publishers')
        .upsert(items.map((p) => mapPublisherToDb(p, false)), { onConflict: 'id' });
      if (retry.error) throw retry.error;
      return;
    }
    throw error;
  }
}

export async function dbDeletePublisher(id: string): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from('publishers').delete().eq('id', id);
  if (error) throw error;
}

export async function dbClearPublishers(): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from('publishers').delete().neq('id', '');
  if (error) throw error;
}

export async function dbUpsertReports(items: ActivityReport[]): Promise<void> {
  if (!supabase || items.length === 0) return;
  const { error } = await supabase
    .from('activity_reports')
    .upsert(items.map((r) => mapReportToDb(r, true)), { onConflict: 'id' });
  if (error) {
    const msg = (error.message ?? '').toLowerCase();
    if (msg.includes('privilege_snapshot') || error.code === '42703' || error.code === 'PGRST204') {
      const retry = await supabase
        .from('activity_reports')
        .upsert(items.map((r) => mapReportToDb(r, false)), { onConflict: 'id' });
      if (retry.error) throw retry.error;
      return;
    }
    throw error;
  }
}

export async function dbDeleteReport(id: string): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from('activity_reports').delete().eq('id', id);
  if (error) throw error;
}

export async function dbFetchServiceGroups(): Promise<ServiceGroup[]> {
  if (!supabase) return DEFAULT_SERVICE_GROUPS;
  const { data, error } = await supabase
    .from('service_groups')
    .select('*')
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true });
  if (error) throw error;
  return ((data ?? []) as DbServiceGroupRow[]).map(mapServiceGroupFromDb);
}

export async function dbUpsertServiceGroup(group: ServiceGroup): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase
    .from('service_groups')
    .upsert(
      { ...mapServiceGroupToDb(group), updated_at: new Date().toISOString() },
      { onConflict: 'id' },
    );
  if (error) throw error;
}

export async function dbDeleteServiceGroup(id: string): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from('service_groups').delete().eq('id', id);
  if (error) throw error;
}

export async function dbFetchServiceOverseer(): Promise<ServiceOverseerSettings> {
  if (!supabase) return DEFAULT_SERVICE_OVERSEER;
  const { data, error } = await supabase
    .from('service_overseer_settings')
    .select('*')
    .eq('id', 'default')
    .maybeSingle();
  if (error) throw error;
  if (!data) return DEFAULT_SERVICE_OVERSEER;
  const row = data as DbServiceOverseerRow;
  return {
    id: row.id,
    supervisorName: row.supervisor_name ?? '',
    supervisorWhatsapp: row.supervisor_whatsapp ?? '',
    cycleLabel: row.cycle_label || 'Ciclo Atual',
    cycleStartDate: row.cycle_start_date || DEFAULT_SERVICE_OVERSEER.cycleStartDate,
  };
}

export async function dbSaveServiceOverseer(settings: ServiceOverseerSettings): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from('service_overseer_settings').upsert(
    {
      id: settings.id || 'default',
      supervisor_name: settings.supervisorName || '',
      supervisor_whatsapp: settings.supervisorWhatsapp || '',
      cycle_label: settings.cycleLabel || 'Ciclo Atual',
      cycle_start_date: settings.cycleStartDate || null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'id' },
  );
  if (error) throw error;
}

export async function dbFetchGroupVisits(): Promise<GroupVisit[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('group_visits')
    .select('*')
    .order('visit_date', { ascending: false })
    .order('created_at', { ascending: false });
  if (error) throw error;
  return ((data ?? []) as DbGroupVisitRow[]).map(mapGroupVisitFromDb);
}

export async function dbUpsertGroupVisit(visit: GroupVisit): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase
    .from('group_visits')
    .upsert(mapGroupVisitToDb(visit), { onConflict: 'id' });
  if (error) throw error;
}

export async function dbDeleteGroupVisit(id: string): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from('group_visits').delete().eq('id', id);
  if (error) throw error;
}
