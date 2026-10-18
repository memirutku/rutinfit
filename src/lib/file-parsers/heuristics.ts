import { ConfidenceLevel, NormalizedArtifactType } from './types';

interface AnalysisResult {
  normalizedType: NormalizedArtifactType;
  confidence: ConfidenceLevel;
  uncertainties: string[];
  sourceSummary: string;
}

export function classifyContent(
  text: string,
  tableData?: Array<Record<string, any>>
): AnalysisResult {
  const lower = text.toLowerCase();
  const uncertainties: string[] = [];

  // Keyword scoring
  const scores = {
    meal_plan: 0,
    workout_plan: 0,
    weight_logs: 0,
    recipe: 0,
  };

  // Meal plan keywords
  if (/(kahvalt[ıi]|öğle|akşam|ara öğün|meal|breakfast|lunch|dinner|snack)/i.test(lower)) scores.meal_plan += 4;
  if (/(kalori|protein|karbonhidrat|yağ|kcal|makro)/i.test(lower)) scores.meal_plan += 3;
  if (/(gram|porsiyon|besin|diyet|beslenme\s+plan)/i.test(lower)) scores.meal_plan += 2;

  // Workout plan keywords
  if (/(set|tekrar|reps|bench|squat|deadlift|rpe|push|pull|legs|antrenman|egzersiz)/i.test(lower)) scores.workout_plan += 4;
  if (/(dinlenme|split|ısınma|ağırlık\s+programı|kardiyo)/i.test(lower)) scores.workout_plan += 3;

  // Weight logs keywords
  if (/(kilo|tart[ıi]|ağırlık\s+takip|kg\b|bel\s*çevresi|vücut\s+ağırlığı)/i.test(lower)) scores.weight_logs += 4;
  if (/\b\d{2}[./-]\d{2}[./-]\d{4}\b/.test(text) && /(kg\b|kilo)/i.test(lower)) scores.weight_logs += 3;

  // Recipe keywords
  if (/(malzemeler|yapılışı|hazırlanışı|pişirme\s+süresi|tarifi\b|porsiyon\s+adedi)/i.test(lower)) scores.recipe += 4;

  let bestType: NormalizedArtifactType = 'unstructured';
  let highestScore = 0;

  for (const [type, score] of Object.entries(scores)) {
    if (score > highestScore && score >= 4) {
      highestScore = score;
      bestType = type as NormalizedArtifactType;
    }
  }

  // Assess confidence
  let confidence: ConfidenceLevel = 'medium';

  if (bestType === 'unstructured') {
    confidence = 'low';
    uncertainties.push('Metin belirli bir plana (beslenme, antrenman, kilo veya tarif) doğrudan eşleşmedi; serbest metin olarak işlenecektir.');
  } else if (highestScore >= 7) {
    confidence = 'high';
  }

  // Check tabular data quality if present
  if (tableData && tableData.length > 0) {
    const firstRow = tableData[0];
    const columnCount = Object.keys(firstRow).length;
    if (columnCount < 2) {
      uncertainties.push('Tabloda 2\'den az sütun tespit edildi; yapısal eşleştirme kısmi olabilir.');
      if (confidence === 'high') confidence = 'medium';
    }
  }

  // Generate source summary
  let sourceSummary = '';
  switch (bestType) {
    case 'meal_plan':
      sourceSummary = `Beslenme Planı / Öğün Listesi (${tableData ? `${tableData.length} satır tablo` : `${text.split('\n').length} satır metin`})`;
      break;
    case 'workout_plan':
      sourceSummary = `Antrenman / Egzersiz Programı (${tableData ? `${tableData.length} hareket/set` : `${text.split('\n').length} satır`})`;
      break;
    case 'weight_logs':
      sourceSummary = `Vücut Ağırlığı ve Ölçüm Kayıtları (${tableData ? `${tableData.length} ölçüm` : 'Metin'})`;
      break;
    case 'recipe':
      sourceSummary = `Yemek Tarifi ve Malzeme Listesi`;
      break;
    default:
      sourceSummary = `Genel Serbest İçerik (${text.length} karakter)`;
  }

  return {
    normalizedType: bestType,
    confidence,
    uncertainties,
    sourceSummary,
  };
}
