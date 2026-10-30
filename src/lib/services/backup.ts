import { datamodel, type DatamodelField } from '../../generated/datamodel';
import type { Prisma } from '../db/client';
import { prisma } from '../prisma';
import { checkAIBaseUrl, DEFAULT_AI_BASE_URL } from '../security/ai-endpoint';

/**
 * Tam kapsamlı yedekleme / geri yükleme.
 *
 * Tablo ve alan bilgisi Prisma şemasından (prisma generate → src/generated/datamodel.ts) okunur: şemaya yeni tablo/sütun eklendiğinde
 * yedek kendiliğinden kapsar. Geri yükleme birleştirme (merge) yapar: yedekteki kayıtlar eklenir
 * veya güncellenir, yedekte olmayan yerel kayıtlar silinmez. Tek transaction'da çalışır; herhangi
 * bir hata olursa hiçbir şey yazılmaz.
 */

export const BACKUP_VERSION = '2.0';

/** Yazma sırası: üst kayıtlar alt kayıtlardan önce. */
export const BACKUP_TABLES = [
  'UserProfile',
  'FoodItem',
  'FoodMeasure',
  'Recipe',
  'RecipeIngredient',
  'MealPlan',
  'PlannedMeal',
  'FoodLog',
  'DrinkLog',
  'SavedMeal',
  'SavedMealItem',
  'CustomExercise',
  'WorkoutTemplate',
  'WorkoutExercise',
  'WorkoutSession',
  'SetLog',
  'CardioLog',
  'WeightLog',
  'BodyMeasurement',
  'DailyWellbeing',
  'SupplementLog',
  'ShoppingListItem',
  'PantryItem',
  'AISettings',
  'AIConversation',
  'UploadedFile',
  'ExtractedArtifact',
  'ActionDraft',
  'AIMessage',
  'AuditEvent',
  'WeeklyCheckin',
] as const;

/** Yeniden üretilebilir önbellekler ve makineye özgü ayarlar (otomatik yedek klasörü) yedeğe alınmaz. */
export const EXCLUDED_TABLES = ['OpenFoodFactsCache', 'AutoBackupSettings'] as const;

/**
 * Üst kayıt geri yüklenince alt kayıtları yedektekiyle birebir aynı olur
 * (ör. tarifte yereldeki fazla malzeme kaldırılır).
 */
const OWNED_CHILDREN: Partial<Record<string, string>> = {
  RecipeIngredient: 'recipeId',
  PlannedMeal: 'mealPlanId',
  WorkoutExercise: 'templateId',
  SetLog: 'workoutSessionId',
  SavedMealItem: 'savedMealId',
  FoodMeasure: 'foodItemId',
  ExtractedArtifact: 'fileId',
  AIMessage: 'conversationId',
};

/** Uygulama tek profil / tek AI ayarı satırıyla çalışır. */
const SINGLETON_IDS: Partial<Record<string, string>> = {
  UserProfile: 'default-user',
  AISettings: 'default-ai',
};

/** Arayüzün ve eski yedeklerin kullandığı adlar (sayım çıktısında da kullanılır). */
const LEGACY_KEYS: Record<string, string> = {
  UserProfile: 'profile',
  FoodItem: 'foods',
  Recipe: 'recipes',
  MealPlan: 'mealPlans',
  FoodLog: 'foodLogs',
  WorkoutTemplate: 'workoutTemplates',
  WorkoutSession: 'workoutSessions',
  WeightLog: 'weightLogs',
  BodyMeasurement: 'measurements',
  DailyWellbeing: 'wellbeings',
  SupplementLog: 'supplementLogs',
  ShoppingListItem: 'shoppingListItems',
  PantryItem: 'pantryItems',
  AISettings: 'aiSettings',
};

const CHUNK = 500;

export class BackupValidationError extends Error {
  constructor(readonly issues: string[]) {
    super(`Yedek dosyası geçersiz: ${issues.slice(0, 5).join('; ')}${issues.length > 5 ? ` (+${issues.length - 5} hata)` : ''}`);
    this.name = 'BackupValidationError';
  }
}

type Row = Record<string, unknown>;
type ScalarField = DatamodelField;

