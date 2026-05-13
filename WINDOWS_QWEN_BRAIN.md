# Windows Qwen Brain Endpoint

This is the future Luma Brain host.

The Windows machine can run Qwen with an RTX GPU and expose an OpenAI-compatible API endpoint to the cloud Luma app.

## Role

```txt
Qwen = Luma Brain for training and memory formation
DeepSeek = default answering expert
```

Qwen should participate in every turn once connected, but it does not directly answer the user. It produces:

- normalized input
- router decision
- memory packet
- learning notes
- quality score

## Expected Endpoint

Luma expects an OpenAI-compatible endpoint:

```txt
POST <LUMA_BRAIN_ENDPOINT>/v1/chat/completions
```

Environment variables on the cloud server:

```txt
LUMA_BRAIN_PROVIDER=qwen
LUMA_BRAIN_ENDPOINT=https://your-qwen-endpoint.example.com
LUMA_BRAIN_API_KEY=<optional token>
LUMA_BRAIN_MODEL=qwen3.5:2b
LUMA_BRAIN_MODE=training
```

## Suggested Windows Stack

Start simple:

```txt
Ollama or another OpenAI-compatible Qwen server
Qwen3.5-2B or similar 2B model
Cloudflare Tunnel for HTTPS exposure
```

The cloud server should not need direct access to your private network. Use a tunnel or another protected HTTPS endpoint.
