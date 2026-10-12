# Course Craft: setup notes

## Run it

```bash
cp .env.example .env.local     # add MONGODB_URI and DEEPSEEK_API_KEY
npm install
npm run seed:admin             # set SEED_ADMIN_* in .env.local first
npm run dev                    # http://localhost:3000
```

The seed command creates an admin account or promotes the account with the configured email. It does not replace an existing account's password. Only admins can upload documents to create courses; regular users can still join and study shared courses.

Verified with `@mastra/core` 1.71 and `@ai-sdk/openai-compatible` 3.0 (the project typechecks with `tsc --noEmit`
and the parser was smoke-tested on a real PDF). Not yet run end to end against MongoDB and the DeepSeek API.

Pages: `/` landing, `/courses` upload + course list, `/courses/[id]` reader with quiz and assistant.
Auth: Auth.js v5, see the Authentication section below.

## Personalized course reconstruction

Users with paid access or an administrator grant can create private course copies from courses they can access. The original stays unchanged.
Each account can start three reconstructions per week (each started run uses a slot), resetting Monday at midnight in Nigeria time (`Africa/Lagos`). The learner prompt
can tailor presentation, examples, and depth while the source subject and learning goals are preserved.

To enable Paystack checkout:

1. Set `PAYSTACK_SECRET_KEY` and `APP_URL` in the server environment. Use the live secret key only in production; `APP_URL` must be the public
   HTTPS origin in production.
2. In Paystack, configure the webhook URL as `{APP_URL}/api/payments/paystack/webhook` and subscribe to `charge.success`. The callback URL is
   supplied automatically by the app.
3. In the admin dashboard, set the one-time whole-naira price under **Platform settings → AI course reconstruction**. A zero price keeps checkout
   unavailable. Administrators can grant or revoke access per user from **Users**.

Payment access is granted only after the server verifies the transaction reference, amount, NGN currency, and customer email with Paystack.
The browser redirect alone does not unlock the feature. In local development, Paystack needs a publicly reachable callback/webhook URL for a full
payment-flow test.

## Monochrome shadcn tokens (already in `app/globals.css`)

```css
:root {
  --radius: 0rem;
  --background: #fff;
  --foreground: #000;
  --border: #000;
  --input: #000;
  --ring: #000;
  --muted: #f4f4f5;
  --muted-foreground: #71717a;
  --primary: #000;
  --primary-foreground: #fff;
}
.dark {
  --background: #000;
  --foreground: #fff;
  --border: #fff;
  --input: #fff;
  --ring: #fff;
  --muted: #18181b;
  --muted-foreground: #a1a1aa;
  --primary: #fff;
  --primary-foreground: #000;
}
```

## Where the tokens go

| Step             | Input                                                           | Output                     |
| ---------------- | --------------------------------------------------------------- | -------------------------- |
| Sanitize / chunk | none (local code)                                               | none                       |
| Outline          | skeleton: ~60-150 chars per 1,200-char block, capped ~24k chars | small JSON                 |
| Lecture x N      | one chapter chunk (max ~9k chars) + chapter titles              | Markdown, max 2,000 tokens |
| Quiz x N         | that chapter's lecture Markdown                                 | JSON, max 1,500 tokens     |
| Chat             | one chapter (max 7k chars) + last 6 turns                       | max 400 tokens             |

Extra savings: static agent instructions first (DeepSeek prefix cache), low temperature (fewer rewrites),
local range repair and option shuffling (no repair calls), no vector DB or embeddings.

## Mastra API notes (1.x)

- Agents need an `id`. Structured output is `generate(prompt, { structuredOutput: { schema, jsonPromptInjection: true } })`
  and the parsed value is `res.object`. `jsonPromptInjection` is needed because DeepSeek has no `json_schema` mode.
- Workflows: `mastra.getWorkflow(id).createRun()` then `run.start({ inputData })`; `.foreach(step, { concurrency })`.
- Generation limits use `modelSettings: { maxOutputTokens, temperature }`.
- If you upgrade `@mastra/core`, run `npx tsc --noEmit` first: these APIs have changed between major versions.

## Editing, regenerating, sharing and analytics

Roles: the person who uploads a course is its **instructor** (owner). A **student** is anyone who joins through the course's share link.

- **Edit** (`/courses/[id]/edit`, owner only): rename the course, edit any chapter's title and Markdown lecture (with preview), edit quiz questions
  (2-6 options, pick the correct one, explanation), add, delete and reorder chapters, delete the course.
- **Regenerate one chapter**: rewrites the lecture (from the source excerpt kept for that chapter, with optional guidance such as "more worked examples")
  or rebuilds the quiz from the lecture text in the editor. The result comes back as an **unsaved draft**, so nothing is overwritten until you choose Save.
  Courses built before source excerpts were stored rewrite from the current lecture instead. Cost: one chapter in, one lecture or quiz out.
