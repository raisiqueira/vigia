---
name: vigia-method
description: Vigia method to find, prove, score, and fix security vulnerabilities in JavaScript, TypeScript, and Python web code.
---

# Vigia method

## Rules

1. **Scope.** Work only on the code in this project and on targets at `localhost`. Do not contact other hosts. Do not send project code to a web service.
2. **Evidence.** A finding without a PoC that ran is a hypothesis. Do not call a hypothesis a vulnerability.
3. **Oracles.** Some questions ask how a parser reads a string, for example "how does the browser read this URL?" Use the `vigia` oracle tools for these questions. Do not answer them from memory.
4. **Writes.** Write files only in `.vigia/`. Do not change application code unless the user asks for it.
5. **Records.** Save each hypothesis with the finding tool, and also save the rejected ones. Then other agents can see the work and do not do it again.

## Stages

1. **Map.** Find the entry points: routes, views, API handlers, template engines, client bootstrap code, and public package exports. Find each trust boundary, where untrusted data enters. Write the map to `.vigia/surface.md`.
2. **Hunt.** For each trust boundary, follow the data from the **source** (untrusted input) through the **check** (validation, escaping, allowlist) to the **sink** (dangerous operation). Save each possible bug as a `hypothesis`, with file and line anchors.
3. **Prove.** Write a PoC in `.vigia/pocs/<ID>/` and run it. Record the exact command and the output. Set the status to `reproduced` if the PoC shows the bug. Set it to `rejected` with a reason if it does not.
4. **Confirm (optional).** Show the impact in a small app that uses the code the way a real consumer does. Then set the status to `confirmed`.
5. **Score.** Give the exploitability score (see below), the severity, and a CVSS vector when you can.
6. **Fix.** Write the smallest patch that removes the root cause, plus a regression test. Store them in `fix`. Do not apply the patch unless the user asks.
7. **Report.** Run the report tool. It writes `.vigia/report.md`.

## Where to look

### Parser differentials

This class is the one that tools miss most often. A check reads input one way, and the consumer (browser, URL loader, database, shell) reads it a different way.

- **URL checks.** Look for scheme checks with regex or `startsWith`, host allowlists, open redirect checks, and SSRF filters. The WHATWG parser removes TAB, LF, and CR everywhere in the input. It strips leading and trailing C0 controls and spaces. It reads `\` as `/` for special schemes. It also resolves `//host`, `/\host`, and root-relative paths against the base. Python `urlsplit` does not do all of this. Test each candidate input with the `url` oracle, and use `python: true` for Python code.
- **Module loading.** Look for `import()`, `require()`, `<script src>`, and `new Worker()` with values that come from page data, config, or a CMS. Use the `url` oracle with `base` to see the real target origin.
- **HTML context.** Look for template engines, tagged templates, and escaping helpers that decide where a value lands. Render the template with a marker as the value. Then use the `html` oracle to see where the browser puts the marker. Watch for script data escape states (`<!--` and `<script` inside a script), RCDATA (`textarea`, `title`), foreign content (`svg`, `math`), and whitespace sets (`/\s/` in JavaScript also matches NBSP, but the HTML tokenizer uses ASCII whitespace only).
- **Paths.** Look for normalization that runs before or after the check, for example `path.join` or `os.path.join` with an absolute user path, `..` after URL decoding, and Unicode normalization.
- **Case and Unicode.** Look for `toLowerCase()` compared with `casefold()`, dotless i, and fullwidth characters in host or username checks.

### Injection

- **SQL.** In JS/TS: template strings in `query()`, `knex.raw`, `sequelize.query`, and `$queryRawUnsafe`. In Python: f-strings or `%` in `cursor.execute`, and Django `raw()`, `extra()`, and `RawSQL`.
- **Shell.** In JS/TS: `child_process.exec` and `execSync` with input. In Python: `subprocess` with `shell=True` and `os.system`.
- **XSS sinks.** In JS/TS: `innerHTML`, `outerHTML`, `insertAdjacentHTML`, `document.write`, `dangerouslySetInnerHTML`, and `v-html`. In Python: `mark_safe`, `|safe`, `{% autoescape off %}`, `Markup()`, and `format_html` used in the wrong way.
- **Template injection.** `render_template_string(user)`, `Template(user)`, and `new Function` or `eval` on user input.
- **Prototype pollution.** Deep merge, `set(obj, path, value)`, and query parsers that accept `__proto__`, `constructor`, or `prototype` keys.

### Access control

- Routes or views without an auth check. Compare them with sibling routes that have one.
- IDOR: an object that is fetched by an ID from the request without an owner check.
- Mass assignment: `req.body` passed directly to an ORM update, or a DRF serializer with `fields = "__all__"`.
- CSRF: `@csrf_exempt`, and state changes on `GET`.
- JWT: `algorithms` not pinned, `verify=False`, and `decode` used instead of `verify`.

### Outbound requests (SSRF)

`fetch`, `axios`, `got`, `requests`, and `httpx` with a URL that comes from the user. Look for a check on the string followed by a connect to the resolved address (DNS rebinding), and redirects that the client follows by default.

### Files

Downloads and uploads with user file names: `res.sendFile`, `send_file`, `FileResponse`, and `open()`. Also archive extraction (zip slip) and upload content types that the server serves back.

### Deserialization and dynamic code

`pickle`, `yaml.load` without `SafeLoader`, `marshal`, `node-serialize`, `vm.runInContext` used as a sandbox, and `eval`.

### Configuration

Django `DEBUG = True`, `ALLOWED_HOSTS = ["*"]`, a hard-coded `SECRET_KEY`, CORS `*` with credentials, cookies without `HttpOnly`, `Secure`, or `SameSite`, and missing CSP where the code depends on one.

### Denial of service

Regex with nested quantifiers on user input (ReDoS), and parsers without size limits.

## PoC rules

- Make the PoC self-contained and deterministic. It must print `VIGIA-POC: VULNERABLE` or `VIGIA-POC: NOT VULNERABLE`, together with the evidence.
- Prefer a PoC that imports the project's own module and calls it directly. It runs fast and needs no network.
- JavaScript and TypeScript: use a `node` script (`.mjs`), or a test file for the project's test runner.
- Python: use a `python3 -I` script, or a `pytest` test. For Django views, use `django.test.Client` in a test.
- For browser behavior, first use the oracles. Use a real browser (Playwright) only if the project already has it.
- Do not use real credentials, do not delete data, and do not contact hosts other than `localhost`.

## Exploitability score

Give each dimension a value. The total gives the priority.

| Dimension | 0 | 1 | 2 | 3 |
| --- | --- | --- | --- | --- |
| Reachability | Not reachable by an attacker | Local or admin only | Needs a position: authenticated user, markup injection, or semi-trusted data | Remote input without authentication |
| Exposure | Dead code or tests only | Opt-in feature or unusual configuration | Common configuration | Default, in every install |
| Certainty | Depends on a race, timing, or an unlikely state | Needs a specific but legal code shape | Deterministic, works every time | — |
| Impact | Small information leak or limited DoS | Limited data access or integrity loss | Code execution, account takeover, or full data access | — |

Certainty and Impact go from 0 to 2. Reachability and Exposure go from 0 to 3.

Priority: 9–10 is P0, 7–8 is P1, 5–6 is P2, and 0–4 is P3. Impact limits the priority: with Impact 1 the highest priority is P1, and with Impact 0 it is P2. Thus an open redirect cannot be P0, even if it is easy to reach. The tool calculates the priority. Write the reason for each value in `score.rationale`.
