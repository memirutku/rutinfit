# Third-Party Notices & Licenses

This project incorporates components, libraries, and design patterns from third-party open-source projects under their respective licenses.

---

## 1. MuscleMapJS & MuscleMap SwiftUI SDK
* **Components:** Muscle heatmap SVG anatomical models, coordinate maps, and grouping schemas (`src/components/MuscleHeatmap.tsx`).
* **Source:** https://github.com/abdofallah/MuscleMapJS (Port of Melih Çolpan's MuscleMap SwiftUI SDK)
* **License:** MIT License

```
MIT License

Copyright (c) 2026 abdofallah
Copyright (c) 2024 Melih Çolpan

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

---

## 2. Open Food Facts (Database & Image Attribution)
* **Components:** Packaged food data, nutritional values, ingredients, and barcodes accessed via `src/lib/openfoodfacts-client.ts`.
* **Database License:** Open Database License (ODbL) 1.0
* **Individual Contents:** Database Contents License (DbCL) 1.0
* **Product Images:** Creative Commons Attribution-ShareAlike 3.0 / 4.0 (CC BY-SA)

> **Legal Notice:**  
> Food product data is provided by the Open Food Facts community database and made available under the **Open Database License (ODbL) v1.0** (https://opendatacommons.org/licenses/odbl/1.0/).  
> Individual contents of the database are licensed under the Database Contents License (DbCL).  
> Any product images displayed are subject to Creative Commons Attribution-ShareAlike licenses or original contributor terms.

---

## 3. Tally
* **Components:** Portion scaling multipliers (0.5x, 1x, 1.5x) and immediate calorie/macro feedback UX patterns.
* **Source:** https://github.com/GeneArnold/tally
* **License:** MIT License

```
MIT License

Copyright (c) 2026 Gene Arnold

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
```

---

## 4. Pantry Host
* **Components:** Pantry inventory data structures and net shopping list calculation patterns (`src/lib/pantry-service.ts`).
* **Source:** https://github.com/jpdevries/pantry-host
* **License:** MIT License

```
MIT License

Copyright (c) 2026 JP de Vries

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
```

---

## 5. Next.js, React, and Core Dependencies

### Next.js
* **License:** MIT License
* **Copyright:** (c) 2026 Vercel, Inc.

### React & React-DOM
* **License:** MIT License
* **Copyright:** (c) Meta Platforms, Inc. and affiliates.

### Prisma Client & Engines
* **License:** Apache License, Version 2.0
* **Copyright:** (c) 2026 Prisma Data, Inc.

### Lucide React
* **License:** ISC License / MIT License
* **Copyright:** (c) 2026 Lucide Contributors.

### Tailwind CSS
* **License:** MIT License
* **Copyright:** (c) Tailwind Labs, Inc.

### Mammoth (.docx parser)
* **License:** BSD 2-Clause License
* **Copyright:** (c) 2013-2024 Michael Searle

### PDF-Parse
* **License:** MIT License
* **Copyright:** (c) 2026 Andrea Parodi

### SheetJS (xlsx)
* **License:** Apache License, Version 2.0
* **Copyright:** (c) SheetJS LLC

### Recharts
* **License:** MIT License
* **Copyright:** (c) 2015-2026 Recharts Group

---

## 6. openGym & Exercise Media Isolation

* **Upstream Project:** [openGym](https://github.com/DuarteSantos8/openGym) by DuarteSantos8
* **Upstream License:** GNU Affero General Public License v3.0 (AGPL-3.0)
* **Integration Model:** Out-of-process Sidecar / Local REST API & JSON state file bridge.
* **Architecture Boundary Notice:**  
  RutinFit is licensed under the MIT License and **does not** embed, relicense, or statically compile openGym source code into the core RutinFit distribution. openGym operates as an optional, independent companion process (sidecar) communicating via localhost HTTP/JSON.
* **Exercise Media Notice:**  
  Exercise illustrations and animations in openGym originate from Gym Visual. These media assets are subject to third-party copyright and **are NOT bundled** with RutinFit binaries. RutinFit only renders user-supplied assets or references local openGym sidecar endpoints at runtime without unauthorized redistribution.
