# Open-Source Components & Data Sources Evaluation

This document provides a comprehensive inventory and audit of all evaluated open-source repositories, libraries, datasets, and external APIs for **RutinFit Desktop**.

Every entry specifies its canonical source, verified license, real usage status in the codebase, and legal attribution obligations.

---

## Evaluation Summary Table

| Component / Source | Canonical URL | Verified License | Actual Usage Status | Role in RutinFit Desktop |
|---|---|---|---|---|
| **openGym** | [GitHub mirror](https://github.com/DuarteSantos8/openGym) · [Gitea Upstream](https://gitea.com/DuarteSantos/openGym) | **AGPL-3.0**<br>(Media: **Gym Visual** Copyright) | **adapted**<br>(Data model & logic) | Workout set/rep structure, RPE scale, and exercise schema adapted to local SQLite. Web UI and Docker container NOT bundled to eliminate AGPL copyleft risks and Gym Visual copyright liabilities. |
| **Open Food Facts** | [openfoodfacts-server](https://github.com/openfoodfacts/openfoodfacts-server) · [API Documentation](https://openfoodfacts.github.io/documentation/docs/Product-Opener/api/) | Server: **AGPL-3.0**<br>DB: **ODbL 1.0**<br>Contents: **DbCL**<br>Images: **CC BY-SA** | **external API/data source** | Remote REST API client for packaged food and barcode lookup (`src/lib/openfoodfacts-client.ts`). SQLite query cache (`OpenFoodFactsCache`) implemented. Server code is NOT copied. Mandatory ODbL attribution displayed in UI. |
| **Tally** | [GeneArnold/tally](https://github.com/GeneArnold/tally) | **MIT**<br>(Copyright 2026 Gene Arnold) | **adapted**<br>(UX Patterns) | Adapted portion scale multipliers (0.5x, 1x, 1.5x) and immediate macro calculation UX into food log. Parallel database and remote AI API calls were omitted. |
| **Pantry Host** | [jpdevries/pantry-host](https://github.com/jpdevries/pantry-host) | **MIT**<br>(Copyright 2026 JP de Vries) | **adapted**<br>(Data Model & Logic) | Adapted pantry inventory model (`PantryItem`) and net shopping list calculation (`calculateNetShoppingList`) in `src/lib/pantry-service.ts`. Anthropic remote API calls completely removed; replaced with local Ollama/LM Studio. |
| **Diet App** | [whiteravens20/diet-app](https://github.com/whiteravens20/diet-app) | **AGPL-3.0**<br>*(PolyForm Noncommercial is obsolete)* | **reference only** | Multi-day target calorie meal-planning and ingredient reuse strategies reviewed conceptually. Due to AGPL-3.0 license and alpha development state, NO code was copied. |
| **Meals** | [marco308/meals](https://github.com/marco308/meals) | Core: **AGPL-3.0**<br>iOS: Separate terms | **deferred** / **reference only** | AI tools and MCP architecture reviewed. RutinFit's 2-phase commit approval engine (`ActionDraft`, `approvalTokenHash`) already provides superior user safety; code integration was deferred. |
| **MuscleMapJS** | [abdofallah/MuscleMapJS](https://github.com/abdofallah/MuscleMapJS) | **MIT**<br>(Derived from Melih Çolpan MuscleMap) | **adopted**<br>(UI Component) | Integrated as native `<MuscleHeatmap />` React/SVG component for front and back anatomical muscle fatigue/recovery visualization. |
| **MuscleMap SwiftUI SDK** | [MuscleMap/MuscleMap](https://github.com/MuscleMap/MuscleMap) | **MIT**<br>(Copyright Melih Çolpan) | **reference only**<br>(Upstream attribution) | Upstream source of anatomical SVG paths and groupings for MuscleMapJS. Preserved in third-party notices. |

---

## Detailed Component Audits

### 1. openGym
* **Canonical URL:** `https://gitea.com/DuarteSantos/openGym` (Mirrored at `https://github.com/DuarteSantos8/openGym`)
* **Audit Date:** 2026-10-18
* **Verified License:** GNU Affero General Public License v3.0 (AGPL-3.0).
* **Media License Notice:** Exercise animation GIF files and diagrams are copyrighted by **Gym Visual** (`https://gymvisual.com`) and are not licensed for unrestricted public redistribution.
* **Usage Decision:** **adapted**.
* **Rationale & Isolation:**
  * To protect RutinFit from AGPL copyleft contamination and Gym Visual copyright infringement, OpenGym's web application and Docker container are **NOT** bundled into the desktop release.
  * RutinFit re-implements workout tracking, RPE, rest timers, and plate calculations cleanly using native React and SQLite.
  * A local synchronization bridge (`src/lib/opengym-client.ts`) is provided for users who independently run OpenGym locally and wish to sync their data.

### 2. Open Food Facts
* **Canonical URL:** `https://github.com/openfoodfacts/openfoodfacts-server`
* **Audit Date:** 2026-10-18
* **Licenses:**
  * Server Software: AGPL-3.0
  * Database: Open Database License (ODbL) 1.0
  * Database Contents: Database Contents License (DbCL) 1.0
  * Product Photos: Creative Commons Attribution-ShareAlike (CC BY-SA) or original contributor copyright
* **Usage Decision:** **external API/data source**.
* **Implementation Details:**
  * Implemented strictly as an external HTTPS client (`src/lib/openfoodfacts-client.ts`) querying `https://world.openfoodfacts.org/api/v2` and `v3`.
  * Mandatory User-Agent header configured: `RutinFit-Desktop/0.1.0 (https://github.com/memir/fitness; local-client)`.
  * Local caching in SQLite (`OpenFoodFactsCache`) prevents unnecessary network requests and respects rate limits.
  * UI prominently displays: *"Data provided by Open Food Facts under ODbL 1.0"*.

### 3. Tally
* **Canonical URL:** `https://github.com/GeneArnold/tally`
* **Audit Date:** 2026-10-18
* **Verified License:** MIT License (Copyright 2026 Gene Arnold).
* **Usage Decision:** **adapted**.
* **Implementation Details:**
  * UX patterns for quick portion multipliers (0.5x, 1x, 1.5x) and immediate deterministic calorie/macro updates were adapted into `src/app/nutrition` and `src/app/foods`.
  * Tally's original database and cloud AI integrations were not used.

### 4. Pantry Host
* **Canonical URL:** `https://github.com/jpdevries/pantry-host`
* **Audit Date:** 2026-10-18
* **Verified License:** MIT License (Copyright 2026 JP de Vries).
* **Usage Decision:** **adapted**.
* **Implementation Details:**
  * Pantry item tracking (`PantryItem`) and net shopping list calculation (`calculateNetShoppingList`) were adapted in `src/lib/pantry-service.ts`.
  * Pantry Host's default Anthropic cloud API calls were intentionally removed to protect user privacy. All AI operations run through RutinFit's local AI coach abstraction (Ollama/LM Studio).

### 5. Diet App
* **Canonical URL:** `https://github.com/whiteravens20/diet-app`
* **Audit Date:** 2026-10-18
* **Verified License:** GNU Affero General Public License v3.0 (AGPL-3.0). *(Earlier reports mentioning PolyForm Noncommercial are obsolete).*
* **Usage Decision:** **reference only**.
* **Rationale:** Due to AGPL-3.0 copyleft obligations and the author's explicit note that the codebase is in early experimental development, no code from Diet App was copied or linked.

### 6. Meals
* **Canonical URL:** `https://github.com/marco308/meals`
* **Audit Date:** 2026-10-18
* **Verified License:** AGPL-3.0 for core codebase; separate proprietary terms for iOS components.
* **Usage Decision:** **deferred / reference only**.
* **Rationale:** RutinFit's pre-existing 2-phase commit AI agent framework (`ActionDraft`, `approvalTokenHash`, `AuditEvent`) already exceeds Meals in security and user control. No code was incorporated.

### 7. MuscleMapJS & MuscleMap SwiftUI SDK
* **Canonical URLs:**
  * JavaScript/TypeScript: `https://github.com/abdofallah/MuscleMapJS`
  * Original SwiftUI SDK: `https://github.com/MuscleMap/MuscleMap`
* **Audit Date:** 2026-10-18
* **Verified Licenses:** MIT License (Copyright 2026 abdofallah; Copyright 2024 Melih Çolpan).
* **Usage Decision:** **adopted**.
* **Implementation Details:**
  * Re-implemented as a zero-dependency React/SVG interactive component (`src/components/MuscleHeatmap.tsx`).
  * Visualizes anatomical muscle fatigue and recovery based on user set logs in the last 7 days.
  * Complete MIT copyright and attribution notices are preserved in `THIRD_PARTY_NOTICES.md`.
