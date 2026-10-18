# Security Policy & Privacy Architecture

## Reporting Security Issues

If you discover a security vulnerability or privacy concern in RutinFit, please report it directly through GitHub Security Advisories on the repository rather than filing a public issue.

---

## Security Principles & Data Protection

RutinFit is designed as a **local-first, privacy-preserving desktop application**:

1. **Local Storage First:** All personal fitness data, food logs, body weights, recipes, and notes are stored locally in a SQLite database located in the operating system's standard user data directory (`~/Library/Application Support/RutinFit/` on macOS).
2. **Loopback Only:** Managed local background services listen exclusively on `127.0.0.1` (loopback). Services are never bound to `0.0.0.0` or exposed to the local area network (LAN) or public internet.
3. **Local AI Privacy:**
   * Conversations with local AI models (Ollama / LM Studio) are routed strictly through local loopback endpoints (`127.0.0.1:11434` or `127.0.0.1:1234`).
   * No user data, logs, or files are sent to third-party cloud providers unless the user explicitly configures a remote API key.
4. **Prompt Injection Defense:**
   * Text extracted from uploaded user files (PDF, XLSX, DOCX) is isolated inside `<untrusted_content>` tags with strict system instructions.
   * AI models cannot execute arbitrary shell commands, raw SQL queries, or file system modifications.
   * Model outputs are parsed through strict Zod schemas and require user confirmation via two-phase commit tokens (`approvalTokenHash`, `ActionDraft`) before modifying any persistent records.
5. **Deterministic Calculations:** Nutritional totals (calories, protein, carbs, fat) and plate calculations are computed by audited deterministic TypeScript code, never guessed by LLM text generation.
