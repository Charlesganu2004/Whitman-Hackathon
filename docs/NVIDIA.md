# NVIDIA free API catalog for Unscroll grading

NVIDIA hosts open and NVIDIA-built models at build.nvidia.com and serves them through an OpenAI-style API at `https://integrate.api.nvidia.com/v1`. A free NVIDIA Developer Program account gets a trial key. The server can use it as a third grading provider next to Groq and OpenAI. It is for development, testing and evaluation, not for serving real students.

## What it does and does not cover

- Grading, technical coaching and lesson coaching: yes, through `POST /v1/chat/completions` with the key in an `Authorization: Bearer` header.
- Voice transcription: no. `POST /v1/audio/transcriptions` returned 404 on the hosted host when checked on 2026-10-10. Set a Groq or OpenAI key if you want recorded answers transcribed. Without one, typed answers and iPhone keyboard dictation still work. `AI_SPEECH_PROVIDER=nvidia` is rejected at server start with a configuration error.
- When NVIDIA grades and `AI_SPEECH_PROVIDER` is unset, speech uses Groq if `GROQ_API_KEY` is set, otherwise OpenAI if `OPENAI_API_KEY` is set, otherwise it is off.
- When `AI_PROVIDER` is unset, the server picks Groq, then NVIDIA, then OpenAI, then the offline rubric.

## Create a key

A team member does this themselves, with an adult account holder (the trial terms require legal age of majority).

1. Open https://build.nvidia.com and pick a model page tagged Free Endpoint. Click Get API Key.
2. Enter an email and continue. Signing up joins the NVIDIA Developer Program. If you have no NVIDIA account you are asked to create one.
3. Complete account verification. The quickstart does not mention it, but user reports describe an SMS phone check that fails for some country codes, and NVIDIA staff have said fixes are not disclosed. Do this days before a demo. Support is help@build.nvidia.com.
4. Copy the key from the pop-up and put it in the ignored `.env` file straight away. It may not be shown in full again. Keys start with `nvapi-`.
5. Later, manage keys from the profile menu at build.nvidia.com, Settings, API keys.

Never put the key in an `EXPO_PUBLIC_` variable or commit it.

## Configure

Add these to `.env`, then restart the server:

```
AI_PROVIDER=nvidia
NVIDIA_API_KEY=nvapi-your-key
NVIDIA_MODEL=nvidia/nemotron-3-super-120b-a12b
```

`NVIDIA_MODEL` is optional and defaults to the value above. A lower-latency option from NVIDIA's catalog is `nvidia/nemotron-3.5-lightning-30b-a3b`; its grading quality is untested here. Model ids are retired quickly (a retired id answers HTTP 410), so change `NVIDIA_MODEL` if grading starts failing with "unavailable".

Check the setup:

```
npm run check:environment
npm run check:ai
```

`check:environment` prints which of the Groq, NVIDIA and OpenAI keys are set (true or false only), which provider will grade and which will transcribe, without sending a request. `check:ai` makes one live grading call with a fictional answer and prints provider, model, latency and whether the reply validated. With no key it says rubric mode is active and exits 0.

## Request shape

The server sends a chat completions request with a system and a user message, `response_format` of type `json_schema` with `strict: true`, `max_tokens` 2200 and `temperature` 0.2. For `nvidia/nemotron-*` models it also sends `chat_template_kwargs: { "enable_thinking": false }`, the switch documented on the Nemotron model cards for turning reasoning off. If NVIDIA answers 400 or 422, the server retries once with `response_format` of type `json_object` and the JSON schema appended to the system message. Replies are cleaned of `<think>` blocks and Markdown fences before parsing, and every field is still validated, so a malformed reply fails closed and the answer is not recorded.

## Limits and caveats

- Rate limit: NVIDIA publishes no number. It varies by model and load, and your current limit is shown in the account menu at the top right of build.nvidia.com. Forum posts report 40 requests per minute; that figure is community-reported and unverified as an official limit. A 429 reaches the app as "reached the provider rate limit"; wait and retry. An NVIDIA moderator post says there is no official way to get a higher free limit.
- Trial use only. The API Trial Terms (version dated 2025-09-19) allow evaluation and testing, say services can be withdrawn at any time, and let NVIDIA use submitted content to improve its products. They also bar sending personal information about identifiable people. Use fictional or de-identified data, and no real student names, emails or IDs.
- Not verified against a live key: nothing in this integration was run against the hosted API. Whether the hosted endpoint accepts `json_schema` (the retry path exists because of this), `chat_template_kwargs`, `max_tokens` and a `system` role for each model is based on model cards and NVIDIA's self-hosted NIM docs. Run `npm run check:ai` first and record what happens.
- Some users report `403 Authorization failed` on chat completions with a valid key and attribute it to a missing Public API Endpoints permission on the personal org. That diagnosis and its fix are unverified.

## Sources

- API quickstart: https://docs.api.nvidia.com/nim/docs/api-quickstart
- API catalog FAQ (key steps, rate-limit position, trial scope): https://forums.developer.nvidia.com/t/nvidia-nim-faq/300317
- LLM API reference: https://docs.api.nvidia.com/nim/reference/llm-apis
- Nemotron 3 Super model card (default model, thinking switch): https://build.nvidia.com/nvidia/nemotron-3-super-120b-a12b.md
- Nemotron 3.5 Lightning model card: https://build.nvidia.com/nvidia/nemotron-3.5-lightning-30b-a3b.md
- NVIDIA API Trial Terms of Service: https://assets.ngc.nvidia.com/products/api-catalog/legal/NVIDIA%20API%20Trial%20Terms%20of%20Service.pdf
- Key creation and `nvapi-` prefix: https://nvidia.github.io/NeMo-Retriever/extraction/api-keys/
- Account verification (staff post): https://forums.developer.nvidia.com/t/account-access-verification-update/360900
- Rate limit increases not granted (moderator post, 2026-04-29): https://forums.developer.nvidia.com/t/api-rate-limit-increase-is-not-granted-by-requesting-it-here/368420
- Keyless route checks on 2026-10-10: `GET /v1/models` 200, `POST /v1/chat/completions` 401, `POST /v1/audio/transcriptions` 404.
