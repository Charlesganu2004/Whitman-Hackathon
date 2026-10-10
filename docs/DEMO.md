# Unscroll demo guide

This guide is for teammates who run the demo from a Mac with an iPhone and Expo Go. Every command below is a script in `package.json`, and every file named here is in the repository.

## 1. What you need

- Node 24. Run `node --version`. It must start with `v24`. `npm run check:environment` prints `FAIL` for any other major version.
- Expo Go, installed from the App Store on the iPhone.
- The iPhone and the computer on the same Wi-Fi. Guest networks often keep devices apart, so use your own network.

## 2. First run

1. Get the latest code.

   ```bash
   git pull
   ```

2. Install the packages.

   ```bash
   npm install
   ```

3. Create the key file from the example.

   ```bash
   cp .env.example .env
   ```

   Open `.env` in a text editor. Paste the NVIDIA key after `NVIDIA_API_KEY=` and the Groq key after `GROQ_API_KEY=`. If you have both keys, also add the line `AI_PROVIDER=nvidia`. Section 3 explains the keys.

4. Check the AI connection with one live grading call.

   ```bash
   npm run check:ai
   ```

   A good result prints the provider, the model, a latency in milliseconds and `Reply validated: yes`. Without a key, the command says rubric mode is active and sends no request.

5. Start the API and Expo together.

   ```bash
   npm run demo
   ```

   The terminal prints whether AI feedback and voice transcription are on, and the address phones use, in the form `http://<address>:3001`. If it says no Wi-Fi address was found, connect the computer to the same Wi-Fi as the phone first. If `.env` does not exist, the command creates it from `.env.example`. Keep this command running while you use the app.

6. Scan the QR code in the terminal with the iPhone Camera app. The camera offers to open the project in Expo Go. The app finds the computer by itself.

## 3. Keys

The keys are not in the repository on purpose. `.env` is ignored by git, so each computer keeps its own copy. The computer that runs `npm run demo` needs the keys. The phone does not.

Get the team keys privately from Charles, or create free keys yourself:

- NVIDIA: open build.nvidia.com, pick a model page tagged Free Endpoint, and click Get API Key. NVIDIA keys start with `nvapi-`. User reports say the SMS phone check fails for some country codes, so create the key days before a demo. `docs/NVIDIA.md` has the full steps.
- Groq: create a key at console.groq.com. The Groq voice model `canopylabs/orpheus-v1-english` needs its terms accepted once in the Groq console before Jarvis can use a Groq voice.

Settings in `.env`:

- With both keys set, add `AI_PROVIDER=nvidia`. Without it, the server picks Groq for grading. With it, grading uses NVIDIA and voice uses Groq.
- Do not set `AI_SPEECH_PROVIDER=nvidia`. NVIDIA has no speech-to-text endpoint, and the server refuses to start with that setting.
- Restart `npm run demo` after you change `.env`. The server reads the file only when it starts.
- With no keys, the app still works. Grading uses rubric practice, and Jarvis speaks with the phone's own voice.
- Use fictional details in the demo. In AI mode, answers and resume text go to the provider you configured. The NVIDIA trial terms also bar sending personal information about identifiable people.

Never put a key in an `EXPO_PUBLIC_` variable or commit it.

## 4. On the phone

- You do not type an address in Expo Go. The app reads the computer's address from Expo and calls the API on port 3001.
- Do not run Expo through a tunnel. A tunnel forwards the app but not the API, so the phone cannot reach the server. `npm run demo` uses the local network.
- If the automatic address fails, use Server connection. It sits under the sign-in card, which holds the Log in or Create account form. Tap it, enter `http://<computer address>:3001`, and tap Test connection. The address is the one `npm run demo` printed.
- When the phone cannot reach the server, a red banner titled Cannot reach the Unscroll server appears at the top of the screen. It has its own Try again and Server connection buttons, and the app checks again by itself.

## 5. Five-minute demo script for judges

Use fictional details for the candidate. Before you start, check that `npm run demo` says AI feedback is on.

