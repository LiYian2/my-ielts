# Space Exploration Active Vocabulary Pilot Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a complete active-learning pilot for all 75 entries in `04_太空探索`, moving learners through contextual input, unaided recall, constrained production, and spaced review.

**Architecture:** Adapt the existing generated vocabulary object into stable canonical entries, then reference those entries from strictly typed static topic content. Pure scheduling and persistence modules remain independent of Vue; focused components render the dashboard, lesson stages, word cards, recall, production, and progress backup. Deterministic tests and a separate language-review subagent gate authored content.

**Tech Stack:** Vue 3 Composition API, TypeScript 5, vite-plugin-pages, UnoCSS, Vitest, Vue Test Utils, browser localStorage, existing MP3 assets, `gpt-5.6-terra` subagents at `high` reasoning effort

## Global Constraints

- Pilot topic is exactly `04_太空探索` with 75 canonical entries.
- Existing vocabulary list and typing practice remain functional.
- Runtime AI, accounts, cloud sync, recording, speech recognition, and automatic free-form grading are excluded.
- Topic prose is natural B2-C1 English suitable for IELTS 6.5-7.5.
- Chinese passage translations are folded by default.
- Every canonical entry has British IPA, existing audio, relevant meaning, 2-4 collocations, a labelled example, a passage sentence, and an output prompt.
- Every source entry is used naturally in at least one annotated passage segment; high-value production words appear in at least two contexts.
- Content must pass 100% deterministic coverage and independent language review.
- Review intervals are 1, 3, 7, 14, and 30 calendar days.
- `active` requires unaided recall on two distinct local dates and at least one recorded production event.
- Content generator and reviewer subagents use `gpt-5.6-terra` with `high` reasoning effort.

---

## File Map

- Create `src/features/vocabulary-learning/canonical.ts`: canonical topic/entry adapter and stable IDs.
- Create `src/features/vocabulary-learning/types.ts`: canonical, content, progress, and answer contracts.
- Create `src/features/vocabulary-learning/content/manifest.ts`: all-topic availability and lazy content loading.
- Create `src/features/vocabulary-learning/content/04-space-exploration.ts`: reviewed pilot content.
- Create `src/features/vocabulary-learning/validate.ts`: deterministic content validation.
- Create `src/features/vocabulary-learning/review.ts`: mastery transitions and due-date scheduling.
- Create `src/features/vocabulary-learning/storage.ts`: versioned persistence, recovery, import/export, reset.
- Create `src/features/vocabulary-learning/useLearningProgress.ts`: Vue-facing progress facade.
- Create `src/components/vocabulary-learning/TopicDashboard.vue`: topic counts and availability.
- Create `src/components/vocabulary-learning/LessonReader.vue`: passage, translation, target highlighting, and audio.
- Create `src/components/vocabulary-learning/WordCardPanel.vue`: core and optional card fields.
- Create `src/components/vocabulary-learning/RecallStage.vue`: cloze and progressive hints.
- Create `src/components/vocabulary-learning/ProductionStage.vue`: constrained tasks and rubric.
- Create `src/components/vocabulary-learning/ProgressBackup.vue`: export, import, and reset controls.
- Create `src/pages/vocabulary/learn/index.vue`: active-learning dashboard route.
- Create `src/pages/vocabulary/learn/[topic].vue`: topic lesson route and unavailable state.
- Modify `src/pages/vocabulary/index.vue`: add an active-learning entry point.
- Create focused unit and component tests under `test/vocabulary-learning/`.
- Modify `package.json`: add `validate:content` and include it in `check`.
- Create `THIRD_PARTY_NOTICES.md`: record the British IPA data attribution.

### Task 1: Canonical Vocabulary Entries and Stable IDs

**Files:**
- Create: `src/features/vocabulary-learning/types.ts`
- Create: `src/features/vocabulary-learning/canonical.ts`
- Create: `test/vocabulary-learning/canonical.test.ts`

**Interfaces:**
- Consumes: default export from `src/pages/vocabulary/vocabulary.js`.
- Produces: `CanonicalEntry`, `CanonicalTopic`, `createEntryId()`, `getCanonicalTopic()`, and `listCanonicalTopics()`.