interface ModelMeta {
  name: string;
  key: string;
  scalars: ScalarField[];
  /** FK sütunu → hedef model */
  foreignKeys: Map<string, string>;
  /** id dışındaki benzersiz anahtarlar (tekli veya bileşik) */
  uniqueKeys: string[][];
}

export const delegateKey = (model: string) => model.charAt(0).toLowerCase() + model.slice(1);

let metaCache: Map<string, ModelMeta> | null = null;

function metadata(): Map<string, ModelMeta> {
  if (metaCache) return metaCache;
  metaCache = new Map();
  for (const m of datamodel.models) {
    const scalars = m.fields.filter((f) => f.kind === 'scalar' || f.kind === 'enum');
    const foreignKeys = new Map<string, string>();
    for (const f of m.fields) {
      if (f.kind === 'object' && f.relationFromFields?.length) {
        for (const fk of f.relationFromFields) foreignKeys.set(fk, f.type);
      }
    }
    const uniqueKeys = [
      ...scalars.filter((f) => f.isUnique && !f.isId).map((f) => [f.name]),
      ...m.uniqueFields.map((u) => [...u]),
    ];
    metaCache.set(m.name, { name: m.name, key: delegateKey(m.name), scalars, foreignKeys, uniqueKeys });
  }
  return metaCache;
}

function delegate(client: Prisma.TransactionClient | typeof prisma, model: string): any {
  return (client as any)[delegateKey(model)];
}

// ---------------------------------------------------------------- dışa aktarma

export async function exportAllData() {
  const data: Record<string, Row[]> = {};
  for (const model of BACKUP_TABLES) {
    data[delegateKey(model)] = await delegate(prisma, model).findMany({ orderBy: { id: 'asc' } });
  }
  return { version: BACKUP_VERSION, exportedAt: new Date().toISOString(), data };
}

// ---------------------------------------------------------------- eski (1.x) biçim

/** 1.0 / 1.1 iç içe biçimini tablo başına düz satırlara çevirir. */
export function legacyToTables(data: Record<string, any>): Record<string, Row[]> {
  const out: Record<string, Row[]> = {};
  const push = (model: string, rows: unknown) => {
    if (!Array.isArray(rows)) return;
    (out[delegateKey(model)] ??= []).push(...(rows.filter(Boolean) as Row[]));
  };

  if (data.profile) push('UserProfile', [data.profile]);
  push('FoodItem', data.foods);
  for (const r of data.recipes ?? []) {
    const { ingredients, ...recipe } = r;
    push('Recipe', [recipe]);
    push('RecipeIngredient', (ingredients ?? []).map((i: Row) => ({ ...i, recipeId: recipe.id })));
  }
  for (const mp of data.mealPlans ?? []) {
    const { meals, ...plan } = mp;
    push('MealPlan', [plan]);
    push('PlannedMeal', (meals ?? []).map((m: Row) => ({ ...m, mealPlanId: plan.id })));
  }
  push('FoodLog', data.foodLogs);
  for (const wt of data.workoutTemplates ?? []) {
    const { exercises, ...tpl } = wt;
    push('WorkoutTemplate', [tpl]);
    push(
      'WorkoutExercise',
      (exercises ?? []).map((e: any) => ({ ...e, templateId: tpl.id, orderIndex: e.orderIndex ?? e.order ?? 0 }))
    );
  }
  for (const ws of data.workoutSessions ?? []) {
    const { setLogs, ...session } = ws;
    push('WorkoutSession', [session]);
    push('SetLog', (setLogs ?? []).map((s: Row) => ({ ...s, workoutSessionId: session.id })));
  }
  push('WeightLog', data.weightLogs);
  push('BodyMeasurement', data.measurements);
  push('DailyWellbeing', data.wellbeings);
  push(
    'SupplementLog',
    (data.supplementLogs ?? []).map((s: any) => ({
      ...s,
      name: s.name ?? s.supplementName ?? 'Kreatin Monohidrat',
      doseGrams: s.doseGrams ?? s.dosage ?? 5,
    }))
  );
  push('ShoppingListItem', data.shoppingListItems);
  push('PantryItem', data.pantryItems);
  if (data.aiSettings) push('AISettings', [data.aiSettings]);
  return out;
}

// ---------------------------------------------------------------- doğrulama

