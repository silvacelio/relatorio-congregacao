import * as XLSX from 'xlsx';
import { ActivityReport, Publisher } from '../types';
import {
  formatMonthLabel,
  formatPercentPtBr,
  formatTimestampPtBr,
  normalizeText,
} from './formatters';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function exportFullWorkbookXlsx(
  monthKey: string,
  publishers: Publisher[],
  reports: ActivityReport[],
): void {
  const monthReports = reports.filter((r) => r.monthKey === monthKey);
  const reportByNormName = new Map<string, ActivityReport>();
  const pubByNormName = new Map<string, Publisher>();
  publishers.forEach((p) => pubByNormName.set(normalizeText(p.name), p));
  monthReports.forEach((r) => {
    reportByNormName.set(normalizeText(r.publisherName), r);
  });

  const activePublishers = publishers.filter((p) => p.active);

  // Sheet 1: Respostas ao formulário
  const formRows = [
    [
      'Carimbo de data/hora',
      'NOME',
      'Privilégio (no mês)',
      'Marque se você participou esse mês',
      'Horas (pioneiro)',
      'Estudos Bíblicos',
      'Observações',
    ],
    ...monthReports.map((r) => [
      formatTimestampPtBr(r.timestamp),
      r.publisherName,
      r.privilegeSnapshot ?? pubByNormName.get(normalizeText(r.publisherName))?.privilege ?? 'Publicador',
      r.participated ? 'Sim' : 'Não',
      r.hours ?? '',
      r.bibleStudies ?? '',
      r.notes ?? '',
    ]),
  ];

  // Sheet 2: CADASTRO
  const cadastroRows = [
    ['CABEÇALHO', 'Grupo', 'Privilégio', 'Status Cadastro', 'WhatsApp'],
    ...publishers.map((p) => [
      p.name,
      p.group,
      p.privilege,
      p.active ? 'Ativo' : 'Inativo',
      p.phone ?? '',
    ]),
  ];

  // Sheet 3: RESPOSTA
  let received = 0;
  const respostaStatusRows = activePublishers.map((p) => {
    const found = reportByNormName.get(normalizeText(p.name));
    if (found) received += 1;
    return [p.name, found ? 'SIM' : 'NÃO'];
  });
  const total = activePublishers.length;
  const pending = total - received;
  const pct = total > 0 ? formatPercentPtBr(received / total) : '0,00%';

  const respostaRows = [
    ['NOME', 'STATUS', '', 'INDICADOR', 'VALOR'],
    ...respostaStatusRows.map((row, idx) => {
      if (idx === 0) return [row[0], row[1], '', 'Recebidas', received];
      if (idx === 1) return [row[0], row[1], '', 'Pendentes', pending];
      if (idx === 2) return [row[0], row[1], '', 'Total', total];
      if (idx === 3) return [row[0], row[1], '', 'Percentual', pct];
      return [row[0], row[1]];
    }),
  ];

  // Sheet 4: QUEM FALTA
  const missingPublishers = activePublishers.filter(
    (p) => !reportByNormName.has(normalizeText(p.name)),
  );
  const quemFaltaRows = [
    ['NOME', 'Grupo', 'Privilégio', 'WhatsApp'],
    ...missingPublishers.map((p) => [p.name, p.group, p.privilege, p.phone ?? '']),
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(formRows), 'Respostas ao formulário');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(cadastroRows), 'CADASTRO');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(respostaRows), 'RESPOSTA');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(quemFaltaRows), 'QUEM FALTA');

  XLSX.writeFile(wb, `relatorio-congregacao-${monthKey}.xlsx`);
}

export function exportPendingCsv(monthKey: string, pendingPublishers: Publisher[]): void {
  const header = ['NOME', 'Grupo', 'Privilégio'];
  const lines = [
    header.join(';'),
    ...pendingPublishers.map((p) =>
      [`"${p.name}"`, `"${p.group}"`, `"${p.privilege}"`].join(';'),
    ),
  ];
  const blob = new Blob(['\ufeff' + lines.join('\n')], {
    type: 'text/csv;charset=utf-8;',
  });
  triggerDownload(blob, `quem-falta-${monthKey}.csv`);
}

