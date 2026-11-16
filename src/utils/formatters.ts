export function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim();
}

export function cleanDisplayName(value: string): string {
  return value.replace(/\s+/g, ' ').trim().toUpperCase();
}

export function formatTimestampPtBr(isoString: string): string {
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) {
    return isoString;
  }
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const yyyy = date.getFullYear();
  const hh = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  const sec = String(date.getSeconds()).padStart(2, '0');
  return `${dd}/${mm}/${yyyy} ${hh}:${min}:${sec}`;
}

export function formatPercentPtBr(ratio: number): string {
  const pct = (ratio * 100).toFixed(2).replace('.', ',');
  return `${pct}%`;
}

const MONTH_NAMES = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
];

export function formatMonthLabel(monthKey: string): string {
  const [yearStr, monthStr] = monthKey.split('-');
  const year = Number(yearStr);
  const monthIdx = Number(monthStr) - 1;
  if (!Number.isFinite(year) || monthIdx < 0 || monthIdx > 11) {
    return monthKey;
  }
  return `${MONTH_NAMES[monthIdx]} de ${year}`;
}

export function getMonthOptions(activeMonth: string, reportMonths: string[]): string[] {
  const set = new Set<string>(reportMonths);
  set.add(activeMonth);

  const [y, m] = activeMonth.split('-').map(Number);
  if (Number.isFinite(y) && Number.isFinite(m)) {
    for (let offset = -3; offset <= 2; offset++) {
      const d = new Date(y, m - 1 + offset, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      set.add(key);
    }
  }

  return Array.from(set).sort((a, b) => b.localeCompare(a));
}

export function generateId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}