function coerceValue(field: ScalarField, value: unknown): { ok: true; value: unknown } | { ok: false } {
  switch (field.type) {
    case 'String':
      return typeof value === 'string' ? { ok: true, value } : { ok: false };
    case 'Int':
      return typeof value === 'number' && Number.isInteger(value) ? { ok: true, value } : { ok: false };
    case 'Float':
      return typeof value === 'number' && Number.isFinite(value) ? { ok: true, value } : { ok: false };
    case 'Boolean':
      return typeof value === 'boolean' ? { ok: true, value } : { ok: false };
    case 'DateTime': {
      const d = typeof value === 'string' || typeof value === 'number' ? new Date(value) : value instanceof Date ? value : null;
      return d && !isNaN(d.getTime()) ? { ok: true, value: d } : { ok: false };
    }
    default:
      return { ok: true, value };
  }
}

/** Satırı şemaya göre doğrular, bilinmeyen alanları atar. updatedAt yazmada otomatik yenilenir. */
function sanitizeRow(meta: ModelMeta, raw: Row, index: number, issues: string[]): Row | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    issues.push(`${meta.key}[${index}] nesne değil`);
    return null;
  }
  const row: Row = {};
  let valid = true;
  for (const f of meta.scalars) {
    if (f.isUpdatedAt) continue;
    const value = raw[f.name];
    if (value === undefined || value === null) {
      if (f.isRequired && !f.hasDefaultValue) {
        issues.push(`${meta.key}[${index}].${f.name} zorunlu`);
        valid = false;
      } else if (value === null && !f.isRequired) {
        row[f.name] = null;
      }
      continue;
    }
    const coerced = coerceValue(f, value);
    if (!coerced.ok) {
      issues.push(`${meta.key}[${index}].${f.name} ${f.type} olmalı`);
      valid = false;
      continue;
    }
    row[f.name] = coerced.value;
  }
  return valid ? row : null;
}

// ---------------------------------------------------------------- geri yükleme

const keyOf = (row: Row, fields: string[]) => JSON.stringify(fields.map((f) => row[f]));

function chunks<T>(items: T[], size = CHUNK): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/** Model-özel güvenlik kuralları (tekil satırlar, AI adresi). */
function applyPolicies(model: string, row: Row): Row {
  const singleton = SINGLETON_IDS[model];
  if (singleton) row.id = singleton;
  if (model === 'AISettings') {
    const url = typeof row.baseUrl === 'string' && checkAIBaseUrl(row.baseUrl).ok ? row.baseUrl : DEFAULT_AI_BASE_URL;
    row.baseUrl = url;
    if (!['ollama', 'lmstudio', 'openai'].includes(String(row.providerType))) row.providerType = 'ollama';
    row.connectionStatus = 'untested';
  }
  return row;
}

export interface RestoreResult {
  counts: Record<string, number>;
}

/**
 * Düz tablo verisini geri yükler. Önce tüm satırlar doğrulanır; hata varsa hiçbir şey yazılmadan
 * BackupValidationError fırlatılır.
 */