1. Create an account. On the first screen, tap Create account. Enter a name, an email and a password of at least 8 characters, then tap Create account. Onboarding has four steps. Pick a major. Set the study goals. On the focus step, leave Screen Time alone, because Expo Go cannot block apps. On the last step, upload a PDF or TXT resume, or paste at least 40 characters of resume text. Tap Save plan and start placement.
2. Start the placement interview. On the Today tab, tap Start placement with Jarvis. The Practice tab has the same interview as Placement interview. The placement has four questions, and Jarvis is the interviewer.
3. Ask Jarvis a clarifying question. Type at least three characters, then tap Ask Jarvis. A clarifying question costs no evaluation points. Each question allows six turns with Jarvis.
4. Take one hint. Tap the hint button, which reads Get a hint · costs 10 evaluation points. Each hint lowers that question's evaluation score by 10 points. A question allows three hints, after which the button reads No hints left. The grade itself does not change.
5. Answer by voice or by typing. To type, enter the answer and tap Submit answer. To speak, tap Record your answer, then tap Stop and transcribe. Recording stops by itself after two minutes. Voice needs a speech key on the server. Without one, the panel shows a note and typing still works. The iPhone keyboard's dictation also works.
6. Read the feedback and the STAR lines. The feedback shows the coach's comments. Behavioral answers also get a STAR check on situation, task, action and result, with a line that names the weakest part. Tap Hear coach feedback to hear it read aloud.
7. See the skill standings. Three standings appear: Communication, Technical discussion and Coding. They are on the Practice tab and on the Roadmap tab.
8. Drag the road map. Open the Roadmap tab, then swipe the road map sideways.
9. Play the launch film. It is `docs/media/unscroll-ad.mp4` in the repository. The README shows its poster at the top. The film is not inside the app, so open the file on the computer.

## 6. Desktop preview

With `npm run demo` or `npm run web` running, open `http://localhost:8081/iphone.html` in a desktop browser. The page shows the app inside an iPhone frame. The frame loads the app from the Expo server on port 8081. In the browser, the app reaches the API on the same computer, so you do not need Server connection.

If you run the API and Expo in separate terminals, use `npm run server` for the API and `npm run web` for Expo.

## 7. Troubleshooting

| Symptom | Cause | Fix |
| --- | --- | --- |
| Red banner "Cannot reach the Unscroll server" | `npm run demo` is not running, the phone is on a different Wi-Fi, or a guest network keeps devices apart | Keep `npm run demo` running. Put the phone and the computer on the same network. Tap Try again. |
| Sign in still fails | The address saved earlier is out of date | Tap Server connection, enter `http://<computer address>:3001`, and tap Test connection. |
| macOS asks whether node may accept incoming connections | The macOS firewall blocks the API | Click Allow. If you dismissed the prompt, open System Settings, Network, Firewall, Options, and allow node. |
| Expo Go cannot reach the computer on the same Wi-Fi | iOS has not allowed Expo Go on the local network | Open Settings, then Expo Go, and turn on Local Network. |
| `npm run demo` prints "API server stopped" | Another program uses port 3001 | Run `lsof -nP -iTCP:3001 -sTCP:LISTEN` and quit the program it lists. Do not only change `PORT`, because the app dials port 3001 unless you enter another address under Server connection. |
| `npm run demo` prints "AI feedback: off" | No usable key in `.env` on the computer running the server, or `AI_PROVIDER` names a provider whose key is missing. The server then uses rubric practice without an error. | Add the key to `.env` on this computer. Check the `AI_PROVIDER` line. Restart `npm run demo`. |
| `npm run check:ai` says rubric mode is active | No key is set in `.env` | Add a key to `.env`. Rubric mode sends no request. |
| Jarvis speaks with the phone's voice | No `GROQ_API_KEY`, the Groq terms for `canopylabs/orpheus-v1-english` are not accepted, or a Groq voice request failed, for example after a daily quota is used up | Add the key and accept the terms in the Groq console. Jarvis falls back to the phone's voice on any error. |
| Voice panel says "Voice transcription needs an AI key on the server" | No Groq or OpenAI key on the server. NVIDIA cannot transcribe. | Add `GROQ_API_KEY` to `.env`, or type the answer, or use the iPhone keyboard's dictation. |
| "... reached the provider rate limit. Your answer was not recorded; wait and retry." | The free tier is busy. NVIDIA publishes no fixed limit. | Wait, then submit again. |
| "... is unavailable. Your answer was not recorded; ask the host to check its provider configuration." | The provider refused the request, for example a retired NVIDIA model (HTTP 410) or a rejected key. A "403 Authorization failed" report from NVIDIA is unverified. | Run `npm run check:ai`. If the model was retired, set `NVIDIA_MODEL` to a current model id, as `docs/NVIDIA.md` describes, and restart `npm run demo`. |
| `npm run check:environment` prints FAIL for Node | Node is not version 24 | Install Node 24, open a new terminal, and run `node --version`. |
| Expo Go asks for a different SDK | The Expo Go app on the phone is older than the project | Update Expo Go from the App Store. |

## 8. What does not work in Expo Go

- Expo Go cannot block or unlock other apps. The Focus screen labels this mode as practice-only. Practice still records progress and the earned access window, without claiming that any app was blocked.
- Shielding other apps needs the signed native iPhone development build in `docs/IPHONE.md`. That build needs an Apple Developer team, valid signing and Screen Time capabilities. It has not been tested on a device.
- `docs/TESTING.md` still lists the Mac and iPhone Expo Go run as pending a physical-device run. Treat your first run as a test, and note any step that does not match this guide.
