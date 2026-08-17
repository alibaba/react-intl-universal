# UI Inspection Evidence

This reference defines the authoritative evidence and report contract for UI Inspection Mode.

Use:

- [ui-inspection-report.schema.json](ui-inspection-report.schema.json) for the machine-readable `report.json` structure;
- `scripts/lib/ui-inspection-report-contract.mjs` for cross-record, image, Git, release, risk, and review invariants;
- `scripts/validate-ui-inspection-report.mjs` before rendering or handoff;
- `scripts/render-ui-inspection-report.mjs` only after validation.

Always start from the initializer's current `report.json` and fill that record during the inspection. Do not reuse or reshape report data from another run.

## Contents

- [One source of truth](#one-source-of-truth)
- [Hashed supporting artifacts](#hashed-supporting-artifacts)
- [Source-backed coverage inventory](#source-backed-coverage-inventory)
- [Immutable capture assets](#immutable-capture-assets)
- [State snapshots](#state-snapshots)
- [Admission](#admission)
- [Claim-level evidence bindings](#claim-level-evidence-bindings)
- [Independent evidence reading](#independent-evidence-reading)
- [Annotations](#annotations)
- [Finding and acceptance contract](#finding-and-acceptance-contract)
- [Fix assessment and risk](#fix-assessment-and-risk)
- [Deployment and chronology](#deployment-and-chronology)
- [Run-local report lifecycle](#run-local-report-lifecycle)
- [Final report review](#final-report-review)
- [Focused final checks](#focused-final-checks)

## One source of truth

`report.json` is the only report data model. Derive HTML metrics, finding status, effective fix risk, and final report status from validated records.

Do not maintain parallel counts, cards, screenshot roles, annotations, or statuses directly in HTML.

The initializer also records `run.reportShellSha256`. The validator hashes the copied wireframe outside the marked content region on every render. Changing Bootstrap, CSS, JavaScript, title, or other shell markup inside a generated report is a contract failure; change the canonical wireframe for future runs instead.

## Hashed supporting artifacts

Store non-image evidence under `run.artifactDirectory` (normally `artifacts/`) and reference it as `{ path, sha256 }`. This applies to source-backed coverage inventory, exact Git diff bytes, baseline and fix publish output, executed validation output, and raw evidence/code-risk/final-report reviewer results.

The validator rejects missing, empty, changed, traversing, out-of-directory, or symlink-escaping artifacts. JSON artifacts are compared field by field with their report records; merely containing an ID or commit token is insufficient. A diff artifact contains the exact `git diff --binary --full-index` bytes and its artifact hash must equal `diffSha256`; do not use abbreviated index lines because their byte representation can vary by Git configuration. A prose summary in `report.json` is not a substitute for the underlying output.

Use distinct reviewer sessions for evidence, code risk, and final report review. Their raw artifacts must preserve what the independent reviewer actually returned. Do not synthesize an approving artifact after reading your own expected conclusion. Hash and field binding prove that the saved result was not silently rewritten; the reviewer identity and actual SubAgent invocation remain a platform trust boundary, so preserve the returned reviewer/session identity instead of inventing one.

Use these normalized JSON payloads; extra raw fields are allowed, but the named fields must exactly equal `report.json`:

- coverage: `generatedAt`, `sourceRefs`, `methodology`, top-level `roots[]` (`id`, `targetId`, `label`, `kind`, `url`, `rendererKey`, `sourceRefs`), and `exclusions`;
- deployment: `id`, `provider`, `status`, `previewUrl`, `buildCommit`, `publishedAt`, `command`, `resultSummary`, and non-empty `rawOutput`;
- validation: `id`, `scope`, canonical `command` text, `executedAt`, `exitCode`, `stdout`, and `stderr`. The validation runner stores raw argv in artifact `command` and the canonical display string in artifact `commandText`; report `command` must equal `commandText`;
- evidence review: reviewer/session identity plus `reviews[]` containing binding ID, capture ID, asset hash, review time, verdict, observed text, checks, and rationale;
- code/final review: every structured review field except the artifact reference itself.

## Source-backed coverage inventory

`coverageInventory` establishes the root denominator before Browser Use. Record its generation time, route/navigation/tab source references, methodology, root coverage IDs, discovered/scoped/excluded root counts, explicit exclusions, hashed raw artifact, and notes. Root source references must resolve to real repository files and valid lines.

The root IDs must exactly match top-level `coverage[]` records. Every coverage node records `rendererKey` and `sourceRefs`; runtime-discovered children may cite `runtime:` or `dom:` discovery references. `duplicate-sampled` is allowed only for repeated `control`, `popover`, `state`, `scroll`, or `other` nodes with the same target, parent, URL, kind, and renderer key. It requires an explicit equivalence rationale and a different representative that is actually `covered`. Routes, tabs, modals, and drawers must be inspected directly. Sampled nodes remain visible in coverage limitations.

## Immutable capture assets

Use one `captures[]` record per saved image. Reuse its ID from multiple bindings instead of copying the same pixels into multiple capture records. A single admitted full-viewport capture may support coverage, finding, verification, regression, blocker, or non-i18n claims through separate role-specific bindings and annotations; do not duplicate the pixels merely to change their intended use.

Treat browser capture and file persistence as separate operations. Do not assume a browser API `path` option wrote the file. Persist the returned bytes explicitly when required by the selected browser surface, then confirm the path exists and run the screenshot inspector before adding the capture to the ledger. Save immediately after each state so file time, state, and pixels cannot be confused with a later route.

Record:

- report-relative path under `run.screenshotDirectory`;
- SHA-256, actual MIME, byte length, and decoded pixel dimensions;
- `full-viewport` or `element-clip`;
- capture time;
- target, locale, exact CSS viewport, actual device DPR, browser zoom, and capture sampling scale;
- URL and state snapshot;
- page, action, readiness signals, intended use, and deployment ID when applicable;
- admission state and pixel-review details.

Generate file facts from saved bytes:

```bash
node <skill-dir>/scripts/inspect-ui-screenshot.mjs \
  --file <run-directory>/screenshots/<file> \
  --report-root <run-directory>
```

The SubAgent output and the artifact referenced by `reviews.finalReport.artifact` must use this exact contract shape. Do not request a parallel generic shape such as `findingChecks`, `interactionChecks`, `reportDigest`, or `reviewer`; those fields cannot be attached to `report.json`. Put interaction findings and risk commentary in the top-level `notes`, and put each Finding's pixel/readability conclusion in its contract `findingReviews[].notes` entry.

Do not copy dimensions, MIME, or hash from browser metadata. The command reads the saved file. A successful browser screenshot call without a readable file is not evidence.

The validator rejects:

- absolute paths, `..` traversal, and symlink escape;
- captures outside the run screenshot directory;
- duplicate paths or duplicate pixels represented by separate records;
- missing or undecodable files;
- extension/MIME mismatch;
- recorded hash, byte length, or dimensions that differ from saved pixels;
- malformed PNG chunks, CRC, compressed scanlines, or incomplete JPEG bytes;
- `full-viewport` pixel dimensions that differ from CSS viewport multiplied by `captureScaleFactor`;
- an admitted review whose hash differs from the current file.

`viewport.deviceScaleFactor` records the actual page value from `window.devicePixelRatio`; it is not necessarily the sampling scale of the saved file. Chrome Browser Use may return a 1x screenshot on a DPR 2 display. Record that capture as DPR 2 with `captureScaleFactor: 1`, preserve the returned bytes, and keep the actual MIME/extension. Never falsify DPR to make dimensions pass. For a full viewport, derive `captureScaleFactor` from the saved pixel dimensions divided by the CSS viewport and require the horizontal and vertical ratios to agree.

## State snapshots

Every capture records a stable state snapshot:

```text
key
route
activeSurfaces[]
filters[]
dataState
scroll { x, y, container }
```

Build `key` from the product state needed for comparison, not from a mutable Preview query parameter. Include route, active tab/mode, open modal/drawer, material filters, representative data state, and scroll position.

Before and final evidence for one finding must share the complete state snapshot, not merely a reused `key` string:

- target;
- locale;
- CSS viewport, actual device DPR, browser zoom, and capture sampling scale;
- state key;
- route, active surfaces, filters, representative data state, and scroll container/position;
- equivalent data state and scroll position.

Use separate targets when the task intentionally tests more than one viewport or locale.

## Admission

A saved image begins with `admission.status: pending`. The primary capture reviewer must open the exact saved pixels and evaluate:

1. correct route, state, tab, modal/drawer, filter, data, and scroll position;
2. correct product locale;
3. page-specific readiness;
4. no browser extension, preview selector, password manager, developer tool, OS UI, or unrelated notification covering the product;
5. valid format and extension;
6. no black/blank composites, missing layers, duplicated regions, or other capture corruption;
7. target visible at a human-readable size;
8. enough product context;
9. exact saved pixels opened.

Review each saved asset individually at original detail. Contact sheets, report thumbnails, bulk multi-image attachments, and a live browser view are navigation aids, not admission evidence. They can scale, crop, reorder, or incompletely decode an image and must not be used to decide whether the saved asset is intact or whether a claim is supported.

If a review surface shows black or opaque blocks, missing layers, duplicated regions, or another suspicious composite, reopen that exact file by itself and compare it with the decoded file facts and hash. Reject the capture when the defect persists in the individually opened saved asset. When the defect disappears and the saved bytes decode consistently, treat the first result as a review-input artifact, preserve both raw review results, and base admission or claim review only on the individual-file recheck. Never silently rewrite the first reviewer result.

For `admitted`:

- every check is `true`;
- `reviewedBy`, `reviewedAt`, and `reviewAssetSha256` are present;
- `reviewAssetSha256` equals the current capture SHA-256;
- `rejectionReasons` is empty.

For `rejected`:

- provide one or more specific rejection reasons;
- never create an evidence binding to it;
- keep it out of the HTML report.

If a screenshot is recaptured, register a new capture and repeat every admission check. A filename containing `final`, `clean`, or `recapture` has no evidentiary value.

For issue evidence, admission is a pre-remediation gate. The capture must reference a published baseline deployment whose build commit equals `run.baselineCommit`. After claim review returns `supports`, write the Finding and its `finding-admitted` event to `report.json`, then run the validator before editing product source. The admitted event must not predate either pixel admission or claim review. A later baseline replay cannot retroactively authorize an earlier fix; a non-reproducible candidate must be rejected and its code change excluded from the release.

## Claim-level evidence bindings

An admitted capture is not automatically evidence for a finding. Create an `evidenceBindings[]` record that connects one owner to one visual claim.

Each binding contains:

- `ownerType` and `ownerId`;
- `captureId`;
- explicit role;
- one claim the image must prove;
- what an independent reader actually observes;
- binding-specific annotation boxes;
- independent review, asset hash, checks, and rationale.

Use these roles:

| Role | Purpose |
| --- | --- |
| `coverage` | Prove an inventoried state was reached and ready. |
| `issue-context` | Locate a clipped issue detail in the complete product workflow. |
| `issue-detail` | Prove the actual finding symptom. |
| `failed-verification` | Prove a released fix failed or regressed. |
| `verification-context` | Locate clipped final detail evidence in the final workflow. |
| `verification-detail` | Prove the original symptom is resolved in final Preview. |
| `regression-check` | Prove a neighboring component, capacity, alternate state, or locale remains intact. |
| `blocker` | Prove a persistent coverage blocker. |
| `non-i18n` | Prove a visible exclusion such as user-created data. |

The validator rejects a role used by the wrong owner, an owner that does not list the binding, a capture from another target/state, or any binding to unadmitted pixels.

### Context versus detail

Prefer a complete product viewport as evidence so a reviewer can locate the feature. Keep it at original pixels in the report.

Use an element clip only when a full-viewport saved capture is corrupted or the detail cannot be read at original pixels. A clipped `issue-detail` requires a supported full-viewport `issue-context`; a clipped `verification-detail` requires `verification-context`.

Do not crop to hide a regression, change visible capacity, or remove adjacent components.

## Independent evidence reading

For findings and observations, the evidence reviewer must differ from both the primary inspector and the capture reviewer; the primary inspector may perform capture admission. Record the primary inspector in `run.primaryInspectorId`.

Give the evidence reviewer:

- one raw saved image opened individually at original detail;
- target locale and viewport;
- named state;
- the proposed claim;
- proposed annotation coordinates;
- no desired verdict and no primary inspector conclusion.

Do not ask the reviewer to judge a claim from a contact sheet, a multi-image montage, or several attachments rendered in one review surface. Before/final comparison may use two separate claim reviews plus the final human-readable report; each underlying image must first be read individually. Apply the review-input artifact procedure from Admission when the reviewer surface renders suspicious black or missing regions.

Require:

```text
verdict: supports | does-not-support | uncertain
observedText
checks:
  targetVisible
  claimMatches
  annotationAccurate
  contextSufficient
  localeCorrect
  stateCorrect
rationale
```

The raw JSON must already be report-compatible: use the exact future binding `id` and `captureId`; set `reviewerType` to `subagent` or `human`; keep `observedText` as one non-empty string; and emit exactly the six boolean checks above. Do not invent aliases, arrays, custom check names, or temporary image IDs and expect report assembly to coerce them. The validator compares the raw artifact with the embedded review field by field.

Also record a review-session ID and the hashed raw reviewer artifact. One review session must resolve to one reviewer identity. Evidence sessions cannot be reused for code-risk or final-report review.

`supports` requires every check to pass. An `issue-detail` with any other verdict cannot create a finding. A final binding with any other verdict cannot satisfy verification or acceptance.

If later report QA changes an admitted issue binding's claim wording or annotation, do not overwrite or time-shift the review that originally authorized the Finding. Preserve that immutable review as `admissionReview`, store the new claim/annotation review as the binding's current `review`, increment the report revision, and repeat report validation and final review. The validator uses `admissionReview` for the before-edit gate and current `review` for present-tense evidence support; both artifacts remain independently hashed and auditable. Do not add `admissionReview` to final, regression, coverage, or observation bindings.

## Annotations

Annotations belong to evidence bindings, not captures. This lets the same full-viewport image support different claims without sharing misleading red boxes or duplicate image records.

Save evidence as raw screenshots and let the renderer draw binding-specific annotations. Do not bake red boxes or labels into PNGs.

Keep `verification-detail` and `regression-check` as separate claims even when one final Preview screenshot proves both. The report labels the latter **Original-function regression evidence** so readers can distinguish “the i18n defect is fixed” from “the pre-existing behavior still works.” The renderer groups finding bindings by capture: one saved capture appears once in the After column, while each role keeps its own claim, annotation, review, and acceptance reference. When the claims need different states or screenshots, render each distinct capture once in that same column.

Use percentage coordinates relative to the image's natural pixel box. Every box must have positive width/height, stay inside the image, and include a visible non-empty label.

Issue evidence marks the actual defect. Final evidence marks the same region and states the verified condition. Regression evidence marks the neighbor or capacity being protected.

Do not draw a large generic box around an entire page when the claim names a specific label or control. Do not use a box merely to satisfy schema.

The report template renders each annotation inside the same `width: max-content` geometry box as its image, both inline and in the lightbox.

## Finding and acceptance contract

Every finding records:

- target, URL, state key, title, severity, and category;
- reproduction, expected, and actual behavior;
- source attribution and user-data assessment;
- explicit acceptance checks;
- owned evidence binding IDs;
- remediation, fix assessment, validation IDs, and commit when fixed;
- verification result and deployment;
- chronological lifecycle events.

At minimum, an admitted finding needs one supported `issue-detail` binding.

Every acceptance check has a kind and evidence:

- `visual` or `cross-locale`: bind relevant final or regression evidence;
- `code`, `runtime`, or `release`: bind passing validation IDs;
- `not-applicable`: state a specific reason.

A passed `cross-locale` check requires a `regression-check` capture from a different target locale. Do not claim cross-locale safety from another screenshot of the primary locale. Modify only inspected target locales unless a separate target and acceptance evidence are added.

For verified findings, before evidence cannot satisfy a final visual acceptance check. Every visual check must reference `verification-context`, `verification-detail`, or `regression-check`.

Verification passes only when:

- remediation is fixed locally and has actual fix assessment plus commit;
- every acceptance check passed or is specifically not applicable;
- passing visual, code, and release acceptance checks are present;
- every remediation and acceptance validation used as proof currently passes;
- code-risk review is approved;
- the deployment is a published fix deployment;
- `verification.verifiedAtCommit`, deployment build commit, and `run.finalCommit` agree;
- final evidence is supported and references that deployment;
- before and final captures are comparable;
- lifecycle events include admission, local fix, commit, publish, and verification.

`remediation.commit` and `fixAssessment.fixCommit` identify the commit that originally introduced this finding's fix. They intentionally remain unchanged in later loops. After every new final deployment, reverify every previously fixed finding and update only its final deployment evidence, `verifiedAt`, and `verifiedAtCommit` to the current `run.finalCommit`.

## Fix assessment and risk

Use `collect-ui-fix-evidence.mjs` with a report-relative diff artifact path to obtain real commits, exact binary diff bytes/hash, and changed paths. Then review and classify each path. The validator rejects invented paths and actual diff paths omitted from an assessment.

Keep two scopes separate:

- `finding.remediation.fixAssessment` covers the narrow commit range that originally introduced that finding's fix. It stays immutable across later loops.
- top-level `releaseAssessment` covers exactly `run.baselineCommit..run.finalCommit`, lists every finding with a code fix, includes current passing validations, and receives a release-scoped independent code-risk review.

This prevents later commits from overwriting old Finding history while also preventing code changes from escaping whole-release review. If baseline and final commits differ, a reviewable report cannot omit `releaseAssessment` even when no new finding was added in the latest loop.

The validator derives a risk floor from:

- changed-file kind;
- path heuristics for dependency/config/global style/shared code;
- explicit risk factors.

`claimedRisk` may equal or exceed the floor. It cannot be lower.

An independent code-risk reviewer other than `run.primaryInspectorId` must match the assessment scope, finding IDs, exact commits, and diff hash. A finding-scoped review evaluates the original fix; a release-scoped review evaluates the complete current release. Its reviewer and review-session IDs must be distinct from evidence review, and its raw result must be a hashed structured artifact. Code review may occur before push. Unresolved P0/P1 blocks approval. Unresolved P2 blocks a low-risk claim.

The HTML report displays the Finding-scoped diff inline in both the main Finding detail and its cloned Finding modal, while retaining the raw artifact link. It also displays the diff identity, changed files, factors, affected surfaces, floor, claimed risk, review verdict, and unresolved review findings. The inline content must come from the already validated `fixAssessment.diffArtifact`; never reconstruct a diff from prose or use the release diff as a substitute for a Finding diff. Do not substitute ownership rationale for risk rationale.

## Deployment and chronology

Record each baseline and fix deployment separately. Include:

- provider and region;
- publish/build/CDN identifiers when available;
- Preview URL;
- exact build commit;
- publish time;
- command and result summary;
- hashed raw publish/provenance artifact.

A verification capture must reference a deployment and occur after its publish time. Preserve the Preview identity query in `capture.url` whenever possible. If an SPA removes it, `deploymentIdentityProof` must contain `requestedUrl`, the exact requested product state including locale and Preview identity, plus one of these independently inspectable runtime proofs:

- `loaded-resource-url`: `observedResourceUrl` is a resource actually loaded by that page whose path or query carries the exact deployment identity;
- `runtime-publication-manifest`: `runtimeIdentity.identityEntries` repeats every Preview identity query key/value, `releaseVersion` matches the deployment version, and `resourceUrls` lists resources exposed by the page's runtime publication manifest.

Store a hashed JSON artifact that repeats capture ID, deployment ID, method, requested URL, current URL, and the selected proof payload. Never synthesize a resource URL that the page did not load.

Deployment identity, route/state, locale, viewport, DPR, zoom, and readiness are capture-local facts. Re-evaluate them after every hard navigation, route change, locale switch, reload, or session replacement and immediately before saving pixels. Do not carry a previous capture's runtime proof forward merely because the browser session or visible product shell is the same.

For a source-backed SPA state whose current URL has dropped Preview identity, re-request that same observed pathname/hash/query state with the exact identity entries from the deployment URL before capture when the product supports it, then wait for readiness again. Do not invent hidden route parameters. When the application immediately removes the identity again, the artifact may retain that exact state-equivalent requested URL while `currentUrl` records the address bar after navigation; the runtime manifest or actually loaded resource must still prove the deployment.

The requested and current URLs must represent the same origin, pathname, and hash state. A screenshot filename, reconstructed resource URL, branch name, unverified JavaScript variable, or current page appearance is not a substitute. Product pathname/hash may differ from the deployment entry route. Separately, the target/owner URL must match the capture's product application path and inspected state. `_codexVerify` may vary. Finding issue evidence must reference a published baseline deployment at `run.baselineCommit`; final and regression evidence must reference the current published fix deployment at `run.finalCommit`. A reusable baseline deployment may predate the run.

Do not relabel an earlier failed deployment screenshot as final. Do not use a branch URL, query marker, screenshot filename, or visual appearance as build-commit proof.

## Run-local report lifecycle

The initializer copies `ui-inspection-report-wireframe.html` to the run as `report.html`. The copied file owns Bootstrap, desktop CSS, modal/lightbox stack, feedback controls, and Back to top behavior. Reviewer feedback exists only in the current DOM session for copying; it must not be persisted to `localStorage`, cookies, IndexedDB, or the report assets, and a reload intentionally clears it. `run.reportShellSha256` binds that shell; the renderer changes only the marked content.

The template contains one content region:

```html
<!-- UI_INSPECTION_REPORT_CONTENT_START -->
<!-- UI_INSPECTION_REPORT_CONTENT_END -->
```

Renderer usage:

```bash
node <skill-dir>/scripts/render-ui-inspection-report.mjs \
  --report-json <run-directory>/report.json \
  --output <run-directory>/report.html \
  --repository <repository>
```

Without `--template`, the renderer reads and updates the run-local output file. It does not silently replace it with the skill's current template. Copy once, then reuse the same file for every loop.

The renderer must preserve:

- Bootstrap desktop shell;
- issues found, verified fixes, and need-attention metrics;
- finding overview and feedback;
- finding cards with claim-level evidence and risk basis;
- coverage limitations only, not a duplicate full coverage matrix;
- separate Blockers and Non-i18n sections;
- screenshot appendix with time, URL/state, action, viewport, asset hash, and deployment;
- side-by-side Before and After finding columns with complete proportional previews; bindings that share one capture share one rendered image;
- natural-pixel screenshot lightboxes and natural-pixel appendix images in explicit scroll containers;
- finding modal, nested image lightbox, first-Escape/second-Escape behavior, backdrop/close buttons, feedback fallback, and right-side Back to top.

Do not add sample findings, mock screenshots, inspection timeline, visual-review appendix, interaction-validation section, generic risk appendix, template instructions, or debug UI.

## Final report review

Prepare a draft with `run.status: complete-candidate`, `partial`, or `blocked` and no `reviews.finalReport`. Validate and render it, then ask a fresh context-isolated SubAgent that did not perform evidence or code-risk review to read the report like a human.

The reviewer must assess every finding:

- title, actual, expected, and screenshots agree;
- annotations identify the stated target;
- before/final evidence is comparable;
- every acceptance claim is visibly or deterministically supported;
- release provenance is understandable;
- changed files and risk basis are sufficient to judge regression risk;
- unsupported statements and missing context are explicit.

Record:

```text
contentSha256
reportRevision
reviewerId
reviewerType
reviewSessionId
artifact { path, sha256 }
reviewedAt
verdict: approved | changes-requested | uncertain
coverageAssessable
artifactUsable
findingReviews[]:
  findingId
  verdict: approved | mismatch | insufficient | uncertain
  understandable
  riskAssessable
  notes
```

Use the validator's `reviewableContentSha256`. The final reviewer/session must be fresh and distinct from evidence and code-risk review. Adding `reviews.finalReport` does not change that digest. Any other report edit does; increment `revision`, remove the stale review, and repeat.

Approval requires `coverageAssessable: true`, `artifactUsable: true`, and a passing `scope: report` validation with a hashed execution artifact. An approved `complete-candidate` review derives report status as `completed` or `completed-with-attention`. Approved `partial` and `blocked` reports retain those statuses. A current failed validation blocks a complete candidate; `failed-pre-existing` remains visible as attention and cannot prove a fix. The top-level `need attention` issue metric counts unresolved, unverified, deferred, blocked, or confirmation-required Findings only. Release risk, coverage limitations, failed-pre-existing validations, blockers, and non-i18n observations remain visible in their own sections and may still derive `completed-with-attention`; do not double-count them as additional Findings.

Freeze all substantive report data, `revision`, and `run.updatedAt` before generating the report-validation artifact and requesting final review. A `scope: report` validation intentionally executes after this frozen time and may then be inserted without advancing `run.updatedAt`; all product, code, and release validations must predate the freeze. Adding the matching report-validation record and then the matching `reviews.finalReport` record are the only allowed metadata insertions after that freeze. Any other JSON change, capture replacement, annotation change, renderer output change, or canonical-template/CSS/JavaScript change invalidates the current report validation and final review: increment the revision, choose a new update time, remove both stale records, rerender, and repeat validation and independent review.

A final-review `mismatch`, `insufficient`, or `uncertain` verdict is not merely a report-writing task. If it identifies unsupported pixels, invalidate the affected binding, reopen the Finding, and repeat capture and evidence review from the latest deployment. Change only narrative or annotation when the saved image already proves the corrected claim; otherwise recapture. Preserve the rejecting raw review artifact even though it cannot approve the new revision.

## Focused final checks

Run:

```bash
node <skill-dir>/scripts/validate-ui-inspection-report.mjs \
  --report-json <run-directory>/report.json \
  --repository <repository> \
  --json
```

Then exercise one finding modal, one nested image lightbox, the two-level Escape stack, feedback copy/fallback, an appendix lightbox, and Back to top in current Chrome.

For one full-viewport image and one annotated image, confirm:

- the report document itself has no horizontal overflow at the actual desktop viewport (`document.documentElement.scrollWidth === document.documentElement.clientWidth`);
- each finding preview shows the complete screenshot, scales proportionally within its Before/After column, and does not crop or stretch it;
- the lightbox image client dimensions equal natural dimensions;
- the annotation stage equals the image box in both the scaled preview and natural-pixel lightbox;
- evidence columns are not clipped;
- oversized lightbox and appendix evidence scrolls inside their designated screenshot containers without scaling the image;
- final Preview and regression bindings that reference the same capture render one image with both claim records;
- every claim annotation and label is visible at the stated target rather than elsewhere on the page;
- annotation labels do not overlap one another in any scaled preview or natural-pixel lightbox, including when several bindings share one capture;
- lightbox annotation remains aligned;
- report fits the actual desktop viewport while oversized screenshots remain scrollable.

Report interaction checks validate the artifact only. They do not replace source, locale, test, build, Git, deployment, product-UI, or independent code-risk validation.
