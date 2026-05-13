# Luma

Luma is a personal butler prototype with a cloud app, DeepSeek expert answers, and a Qwen brain training interface.

## Run

Install dependencies once:

```sh
npm install
```

Run:

```sh
npm start
```

Open:

```txt
http://localhost:4387
```

Local development uses:

```txt
data/luma.json
```

Cloud deployment can use `DATABASE_URL` for PostgreSQL. The lightweight cloud-server path can keep JSON/SQLite-style file storage during the learning phase.

DeepSeek is the default answering expert. Configure it with environment variables:

```txt
DEEPSEEK_API_KEY
DEEPSEEK_MODEL=deepseek-v4-flash
```

Qwen is Luma Brain for training and memory formation. Configure it when the Windows host endpoint is ready:

```txt
LUMA_BRAIN_ENDPOINT
LUMA_BRAIN_MODEL=qwen3.5:2b
```

## V2 Scope

- Chat-first Today page with status, location, weather, current project, and usage.
- Every user turn goes through the Input Normalization Layer before model routing.
- DeepSeek is the default answer and action proposal expert.
- Qwen Brain participates in every turn when configured, but it writes training samples and memory packets instead of directly answering the user.
- If DeepSeek is not configured or fails, Luma falls back to the local parser.
- DeepSeek only proposes actions; local Luma still owns confirmation, execution, memory, and project state.
- Project memory keeps named work such as `5207` as a continuous project thread with progress and next step.
- Projects are meant to be created manually first, then Luma can bind future actions to them.
- Usage page records model/parser calls, token estimates, cost estimates, and a 7-day token chart.
- Brain service and prompt optimizer interfaces are reserved for Windows Qwen and future token compression.

## V1 Scope

- Pseudo desktop app: local server plus a desktop launcher.
- Today dashboard, Setup, and ML Progress pages.
- Status is user-controlled and dynamic.
- Time/date/location/weather are context features, not hard-coded scenes.
- Location uses browser/macOS location permission. Save coordinates as places such as `home` or `campus`; Luma will infer the place later when nearby.
- Weather is fetched from current coordinates with Open-Meteo in the browser.
- Luma suggests a status from local history.
- Reminders are manually created and bound to status.
- Reminder frequencies: once, every time, next 3 days, daily until done, saved only.
- Deadline reminders can alert before due time, such as 30/20/10 minutes.
- Browser notification alerts work while Luma is open.
- Codex context can be copied for quick debugging or feature ideas.

## Cloud Deployment

Luma can run on a small Linux cloud server. See:

```txt
CLOUD_DEPLOY.md
```

For an Alibaba Cloud Windows ECS deployment with PostgreSQL and local Qwen Brain, see:

```txt
ALICLOUD_WINDOWS_DEPLOY.md
```

## Windows Qwen Brain

Run Qwen on the Windows host and expose an OpenAI-compatible endpoint to the cloud app. Luma treats this endpoint as its training brain, not as an external answering agent.