- [ ] **Step 1: Define canonical contracts**

Create the first section of `types.ts`:

```ts
export type EntryId = `${string}:${string}`

export interface CanonicalEntry {
  id: EntryId
  sourceId: number
  topicId: string
  headwords: string[]
  primaryHeadword: string
  pos: string
  meaning: string
  example: string
  extra: string
  audioPath: string
}

export interface CanonicalTopic {
  id: string
  label: string
  chapterAudioPath: string
  entries: CanonicalEntry[]
}
```

- [ ] **Step 2: Write failing canonical adapter tests**

Create `canonical.test.ts` with these behaviours:

```ts
import { describe, expect, it } from 'vitest'
import { createEntryId, getCanonicalTopic } from '../../src/features/vocabulary-learning/canonical'

describe('canonical vocabulary adapter', () => {
  it('creates URL-safe deterministic IDs', () => {
    expect(createEntryId('04_太空探索', 'synthesise/synthesize')).toBe('04-space-exploration:synthesise')
  })

  it('adapts all Space Exploration entries with unique IDs and audio', () => {
    const topic = getCanonicalTopic('04_太空探索')
    expect(topic.entries).toHaveLength(75)
    expect(new Set(topic.entries.map(entry => entry.id)).size).toBe(75)
    expect(topic.entries.find(entry => entry.primaryHeadword === 'galaxy')).toMatchObject({
      id: '04-space-exploration:galaxy',
      audioPath: '/vocabulary/audio/04_太空探索/galaxy.mp3',
    })
  })
})
```

- [ ] **Step 3: Run the focused test and verify failure**

```bash
pnpm test -- --run test/vocabulary-learning/canonical.test.ts
```

Expected: FAIL because `canonical.ts` does not exist.

- [ ] **Step 4: Implement the adapter**

Implement explicit topic slugs, headword normalisation, duplicate detection, and flattening. The public signatures are:

```ts
export function createEntryId(topicId: string, primaryHeadword: string): EntryId
export function getCanonicalTopic(topicId: string): CanonicalTopic
export function listCanonicalTopics(): CanonicalTopic[]
```

Use `04-space-exploration` as the topic ID prefix and the first slash-separated headword as the entry suffix. Throw on duplicate generated IDs instead of adding unstable numeric suffixes.

- [ ] **Step 5: Run tests and commit**

```bash
pnpm test -- --run test/vocabulary-learning/canonical.test.ts
pnpm typecheck
git add src/features/vocabulary-learning/types.ts src/features/vocabulary-learning/canonical.ts test/vocabulary-learning/canonical.test.ts
git commit -m "feat(vocabulary): add canonical learning entries"
```

### Task 2: Typed Topic Content and Deterministic Validation

**Files:**
- Modify: `src/features/vocabulary-learning/types.ts`
- Create: `src/features/vocabulary-learning/validate.ts`
- Create: `test/vocabulary-learning/validate.test.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes: `CanonicalTopic` from Task 1.
- Produces: `TopicContent`, `Lesson`, `WordCard`, `validateTopicContent()`, and `assertValidTopicContent()`.

- [ ] **Step 1: Add exact content contracts**

Append these shapes to `types.ts`:

```ts
export interface PassageSegment {
  text: string
  entryId?: EntryId
}

export interface PassageParagraph {
  segments: PassageSegment[]
}

export interface WordCard {
  entryId: EntryId
  priority: 'high' | 'standard'
  ipa: string
  meaning: string
  collocations: [string, string, ...string[]]
  example: { text: string; use: 'speaking' | 'writing' | 'both' }
  passageSentence: string
  outputPrompt: string
  wordFamily?: string[]
  synonyms?: Array<{ word: string; distinction: string }>
  usageNotes?: string[]
}

export interface RecallExercise {
  id: string
  entryId: EntryId
  before: string
  after: string
  acceptedAnswers: string[]
  meaningCue: string
}

