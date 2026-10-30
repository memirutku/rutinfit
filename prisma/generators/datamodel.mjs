#!/usr/bin/env node
/**
 * Prisma üreteci: şemanın model/alan bilgisini src/generated/datamodel.ts'e yazar.
 *
 * Prisma 7'nin `prisma-client` üreteci `Prisma.dmmf`'i artık dışa vermiyor; yedekleme servisi
 * (src/lib/services/backup.ts) ise tabloları, yabancı anahtarları ve benzersiz alanları şemadan
 * okuyor. Bu dosya `prisma generate` sırasında çalışır; çalışma anında Prisma iç paketlerine
 * bağımlılık yoktur.
 */
import fs from "node:fs";
import path from "node:path";
import helper from "@prisma/generator-helper";

const { generatorHandler } = helper;

const FIELD_KEYS = [
  "name",
  "kind",
  "type",
  "isList",
  "isRequired",
  "isId",
  "isUnique",
  "hasDefaultValue",
  "isUpdatedAt",
  "relationName",
  "relationFromFields",
  "relationToFields",
];

function pick(field) {
  const out = {};
  for (const key of FIELD_KEYS) {
    if (field[key] !== undefined) out[key] = field[key];
  }
  return out;
}

generatorHandler({
  onManifest: () => ({
    prettyName: "RutinFit datamodel",
    defaultOutput: "../src/generated/datamodel.ts",
  }),
  onGenerate: async (options) => {
    const output = options.generator.output?.value;
    if (!output) throw new Error("datamodel üreteci: output yolu yok");
    const models = options.dmmf.datamodel.models.map((m) => ({
      name: m.name,
      fields: m.fields.map(pick),
      uniqueFields: m.uniqueFields.map((u) => [...u]),
    }));
    const body = `/* Bu dosya prisma/generators/datamodel.mjs tarafından üretilir; elle düzenlemeyin. */
/* eslint-disable */

export interface DatamodelField {
  name: string;
  kind: "scalar" | "object" | "enum" | "unsupported";
  type: string;
  isList: boolean;
  isRequired: boolean;
  isId: boolean;
  isUnique: boolean;
  hasDefaultValue: boolean;
  isUpdatedAt?: boolean;
  relationName?: string;
  relationFromFields?: string[];
  relationToFields?: string[];
}

export interface DatamodelModel {
  name: string;
  fields: DatamodelField[];
  uniqueFields: string[][];
}

export const datamodel: { models: DatamodelModel[] } = ${JSON.stringify({ models }, null, 2)};
`;
    fs.mkdirSync(path.dirname(output), { recursive: true });
    fs.writeFileSync(output, body);
  },
});
