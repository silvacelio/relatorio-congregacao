export type PrivilegeType =
  | 'Publicador'
  | 'Pioneiro Regular'
  | 'Pioneiro Auxiliar'
  | 'Servo Ministerial'
  | 'Ancião';

export type AuxiliaryPioneerOption = 'Não' | '15 horas' | '30 horas' | 'Contínuo';

export interface Publisher {
  id: string;
  name: string;
  group: string;
  privilege: PrivilegeType;
  active: boolean;
  phone?: string;
}

export interface ActivityReport {
  id: string;
  monthKey: string; // YYYY-MM
  timestamp: string; // ISO string or formatted timestamp
  publisherName: string;
  publisherId?: string;
  participated: boolean;
  hours: number | null;
  bibleStudies: number | null;
  auxiliaryPioneer: AuxiliaryPioneerOption;
  notes: string;
}

export type TabKey = 'resposta' | 'respostas' | 'cadastro' | 'quem_falta';

export interface ToastMessage {
  id: string;
  text: string;
  tone: 'success' | 'error' | 'info';
}