export interface ProductionTask {
  id: string
  mode: 'collocation' | 'rewrite' | 'sentence' | 'speaking' | 'writing'
  prompt: string
  requiredEntryIds: EntryId[]
  referenceAnswer: string
  rubric: string[]
}

export interface Lesson {
  id: string
  title: string
  warmupPrompt: string
  targetEntryIds: EntryId[]
  passage: PassageParagraph[]
  translation: string[]
  recallExercises: RecallExercise[]
  productionTasks: ProductionTask[]
}

export interface TopicContent {
  schemaVersion: 1
  topicId: string
  slug: string
  title: string
  level: 'B2-C1'
  lessons: Lesson[]
  wordCards: Record<EntryId, WordCard>
  finalSpeaking: ProductionTask
  finalWriting: ProductionTask
}

export interface ValidationIssue {
  code: string
  path: string
  message: string
}
```

- [ ] **Step 2: Write failing validator tests**

Tests must prove the validator reports:

- missing canonical entry coverage;
- an unknown `entryId`;
- a word card with fewer than two collocations;
- a word card with more than four collocations;
- a canonical entry without a word card;
- duplicate target IDs within a lesson;
- a target annotation not declared by its lesson;
- an empty translation, example, passage sentence, or output prompt.
- a `passageSentence` that is not present in the rendered lesson text;
- a `priority: 'high'` entry with fewer than two annotated passage uses.

The passing fixture contains two canonical entries and one complete lesson, making expected issue arrays small and explicit.

- [ ] **Step 3: Implement validation**

Provide:

```ts
export function validateTopicContent(content: TopicContent, topic: CanonicalTopic): ValidationIssue[]

export function assertValidTopicContent(content: TopicContent, topic: CanonicalTopic): void {
  const issues = validateTopicContent(content, topic)
  if (issues.length)
    throw new Error(issues.map(issue => `${issue.path}: ${issue.message}`).join('\n'))
}
```

Coverage is based on annotated `PassageSegment.entryId`, not substring search. Every canonical entry must have a card and at least one annotated passage use. A card marked `priority: 'high'` must have at least two annotated uses in distinct lessons; the independent reviewer verifies that the priority choice itself is pedagogically sound.

- [ ] **Step 4: Add content validation script**

Add this temporary validator-only script to `package.json` so Tasks 2-7 remain independently testable before the real topic content exists:

```json
"validate:content": "vitest run test/vocabulary-learning/validate.test.ts"
```

Update `check` to:

```json
"check": "pnpm lint && pnpm typecheck && pnpm test -- --run && pnpm validate:content && pnpm build"
```

Task 8 switches the script to the real content acceptance test in the same commit that creates that test.

- [ ] **Step 5: Run tests and commit**

```bash
pnpm test -- --run test/vocabulary-learning/validate.test.ts
pnpm typecheck
git add src/features/vocabulary-learning/types.ts src/features/vocabulary-learning/validate.ts test/vocabulary-learning/validate.test.ts package.json
git commit -m "feat(vocabulary): validate static learning content"
```

### Task 3: Spaced Review and Mastery State Machine

**Files:**
- Modify: `src/features/vocabulary-learning/types.ts`
- Create: `src/features/vocabulary-learning/review.ts`
- Create: `test/vocabulary-learning/review.test.ts`

**Interfaces:**
- Produces: `WordProgress`, `ReviewOutcome`, `recordExposure()`, `recordReview()`, `recordProduction()`, `isDue()`, and `localDateKey()`.

- [ ] **Step 1: Define progress contracts**

```ts
export type MasteryState = 'unseen' | 'understood' | 'recallable' | 'active'
export type ReviewOutcome = 'unaided' | 'prompted' | 'failed'

