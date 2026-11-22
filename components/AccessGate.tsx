import { useEffect } from 'react';
import { PortalSettings } from '../types';

interface AccessGateProps {
  portalSettings: PortalSettings;
  loadingSettings: boolean;
  isDark: boolean;
  onToggleDark: () => void;
  onUnlock: () => void;
  onUpdateAccessCode: (newCode: string) => Promise<boolean>;
}

export function AccessGate({ onUnlock }: AccessGateProps) {
  useEffect(() => {
    onUnlock();
  }, [onUnlock]);

  return null;
}