export function exportReportToWord(
  monthKey: string,
  publishers: Publisher[],
  reports: ActivityReport[],
  mode: 'completo' | 'quem_falta',
): void {
  const monthLabel = formatMonthLabel(monthKey);
  const monthReports = reports.filter((r) => r.monthKey === monthKey);
  const reportByNormName = new Map<string, ActivityReport>();
  const pubByNormName = new Map<string, Publisher>();
  publishers.forEach((p) => pubByNormName.set(normalizeText(p.name), p));
  monthReports.forEach((r) => reportByNormName.set(normalizeText(r.publisherName), r));

  const activePublishers = publishers.filter((p) => p.active);
  const missingPublishers = activePublishers.filter(
    (p) => !reportByNormName.has(normalizeText(p.name)),
  );
  const receivedCount = activePublishers.length - missingPublishers.length;
  const pct =
    activePublishers.length > 0
      ? formatPercentPtBr(receivedCount / activePublishers.length)
      : '0,00%';

  const totalHours = monthReports.reduce((sum, r) => sum + (r.hours ?? 0), 0);
  const totalStudies = monthReports.reduce((sum, r) => sum + (r.bibleStudies ?? 0), 0);

  const html = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office"
          xmlns:w="urn:schemas-microsoft-com:office:word"
          xmlns="http://www.w3.org/TR/REC-html40">
    <head>
      <meta charset="utf-8" />
      <title>Relatório Congregação — ${escapeHtml(monthLabel)}</title>
      <style>
        body { font-family: Calibri, Arial, sans-serif; color: #1e293b; font-size: 11pt; }
        h1 { font-size: 16pt; color: #0f172a; margin-bottom: 4px; }
        h2 { font-size: 12pt; color: #1e3a8a; margin-top: 18px; margin-bottom: 8px; }
        p.subtitle { color: #475569; margin-top: 0; font-size: 10pt; }
        table { width: 100%; border-collapse: collapse; margin-top: 8px; }
        th, td { border: 1px solid #cbd5e1; padding: 6px 8px; text-align: left; font-size: 10pt; }
        th { background-color: #f1f5f9; font-weight: bold; }
        .status-sim { color: #15803d; font-weight: bold; }
        .status-nao { color: #b91c1c; font-weight: bold; }
      </style>
    </head>
    <body>
      <h1>Relatório de Atividades Ministeriais — ${escapeHtml(monthLabel)}</h1>
      <p class="subtitle">Recebidas: ${receivedCount} | Pendentes: ${missingPublishers.length} | Total Ativos: ${activePublishers.length} (${pct})</p>
      ${
        mode === 'completo'
          ? `
        <h2>Resumo Quantitativo</h2>
        <table>
          <tr><th>Indicador</th><th>Valor</th></tr>
          <tr><td>Relatórios Recebidos</td><td>${receivedCount}</td></tr>
          <tr><td>Pendentes</td><td>${missingPublishers.length}</td></tr>
          <tr><td>Total de Publicadores Ativos</td><td>${activePublishers.length}</td></tr>
          <tr><td>Percentual Entregue</td><td>${pct}</td></tr>
          <tr><td>Total de Horas Registradas</td><td>${totalHours}</td></tr>
          <tr><td>Total de Estudos Bíblicos</td><td>${totalStudies}</td></tr>
        </table>

        <h2>Respostas ao Formulário</h2>
        <table>
          <tr>
            <th>Data/Hora</th>
            <th>Nome</th>
            <th>Privilégio</th>
            <th>Participou</th>
            <th>Horas</th>
            <th>Estudos</th>
            <th>Observações</th>
          </tr>
          ${monthReports
            .map((r) => {
              const priv =
                r.privilegeSnapshot ??
                pubByNormName.get(normalizeText(r.publisherName))?.privilege ??
                'Publicador';
              return `
            <tr>
              <td>${escapeHtml(formatTimestampPtBr(r.timestamp))}</td>
              <td>${escapeHtml(r.publisherName)}</td>
              <td>${escapeHtml(priv)}</td>
              <td>${r.participated ? 'Sim' : 'Não'}</td>
              <td>${r.hours ?? '—'}</td>
              <td>${r.bibleStudies ?? '—'}</td>
              <td>${escapeHtml(r.notes || '—')}</td>
            </tr>`;
            })
            .join('')}
        </table>
      `
          : ''
      }
      <h2>Quem Falta Entregar (${missingPublishers.length})</h2>
      <table>
        <tr><th>#</th><th>Nome</th><th>Grupo</th><th>Privilégio</th></tr>
        ${missingPublishers
          .map(
            (p, i) => `
          <tr>
            <td>${i + 1}</td>
            <td class="status-nao">${escapeHtml(p.name)}</td>
            <td>${escapeHtml(p.group)}</td>
            <td>${escapeHtml(p.privilege)}</td>
          </tr>`,
          )
          .join('')}
      </table>
    </body>
    </html>
  `;

  const blob = new Blob(['\ufeff', html], { type: 'application/msword' });
  const suffix = mode === 'quem_falta' ? 'quem-falta' : 'completo';
  triggerDownload(blob, `relatorio-${suffix}-${monthKey}.doc`);
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