export interface WordProgress {
  state: MasteryState
  intervalIndex: number
  nextReviewOn: string | null
  unaidedRecallDates: string[]
  productionDates: string[]
  lastOutcome: ReviewOutcome | null
}
```

- [ ] **Step 2: Write failing transition tests**

Cover these exact cases with fixed local dates:

- exposure moves `unseen` to `understood` without scheduling mastery;
- first unaided recall on `2026-08-02` produces `recallable` and due date `2026-08-03`;
- prompted success does not advance the interval and schedules the next day;
- failure resets `intervalIndex` to 0 and schedules the next day;
- two unaided recalls on the same date do not satisfy the distinct-date rule;
- unaided recalls on two dates plus production produce `active`;
- production without two distinct unaided dates does not produce `active`;
- interval advancement yields 1, 3, 7, 14, then 30 days and remains capped at 30;
- due-date comparison uses local calendar dates rather than UTC timestamps.

- [ ] **Step 3: Implement pure scheduling functions**

Use this interval constant and signatures:

```ts
export const REVIEW_INTERVAL_DAYS = [1, 3, 7, 14, 30] as const

export function createWordProgress(): WordProgress
export function localDateKey(date: Date): string
export function recordExposure(progress: WordProgress, date: Date): WordProgress
export function recordReview(progress: WordProgress, outcome: ReviewOutcome, date: Date): WordProgress
export function recordProduction(progress: WordProgress, date: Date): WordProgress
export function isDue(progress: WordProgress, date: Date): boolean
```

Functions return new objects and never mutate their input.

- [ ] **Step 4: Run tests and commit**

```bash
pnpm test -- --run test/vocabulary-learning/review.test.ts
pnpm typecheck
git add src/features/vocabulary-learning/types.ts src/features/vocabulary-learning/review.ts test/vocabulary-learning/review.test.ts
git commit -m "feat(vocabulary): add active mastery scheduling"
```

### Task 4: Versioned Local Progress, Recovery, Import, and Export

**Files:**
- Modify: `src/features/vocabulary-learning/types.ts`
- Create: `src/features/vocabulary-learning/storage.ts`
- Create: `src/features/vocabulary-learning/useLearningProgress.ts`
- Create: `test/vocabulary-learning/storage.test.ts`

**Interfaces:**
- Produces: `LearningStateV1`, `loadLearningState()`, `saveLearningState()`, `exportLearningState()`, `importLearningState()`, `resetLearningState()`, and `useLearningProgress()`.

- [ ] **Step 1: Define persisted state**

```ts
export interface SavedAnswer {
  taskId: string
  text: string
  selfAssessment: Record<string, boolean>
  updatedAt: string
}

