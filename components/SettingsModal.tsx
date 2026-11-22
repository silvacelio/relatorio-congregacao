import { Eye, EyeOff, Lock, Settings, X } from 'lucide-react';
import { FormEvent, useState } from 'react';
import { PortalSettings } from '../types';

interface SettingsModalProps {
  portalSettings: PortalSettings;
  onClose: () => void;
  onSaveSettings: (next: PortalSettings) => Promise<boolean>;
  onLockPortal: () => void;
}

export function SettingsModal({
  portalSettings,
  onClose,
  onSaveSettings,
  onLockPortal,
}: SettingsModalProps) {
  const [accessCode, setAccessCode] = useState(portalSettings.accessCode);
  const [recoveryCode, setRecoveryCode] = useState(portalSettings.recoveryCode);
  const [showAccess, setShowAccess] = useState(false);
  const [showRecovery, setShowRecovery] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    const cleanAccess = accessCode.trim();
    const cleanRecovery = recoveryCode.trim();

    if (cleanAccess.length < 4) {
      setErrorMsg('O código de acesso deve ter pelo menos 4 caracteres.');
      return;
    }
    if (cleanRecovery.length < 4) {
      setErrorMsg('O código de recuperação deve ter pelo menos 4 caracteres.');
      return;
    }

    setSaving(true);
    const ok = await onSaveSettings({
      ...portalSettings,
      accessCode: cleanAccess,
      recoveryCode: cleanRecovery,
    });
    setSaving(false);

    if (ok) {
      onClose();
    } else {
      setErrorMsg('Erro ao salvar configurações no banco. Tente novamente.');
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/60 dark:bg-black/70 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-modal-title"
    >
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg w-full max-w-md shadow-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Settings className="w-4 h-4 text-blue-700 dark:text-blue-400" />
            <h2 id="settings-modal-title" className="text-base font-semibold text-slate-900 dark:text-slate-100">
              Configurações de Acesso
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar configurações"
            className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            As alterações nos códigos são sincronizadas automaticamente para todos os dispositivos conectados ao sistema.
          </p>

          <div>
            <label
              htmlFor="settings-access-code"
              className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
            >
              Código de Acesso Congregacional
            </label>
            <div className="relative">
              <input
                id="settings-access-code"
                type={showAccess ? 'text' : 'password'}
                value={accessCode}
                onChange={(e) => setAccessCode(e.target.value)}
                required
                className="w-full h-10 pl-3 pr-10 text-sm font-mono bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
              <button
                type="button"
                onClick={() => setShowAccess((prev) => !prev)}
                aria-label={showAccess ? 'Ocultar código de acesso' : 'Mostrar código de acesso'}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
              >
                {showAccess ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div>
            <label
              htmlFor="settings-recovery-code"
              className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
            >
              Código de Recuperação
            </label>
            <div className="relative">
              <input
                id="settings-recovery-code"
                type={showRecovery ? 'text' : 'password'}
                value={recoveryCode}
                onChange={(e) => setRecoveryCode(e.target.value)}
                required
                className="w-full h-10 pl-3 pr-10 text-sm font-mono bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
              <button
                type="button"
                onClick={() => setShowRecovery((prev) => !prev)}
                aria-label={showRecovery ? 'Ocultar código de recuperação' : 'Mostrar código de recuperação'}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
              >
                {showRecovery ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {errorMsg && (
            <div className="p-3 rounded-md bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800 text-xs text-red-800 dark:text-red-300">
              {errorMsg}
            </div>
          )}

          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
            <button
              type="button"
              onClick={onLockPortal}
              className="h-9 px-3 text-xs font-medium text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900/60 rounded-md hover:bg-red-100 dark:hover:bg-red-950/80 inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Lock className="w-3.5 h-3.5" />
              Bloquear Acesso
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="h-9 px-4 text-xs font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saving}
                className="h-9 px-4 text-xs font-medium text-white bg-blue-700 dark:bg-blue-600 rounded-md hover:bg-blue-800 dark:hover:bg-blue-500 disabled:opacity-50 cursor-pointer"
              >
                {saving ? 'Salvando...' : 'Salvar Códigos'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
