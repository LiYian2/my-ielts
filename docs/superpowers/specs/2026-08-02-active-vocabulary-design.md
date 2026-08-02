# Active Vocabulary Learning Design

## Goal

Turn the repository's topic-based IELTS word list into a static learning system that moves words from recognition to natural, active use through contextual input, unaided recall, constrained production, and spaced review.

## Scope and Rollout

The first release is a complete pilot for `04_太空探索`, which contains 75 source entries. Existing vocabulary-list and typing-practice pages remain available and unchanged in purpose.

The other 21 topics initially show that active-learning content is still being generated. They are generated only after the pilot's content template and interaction model have been tested by the user. Expansion uses one `gpt-5.6-terra` subagent at `high` reasoning effort per topic, with a separate subagent reviewing the generated language.

## Product Principles

- Active production is the success metric; seeing a familiar word is not mastery.
- Natural context takes priority over forcing every word into one oversized article.
- Each topic is a pack of short, coherent lessons that collectively cover every source entry.
- Runtime AI is not used. All learning content is generated, reviewed, versioned, and shipped as static data.
- English is natural B2-C1 language suitable for IELTS band 6.5-7.5 learners.
- Chinese support is available but folded by default.
- British spelling and pronunciation are preferred.

## Source of Truth and Data Flow

`src/pages/vocabulary/vocabulary.txt` remains the canonical word list. The parser produces normalised entries with stable IDs and preserves existing meanings, examples, extensions, topic membership, group membership, and audio paths.

Each topic has one structured static content file containing:

- topic metadata and source-entry IDs;
- lessons and passages;
- word cards;
- recall exercises;
- production tasks;
- final Speaking and Writing challenges;
- explicit coverage references connecting every source entry to passages and exercises.

A build-time validator rejects malformed data, missing source entries, unknown IDs, duplicate coverage records, missing required fields, invalid audio paths, and coverage below 100%.

## Lesson Structure

The Space Exploration pilot divides 75 entries into approximately four to six lessons, each teaching roughly 15-25 target entries. Every lesson follows the same five-stage sequence.

### 1. Warm-up

The learner responds to a short topic question before seeing the target vocabulary. This activates existing language and creates a baseline for later comparison.

### 2. Contextual Input

The learner reads a coherent English passage. Target entries are visually highlighted. Selecting a target:

- plays the existing repository audio where available;
- opens the matching word card;
- shows how the word functions in the current sentence.

The full Chinese translation is folded by default. It is an escape hatch for comprehension, not the primary reading mode.

### 3. Active Recall

The passage is reused as a cloze exercise. The learner first attempts unaided recall. Hints appear progressively:

1. first letter;
2. relevant Chinese meaning or English cue;
3. complete answer.

The system records unaided success, prompted success, and failure separately.

### 4. Active Use

The learner completes collocation selection, sentence rewriting, a personal example, and a short spoken or written response. The task specifies required target entries so the learner cannot use only familiar words.

### 5. Delayed Review

Words enter a local review queue. Reviews mix meaning-to-word recall, contextual cloze, collocation completion, and production prompts instead of repeating one exercise form.

## Topic Completion

A topic concludes with:

- one IELTS Speaking Part 2 or Part 3 response;
- one IELTS Task 2-style paragraph rather than a full essay;
- a randomly selected set of required target entries;
- a self-assessment checklist covering meaning, collocation, grammar, register, and relevance;
- a reference answer that demonstrates natural use without implying that it is the only valid response.

## Word Cards

Every entry must contain:

- British IPA;
- a link to the existing pronunciation audio;
- the relevant Chinese meaning;
- two to four useful collocations;
- one new example labelled as suitable for speaking, writing, or both;
- the sentence from the topic passage;
- an active-output prompt.

These optional fields appear only where they add genuine learning value:

- word family and derivatives;
- precise synonyms with usage distinctions;
- confusable words;
- grammar or preposition restrictions;
- register and IELTS usage advice.

British IPA is matched first from the open `en_UK` Received Pronunciation data in `open-dict-data/ipa-dict`. The upstream UK dataset is GPL-3.0, so any derived pronunciation data included in the repository must retain the required attribution and licence notice. Multiword expressions, inflected forms, and proper nouns that do not match the dataset are supplied by the content subagent and receive explicit reviewer attention. Missing IPA is reported rather than silently guessed after review fails.

## Coverage Rules

