# n8n Automation — setup

For what these workflows actually do and why, see `AUTOMATION_WORKFLOWS.md` at the project root. This doc is the technical checklist to get n8n calling this app for real.

The app already runs the full automation pipeline in dev without any of this — every `/api/automation/*` route works standalone and can be triggered by hand (`curl`, Postman, etc.) to verify it before n8n is even involved. Nothing below is required to develop or test the endpoints themselves.

## 1. Get an n8n instance running

n8n is a separate service from this app — it doesn't run inside Next.js. Any of the following works:

- **n8n Cloud** (simplest, no infrastructure to manage) — sign up at [n8n.io](https://n8n.io).
- **Self-hosted via Docker** (recommended if it'll live on the same Hostinger VPS as this app eventually):
  ```
  docker run -it --rm --name n8n -p 5678:5678 -v n8n_data:/home/node/.n8n docker.n8n.io/n8nio/n8n
  ```
- **Self-hosted via npm**: `npx n8n` (pulls a large dependency tree on first run — be patient).

Set the n8n instance's **timezone** to `Asia/Kolkata` in its settings (Settings → this affects when the "Daily at 9:00 AM" style triggers actually fire) — otherwise those two daily workflows will fire at 9/10 AM in whatever timezone the n8n server defaults to (often UTC).

## 2. Create the shared credential

1. In n8n, go to **Credentials → New → HTTP Header Auth**.
2. Name it exactly `TripNexio Automation Key` (matches what the workflow JSON files below reference).
3. Header name: `Authorization`. Header value: `Bearer <AUTOMATION_API_KEY>` — the exact value from this app's `.env` (see `.env.example` for how it was generated).

## 3. Set the app's base URL in n8n

In n8n's own environment configuration (Settings → Environment Variables, or however your n8n deployment injects env vars — this differs between n8n Cloud and self-hosted), set:

```
TRIPNEXIO_BASE_URL=https://your-production-domain.com
```

(or `http://localhost:3000` / a staging URL while testing). Every workflow JSON references `{{ $env.TRIPNEXIO_BASE_URL }}` instead of a hard-coded URL so the same exported workflow works across environments.

## 4. Import the four workflows

The exported workflow files are in `n8n/workflows/` in this repo:

| File | Workflow | Calls |
|---|---|---|
| `quote-expiry-handling.json` | Quote Expiry Handling | `POST /api/automation/quote-expiry` |
| `payment-followup-reminders.json` | Payment Follow-up Reminders | `POST /api/automation/payment-followup` |
| `otb-requirement-checks.json` | OTB Requirement Checks | `POST /api/automation/otb-requirement-check` |
| `periodic-service-followups.json` | Periodic Service Follow-ups | `POST /api/automation/lead-followup` |

For each file: n8n → **Workflows → Import from File** → select the JSON.

**After importing, re-select the credential on the HTTP Request node in each workflow.** The JSON references the credential by name (`TripNexio Automation Key`), but n8n assigns credentials an internal ID per-instance that an exported file can't carry across instances — this is expected, standard n8n behavior for shared workflow templates, not a bug in the file. Open the HTTP Request node, click the Credential dropdown, and pick the one created in step 2.

Each workflow imports **inactive** (`"active": false`) on purpose — turn it on (the toggle at the top of the workflow editor) only once you've confirmed it works (step 5).

> **Note on these files**: they were hand-authored against n8n's documented workflow-export schema (Schedule Trigger + HTTP Request nodes) and validated as well-formed JSON, but not verified against a live n8n import in this environment (n8n wasn't available to install here). Double-check the Schedule Trigger's cron/interval fields match your n8n version's node UI after importing — n8n's node parameter shape occasionally changes between versions.

## 5. Verify each workflow before activating it

1. Open the workflow, click the HTTP Request node, click **Test step** (or **Execute Workflow**).
2. Confirm it returns a 200 with a JSON body like `{"data": {"checked": 0, "expired": 0, "remindersSent": 0}}` (exact keys vary per workflow — see each route's own summary shape in `AUTOMATION_WORKFLOWS.md`).
3. Check **Admin → Automation** in the app — the workflow's card should now show a "Success" last run.
4. Only then flip the workflow to **Active**.

A 401 response means the credential's header value doesn't match `AUTOMATION_API_KEY` in the app's `.env` — re-check step 2. Any other error shows up in both n8n's own execution log and the Admin Automation screen (which records the error message).

## 6. Ongoing monitoring

**Admin → Automation** (staff with the `automation.view` permission — Admin by default, grant it to another role via Admin → Roles if needed) shows every workflow's last run and a recent-run history. n8n's own **Executions** tab is the second place to check — it shows the raw HTTP response/timing for every run, useful for debugging a specific failure in more detail than the app's summary view.

## Known gap: no failure alerting yet

If a workflow starts failing, today the only way to notice is checking Admin → Automation or n8n's Executions tab — nothing pages anyone. A natural next step: add an error-handling branch in each n8n workflow (n8n supports a workflow-level "Error Workflow" setting, or an IF node checking the HTTP response status) that posts to Slack/sends an email when a run fails. Not built here — flagged as a next step rather than guessed at, since the right notification channel is a product decision for the client to make.
