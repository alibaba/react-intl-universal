# UI Inspection Evidence

This reference is the authoritative contract for screenshots, annotations, before/after binding, `report.json`, and `report.html` in UI Inspection Mode.

## Contents

- [Evidence records](#evidence-records)
- [Screenshot admission](#screenshot-admission)
- [Annotations](#annotations)
- [Before and after binding](#before-and-after-binding)
- [Report lifecycle](#report-lifecycle)
- [Wireframe preservation contract](#wireframe-preservation-contract)
- [Report content](#report-content)
- [Prevention-first consistency gate](#prevention-first-consistency-gate)

## Evidence records

Use two separate collections. A saved file is never evidence merely because its filename says `final`, `clean`, or `recapture`.

### Capture ledger

Create a `captureLedger` record immediately after saving every candidate image. Its initial state is `pendingPixelReview`. Record the path, capture time, locale, viewport, intended route/state, and intended purpose.

Store screenshot paths relative to the report folder, for example `20260712_080719_screenshots/CAP-001.jpg`. Never store machine-specific absolute paths in `captureLedger` or `screenshotManifest`; the generated report must remain portable when the run folder is moved or served over HTTP.

The primary agent must then open the exact saved file and move the candidate to exactly one terminal state:

- `admitted`: the pixels pass every admission gate; the record points to the promoted screenshot-manifest ID;
- `rejected`: record one or more concrete rejection reasons and never bind the file to a finding, observation, coverage item, or appendix.

Keep the terminal-state fields mutually exclusive. An admitted record must have an empty `rejectionReasons` array and a valid `admittedScreenshotId`. A rejected record must have one or more `rejectionReasons` and must not have `admittedScreenshotId`. Descriptions of why an admitted image is useful belong in `notes`, not in `rejectionReasons`.

Do not infer this decision from the live page, DOM snapshot, byte size, dimensions, filename, or a browser preview that is not the saved file.

### Admitted screenshot manifest

Only an admitted candidate may create a `screenshotManifest` record. Record:

- stable screenshot ID and path;
- capture time and timezone;
- full URL or route/state, target locale, viewport, and page/module label;
- action and readiness signal;
- coverage or finding purpose;
- status such as `coverage`, `issueEvidence`, `verificationFailed`, `verified`, `blocked`, or `nonI18n`;
- notes describing exactly what the pixels prove and do not prove;
- annotation coordinates and visible label text when applicable;
- release commit for final after evidence.

Write both transitions to `inspection-log.md` and `report.json` while the route/state is still understood.

## Screenshot admission

Every candidate must pass this gate before promotion into `screenshotManifest` or attachment to a finding, blocker, non-i18n observation, coverage item, or appendix.

1. **Correct state:** URL, route, active tab/menu, open modal/drawer/dropdown, filters, data state, and scroll position match the record.
2. **Correct locale:** the requested product locale is visibly active. Browser chrome or external tools do not determine the product locale.
3. **Ready content:** page-specific main content and the target component are loaded; the screenshot is not a skeleton, spinner, stale transition, blank state, or half-rendered route.
4. **No foreign overlay:** browser extensions, preview selectors, password managers, developer tooling, unrelated notifications, and OS UI do not cover or alter the target.
5. **File format valid:** inspect the saved file's magic bytes or MIME type and confirm they match its extension. If a capture API returns JPEG bytes for a `.png` path, save it as `.jpg` or convert it to a true PNG before pixel review. A decoder artifact caused only by a mislabeled extension is not product evidence and is not automatically a compositor failure.
6. **No capture corruption:** after format normalization, reject unexpected black rectangles, blank composites, missing layers, duplicated regions, or other screenshot-tool artifacts even when the DOM snapshot looks correct.
7. **Target visible:** the described problem or verification region is actually visible and large enough for a human to judge.
8. **Context sufficient:** the image includes enough page/component context to prove the route and state. A crop that shows only isolated text without its component is insufficient.
9. **Saved pixels inspected:** the primary agent opens the exact normalized saved image and checks the pixels before changing `pendingPixelReview` to `admitted`. File existence, DOM text, dimensions, byte size, a prior capture, or another agent's assertion are not substitutes.

If a full-viewport capture is corrupted, take a clipped recapture of the target region. The clipped image is admissible only when it remains pixel-faithful, includes sufficient component context, and passes all gates. Record that it is a clipped recapture. Never use cropping to hide a real regression or change the apparent before/after capacity.

Use a complete product viewport as the primary evidence whenever possible so a reviewer can locate the feature in navigation and understand the surrounding workflow. A tight target crop is detail evidence, not location evidence. When tooling corruption makes a clipped recapture necessary, also bind an admitted full-context screenshot through `contextScreenshotRefs`; the context screenshot must show the route, active navigation/tab, and affected component location, while the detail screenshot proves the exact pixels. Do not substitute browser chrome, OS chrome, or a textual URL for product context.

Rejected screenshots may remain in the run folder for debugging, but they exist only in `captureLedger`; they must not appear in `screenshotManifest` or the HTML report. A real product regression captured without tooling corruption is different: admit and report it with status `verificationFailed` and the exact product failure reason.

When a candidate is rejected, restore or recreate the intended state and capture a new candidate. A suffix such as `-recapture` does not carry admission forward: the new file starts at `pendingPixelReview` and must be opened independently.

## Annotations

Accepted visual observations require visible annotations in `report.html`:

- issue evidence has a red box around the actual problem and a short visible label;
- final after evidence marks the same verified region and labels the successful condition;
- failed verification evidence marks the remaining or new defect;
- visually observable blockers and non-i18n observations include a screenshot and annotation;
- one screenshot may have multiple boxes when the finding explicitly covers related regions.

Annotations must be rendered as HTML/CSS overlays over the real screenshot so the original evidence pixels remain unchanged. Store stable percentage-based coordinates in `report.json` or the report data. Verify that boxes and labels align both inline and in the enlarged lightbox.

Do not add a box merely to satisfy the format. The box must point to the element described by the title and caption. If annotation is genuinely inapplicable, record a specific rationale; raw screenshot-only cards are otherwise incomplete.

## Before and after binding

Before and after evidence must be comparable:

- same product locale;
- same viewport unless the finding is explicitly responsive;
- same route and equivalent interaction state;
- same selected tab/filter/mode;
- same or equivalent data/empty state;
- same scroll position or visible-capacity baseline;
- target component and immediate neighbors visible in both images.

The after screenshot must come from the exact final released commit recorded by the finding. Do not use an earlier preview, local development screenshot, source diff, or static build result as final visual proof.

Before assigning `verifiedFixed`, compare:

- the original problem region;
- neighboring labels and controls;
- visible item/column/tab capacity;
- presence of editors, charts, tables, actions, validation, and other key components;
- new clipping, overlap, mid-word breaks, or misplaced fixed-column boundaries.

If the after image proves less than the before image, leave the finding unverified and re-enter the fix loop.

## Report lifecycle

### Start once

At the beginning of the first loop for a repository in a Codex task:

1. create the run folder and screenshot folder;
2. copy `ui-inspection-report-wireframe.html` to `report.html` with a filesystem copy;
3. create `inspection-log.md` and `report.json`;
4. replace only the initial report metadata and zero-state counts;
5. keep these same artifacts for all later loops in the task.

### Update continuously

When an observation passes admission:

1. promote the admitted candidate into `screenshotManifest`;
2. create the finding or observation record and bind the promoted ID immediately;
3. add it to the overview and detail section;
4. update counts from actual states;
5. append screenshot metadata to the appendix;
6. advance lifecycle state only when its required evidence exists.

Do not postpone all report construction until the end, when screenshots and states are easier to misbind. Rejected candidates never enter report content and therefore cannot be accidentally relabeled during final assembly.

## Wireframe preservation contract

The wireframe is executable report code, not a visual suggestion. A generated report MUST retain:

- Bootstrap CSS and the desktop-only layout assumptions;
- hero metadata and the three metrics: issues found, issues fixed, and need attention;
- finding overview with reviewer feedback;
- finding detail cards;
- separate Blockers and Non-i18n sections;
- screenshot appendix;
- Bootstrap badge styles;
- finding-detail modal;
- screenshot lightbox;
- nested modal behavior where one real `Escape` closes only the topmost lightbox, then a second `Escape` closes the finding modal;
- close buttons and backdrop behavior;
- localized feedback-copy behavior and fallback;
- right-side Back to top control.
- original-pixel screenshot presentation: report images are not resized or cropped by CSS; evidence is arranged vertically, and oversized images use an explicit scroll viewport;
- one shared geometry box for each image and its percentage annotations, both inline and in the lightbox.

The agent MUST NOT:

- recreate the report with a different DOM structure or design;
- replace Bootstrap with ad hoc styling;
- delete required sections because they are empty; show an explicit empty state instead;
- add a coverage matrix; put URL, action, status, notes, and capture time directly under each screenshot appendix item;
- add an inspection timeline, independent visual-review appendix, report interaction-validation section, or generic human-attention/risk appendix;
- put template replacement instructions in the generated report;
- leave mock screenshots, placeholder findings, sample values, or debug logging.

Populate the copied wireframe with the deterministic renderer after each coherent evidence batch:

```bash
node <skill-dir>/scripts/render-ui-inspection-report.mjs \
  --report-json <run-folder>/report.json \
  --template <skill-dir>/references/ui-inspection-report-wireframe.html \
  --output <run-folder>/report.html
```

The renderer replaces only the wireframe's report content region and preserves its CSS, Bootstrap dependency, modal/lightbox stack, feedback controls, and Back to top interaction. Do not hand-author a second HTML data model beside `report.json`.

If the copied template cannot be preserved, stop report generation and fix the copy/population method before continuing. Do not compensate with a post-hoc style comparison.

## Report content

### Summary

Counts are derived from records:

- **Issues found:** confirmed i18n findings plus confirmation-required system-copy candidates.
- **Issues fixed:** findings in `verifiedFixed` with final-release after evidence.
- **Need attention:** open, blocked, failed verification, deferred, not-fixable-here, or confirmation-required items.

Represent a confirmation-required system-copy candidate once, as a finding with status `needsHumanConfirmation`; do not duplicate it in an observation collection.

### Finding overview

Each row includes ID, title, concise ownership/risk note, fix risk, lifecycle status, verification confidence, and reviewer feedback. Clicking the title opens the finding modal.

### Finding details

Each card includes:

- URL/state, locale, viewport, steps, expected, and actual;
- source attribution and recommended owner;
- before, failed-intermediate when relevant, and final after evidence;
- visible annotations and capture times;
- concise changed-file/diff summary only when local code changed;
- fix rationale, regression checks, validation, release commit, and acceptance result.

Do not show an empty diff panel for backend, external, or unmodified findings.

For verified frontend findings, `fixEvidence.changedFiles` and `fixEvidence.localValidation` must be non-empty. Use the report schema field names exactly: validation records are `{ command, result, notes? }`, where `result` is `passed`, `failed`, `failed-pre-existing`, or `not-run`. Do not invent parallel field names such as `check` or `status`; malformed records make the HTML summary misleading even when rendering succeeds.

### Blockers and non-i18n observations

Keep these separate from `I18N-xxx` findings. A visible non-i18n observation needs a screenshot so a human can judge the exclusion quickly. Do not promote recovered blank/loading states or user-created names to these sections merely to preserve noise.

### Screenshot appendix

List every admitted screenshot with:

- image and filename;
- capture time and timezone;
- page/module;
- URL/state;
- action;
- status;
- notes.

The appendix replaces a separate coverage matrix. Exclude corrupt, wrong-state, loading, plugin-obscured, or otherwise rejected screenshots.

If no issues are found, still produce the report with honest coverage screenshots, explicit zero counts, empty Blockers/Non-i18n states, and the states actually verified.

## Prevention-first consistency gate

The main defense is correct admission and immediate population, not a large repair pass at the end. Before handoff, perform only these focused integrity checks:

1. Derive overview counts from the final records and compare them with the visible metrics.
2. For each finding, match title, description, status, source attribution, screenshot IDs, annotations, and release commit.
3. Confirm every candidate has a terminal admission decision, every image path exists, no rejected capture appears in `screenshotManifest`, and no DOM `id` is duplicated.
4. Confirm the report contains no sample marker, mock screenshot, placeholder finding, template instruction, or debug UI.
5. Parse every executable inline script with Node's `vm.Script` or an equivalent syntax-only check.
6. When browser policy permits, open the copied report and exercise one overview finding, nested screenshot lightbox, real Escape stack, feedback copy, appendix lightbox, and Back to top. If policy blocks this, state the limitation; do not claim browser interaction verification and do not circumvent the policy.
7. For one full-context image and one annotated detail image, verify in Chrome that `clientWidth/clientHeight` equal `naturalWidth/naturalHeight`, the annotation stage equals the rendered image box, no evidence column is clipped, and the same annotation remains aligned after opening the lightbox.

Report rendering and interaction checks are artifact integrity checks. They do not replace code, locale, build, test, release-commit, or product-UI verification.
