# Deploy Luma on a Small Linux Cloud Server

This path is for the lightweight cloud app:

- Luma Web UI
- Luma Node.js API
- lightweight file storage during the learning phase
- DeepSeek as the default answering expert
- Windows Qwen as Luma Brain through an endpoint

Do not run Qwen on a 2 vCPU / 2 GiB server.

## Recommended OS

Use:

```txt
Ubuntu 22.04 LTS 64-bit
```

Ubuntu 24.04 LTS is also fine.

## Server Setup

Install Node.js LTS:

```sh
curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
sudo apt-get install -y nodejs git
```

Clone Luma:

```sh
git clone https://github.com/Philippe979/Luma.git
cd Luma
npm install
```

Create environment file:

```sh
cp .env.example .env
```

Set at least:

```txt
PORT=4387
LUMA_ACCESS_CODE=<private access code>
DEEPSEEK_API_KEY=<deepseek key>
DEEPSEEK_MODEL=deepseek-v4-flash
DEEPSEEK_THINKING=disabled
LUMA_BRAIN_PROVIDER=qwen
LUMA_BRAIN_ENDPOINT=<windows qwen endpoint, later>
LUMA_BRAIN_MODEL=qwen3.5:2b
LUMA_BRAIN_MODE=training
```

Start:

```sh
npm start
```

For long-running deployment, use PM2:

```sh
sudo npm install -g pm2
pm2 start server.js --name luma
pm2 save
pm2 startup
```

## Brain Routing Lock

The cloud app uses this rule:

```txt
DeepSeek = default answering expert
Qwen Brain = training + memory packet formation
```

Qwen does not directly answer users in this phase. It receives the user input, DeepSeek output, context, and recent memory, then returns structured training data.
