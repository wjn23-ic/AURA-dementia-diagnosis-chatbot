
export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
  timestamp: Date;
}

export interface AnalysisReport {
  timestamp: Date;
  summary: string;
  concerns: string[];
  suggestedAction: string;
  stageAssessment: string;
}

export enum AppView {
  LANDING = 'LANDING',
  PATIENT = 'PATIENT',
  DOCTOR = 'DOCTOR',
}

export enum AppMode {
  CONVERSATION = 'CONVERSATION',
  TEST_SETUP = 'TEST_SETUP',
  TEST_ACTIVE = 'TEST_ACTIVE'
}

export type TestType = 'SEMANTIC' | 'PHONEMIC' | null;

export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface FluencyMetric {
  totalWords: number;
  uniqueWords: number;
  repetitions: number;
  clusters: string[][]; // e.g. ["lion", "tiger"] (felines), ["cow", "pig"] (farm)
  switches: number; // Number of times switching between clusters
  timeInSeconds: number;
}

export interface FluencyScore {
  score: number;
  threshold: number;
  isConcern: boolean;
  metrics: FluencyMetric;
  rawAnalysis: string;
}