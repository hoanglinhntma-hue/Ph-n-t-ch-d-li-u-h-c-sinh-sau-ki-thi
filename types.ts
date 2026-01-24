
export enum SubjectLevel {
  TOT = 'TỐT',
  KHA = 'KHÁ',
  DAT = 'ĐẠT',
  CHUA_DAT = 'CHƯA ĐẠT'
}

export enum StudentClassification {
  TOT = 'Học sinh TỐT',
  TIEM_CAN_TOT = 'Tiệm cận TỐT',
  KHA = 'Học sinh KHÁ',
  DAT = 'Học sinh ĐẠT',
  NGUY_CO = 'Nguy cơ (Dưới 5.0)',
}

export interface SubjectScore {
  name: string;
  score: number;
  level: SubjectLevel;
}

export interface Goal {
  subjectName: string;
  currentScore: number;
  targetScore: number;
  increment: number;
  description: string;
}

export interface StudentData {
  id: number;
  name: string;
  className: string;
  scores: SubjectScore[];
  classification: StudentClassification;
  summary: string;
  goals: Goal[];
  prioritySubjects: string[];
}

export interface ClassStats {
  total: number;
  totCount: number;
  tiemCanTotCount: number;
  khaCount: number;
  datCount: number;
  nguyCoCount: number;
}
