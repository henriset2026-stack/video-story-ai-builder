# Deployment

The app is a standard Next.js 16 project (no custom server), so it deploys to Vercel or any Node.js host. Production needs two things the local setup doesn't: **Firebase (Cloud Firestore)** for storage and an **AI provider key**.

## 1. Firebase

### Create the project and database

1. Create a project in the [Firebase console](https://console.firebase.google.com) (or `npx firebase-tools@15 projects:create`).
2. Open **Build → Firestore Database → Create database**. Choose **production mode** and a location near your users (for Indonesia: `asia-southeast2`, Jakarta). The location cannot be changed later.
3. Deploy the security rules and index config from this repository:

   ```bash
   npx firebase-tools@15 login
   ```

   ```bash
   npx firebase-tools@15 deploy --only firestore:rules,firestore:indexes --project <your-project-id>
   ```

No schema migration is needed. The app stores **one document per project** in the `projects` collection:

| Field | Purpose |
| --- | --- |
| `title`, `theme`, `genre`, `duration`, `aspectRatio`, `language`, `sceneCount`, `createdAt` | Summary used by the project list (`createdAt` is an ISO 8601 string, ordered descending) |
| `storyboard` | The full validated storyboard, including scenes with their ids |
| `sceneIds` | Scene ids, so a scene can be found with an `array-contains` query |
| `ownerId` | Reserved for user accounts; `null` for now |
| `updatedAt` | Last change (ISO 8601) |

A storyboard is far below Firestore's 1 MiB document limit. Because a project is one document, creating a project is a single write and regenerating a scene is a single transaction — both atomic. The queries use single-field indexes that Firestore creates automatically, so `firestore.indexes.json` is empty.

### Service-account credentials

**Project settings → Service accounts → Generate new private key** downloads a JSON file. Copy three values from it:

| JSON field | Env variable | Exposure |
| --- | --- | --- |
| `project_id` | `FIREBASE_PROJECT_ID` | not secret |
| `client_email` | `FIREBASE_CLIENT_EMAIL` | server-only |
| `private_key` | `FIREBASE_PRIVATE_KEY` | **server-only secret** |

Keep the JSON file out of the repository and delete it once the values are stored. The private key can be pasted with real line breaks, or on one line with literal `\n` — the app restores the line breaks either way.

### Access model

There are no user accounts yet, so the server is the only database client. It uses the Firebase **Admin SDK** with the service account, only in route handlers and server components (`server-only` guards fail the build if a client component imports it).

`firestore.rules` denies **all** reads and writes from browsers and mobile clients. The Admin SDK bypasses rules, so the app works while nothing else can reach the data. To confirm after deploying the rules, this unauthenticated request must be refused (HTTP 403 `PERMISSION_DENIED`), never return projects:

```bash
curl "https://firestore.googleapis.com/v1/projects/<your-project-id>/databases/(default)/documents/projects"
```

When accounts are added, set `ownerId` on each project and open `projects/{id}` to `request.auth.uid == resource.data.ownerId` (see the roadmap in `docs/architecture.md`).

### Cost

The free Spark plan includes 50,000 document reads and 20,000 writes per day, plus 1 GiB of stored data, which comfortably covers a small team. Each generation is one write; opening a storyboard is one read; the project list reads one document per project shown.

## 2. Vercel

1. Import the GitHub repository in Vercel (or deploy from the CLI). The framework preset (Next.js), build command (`npm run build`) and output are detected automatically.
2. Add environment variables for Production (and Preview if you want previews to work):

   | Variable | Value |
   | --- | --- |
   | `AI_PROVIDER` | `anthropic`, `openai` or `gemini` |
   | `AI_PROVIDER_API_KEY` | your provider key |
   | `AI_BASE_URL` | optional OpenAI-compatible router, e.g. `https://router.bynara.id/v1` |
   | `AI_MODEL` | optional model override |
   | `FIREBASE_PROJECT_ID` | from the service-account JSON |
   | `FIREBASE_CLIENT_EMAIL` | from the service-account JSON |
   | `FIREBASE_PRIVATE_KEY` | from the service-account JSON |
   | `STORAGE_DRIVER` | `firestore` |

   Secrets can be added from your own terminal without pasting them anywhere shared:

   ```bash
   npx vercel@latest env add FIREBASE_PRIVATE_KEY production
   ```

3. Deploy.

### Why set `STORAGE_DRIVER=firestore`

Without it, the app picks local-file storage whenever the Firebase variables are missing. Serverless file systems are read-only and per-instance, so saving would fail and projects would never persist. With `STORAGE_DRIVER=firestore`, a missing variable fails loudly instead of silently falling back.

### Function duration

`/api/generate` sets `maxDuration = 300` (seconds) and `/api/scenes/[id]/regenerate` sets `120`. A full generation is about 6 sequential AI calls. If your plan caps functions lower, generations can be cut off: reduce `AI_TIMEOUT_MS`, use a faster model via `AI_MODEL`, or upgrade the plan. Progress is streamed, so the browser connection stays active during the run.

Measured with Nara Router: `agnes-2.5-flash` completes a 3-scene storyboard in about 190 s; `agnes-3-flash` (a slower reasoning model) exceeded 300 s.

### Rate limiting

The built-in limiter (5 generations and 15 regenerations per minute per IP) is in memory, so each serverless instance counts separately. For a public deployment, implement the `RateLimiter` interface in `lib/http.ts` on a shared store such as Upstash Redis.

## 3. Other Node.js hosts

```bash
npm ci
```

```bash
npm run build
```

```bash
npm start
```

Set the same environment variables. On a single long-running server, local-file storage works (projects in `LOCAL_DATA_DIR`), but Firestore is still recommended for backups and multiple instances.

## 4. Testing Firestore locally

`npm run test:firestore` starts the Firestore emulator (needs Java 21 or newer) and runs the whole suite against it, including the storage contract test for `FirestoreRepository`. No cloud project or credentials are used. On macOS with Homebrew, Java is keg-only, so put it on the PATH for the run:

```bash
PATH="/opt/homebrew/opt/openjdk/bin:$PATH" npm run test:firestore
```

## 5. Production checklist

- [ ] Firestore database created; rules deployed; the unauthenticated request above returns 403
- [ ] `STORAGE_DRIVER=firestore` and the three Firebase values set as server-side env vars
- [ ] Service-account JSON file deleted from your machine after copying the values
- [ ] `AI_PROVIDER_API_KEY` set; `/settings` shows the provider (not "Mock data") and "Cloud Firestore"
- [ ] `AI_MOCK_MODE` unset or `false`
- [ ] One full generation and one scene regeneration succeed on the deployed URL
- [ ] Function duration limit is at least what a generation needs on your plan
- [ ] Shared rate limiter in place if the app is public
- [ ] `npm run lint`, `npm run typecheck`, `npm run test:firestore` and `npm run build` pass on the commit being deployed

## 6. Troubleshooting

| Symptom | Likely cause |
| --- | --- |
| Header shows "Mock data" in production | `AI_PROVIDER_API_KEY` missing or `AI_MOCK_MODE=true` |
| "Your storyboard was created but could not be saved" | Storage misconfigured: wrong Firebase project or credentials, Firestore database not created, or local storage on a serverless host |
| Every generation fails with the generic AI error | Invalid key or model name, or no provider credit — check the server logs (keys are redacted) and `AI_MODEL` |
| "The AI took too long to respond" | `AI_TIMEOUT_MS` too low for the model, or the platform's function limit was reached |
| Projects page shows an error | Firestore unreachable, database not created, or the private key was pasted incorrectly — check the server logs |
