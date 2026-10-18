export type NormalizedArtifactType =
  | 'meal_plan'
  | 'workout_plan'
  | 'weight_logs'
  | 'recipe'
  | 'unstructured';

export type ConfidenceLevel = 'high' | 'medium' | 'low';

export interface ParsedFileResult {
  rawText: string;
  sanitizedContent: string;
  normalizedType: NormalizedArtifactType;
  structuredData: Record<string, any>;
  confidence: ConfidenceLevel;
  uncertainties: string[];
  sourceSummary: string;
  metadata?: {
    pageCount?: number;
    sheetNames?: string[];
    rowCount?: number;
    wordCount?: number;
    format: string;
  };
}

export interface ParseFileInput {
  buffer: Buffer;
  originalName: string;
  mimeType: string;
  aiModelName?: string;
  hasVisionSupport?: boolean;
}
