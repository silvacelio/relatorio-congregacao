export type PrivilegeType =
  | 'Publicador'
  | 'Pioneiro Auxiliar'
  | 'Pioneiro Regular'
  | 'Servo Ministerial'
  | 'Ancião';

export type AuxiliaryPioneerOption = 'Não' | '15 horas' | '30 horas' | 'Contínuo';

export type PublisherGender = 'Masculino' | 'Feminino';
export type PublisherHope = 'Outras Ovelhas' | 'Ungido';
export type SpecialRoleType = 'Nenhum' | 'Pioneiro especial' | 'Missionário em campo';

export interface Publisher {
  id: string;
  name: string;
  group: string;
  groupId?: string;
  privilege: PrivilegeType;
  active: boolean;
  phone?: string;
  birthDate?: string;
  baptismDate?: string;
  gender?: PublisherGender;
  hope?: PublisherHope;
  isRegularPioneer?: boolean;
  specialRole?: SpecialRoleType;
  publisherCode?: string;
  statusFlags?: string;
}

export interface ActivityReport {
  id: string;
  monthKey: string; // YYYY-MM
  timestamp: string; // ISO string or formatted timestamp
  publisherName: string;
  publisherId?: string;
  privilegeSnapshot?: PrivilegeType;
  participated: boolean;
  hours: number | null;
  bibleStudies: number | null;
  auxiliaryPioneer: AuxiliaryPioneerOption;
  notes: string;
}

export type PendingSelfReportStatus = 'pendente' | 'confirmado' | 'recusado';

export interface PendingSelfReport {
  id: string;
  monthKey: string; // YYYY-MM
  submittedAt: string;
  publisherId?: string;
  publisherName: string;
  privilegeSnapshot: PrivilegeType;
  participated: boolean;
  hours: number | null;
  bibleStudies: number | null;
  auxiliaryPioneer: AuxiliaryPioneerOption;
  notes: string;
  status: PendingSelfReportStatus;
}

export interface PortalSettings {
  id: string;
  accessCode: string;
  recoveryCode: string;
  updatedAt?: string;
}

export interface ServiceGroup {
  id: string;
  name: string;
  overseerName: string;
  overseerWhatsapp: string;
  notes: string;
  sortOrder: number;
}

export interface ServiceOverseerSettings {
  id: string;
  supervisorName: string;
  supervisorWhatsapp: string;
  cycleLabel: string;
  cycleStartDate: string;
}

export type GroupVisitStatus = 'realizada' | 'agendada';

export interface GroupVisit {
  id: string;
  groupId: string;
  groupNameSnapshot: string;
  visitDate: string; // YYYY-MM-DD
  visitorName: string;
  notes: string;
  status: GroupVisitStatus;
}

export interface MeetingAttendance {
  id: string; // YYYY-MM
  monthKey: string; // YYYY-MM
  midweekWeeks: (number | null)[]; // [sem1, sem2, sem3, sem4, sem5]
  weekendWeeks: (number | null)[]; // [sem1, sem2, sem3, sem4, sem5]
  notes: string;
}

export type TabKey =
  | 'resposta'
  | 'respostas'
  | 'cadastro'
  | 'quem_falta'
  | 'grupos'
  | 'visitas'
  | 'assistencia'
  | 'cartoes'
  | 'enviar_relatorio';

export interface ToastMessage {
  id: string;
  text: string;
  tone: 'success' | 'error' | 'info';
}