export interface LearningStateV1 {
  schemaVersion: 1
  words: Record<EntryId, WordProgress>
  answers: Record<string, SavedAnswer>
  completedLessons: string[]
}
```

Use storage key `my-ielts:vocabulary-learning:v1` and recovery-key prefix `my-ielts:vocabulary-learning:recovery:`.

- [ ] **Step 2: Write failing storage tests**

Cover:

- empty storage returns a fresh state;
- save/load round trip;
- malformed JSON is copied to a timestamped recovery key before fresh state is returned;
- import rejects malformed JSON and unsupported schema versions without changing current storage;
- export followed by import preserves words, answers, and completed lessons;
- reset removes only the active learning key, not unrelated localStorage values.

- [ ] **Step 3: Implement storage with injected dependencies**

Use signatures that keep tests deterministic:

```ts
export function loadLearningState(storage: Storage, now?: Date): LearningStateV1
export function saveLearningState(storage: Storage, state: LearningStateV1): void
export function exportLearningState(state: LearningStateV1): string
export function importLearningState(storage: Storage, json: string): LearningStateV1
export function resetLearningState(storage: Storage): LearningStateV1
```

`useLearningProgress()` owns one reactive state, delegates all state transitions to `review.ts`, and persists after each explicit action.

- [ ] **Step 4: Run tests and commit**

```bash
pnpm test -- --run test/vocabulary-learning/storage.test.ts test/vocabulary-learning/review.test.ts
pnpm typecheck
git add src/features/vocabulary-learning/types.ts src/features/vocabulary-learning/storage.ts src/features/vocabulary-learning/useLearningProgress.ts test/vocabulary-learning/storage.test.ts
git commit -m "feat(vocabulary): persist and back up learning progress"
```

### Task 5: Topic Manifest and Dashboard Routes

**Files:**
- Create: `src/features/vocabulary-learning/content/manifest.ts`
- Create: `src/components/vocabulary-learning/TopicDashboard.vue`
- Create: `src/components/vocabulary-learning/ProgressBackup.vue`
- Create: `src/pages/vocabulary/learn/index.vue`
- Create: `src/pages/vocabulary/learn/[topic].vue`
- Modify: `src/pages/vocabulary/index.vue`
- Create: `test/vocabulary-learning/dashboard.test.ts`

**Interfaces:**
- Consumes: canonical topics and local progress.
- Produces: `TopicManifestEntry`, `topicManifest`, `findTopicBySlug()`, route `/vocabulary/learn`, and route `/vocabulary/learn/:topic`.

- [ ] **Step 1: Define the manifest**

```ts
export interface TopicManifestEntry {
  sourceTopicId: string
  slug: string
  title: string
  available: boolean
  load?: () => Promise<{ default: TopicContent }>
}
```

List all 22 source topics. Only `04_太空探索` has `available: true` and a loader for `./04-space-exploration`; the other entries have `available: false` and no loader.

- [ ] **Step 2: Write failing dashboard tests**

Mount `TopicDashboard` with a test manifest and assert:

- available topics link to `/vocabulary/learn/space-exploration`;
- unavailable topics show `内容生成中` and are not links;
- counts for `未接触`, `已理解`, `可回忆`, `可主动使用`, and `今日待复习` are rendered from injected progress;
- `ProgressBackup` emits export, import, and reset actions;
- the existing vocabulary page contains a link labelled `主动学习`.

- [ ] **Step 3: Implement the dashboard and routes**

The dashboard page composes `TopicDashboard` and `ProgressBackup`. The dynamic topic page resolves `route.params.topic`; it renders a safe `内容生成中` card for an unknown/unavailable slug and lazy-loads available content.

Add a prominent `主动学习` router-link near the existing `雅思词汇真经` heading without changing list/training behaviour.

- [ ] **Step 4: Run tests and commit**

```bash
pnpm test -- --run test/vocabulary-learning/dashboard.test.ts
pnpm typecheck
git add src/features/vocabulary-learning/content/manifest.ts src/components/vocabulary-learning/TopicDashboard.vue src/components/vocabulary-learning/ProgressBackup.vue src/pages/vocabulary/learn/index.vue 'src/pages/vocabulary/learn/[topic].vue' src/pages/vocabulary/index.vue test/vocabulary-learning/dashboard.test.ts
git commit -m "feat(vocabulary): add active learning dashboard"
```

### Task 6: Passage Reader, Word Cards, and Existing Audio

**Files:**
- Create: `src/components/vocabulary-learning/LessonReader.vue`
- Create: `src/components/vocabulary-learning/WordCardPanel.vue`
- Create: `test/vocabulary-learning/lesson-reader.test.ts`

**Interfaces:**
- Consumes: `Lesson`, `CanonicalTopic`, and `Record<EntryId, WordCard>`.
- Emits: `exposed(entryIds: EntryId[])` and `open-card(entryId: EntryId)`.

- [ ] **Step 1: Write failing reader tests**

Assert:

- plain and target passage segments render in original order;
- targets are buttons with their exact segment text;
- selecting a target opens the matching word card;
- the card renders IPA, audio, meaning, collocations, labelled example, passage sentence, output prompt, and only present optional fields;
- Chinese translation is hidden initially and shown after clicking `显示中文翻译`;
- audio uses the canonical entry's existing path;
- an injected audio error disables the speaker button and shows `音频不可用`.

- [ ] **Step 2: Implement focused components**

`LessonReader` owns passage/translation presentation and selected entry ID. `WordCardPanel` receives a fully resolved entry/card pair and owns no progress logic. Use a single reusable `HTMLAudioElement`, pause the previous word before playing the next, and expose a testable `audioFactory` prop with a browser default.

- [ ] **Step 3: Run tests and commit**

```bash
pnpm test -- --run test/vocabulary-learning/lesson-reader.test.ts
pnpm typecheck
git add src/components/vocabulary-learning/LessonReader.vue src/components/vocabulary-learning/WordCardPanel.vue test/vocabulary-learning/lesson-reader.test.ts
git commit -m "feat(vocabulary): add contextual lesson reader"
```

### Task 7: Progressive Recall and Constrained Production

**Files:**
- Create: `src/components/vocabulary-learning/RecallStage.vue`
- Create: `src/components/vocabulary-learning/ProductionStage.vue`
- Create: `test/vocabulary-learning/recall-stage.test.ts`
- Create: `test/vocabulary-learning/production-stage.test.ts`

**Interfaces:**
- `RecallStage` consumes `RecallExercise[]` and emits `reviewed({ entryId, outcome })`.
- `ProductionStage` consumes `ProductionTask[]` and saved answers; emits `answer-saved` and `production-recorded`.

- [ ] **Step 1: Write failing recall interaction tests**

Prove:

- correct first submission emits `unaided`;
- first hint reveals only the first letter;
- second hint reveals `meaningCue`;
- revealing the answer emits `failed` if not already answered;
- correct submission after either hint emits `prompted`;
- accepted answers compare case-insensitively after trimming and Unicode-space normalisation;
- advancing exercises does not erase recorded outcomes.

- [ ] **Step 2: Implement `RecallStage`**

Track hint depth per exercise and emit exactly once per completed exercise. Do not expose the full canonical word in hidden DOM before the answer-reveal step.

- [ ] **Step 3: Write failing production tests**

Prove:

- required words render beside each task;
- answers persist through emitted `answer-saved` events;
- the reference answer remains folded until the learner saves a non-empty attempt;
- rubric checkboxes cover meaning, collocation, grammar, register, and relevance;
- `production-recorded` emits only after all rubric items are checked;
- no automatic score or correctness claim is rendered.

- [ ] **Step 4: Implement `ProductionStage`**

Render modes `collocation`, `rewrite`, `sentence`, `speaking`, and `writing` with one consistent answer model. Speaking mode uses a text notes area and timer prompt only; it does not request microphone access.

- [ ] **Step 5: Run tests and commit**

```bash
pnpm test -- --run test/vocabulary-learning/recall-stage.test.ts test/vocabulary-learning/production-stage.test.ts
pnpm typecheck
git add src/components/vocabulary-learning/RecallStage.vue src/components/vocabulary-learning/ProductionStage.vue test/vocabulary-learning/recall-stage.test.ts test/vocabulary-learning/production-stage.test.ts
git commit -m "feat(vocabulary): add recall and production practice"
```

### Task 8: Generate and Independently Review Space Exploration Content

**Files:**
- Create: `src/features/vocabulary-learning/content/04-space-exploration.ts`
- Create: `test/vocabulary-learning/content.test.ts`
- Create: `THIRD_PARTY_NOTICES.md`
- Modify when factual corrections are required: `src/pages/vocabulary/vocabulary.txt`
- Regenerate after source corrections: `src/pages/vocabulary/vocabulary.js`
- Modify: `package.json`

**Interfaces:**
- Consumes: the 75 canonical entries, `TopicContent` schema, validator, existing MP3 paths, and the approved design spec.
- Produces: default export `spaceExplorationContent satisfies TopicContent`.

- [ ] **Step 1: Pin and obtain the British IPA source for generation**

Use upstream commit `43c3570eb3553bdd19fccd2bd0091534889af023` and file `data/en_UK.txt` from `open-dict-data/ipa-dict`. Download it to a temporary directory, never `src` or `public`, and verify the file blob SHA recorded by GitHub is `f33a9d08cba10e434e20b0a6d417857e11680030`.

Create `THIRD_PARTY_NOTICES.md` naming the project, URL, upstream commit, Received Pronunciation dataset, and GPL-3.0 upstream licence. Only the matched IPA strings needed by the 75 word cards enter the topic content.

- [ ] **Step 2: Dispatch the generator subagent**

Spawn one subagent with model `gpt-5.6-terra`, reasoning effort `high`, and this exact bounded assignment:

```text
Own only the Space Exploration pilot content and factual corrections to its source block. Read the approved active-vocabulary design, canonical/content types, validator, and the 04_太空探索 source block. Create src/features/vocabulary-learning/content/04-space-exploration.ts with 4-6 coherent B2-C1 lessons covering all 75 canonical entry IDs. Every entry needs a complete WordCard. Annotate every target occurrence as a PassageSegment. Use British spelling, natural IELTS-relevant contexts, folded Chinese translations, recall exercises, constrained production, one final Speaking task, and one Task 2 paragraph task. Use the pinned en_UK IPA data first; explicitly verify fallbacks. Correct only demonstrable typos or factual errors in the 04_太空探索 block of vocabulary.txt, preserve all 75 entries and groups, then regenerate vocabulary.js with parser.py. Do not touch UI, review logic, storage, other topics, or deployment files. Run the content tests and validator before returning.
```

The subagent may work across follow-up turns but remains the owner through review repairs.

- [ ] **Step 3: Write deterministic content acceptance tests**

`content.test.ts` must:

- load canonical topic `04_太空探索` and the content default export;
- assert exactly 75 canonical entries and 75 word cards;
- call `assertValidTopicContent()`;
- assert four to six lessons;
- assert every lesson has 15-25 unique target entries;
- assert every card has two to four collocations and non-empty IPA;
- assert every card marked `priority: 'high'` has annotated uses in at least two lessons;
- assert every existing canonical audio path maps to a file under `public` using `existsSync`;
- assert final Speaking and Writing tasks have required entry IDs and five rubric dimensions;
- assert `synthesise` is the accepted British primary form where that entry appears.

Set `validate:content` exactly to:

```json
"validate:content": "vitest run test/vocabulary-learning/content.test.ts"
```

- [ ] **Step 4: Run deterministic validation**

```bash
python3 src/pages/vocabulary/parser.py
pnpm validate:content
pnpm typecheck
```

Expected: all checks pass with 100% coverage. Any source correction must be visible in both `vocabulary.txt` and regenerated `vocabulary.js`.

- [ ] **Step 5: Dispatch an independent language reviewer**

Spawn a different `gpt-5.6-terra` subagent at `high` reasoning effort:

```text
Review only the Space Exploration static content against the approved design and the 75 canonical source entries. Do not edit files. Report findings with entry ID and exact passage/card/task location. Check semantic fit, collocation accuracy, grammar, British spelling, register, B2-C1 readability, passage coherence, Chinese translation fidelity, IELTS usefulness, IPA fallbacks, and whether any target was inserted unnaturally. Treat deterministic coverage as necessary but not sufficient. Return “approved” only when no actionable findings remain.
```

- [ ] **Step 6: Repair all reviewer findings with the original generator**

Send the review report back to the original generator. Require it to address every finding or explain with evidence why no edit is appropriate. Re-run `pnpm validate:content` and repeat independent review until no actionable findings remain.

- [ ] **Step 7: Commit accepted content**

```bash
git add src/features/vocabulary-learning/content/04-space-exploration.ts test/vocabulary-learning/content.test.ts THIRD_PARTY_NOTICES.md package.json src/pages/vocabulary/vocabulary.txt src/pages/vocabulary/vocabulary.js
git commit -m "feat(vocabulary): add reviewed space exploration content"
```

If the source files required no corrections, omit them from `git add`.

### Task 9: Compose the Five-Stage Topic Experience

**Files:**
- Modify: `src/pages/vocabulary/learn/[topic].vue`
- Create: `test/vocabulary-learning/topic-page.test.ts`

**Interfaces:**
- Consumes: manifest loader, canonical topic, static content, reader, recall, production, and progress facade.
- Produces: ordered stages `预热`, `语境输入`, `主动回忆`, `主动使用`, and `延迟复习` plus final challenges.

- [ ] **Step 1: Write a failing topic-page integration test**

Mock the manifest loader and progress facade, then assert:

- the five stage labels render in order;
- completing input records exposure for the lesson's target IDs;
- recall emissions call the corresponding review transition;
- production completion records production for every required entry ID;
- next/previous navigation retains saved progress;
- a lesson becomes complete only after recall and production stages are submitted;
- final Speaking and Writing tasks unlock after all lessons complete;
- topic stats update across all four mastery states and due reviews.

- [ ] **Step 2: Implement the page orchestrator**

The page owns only current lesson/stage selection and component wiring. Scheduling stays in `review.ts`; persistence stays in `storage.ts`; content remains immutable. A reload restores the current completion state from saved progress.

- [ ] **Step 3: Run tests and commit**

```bash
pnpm test -- --run test/vocabulary-learning/topic-page.test.ts
pnpm typecheck
git add 'src/pages/vocabulary/learn/[topic].vue' test/vocabulary-learning/topic-page.test.ts
git commit -m "feat(vocabulary): compose active topic learning flow"
```

### Task 10: Full Verification, Visual QA, and Production Release

**Files:**
- Modify only if verification finds scoped defects in files from Tasks 1-9.

**Interfaces:**
- Consumes: all pilot features and the Cloudflare deployment completed by the first plan.
- Produces: a verified production pilot at `https://liyian2-my-ielts.pages.dev/#/vocabulary/learn`.

