# Deploy Luma on Alibaba Cloud Windows

This deployment keeps the cloud app on Alibaba Cloud Windows ECS and keeps Qwen Brain on your local Windows PC:

- Luma Web UI served by the Node.js app
- Luma Node.js API on port `4387`
- PostgreSQL for memory and long-term state
- Qwen brain endpoint on your local PC, exposed to Alibaba Cloud through a protected HTTPS tunnel

## 1. Security Group

Open only the ports you need:

```txt
80/tcp     public HTTP, if using a reverse proxy
443/tcp    public HTTPS, if using a reverse proxy
4387/tcp   optional direct Luma access; restrict to your own IP if possible
11434/tcp  do not open publicly; Qwen should stay behind a tunnel
5432/tcp   PostgreSQL local only; do not expose publicly
```

For a first private test, open `4387/tcp` only to your own IP.

## 2. Install Runtime

Install these on the Windows ECS host:

```txt
Node.js LTS
Git for Windows
PostgreSQL 16 or newer
```

Verify in PowerShell:

```powershell
node -v
npm -v
git --version
psql --version
```

## 3. Prepare PostgreSQL

Create a database and user:

```sql
create database luma;
create user luma_user with encrypted password 'replace-with-a-strong-password';
grant all privileges on database luma to luma_user;
```

If PostgreSQL 15+ blocks schema creation for non-owner users, run:

```sql
\c luma
grant all on schema public to luma_user;
```

Luma creates and updates its own tables at startup. The main SQL memory tables are:

```txt
luma_state
memory_events
conversations
projects
usage_events
brain_events
training_samples
context_snapshots
emotion_signals
```

## 4. Deploy Luma

Clone or copy this repository to the server:

```powershell
git clone https://github.com/Philippe979/Luma.git C:\Luma
cd C:\Luma
npm install
copy .env.example .env
notepad .env
```

Set `.env`:

```txt
PORT=4387
DATABASE_URL=postgresql://luma_user:replace-with-a-strong-password@127.0.0.1:5432/luma
LUMA_ACCESS_CODE=replace-with-private-login-code
DEEPSEEK_API_KEY=replace-with-deepseek-key
DEEPSEEK_MODEL=deepseek-v4-flash
DEEPSEEK_THINKING=disabled
LUMA_BRAIN_PROVIDER=qwen
LUMA_BRAIN_ENDPOINT=https://your-local-qwen-tunnel.example.com
LUMA_BRAIN_API_KEY=
LUMA_BRAIN_MODEL=qwen3.5:2b
LUMA_BRAIN_MODE=training
```

Then verify:

```powershell
npm run check
npm start
```

Open:

```txt
http://<your-ecs-public-ip>:4387
```

## 5. Start Qwen Brain on Your Local PC

If you use Ollama, install or import the closest available Qwen 2B model on your local Windows PC, then start the server:

```powershell
ollama serve
ollama pull qwen3.5:2b
```

Ollama exposes an OpenAI-compatible endpoint on your local PC at:

```txt
http://127.0.0.1:11434/v1/chat/completions
```

Luma calls:

```txt
<LUMA_BRAIN_ENDPOINT>/v1/chat/completions
```

Expose that local endpoint to Alibaba Cloud through a protected tunnel such as Cloudflare Tunnel, frp, Tailscale Funnel, or an SSH reverse tunnel.

Then set Alibaba Cloud `.env` to the public HTTPS tunnel root:

```txt
LUMA_BRAIN_ENDPOINT=https://your-local-qwen-tunnel.example.com
```

If your Qwen server uses another model tag, update `LUMA_BRAIN_MODEL` to the exact model name shown by that server.

## 6. Run as a Windows Service

The simplest service path is NSSM:

```powershell
npm install
npm run check
```

Create a service with:

```txt
Application: C:\Program Files\nodejs\node.exe
Arguments: server.js
Startup directory: C:\Luma
```

Set the service to restart on failure. Keep `.env` in `C:\Luma`; Luma reads it automatically on startup.

## 7. Production Reverse Proxy

For a public deployment, place Caddy, Nginx, or IIS in front of Luma:

```txt
https://your-domain.example -> http://127.0.0.1:4387
```

After HTTPS is ready, close public access to `4387/tcp` and leave only `80/tcp` and `443/tcp` open.

## 8. Smoke Tests

Use PowerShell on the server:

```powershell
Invoke-RestMethod http://127.0.0.1:4387/api/health
Invoke-RestMethod https://your-local-qwen-tunnel.example.com/v1/models
```

Then open Luma in the browser, log in with `LUMA_ACCESS_CODE`, send a chat message, and check that:

```txt
Usage events increase
Training samples increase
Brain events show ok=true when Qwen is reachable
PostgreSQL tables receive rows
```
