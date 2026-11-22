import { ArrowLeft, Eye, EyeOff, KeyRound, Lock, Moon, Sun } from 'lucide-react';
import { FormEvent, useState } from 'react';
import { PortalSettings } from '../types';

interface AccessGateProps {
  portalSettings: PortalSettings;
  loadingSettings: boolean;
  isDark: boolean;
  onToggleDark: () => void;
  onUnlock: () => void;
  onUpdateAccessCode: (newCode: string) => Promise<boolean>;
}

export function AccessGate({
  portalSettings,
  loadingSettings,
  isDark,
  onToggleDark,
  onUnlock,
  onUpdateAccessCode,
}: AccessGateProps) {
  const [mode, setMode] = useState<'login' | 'recovery' | 'recovered'>('login');
  const [accessInput, setAccessInput] = useState('');
  const [showAccessCode, setShowAccessCode] = useState(false);
  const [recoveryInput, setRecoveryInput] = useState('');
  const [showRecoveryCode, setShowRecoveryCode] = useState(false);
  const [newAccessCode, setNewAccessCode] = useState('');
  const [savingNewCode, setSavingNewCode] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleLoginSubmit = (e: FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    if (accessInput.trim() === portalSettings.accessCode.trim()) {
      onUnlock();
      return;
    }
    setErrorMsg('Código de acesso incorreto. Verifique e tente novamente.');
  };

  const handleRecoveryVerify = (e: FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    if (recoveryInput.trim() === portalSettings.recoveryCode.trim()) {
      setMode('recovered');
      setNewAccessCode('');
      return;
    }
    setErrorMsg('Código de recuperação inválido.');
  };

  const handleSaveNewAccessCode = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    const trimmed = newAccessCode.trim();
    if (trimmed.length < 4) {
      setErrorMsg('O novo código de acesso deve ter pelo menos 4 caracteres.');
      return;
    }
    setSavingNewCode(true);
    const ok = await onUpdateAccessCode(trimmed);
    setSavingNewCode(false);
    if (ok) {
      onUnlock();
    } else {
      setErrorMsg('Não foi possível salvar o novo código agora. Tente novamente.');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col justify-between p-4 sm:p-6 transition-colors">
      <div className="flex justify-end max-w-5xl w-full mx-auto">
        <button
          type="button"
          onClick={onToggleDark}
          aria-label={isDark ? 'Ativar modo claro' : 'Ativar modo escuro'}
          className="h-9 px-3 text-xs font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
        >
          {isDark ? (
            <Sun className="w-3.5 h-3.5 text-amber-400" />
          ) : (
            <Moon className="w-3.5 h-3.5 text-slate-600" />
          )}
          {isDark ? 'Modo Claro' : 'Modo Escuro'}
        </button>
      </div>

      <div className="w-full max-w-md mx-auto my-auto py-8">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shadow-sm overflow-hidden">
          <div className="px-6 py-5 border-b border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-2 text-blue-700 dark:text-blue-400 text-xs font-semibold">
              <Lock className="w-4 h-4 shrink-0" />
              <span>Acesso Restrito à Secretaria</span>
            </div>
            <h1 className="mt-2 font-display text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100 text-balance">
              Relatório Congregação — José dos Reis
            </h1>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Monitoramento de atividades ministeriais, cadastros e lembretes.
            </p>
          </div>

          <div className="p-6">
            {loadingSettings ? (
              <div className="py-6 text-center text-xs text-slate-500 dark:text-slate-400">
                Carregando configurações de acesso...
              </div>
            ) : mode === 'login' ? (
              <form onSubmit={handleLoginSubmit} className="space-y-4">
                <div>
                  <label
                    htmlFor="portal-access-code"
                    className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5"
                  >
                    Código de Acesso Congregacional
                  </label>
                  <div className="relative">
                    <input
                      id="portal-access-code"
                      type={showAccessCode ? 'text' : 'password'}
                      value={accessInput}
                      onChange={(e) => {
                        setAccessInput(e.target.value);
                        if (errorMsg) setErrorMsg(null);
                      }}
                      placeholder="Digite o código de acesso"
                      autoFocus
                      required
                      className="w-full h-11 pl-3 pr-10 text-sm font-mono bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-md text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-600"
                    />
                    <button
                      type="button"
                      onClick={() => setShowAccessCode((prev) => !prev)}
                      aria-label={showAccessCode ? 'Ocultar código' : 'Mostrar código'}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
                    >
                      {showAccessCode ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>

                {errorMsg && (
                  <div className="p-3 rounded-md bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800 text-xs text-red-800 dark:text-red-300">
                    {errorMsg}
                  </div>
                )}

                <button
                  type="submit"
                  className="w-full h-11 px-4 text-sm font-medium text-white bg-blue-700 dark:bg-blue-600 rounded-md hover:bg-blue-800 dark:hover:bg-blue-500 transition-colors cursor-pointer"
                >
                  Entrar
                </button>

                <div className="pt-1 text-center">
                  <button
                    type="button"
                    onClick={() => {
                      setMode('recovery');
                      setErrorMsg(null);
                      setRecoveryInput('');
                    }}
                    className="text-xs font-medium text-blue-700 dark:text-blue-400 hover:underline cursor-pointer"
                  >
                    Esqueceu o código?
                  </button>
                </div>
              </form>
            ) : mode === 'recovery' ? (
              <form onSubmit={handleRecoveryVerify} className="space-y-4">
                <div>
                  <label
                    htmlFor="portal-recovery-code"
                    className="flex items-center gap-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5"
                  >
                    <KeyRound className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                    <span>Código de Recuperação</span>
                  </label>
                  <div className="relative">
                    <input
                      id="portal-recovery-code"
                      type={showRecoveryCode ? 'text' : 'password'}
                      value={recoveryInput}
                      onChange={(e) => {
                        setRecoveryInput(e.target.value);
                        if (errorMsg) setErrorMsg(null);
                      }}
                      placeholder="Digite o código de recuperação"
                      autoFocus
                      required
                      className="w-full h-11 pl-3 pr-10 text-sm font-mono bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-md text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-600"
                    />
                    <button
                      type="button"
                      onClick={() => setShowRecoveryCode((prev) => !prev)}
                      aria-label={showRecoveryCode ? 'Ocultar código' : 'Mostrar código'}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
                    >
                      {showRecoveryCode ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>

                {errorMsg && (
                  <div className="p-3 rounded-md bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800 text-xs text-red-800 dark:text-red-300">
                    {errorMsg}
                  </div>
                )}

                <button
                  type="submit"
                  className="w-full h-11 px-4 text-sm font-medium text-white bg-blue-700 dark:bg-blue-600 rounded-md hover:bg-blue-800 dark:hover:bg-blue-500 transition-colors cursor-pointer"
                >
                  Validar Código de Recuperação
                </button>

                <div className="pt-1 text-center">
                  <button
                    type="button"
                    onClick={() => {
                      setMode('login');
                      setErrorMsg(null);
                    }}
                    className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 cursor-pointer"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    Voltar
                  </button>
                </div>
              </form>
            ) : (
              <div className="space-y-4">
                <div className="p-3.5 rounded-md bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800">
                  <div className="text-xs font-medium text-emerald-800 dark:text-emerald-300">
                    Código de acesso atual:
                  </div>
                  <div className="mt-1 text-base font-mono font-semibold text-emerald-950 dark:text-emerald-100 select-all">
                    {portalSettings.accessCode}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={onUnlock}
                  className="w-full h-10 px-4 text-xs font-medium text-white bg-emerald-700 hover:bg-emerald-800 rounded-md transition-colors cursor-pointer"
                >
                  Entrar com o Código Atual
                </button>

                <form
                  onSubmit={handleSaveNewAccessCode}
                  className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-3"
                >
                  <label
                    htmlFor="new-portal-access-code"
                    className="block text-xs font-medium text-slate-700 dark:text-slate-300"
                  >
                    Ou definir um novo código de acesso:
                  </label>
                  <input
                    id="new-portal-access-code"
                    type="text"
                    value={newAccessCode}
                    onChange={(e) => {
                      setNewAccessCode(e.target.value);
                      if (errorMsg) setErrorMsg(null);
                    }}
                    placeholder="Digite o novo código (mín. 4 caracteres)"
                    className="w-full h-10 px-3 text-sm font-mono bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-md text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />

                  {errorMsg && (
                    <div className="p-2.5 rounded-md bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800 text-xs text-red-800 dark:text-red-300">
                      {errorMsg}
                    </div>
                  )}

                  <div className="flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setMode('login');
                        setErrorMsg(null);
                      }}
                      className="h-9 px-3 text-xs font-medium text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer"
                    >
                      Voltar
                    </button>
                    <button
                      type="submit"
                      disabled={savingNewCode}
                      className="h-9 px-4 text-xs font-medium text-white bg-blue-700 dark:bg-blue-600 rounded-md hover:bg-blue-800 dark:hover:bg-blue-500 disabled:opacity-50 cursor-pointer"
                    >
                      {savingNewCode ? 'Salvando...' : 'Salvar Novo Código e Entrar'}
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="text-center text-xs text-slate-400 dark:text-slate-600 pb-2">
        Congregação José dos Reis
      </div>
    </div>
  );
}