- [ ] **Step 1: Run the complete automated suite**

```bash
pnpm lint
pnpm typecheck
pnpm test -- --run
pnpm validate:content
pnpm build
```

Expected: every command exits 0. Confirm the build includes all 75 Space Exploration MP3 files and no runtime model credentials.

- [ ] **Step 2: Run browser QA at desktop and mobile sizes**

Start the app and inspect it with the in-app browser:

```bash
pnpm dev -- --host 127.0.0.1
```

At 1440×900 and 390×844, check light and dark modes for:

- existing vocabulary list and typing practice;
- dashboard availability states and counts;
- every lesson's passage layout and target buttons;
- long IPA, collocations, and Chinese text wrapping;
- translation folding;
- word audio switching;
- hint progression without answer leakage;
- production answers and rubric persistence after reload;
- export, reset, and import recovery;
- final challenge locking/unlocking.

- [ ] **Step 3: Inspect all lessons, not only the first**

Open each Space Exploration lesson and at least five cards per lesson. Confirm passage coherence at lesson boundaries, target highlighting, matching card context, and no clipped controls on mobile.

- [ ] **Step 4: Commit scoped QA fixes**

```bash
git status --short
```

If QA changed scoped pilot files, inspect `git diff --name-only`, stage each reported in-scope path explicitly with one `git add` argument per path, then run:

```bash
git commit -m "fix(vocabulary): polish active learning pilot"
```

Skip this commit when QA requires no changes. Never stage unrelated files.

- [ ] **Step 5: Push and watch production deployment**

```bash
git push origin master
gh run watch --exit-status
```

Expected: Cloudflare deployment succeeds.

- [ ] **Step 6: Verify the production learning flow**

Open:

- `https://liyian2-my-ielts.pages.dev/#/vocabulary`
- `https://liyian2-my-ielts.pages.dev/#/vocabulary/learn`
- `https://liyian2-my-ielts.pages.dev/#/vocabulary/learn/space-exploration`

Complete one recall item, reload, and confirm progress persists. Play `galaxy` and `synthesise`, export progress, and verify the downloaded JSON has `schemaVersion: 1` without private credentials.

---

## Plan Self-Review

- Spec coverage: canonical IDs, schema, validation, content, independent review, five learning stages, mastery, spaced review, persistence, backup, unavailable topics, final IELTS tasks, accessibility states, visual QA, and deployment are mapped to explicit tasks.
- Placeholder scan: content generation is specified by an exact bounded subagent assignment; all code interfaces and acceptance commands are concrete. QA staging is derived from inspected, in-scope changed paths and contains no wildcard or placeholder.
- Type consistency: `EntryId`, `CanonicalTopic`, `TopicContent`, `WordProgress`, `ReviewOutcome`, and component events use the same names and meanings in every task.