export async function restoreTables(tables: Record<string, unknown>): Promise<RestoreResult> {
  const meta = metadata();
  const issues: string[] = [];
  const prepared = new Map<string, Row[]>();

  for (const model of BACKUP_TABLES) {
    const m = meta.get(model)!;
    const rawRows = tables[m.key];
    if (rawRows === undefined || rawRows === null) continue;
    if (!Array.isArray(rawRows)) {
      issues.push(`${m.key} bir dizi olmalı`);
      continue;
    }
    const rows: Row[] = [];
    rawRows.forEach((raw, i) => {
      const row = sanitizeRow(m, raw as Row, i, issues);
      if (row) rows.push(applyPolicies(model, row));
    });
    prepared.set(model, rows);
  }
  if (issues.length) throw new BackupValidationError(issues);

  const counts: Record<string, number> = {};

  await prisma.$transaction(
    async (tx) => {
      // Yedekteki kimlik → yerelde kullanılan kimlik (doğal anahtar çakışmalarında değişir)
      const idMap = new Map<string, Map<string, string>>();
      const restoredIds = new Map<string, Set<string>>();

      for (const model of BACKUP_TABLES) {
        let rows = prepared.get(model);
        if (!rows || rows.length === 0) continue;
        const m = meta.get(model)!;
        const db = delegate(tx, model);
        const remap = idMap.get(model) ?? new Map<string, string>();
        idMap.set(model, remap);

        // 1) Yabancı anahtarları yerel kimliklere çevir
        rows = rows.map((r) => {
          const out = { ...r };
          for (const [fk, target] of m.foreignKeys) {
            const v = out[fk];
            const mapped = typeof v === 'string' ? idMap.get(target)?.get(v) : undefined;
            if (mapped) out[fk] = mapped;
          }
          return out;
        });

        // 2) Yedek içindeki tekrarları ayıkla (son kayıt kazanır)
        const byIdentity = new Map<string, Row>();
        for (const r of rows) {
          const naturalKey = m.uniqueKeys.find((k) => k.every((f) => r[f] !== undefined && r[f] !== null));
          const identity = r.id ? `id:${r.id}` : naturalKey ? `nk:${keyOf(r, naturalKey)}` : `row:${byIdentity.size}`;
          byIdentity.set(identity, r);
        }
        rows = [...byIdentity.values()];

        // 3) Var olan kayıtları kimliğe ve doğal anahtara göre bul
        const existingIds = new Set<string>();
        const withId = rows.filter((r) => typeof r.id === 'string') as Array<Row & { id: string }>;
        for (const part of chunks(withId.map((r) => r.id))) {
          for (const e of await db.findMany({ where: { id: { in: part } }, select: { id: true } })) existingIds.add(e.id);
        }
        for (const uk of m.uniqueKeys) {
          const candidates = rows.filter((r) => !(typeof r.id === 'string' && existingIds.has(r.id)) && uk.every((f) => r[f] != null));
          if (!candidates.length) continue;
          const lead = uk[0];
          const leadValues = [...new Set(candidates.map((r) => r[lead]))];
          const found = new Map<string, string>();
          for (const part of chunks(leadValues)) {
            const select = Object.fromEntries([['id', true], ...uk.map((f) => [f, true])]);
            for (const e of await db.findMany({ where: { [lead]: { in: part } }, select })) found.set(keyOf(e, uk), e.id);
          }
          for (const r of candidates) {
            const localId = found.get(keyOf(r, uk));
            if (!localId) continue;
            if (typeof r.id === 'string' && r.id !== localId) remap.set(r.id, localId);
            r.id = localId;
            existingIds.add(localId);
          }
        }

        // 4) Sahipli alt kayıtlar: geri yüklenen üst kaydın yedekte olmayan çocuklarını kaldır
        const ownerFk = OWNED_CHILDREN[model];
        if (ownerFk) {
          const parentModel = m.foreignKeys.get(ownerFk)!;
          const parents = [...(restoredIds.get(parentModel) ?? [])];
          const keepIds = new Set(rows.map((r) => r.id).filter((id): id is string => typeof id === 'string'));
          // Prisma 7 (sürücü adaptörü) SQLite'ta sorgu başına en çok 999 parametre gönderir; `in`
          // listelerini böler ama `notIn` listesini bölemez (P2029). Silinecekler önce okunur,
          // sonra parça parça silinir.
          const stale: string[] = [];
          for (const part of chunks(parents)) {
            for (const e of await db.findMany({ where: { [ownerFk]: { in: part } }, select: { id: true } })) {
              if (!keepIds.has(e.id)) stale.push(e.id);
            }
          }
          for (const part of chunks(stale)) await db.deleteMany({ where: { id: { in: part } } });
        }

        // 5) Yaz: yeni satırlar toplu, var olanlar tek tek güncellenir
        const toCreate = rows.filter((r) => !(typeof r.id === 'string' && existingIds.has(r.id)));
        const toUpdate = rows.filter((r) => typeof r.id === 'string' && existingIds.has(r.id));
        for (const part of chunks(toCreate)) await db.createMany({ data: part });
        for (const r of toUpdate) {
          const { id, ...data } = r;
          await db.update({ where: { id }, data });
        }

        const ids = new Set(rows.map((r) => r.id).filter((id): id is string => typeof id === 'string'));
        restoredIds.set(model, ids);
        counts[LEGACY_KEYS[model] ?? m.key] = rows.length;
      }
    },
    { timeout: 120_000, maxWait: 10_000 }
  );

  return { counts };
}

