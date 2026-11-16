import { FileSpreadsheet, FileText, Upload, X } from 'lucide-react';
import { ChangeEvent, useMemo, useState } from 'react';
import { Publisher } from '../types';
import { formatMonthLabel, normalizeText } from '../utils/formatters';
import {
  ParsedRow,
  ParsedSheetResult,
  parsePastedText,
  parseSpreadsheetFile,
  parseWordDocxFile,
} from '../utils/importParsers';

interface ImportModalProps {
  monthKey: string;
  existingPublishers: Publisher[];
  onClose: () => void;
  onImportToCadastro: (rows: ParsedRow[], mode: 'append' | 'replace') => void;
  onImportToReports: (rows: ParsedRow[], autoAddMissingToCadastro: boolean) => void;
}

export function ImportModal({
  monthKey,
  existingPublishers,
  onClose,
  onImportToCadastro,
  onImportToReports,
}: ImportModalProps) {
  const [sourceMode, setSourceMode] = useState<'file' | 'paste'>('file');
  const [pasteText, setPasteText] = useState('');
  const [currentFile, setCurrentFile] = useState<File | null>(null);
  const [parsed, setParsed] = useState<ParsedSheetResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [targetType, setTargetType] = useState<'cadastro' | 'respostas'>('cadastro');
  const [cadastroMode, setCadastroMode] = useState<'append' | 'replace'>('append');
  const [autoAddCadastro, setAutoAddCadastro] = useState(true);

  const existingNormSet = useMemo(
    () => new Set(existingPublishers.map((p) => normalizeText(p.name))),
    [existingPublishers],
  );

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await processFile(file);
  };

  const processFile = async (file: File, sheetName?: string) => {
    setLoading(true);
    setErrorMsg(null);
    setCurrentFile(file);

    try {
      const lower = file.name.toLowerCase();
      let result: ParsedSheetResult;

      if (lower.endsWith('.docx')) {
        result = await parseWordDocxFile(file);
      } else if (
        lower.endsWith('.xlsx') ||
        lower.endsWith('.xls') ||
        lower.endsWith('.csv')
      ) {
        result = await parseSpreadsheetFile(file, sheetName);
      } else if (lower.endsWith('.txt')) {
        const text = await file.text();
        result = parsePastedText(text);
        result.sourceName = file.name;
      } else {
        throw new Error(
          'Formato não suportado. Envie arquivos Word (.docx), Excel (.xlsx / .xls), CSV (.csv) ou Texto (.txt).',
        );
      }

      setParsed(result);
      const hasReportCols = result.rows.some(
        (r) => r.hours !== undefined || r.participated !== undefined || r.bibleStudies !== undefined,
      );
      if (hasReportCols) {
        setTargetType('respostas');
      }
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : 'Não foi possível ler o arquivo enviado. Verifique o formato.',
      );
      setParsed(null);
    } finally {
      setLoading(false);
    }
  };

  const handleParsePaste = () => {
    setErrorMsg(null);
    if (!pasteText.trim()) {
      setErrorMsg('Cole a lista de nomes ou tabela do Word/Excel antes de analisar.');
      return;
    }
    const result = parsePastedText(pasteText);
    setParsed(result);
    const hasReportCols = result.rows.some(
      (r) => r.hours !== undefined || r.participated !== undefined || r.bibleStudies !== undefined,
    );
    if (hasReportCols) {
      setTargetType('respostas');
    }
  };

  const handleConfirmImport = () => {
    if (!parsed || parsed.rows.length === 0) return;
    if (targetType === 'cadastro') {
      onImportToCadastro(parsed.rows, cadastroMode);
    } else {
      onImportToReports(parsed.rows, autoAddCadastro);
    }
  };

  const newNamesCount = useMemo(() => {
    if (!parsed) return 0;
    const seen = new Set<string>();
    let count = 0;
    parsed.rows.forEach((r) => {
      const norm = normalizeText(r.name);
      if (!seen.has(norm)) {
        seen.add(norm);
        if (!existingNormSet.has(norm)) count += 1;
      }
    });
    return count;
  }, [parsed, existingNormSet]);

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/60 dark:bg-black/70 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="import-modal-title"
    >
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg w-full max-w-3xl max-h-[90vh] flex flex-col shadow-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0">
          <div>
            <h2 id="import-modal-title" className="text-base font-semibold text-slate-900 dark:text-slate-100">
              Importar Planilha ou Documento Word
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Suporta Word (.docx), Excel (.xlsx / .xls), CSV (.csv) ou texto copiado diretamente.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar importação"
            className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 overflow-y-auto space-y-5">
          {/* Source Toggle */}
          <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-md w-fit">
            <button
              type="button"
              onClick={() => setSourceMode('file')}
              className={`px-3 py-1.5 text-xs font-medium rounded transition-colors cursor-pointer ${
                sourceMode === 'file'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
              }`}
            >
              Enviar Arquivo (.docx / .xlsx / .csv)
            </button>
            <button
              type="button"
              onClick={() => setSourceMode('paste')}
              className={`px-3 py-1.5 text-xs font-medium rounded transition-colors cursor-pointer ${
                sourceMode === 'paste'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
              }`}
            >
              Colar Texto do Word / Excel
            </button>
          </div>

          {sourceMode === 'file' ? (
            <label className="block border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-blue-500 dark:hover:border-blue-400 rounded-lg p-6 text-center cursor-pointer transition-colors bg-slate-50/50 dark:bg-slate-800/40">
              <input
                type="file"
                accept=".docx,.xlsx,.xls,.csv,.txt"
                onChange={handleFileChange}
                className="sr-only"
              />
              <Upload className="w-8 h-8 text-blue-700 dark:text-blue-400 mx-auto" />
              <div className="mt-2 text-sm font-medium text-slate-900 dark:text-slate-100">
                {currentFile
                  ? `Arquivo selecionado: ${currentFile.name}`
                  : 'Clique para selecionar um arquivo Word (.docx) ou Planilha (.xlsx, .csv)'}
              </div>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Tabelas do Word, listas de nomes com ou sem numeração e abas do Excel são detectadas automaticamente.
              </p>
            </label>
          ) : (
            <div className="space-y-2">
              <textarea
                rows={6}
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                placeholder={
                  'Cole aqui os nomes do Word (um por linha) ou copie colunas do Excel/Google Sheets:\nAILTON DE OLIVEIRA BRANDÃO\nMARCOS CATHARINA LEMOS\tSim\t100'
                }
                className="w-full p-3 text-xs font-mono bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handleParsePaste}
                  className="h-9 px-4 text-xs font-medium text-white bg-slate-900 dark:bg-blue-600 rounded-md hover:bg-slate-800 dark:hover:bg-blue-500 cursor-pointer"
                >
                  Analisar Texto Colado
                </button>
              </div>
            </div>
          )}

          {loading && (
            <div className="text-sm text-slate-600 dark:text-slate-400 py-4 text-center">
              Processando arquivo...
            </div>
          )}

          {errorMsg && (
            <div className="p-3 bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800 rounded-md text-xs text-red-800 dark:text-red-300">
              {errorMsg}
            </div>
          )}

          {parsed && (
            <div className="space-y-4 border-t border-slate-200 dark:border-slate-800 pt-4">
              {/* Sheet selector if multi-sheet Excel */}
              {parsed.sheetNames.length > 1 && currentFile && (
                <div className="flex items-center gap-3">
                  <label className="text-xs font-medium text-slate-700 dark:text-slate-300 whitespace-nowrap">
                    Aba da Planilha:
                  </label>
                  <select
                    value={parsed.selectedSheet}
                    onChange={(e) => processFile(currentFile, e.target.value)}
                    className="h-8 px-3 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md text-slate-900 dark:text-slate-100"
                  >
                    {parsed.sheetNames.map((sheet) => (
                      <option key={sheet} value={sheet}>
                        {sheet}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Target Destination Selection */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setTargetType('cadastro')}
                  className={`p-3 text-left rounded-md border transition-colors cursor-pointer ${
                    targetType === 'cadastro'
                      ? 'bg-blue-50 dark:bg-blue-950/60 border-blue-600 dark:border-blue-500'
                      : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/70'
                  }`}
                >
                  <div className="flex items-center gap-2 text-xs font-semibold text-slate-900 dark:text-slate-100">
                    <FileText className="w-4 h-4 text-blue-700 dark:text-blue-400" />
                    Importar para Cadastro (Nomes)
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Atualiza a lista mestra de publicadores da congregação.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setTargetType('respostas')}
                  className={`p-3 text-left rounded-md border transition-colors cursor-pointer ${
                    targetType === 'respostas'
                      ? 'bg-blue-50 dark:bg-blue-950/60 border-blue-600 dark:border-blue-500'
                      : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/70'
                  }`}
                >
                  <div className="flex items-center gap-2 text-xs font-semibold text-slate-900 dark:text-slate-100">
                    <FileSpreadsheet className="w-4 h-4 text-blue-700 dark:text-blue-400" />
                    Importar como Respostas ({formatMonthLabel(monthKey)})
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Lança atividades recebidas (participação, horas, estudos).
                  </p>
                </button>
              </div>

              {targetType === 'cadastro' ? (
                <div className="flex flex-wrap items-center gap-4 text-xs text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/70 p-3 rounded-md border border-slate-200 dark:border-slate-700">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="cadastroMode"
                      checked={cadastroMode === 'append'}
                      onChange={() => setCadastroMode('append')}
                    />
                    <span>Adicionar aos existentes (ignora duplicados)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="cadastroMode"
                      checked={cadastroMode === 'replace'}
                      onChange={() => setCadastroMode('replace')}
                    />
                    <span className="text-red-700 dark:text-red-400 font-medium">
                      Substituir toda a lista de Cadastro atual
                    </span>
                  </label>
                </div>
              ) : (
                <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/70 p-3 rounded-md border border-slate-200 dark:border-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autoAddCadastro}
                    onChange={(e) => setAutoAddCadastro(e.target.checked)}
                  />
                  <span>
                    Cadastrar automaticamente nomes que ainda não existem no Cadastro ({newNamesCount} novos)
                  </span>
                </label>
              )}

              {/* Preview Table */}
              <div>
                <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-400 mb-2">
                  <span>
                    Pré-visualização: <strong className="text-slate-900 dark:text-slate-100">{parsed.rows.length}</strong> registros encontrados
                  </span>
                  <span>
                    {newNamesCount} nomes novos · {parsed.rows.length - newNamesCount} já no cadastro
                  </span>
                </div>

                {parsed.rows.length === 0 ? (
                  <div className="p-4 border border-slate-200 dark:border-slate-700 rounded text-xs text-slate-500 dark:text-slate-400 text-center">
                    Nenhum registro válido identificado neste arquivo/aba.
                  </div>
                ) : (
                  <div className="border border-slate-200 dark:border-slate-700 rounded-md overflow-x-auto max-h-52">
                    <table className="w-full border-collapse text-left text-xs">
                      <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 sticky top-0">
                        <tr>
                          <th className="py-2 px-3">#</th>
                          <th className="py-2 px-3">Nome</th>
                          <th className="py-2 px-3">Grupo</th>
                          <th className="py-2 px-3">Participou</th>
                          <th className="py-2 px-3 text-right">Horas</th>
                          <th className="py-2 px-3 text-right">Estudos</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {parsed.rows.slice(0, 50).map((row, idx) => (
                          <tr key={`${row.name}-${idx}`}>
                            <td className="py-1.5 px-3 font-mono text-slate-400 dark:text-slate-500">{idx + 1}</td>
                            <td className="py-1.5 px-3 font-medium text-slate-900 dark:text-slate-100">{row.name}</td>
                            <td className="py-1.5 px-3 text-slate-600 dark:text-slate-400">{row.group ?? '—'}</td>
                            <td className="py-1.5 px-3 text-slate-600 dark:text-slate-400">
                              {row.participated === undefined
                                ? '—'
                                : row.participated
                                  ? 'Sim'
                                  : 'Não'}
                            </td>
                            <td className="py-1.5 px-3 text-right font-mono tabular-nums text-slate-900 dark:text-slate-100">
                              {row.hours ?? '—'}
                            </td>
                            <td className="py-1.5 px-3 text-right font-mono tabular-nums text-slate-900 dark:text-slate-100">
                              {row.bibleStudies ?? '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {parsed.rows.length > 50 && (
                      <div className="px-3 py-2 text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700">
                        Mostrando os primeiros 50 de {parsed.rows.length} registros.
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="px-5 py-3.5 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-2 bg-slate-50 dark:bg-slate-800/60 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="h-9 px-4 text-xs font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={!parsed || parsed.rows.length === 0}
            onClick={handleConfirmImport}
            className="h-9 px-5 text-xs font-medium text-white bg-blue-700 dark:bg-blue-600 rounded-md hover:bg-blue-800 dark:hover:bg-blue-500 disabled:opacity-40 cursor-pointer"
          >
            Confirmar Importação ({parsed?.rows.length ?? 0})
          </button>
        </div>
      </div>
    </div>
  );
}
