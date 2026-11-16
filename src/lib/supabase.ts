import { createClient, SupabaseClient } from '@supabase/supabase-js';
import {
  ActivityReport,
  AuxiliaryPioneerOption,
  PrivilegeType,
  Publisher,
} from '../types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const isSupabaseConfigured = Boolean(
  supabaseUrl && supabaseUrl.trim() && supabaseAnonKey && supabaseAnonKey.trim(),
);

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(supabaseUrl!.trim(), supabaseAnonKey!.trim())
  : null;

interface DbPublisherRow {
  id: string;
  name: string;
  group_name: string;
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
  participated: boolean;
  hours: number | null;
  bible_studies: number | null;
  auxiliary_pioneer: string;
  notes: string;
}

function mapPublisherFromDb(row: DbPublisherRow): Publisher {
  return {
    id: row.id,
    name: row.name,
    group: row.group_name || 'Congregação',
    privilege: (row.privilege as PrivilegeType) || 'Publicador',
    active: row.active,
    phone: row.phone ?? undefined,
  };
}

function mapPublisherToDb(pub: Publisher): DbPublisherRow {
  return {
    id: pub.id,
    name: pub.name,
    group_name: pub.group || 'Congregação',
    privilege: pub.privilege || 'Publicador',
    active: pub.active,
    phone: pub.phone ?? null,
  };
}

function mapReportFromDb(row: DbReportRow): ActivityReport {
  return {
    id: row.id,
    monthKey: row.month_key,
    timestamp: row.timestamp,
    publisherName: row.publisher_name,
    publisherId: row.publisher_id ?? undefined,
    participated: row.participated,
    hours: row.hours,
    bibleStudies: row.bible_studies,
    auxiliaryPioneer: (row.auxiliary_pioneer as AuxiliaryPioneerOption) || 'Não',
    notes: row.notes || '',
  };
}

function mapReportToDb(report: ActivityReport): DbReportRow {
  return {
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

export async function dbUpsertPublishers(items: Publisher[]): Promise<void> {
  if (!supabase || items.length === 0) return;
  const { error } = await supabase
    .from('publishers')
    .upsert(items.map(mapPublisherToDb), { onConflict: 'id' });
  if (error) throw error;
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
    .upsert(items.map(mapReportToDb), { onConflict: 'id' });
  if (error) throw error;
}

export async function dbDeleteReport(id: string): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from('activity_reports').delete().eq('id', id);
  if (error) throw error;
}