- Every source entry appears naturally in at least one passage.
- High-value IELTS production vocabulary appears in at least two distinct contexts.
- Low-frequency technical terms and proper nouns require one accurate contextual use; they are not repeated artificially.
- Slash-separated British/American spellings are treated as one entry, with British spelling used in prose.
- Coverage is computed from structured target annotations, then cross-checked against rendered text.
- A topic cannot be committed as complete until coverage is 100%.

## Content Production and Review

For each topic:

1. The parser exports a bounded source packet containing only that topic's canonical entries and constraints.
2. One `gpt-5.6-terra` subagent at `high` reasoning effort generates the topic data. Large topics may take several turns, but the same agent owns the topic to preserve voice and internal consistency.
3. The generator cannot add, remove, rename, or reinterpret source IDs.
4. Deterministic validation checks schema, required fields, coverage, spelling preference, references, and audio paths.
5. A different `gpt-5.6-terra` subagent at `high` reasoning effort reviews semantic accuracy, collocations, register, naturalness, passage coherence, and IELTS relevance.
6. The original generator repairs reviewer findings and validation errors.
7. The topic is accepted only after deterministic validation passes and review findings are resolved.

During full expansion, topic agents run in bounded batches because the session supports three concurrent child agents in addition to the coordinating agent.

## Mastery Model

Each entry has one learning state:

- `unseen`: no lesson exposure;
- `understood`: encountered in context but not recalled unaided;
- `recallable`: recalled unaided at least once;
- `active`: recalled unaided on at least two different dates and used in at least one learner-produced sentence or response.

The review intervals are 1, 3, 7, 14, and 30 days:

- unaided success advances to the next interval;
- prompted success retains the current level and schedules the next day;
- failure returns the entry to a one-day interval;
- recognition without recall does not count as mastery.

The static application cannot truthfully grade free-form naturalness. For speaking and writing, it stores the learner's answer, shows a reference and rubric, and records the learner's self-assessment.

## Local Progress

The application stores progress, written responses, review history, and self-ratings in browser storage. The stored structure includes a schema version and supports:

- JSON export;
- JSON import with validation;
- full reset after confirmation;
- migration when the content or progress schema changes;
- recovery from malformed saved state without silently erasing the original value.

Accounts, server storage, cross-device sync, voice recording, speech recognition, and runtime AI grading are outside the pilot.

## Interface Boundaries

- The existing vocabulary source parser owns canonical entries and stable IDs.
- Topic content files own authored learning material but reference canonical entries by ID.
- The content validator owns acceptance rules and runs independently of Vue rendering.
- Vue lesson components render stages but do not calculate scheduling rules internally.
- A progress module owns state transitions, due dates, persistence, import, export, migration, and reset.
- Topic availability is driven by a manifest, allowing incomplete topics to display a safe generated-content status.

## Error Handling

- Missing topic content produces a non-breaking "content in progress" state.
- Missing audio disables the speaker action and is also reported during validation.
- Unknown content IDs or incomplete required fields fail validation rather than disappearing in the UI.
- Invalid saved progress is preserved as a recovery copy before the application starts fresh.
- Import rejects incompatible or malformed progress with a clear error and leaves current progress unchanged.

## Testing and Acceptance

### Deterministic Tests

- Parser tests cover stable IDs, slash-separated variants, multiword entries, topic counts, and audio path generation.
- Validator tests cover missing/unknown IDs, duplicate coverage, required word-card fields, audio existence, and 100% coverage.
- Scheduling tests cover all success outcomes, interval transitions, date boundaries, and active-state requirements.
- Persistence tests cover round-trip storage, export/import, schema migration, malformed input, and reset.

### Component Tests

- Topic dashboard counts and due reviews.
- Folded translation and word-card interaction.
- Audio play action and missing-audio state.
- Progressive hint behaviour and distinct result recording.
- Learner answer persistence and rubric self-assessment.

### Content Acceptance

- All 75 Space Exploration source entries are referenced and rendered.
- Every core word-card field is present.
- Passages are coherent B2-C1 English rather than lists disguised as prose.
- Required collocations match the relevant meanings.
- British spelling is used where variants exist.
- The independent language review has no unresolved findings.

### Visual and Deployment Acceptance

- Verify desktop and mobile widths in light and dark modes.
- Verify the existing list and typing practice still work.
- Run lint, typecheck, tests, content validation, and a production build.
- After Cloudflare deployment, verify the home page, vocabulary routes, refresh behaviour, and representative audio assets.

## Out of Scope

- Runtime model calls
- AI scoring or tutoring
- Accounts and cloud sync
- Full-essay grading
- Voice recording or automatic speech recognition
- A custom Cloudflare domain
- Generating the remaining 21 topics before the pilot is approved through real use

