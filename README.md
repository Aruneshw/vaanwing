# StudyNest — Personalized Tutoring & Adaptive Learning (frontend)

Frontend for a source-grounded AI study companion (Multimodal AI Hackathon 2026 · Track D).
Three tabs, built to match the design mockups:

| Tab | What works |
| --- | --- |
| **Home** | Overall progress donut, weekly study time & streak, stat cards, continue learning, subjects, weekly focus (weakest concept from the learner model), recent activity, recommendations. Every card/button opens its view (lesson player, demo tour, quiz, notes, reports, etc.). |
| **Learn** | Subject sidebar (+ add subject), topic search, resume banner, All Topics / Concepts / Notes / Bookmarks tabs, sorting, expandable modules with lesson viewer, mark-complete & bookmark, subject progress, topic map + full course flow map, quick actions. |
| **AI Tutor** | Add sources (file upload / drag-drop, YouTube, web URL, pasted text, audio recording), resource search/filter/rename/delete, study modes, source-grounded chat with clickable citations that **declines or flags** off-material questions, suggested questions, analysis progress, learning tools (notes, flashcards, slide deck, mind map, audio brief, summary, reports, data table), adaptive quiz that unlocks the personalized learning path. |

Other details: `Ctrl/⌘ + K` command palette, notifications, profile/settings, toasts, responsive layout.
State (progress, notes, quiz history, per-concept mastery, sources, chat) is persisted in `localStorage`;
use **Reset demo data** from the profile menu to start over.

## Demo flow (single-PDF mode)

1. **AI Tutor → Upload Files** → choose the *Operating System* notes PDF. It is parsed in the browser with pdf.js:
   every page is split into headed sections that become citable excerpts (`p. N`), and the 17 topics become an
   **Operating Systems** course in the Learn tab.
2. Ask anything (“What is a deadlock?”, “Explain paging and the TLB”) — answers quote the PDF with page citations.
   Off-material questions are declined (or flagged as outside knowledge with Web Search / Open Mode).
3. “Give me a quick test” → a 5-question adaptive test (24 verified OS questions, each tagged with topic, page, difficulty).
4. **New student:** profile menu → *Start as new student* → intake conversation + diagnostic quiz (one question per topic)
   → strengths / focus areas seed the BKT learner model and unlock the personalized path.
5. **System Evaluation** card (AI Tutor, right column) → *Run evaluation*: faithfulness, answer relevancy, context precision /
   recall and off-material refusal on a team-built test set (17 OS questions with known pages + 6 off-material queries),
   plus 3 simulated student profiles × 5 sessions reporting mastery gain and question-repetition rate (vs. a random baseline).
   Metrics follow RAGAS definitions with lexical judges so they run offline; the report can be downloaded as JSON.

## Mocked backend

There is no backend yet. These pieces run client-side so the UI is fully interactive and are the
integration points for the real services:

- `src/tutor.ts` — retrieval over source chunks + grounded answer composition (swap for the RAG API).
- `src/sources.ts`, `src/pdf.ts` — turn uploads into resources/chunks (PDFs and text files are really extracted and citable; video, audio and images are registered only).
- `src/osCourse.ts` — OS course builder + verified question bank for the OS notes PDF.
- `src/eval.ts` — evaluation harness (RAG metrics + simulated students).
- `src/store.tsx` — learner model with Bayesian Knowledge Tracing updates after every quiz answer.
- `src/data.ts` — seed course, concepts, knowledge-base excerpts and question bank.

## Run

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # static build in dist/ (relative paths, hash routing — host anywhere)
```

Stack: React 19 + TypeScript + Vite, `react-router-dom`, `lucide-react`. No UI framework — styles live in `src/index.css`.
