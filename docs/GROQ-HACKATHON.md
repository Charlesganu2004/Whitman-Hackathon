# Groq setup for the hackathon

Use a **free Groq account** first. This integration is for the hackathon demo, not a production service. Do not upgrade billing without the team deciding on a budget. A teammate must create an account/key, keep it in ignored `.env`, and restart the server. No live key was supplied during the Windows build.

```dotenv
AI_PROVIDER=groq
AI_SPEECH_PROVIDER=groq
GROQ_API_KEY=your_server_key
GROQ_MODEL=openai/gpt-oss-20b
GROQ_TRANSCRIPTION_MODEL=whisper-large-v3-turbo
```

Start `npm run server`, then check `http://localhost:3001/health`. It should report `gradingProvider: "groq"`, `speechProvider: "groq"`, and `speechAvailable: true`. That indicates configuration, not validated credentials; complete a real answer and recording to test the key. Never place credentials in Git, screenshots, chat, or `EXPO_PUBLIC_` variables.

## Free tier and cost, checked October 9, 2026

The published free-plan limits for GPT OSS 20B are **30 requests/minute, 1,000 requests/day, 8,000 tokens/minute, and 200,000 tokens/day**. Whisper Turbo lists **20 requests/minute, 2,000 requests/day, 7,200 audio seconds/hour, and 28,800 audio seconds/day**. Limits are shared at the organization level; the actual account limits can differ. An initial small demo may fit the free tier, but tokens per minute can become the first bottleneck with several simultaneous students. Confirm the account's limits before presenting. [Groq rate limits](https://console.groq.com/docs/rate-limits)

If the team later chooses a paid plan, the published GPT OSS 20B model price is **$0.075 per million input tokens and $0.30 per million output tokens**. An illustrative feedback call with 2,000 input tokens and 800 output tokens costs about **$0.00039**, before any additional billed tokens or service conditions. Actual usage varies. [GPT OSS 20B pricing](https://console.groq.com/docs/model/openai/gpt-oss-20b)

Whisper Turbo's listed price is **$0.04 per audio hour**. A two-minute recording is approximately **$0.00133** at that rate. Two such answers plus two illustrative feedback calls total approximately **$0.00345**; technical coaching and extra retries add usage. This calculation is a planning example, not a spending guarantee. [Whisper Turbo pricing](https://console.groq.com/docs/model/whisper-large-v3-turbo)

## Demo safeguards and teammate checklist

- Keep the account on its free tier for the hackathon. Quota exhaustion returns a visible error; it does not give a passing grade, complete a lesson, or unlock apps.
- Recordings are limited to two minutes in the client. Server validation bounds payloads and requires authentication. Technical and lesson coaching have bounded turns and request throttles.
- Use fictional resume and answer data. AI mode sends answers, relevant resume context, and selected company goals to Groq; recordings go to transcription.
- Test microphone denial, a clear recording, an edited transcript, STAR feedback, technical hints, lesson coaching, rate limits, and a lost network connection on the iPhone.
- Record live results in [TESTING.md](TESTING.md). Existing AI tests use mocked provider responses; they do not prove a live key or physical microphone works.

GitHub Pro is a repository plan, and Copilot has separate plans. GitHub Models' inference API has retired, so a GitHub token is not used as this app's AI key. [GitHub Pro features](https://docs.github.com/en/get-started/learning-about-github/githubs-plans), [Copilot plans](https://docs.github.com/en/copilot/get-started/plans), [Models retirement](https://docs.github.com/en/github-models)