- **Share** (`/courses/[id]/students`): turn a join link on or off, or replace it with a new one. Students sign in, see a notice about what the
  instructor can see, and join at `/join/[code]`. Turning the link off blocks new joins only; use Remove to end a student's access.
- **Analytics** (same page, owner only): students, average completion, average quiz score, assistant questions, per-chapter completion and best-attempt
  quiz averages (chapters under 60% are flagged), the five hardest quiz questions, and a per-student table with last activity and a Remove button.
  Per-question results only use each student's latest attempt made after the quiz was last edited, so edits never mix old answers into new questions.
  The instructor's own activity is not counted.

Access rules, all enforced in the API and the pages: only the owner can edit, regenerate, share or view analytics; owners and joined students can read,
take quizzes and use the assistant; everyone else gets "not found". Progress is only accepted for real chapters of a course you can access.

Tested end to end with `next dev`, a local Mongo-compatible database (FerretDB) and a mock model server: the full background build through the real Mastra workflow,
every edit, reorder, add and delete (including validation errors), regeneration returning drafts without saving, sharing on/off/reset, student vs owner
permissions on every route and page, progress and assistant counters, the dashboard numbers (also unit-tested), removing students and course deletion.
Not tested: a real DeepSeek response (prompts and validation are exercised, but not real model output), the browser UI (forms and editor interactions),
and MongoDB proper.

Known limits: regeneration is one synchronous request (up to 2 minutes) with no per-user cooldown, so add rate limiting before opening it up;
the dashboard reads up to 1,000 students; reordering is not atomic if interrupted midway (chapters still sort correctly and the next reorder repairs it);
students can't leave a course themselves yet; there is no CSV export.

## Background builds

`POST /api/courses` validates the upload, creates the course, returns `202`, and runs `buildCourse()` via Next's `after()`.
Progress (stage, chapters done) is stored on the Course document; `/courses/[id]` polls
`GET /api/courses/[id]/status` every 2 seconds and switches to the reader when the build finishes.

- Model calls retry up to 3 times with backoff. A chapter whose quiz keeps failing ships without a quiz.
- A build with no progress for 10 minutes is reported as interrupted (server restart or timeout).
- Limits: the job runs inside the web process and the uploaded file is held in memory, so a restart loses in-flight builds.
  On serverless hosts `maxDuration` (300s) also caps the build. For heavy traffic move `buildCourse()` into a queue worker
  (BullMQ, Inngest, QStash) and store the upload in object storage; the status endpoint and progress screen stay the same.

## Authentication (Auth.js v5)

Users can sign up and sign in with **email and password**, and optionally with Google and/or GitHub. Sessions are JWTs.

Setup:

1. `npx auth secret` and put the value in `AUTH_SECRET`. Email/password also needs `MONGODB_URI`.
2. Optional OAuth: create an OAuth app per provider, register `{origin}/api/auth/callback/google` and/or `/github`
   (`http://localhost:3000` in dev), and set `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` and/or `AUTH_GITHUB_ID` / `AUTH_GITHUB_SECRET`.
   A provider button only appears when its id is set.
3. Self-hosting behind a proxy: also set `AUTH_TRUST_HOST=true`.

Pages: `/signin`, `/signup`. Wiring: `auth.config.ts` (edge-safe half, used by `middleware.ts`), `auth.ts` (adds the email/password
provider, Node only), `lib/users.ts` (sign-up, credential check), `lib/password.ts` (scrypt hashing), `lib/auth.ts` (`getUserId()`).
Pages redirect to `/signin` and API routes return `401` on their own too, and every course, chapter and chat request is checked against the owner.

Password handling: scrypt (N=2^15) with a random salt, stored as `scrypt$N$r$p$salt$hash`. After 5 wrong passwords an account is locked for
15 minutes. Failures look identical for unknown email, wrong password and locked account, and a dummy hash is verified for unknown emails so timing does not reveal them.

Tested: typecheck, plus against a local Mongo-compatible database (FerretDB): sign-up validation, duplicate and concurrent sign-ups (exactly one wins),
login with case-insensitive email, lockout and recovery, and through the real Auth.js endpoints: wrong password rejected, correct password creates a
session, `/courses` works only with that session, and an upload by that user reaches the background build and fails cleanly when the model is unreachable.
Not tested: OAuth logins (need your provider credentials), the browser form submit, and MongoDB proper (FerretDB is close but not identical).

Known gaps:

- No email verification and no password reset (both need an email service). Anyone can register any email address.
- Sign-up says when an email is already registered, which reveals that it has an account. Lockout lets someone deliberately lock a known email for 15 minutes.
  Add per-IP rate limiting on `/signin` and `/signup` before going public.
- The user id is the ObjectId (email users) or the provider account id (OAuth users), so one person using several methods gets separate accounts.
- JWT sessions cannot be revoked server-side until you add a database session strategy.

## Production TODOs

Add per-user rate limiting on `/api/chat` and log token usage per course.
