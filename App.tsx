import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AppState, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import { LESSONS } from './src/core/content';
import type { Feedback, Lesson, Profile, Snapshot } from './src/core/types';
import { configureApi, getApiUrl, initializeApi, request } from './src/services/api';
import { clearAccount, readAvatar, writeAvatar, readSnapshot, readToken, writeSnapshot, writeToken } from './src/services/cache';
import { authorizeFocus, chooseFocusApps, emergencyRelease, focusStatus, lockFocus, unlockFocus } from './src/services/focus';
import { Body, Button, Card, Chips, Field, Label, Message, Meter, Title } from './src/ui/components';
import { VoiceAnswer } from './src/ui/VoiceAnswer';
import { ThemeProvider, useTheme } from './src/ui/theme';
import { Dashboard } from './src/ui/Dashboard';
import { Progress } from './src/ui/Progress';
import { Lessons } from './src/ui/Lessons';
import { Navigation } from './src/ui/Navigation';
import { BrandIntro, Welcome } from './src/ui/BrandIntro';
import { FocusApps } from './src/ui/FocusApps';
import { TechnicalCoach } from './src/ui/TechnicalCoach';
import { AnswerFeedback } from './src/ui/AnswerFeedback';
import { PracticeHub } from './src/ui/PracticeHub';
import { Reveal, AmbientMotion } from './src/ui/motion';
import { Avatar } from './src/ui/Avatar';

type Tab = 'today' | 'practice' | 'learn' | 'progress' | 'settings';
const levelOrder = ['beginner', 'intermediate', 'advanced', 'expert', 'master'];
const capitalize = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

export default function App() { return <SafeAreaProvider><ThemeProvider><Application /></ThemeProvider></SafeAreaProvider>; }
function Application() {
  const { colors, mode, setMode, isDark, accent, setAccent, persistenceError } = useTheme();
  const s = useMemo(() => appStyles(colors), [colors]);
  const [introDone, setIntroDone] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [reviewPlan, setReviewPlan] = useState(false);
  const [sessionsPerDay, setSessionsPerDay] = useState(1);
  useEffect(() => { const timer = setTimeout(() => setIntroDone(true), 1800); return () => clearTimeout(timer); }, []);
  const [ready, setReady] = useState(false);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [offline, setOffline] = useState(false);
  const [tab, setTab] = useState<Tab>('today');
  const [signup, setSignup] = useState(true);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [serverUrl, setServerUrl] = useState('');
  const [showServer, setShowServer] = useState(false);
  const [step, setStep] = useState(0);
  const [major, setMajor] = useState('Computer Science');
  const [companies, setCompanies] = useState('');
  const [avatar, setAvatar] = useState('');
  const [target, setTarget] = useState<Profile['target']>('internship');
  const [minutes, setMinutes] = useState(20);
  const [days, setDays] = useState(5);
  const [unlockMinutes, setUnlockMinutes] = useState(30);
  const [focusApps, setFocusApps] = useState(['Instagram', 'TikTok']);
  const [resumeText, setResumeText] = useState('');
  const [answer, setAnswer] = useState('');
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [practice, setPractice] = useState(false);
  const [selectedLesson, setSelectedLesson] = useState<Lesson | null>(null);
  const [lessonChoice, setLessonChoice] = useState(-1);
  const [lessonStartedAt, setLessonStartedAt] = useState(0);
  const [speechAvailable, setSpeechAvailable] = useState(false);
  const [gradingMode, setGradingMode] = useState('rubric');
  const [focus, setFocus] = useState({ supported: false, authorized: false, selectedCount: 0, blocking: false, emergencyReleased: false, reason: 'Checking focus support…' });
  const [now, setNow] = useState(Date.now());
  const scroll = useRef<ScrollView>(null);
  const profile = snapshot?.profile;
  const session = snapshot?.activeSession;
  const question = session?.questions[session.index];
  const needsOnboarding = !!profile && (!profile.major || reviewPlan);
  const needsPlacement = !!profile && !profile.placementComplete;
  const remaining = snapshot?.stats.unlockedUntil ? Math.max(0, Math.ceil((Date.parse(snapshot.stats.unlockedUntil) - now) / 60000)) : 0;

  useEffect(() => { let active = true; setAvatar(''); if (profile?.id) readAvatar(profile.id).then(image => { if (active) setAvatar(image || ''); }).catch(() => { if (active) setError('Profile photo could not be loaded.'); }); return () => { active = false; }; }, [profile?.id]);

  async function accept(data: Snapshot) {
    setSnapshot(data);
    await writeSnapshot(data);
    try {
      const current = await focusStatus();
      if (current.supported && current.authorized && current.selectedCount > 0) {
        if (data.activeSession?.kind === 'daily' && ['active', 'review'].includes(data.activeSession.status)) {
          if (!current.blocking && !current.emergencyReleased) await lockFocus();
        } else if (data.stats.unlockedUntil && Date.parse(data.stats.unlockedUntil) > Date.now() && current.blocking) {
          await unlockFocus(data.stats.unlockedUntil);
        }
      }
      await refreshFocus();
    } catch (e) { setError(`Progress saved, but focus could not synchronize: ${e instanceof Error ? e.message : 'unknown error'}. Release focus in Settings if needed.`); }
  }
  async function refreshFocus() { setFocus(await focusStatus()); }
  function populate(p: Profile) {
    setMajor(p.major || 'Computer Science'); setCompanies((p.targetCompanies || []).join(', ')); setTarget(p.target); setMinutes(p.minutes);
    setDays(p.daysPerWeek); setSessionsPerDay(p.sessionsPerDay || 1); setUnlockMinutes(p.unlockMinutes); setFocusApps(p.focusApps);
  }
  async function health() {
    try { const data = await request<Record<string, unknown>>('/health'); setSpeechAvailable(Boolean(data.speechAvailable || data.speech || data.aiEnabled)); setGradingMode(String(data.gradingMode || data.mode || 'rubric')); } catch { /* Connection errors are surfaced by the requested action. */ }
  }
  useEffect(() => {
    void (async () => {
      try {
        setServerUrl(await initializeApi());
        if (await readToken()) {
          const cached = await readSnapshot();
          if (cached) { setSnapshot(cached); populate(cached.profile); }
          try { const data = await request<Snapshot>('/me'); await accept(data); populate(data.profile); }
          catch (e) { if (cached) { setOffline(true); setError('Offline view. Reconnect before starting or submitting practice.'); } else { await clearAccount(); setError(e instanceof Error ? e.message : 'Sign in again.'); } }
        }
        await refreshFocus(); await health();
      } catch (e) { setError(e instanceof Error ? e.message : 'Could not initialize app.'); }
      finally { setReady(true); }
    })();
  }, []);
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), selectedLesson ? 1000 : 15000); return () => clearInterval(timer); }, [selectedLesson?.id]);
  useEffect(() => {
    const listener = AppState.addEventListener('change', state => { if (state === 'active') { setNow(Date.now()); void (async () => { try { if (await readToken()) { await accept(await request<Snapshot>('/me')); setOffline(false); } else await refreshFocus(); } catch { setOffline(true); } })(); } });
    return () => listener.remove();
  }, []);
  useEffect(() => { scroll.current?.scrollTo({ y: 0, animated: false }); }, [tab, step, practice, selectedLesson?.id, question?.id, feedback]);

  async function act(work: () => Promise<void>) {
    if (busy) return;
    setBusy(true); setError(''); setNotice('');
    try { await work(); } catch (e) { setError(e instanceof Error ? e.message : 'Something went wrong. Please try again.'); }
    finally { setBusy(false); }
  }
  async function authenticate() {
    await configureApi(serverUrl || getApiUrl());
    const data = await request<{ token: string; snapshot: Snapshot }>(signup ? '/auth/signup' : '/auth/login', { name, email, password, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone });
    await writeToken(data.token); await accept(data.snapshot); populate(data.snapshot.profile);
    setPassword(''); setOffline(false); setStep(0); setReviewPlan(true); await health();
  }
  const saveProfile = async () => accept(await request<Snapshot>('/profile', { major, target, targetCompanies: companies.split(',').map(value => value.trim()).filter(Boolean), minutes, daysPerWeek: days, sessionsPerDay, unlockMinutes, focusApps, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone }, 'PUT'));
  async function uploadResume() {
    const picked = await DocumentPicker.getDocumentAsync({ type: ['application/pdf', 'text/plain'], copyToCacheDirectory: true });
    if (picked.canceled) return;
    const asset = picked.assets[0];
    if (asset.size && asset.size > 4 * 1024 * 1024) throw new Error('Resume must be under 4 MB.');
    let base64: string;
    if (Platform.OS === 'web' && asset.file) {
      base64 = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result).split(',')[1]); reader.onerror = reject; reader.readAsDataURL(asset.file!); });
    } else { base64 = await new File(asset.uri).base64(); }
    await accept(await request<Snapshot>('/resume', { name: asset.name, base64, mimeType: asset.mimeType || 'text/plain' }));
    setNotice('Resume saved. Your interview can use your experience.');
  }
  async function uploadAvatar() {
    const picked = await DocumentPicker.getDocumentAsync({ type: ['image/jpeg', 'image/png', 'image/webp'], copyToCacheDirectory: true });
    if (picked.canceled) return;
    const asset = picked.assets[0];
    if (asset.size && asset.size > 2 * 1024 * 1024) throw new Error('Choose a profile photo under 2 MB.');
    const mime = asset.mimeType || (/\.png$/i.test(asset.name) ? 'image/png' : /\.webp$/i.test(asset.name) ? 'image/webp' : 'image/jpeg');
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(mime)) throw new Error('Use a JPG, PNG, or WebP photo.');
    let base64: string;
    if (Platform.OS === 'web' && asset.file) base64 = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result).split(',')[1]); reader.onerror = reject; reader.readAsDataURL(asset.file!); });
    else base64 = await new File(asset.uri).base64();
    if (base64.length > 2800000) throw new Error('Choose a profile photo under 2 MB.');
    const image = 'data:' + mime + ';base64,' + base64;
    await writeAvatar(profile!.id, image); setAvatar(image); setNotice('Profile photo saved on this device.');
  }
  async function startSession(kind: 'placement' | 'daily' | 'checkpoint') {
    const data = await request<Snapshot>('/sessions', { kind });
    await accept(data); setPractice(true); setAnswer(''); setFeedback(null);
    if (kind === 'daily' && focus.supported && focus.authorized && focus.selectedCount > 0) { await lockFocus(); await refreshFocus(); }
  }
  async function openLesson(lesson: Lesson) {
    await accept(await request<Snapshot>(`/lessons/${lesson.id}/start`, {}));
    setSelectedLesson(lesson); setLessonChoice(-1); setLessonStartedAt(Date.now());
  }
  async function submitAnswer() {
    if (!session || !question) return;
    const data = await request<{ feedback: Feedback; snapshot: Snapshot }>(`/sessions/${session.id}/answer`, { questionId: question.id, answer });
    await accept(data.snapshot); setFeedback(data.feedback); setAnswer('');
    if (data.snapshot.stats.unlockedUntil && data.snapshot.activeSession?.status === 'completed' && data.snapshot.activeSession.kind === 'daily' && focus.supported && focus.authorized && focus.selectedCount > 0) {
      try { await unlockFocus(data.snapshot.stats.unlockedUntil); await refreshFocus(); }
      catch (e) { setError(`Quiz passed, but iPhone unlock failed: ${e instanceof Error ? e.message : 'unknown error'}. Use Release focus in Settings.`); }
    }
  }
  async function nextQuestion() {
    if (session?.status === 'review' && question) await accept(await request<Snapshot>(`/sessions/${session.id}/review`, { questionId: question.id }));
    setFeedback(null); setAnswer('');
  }
  async function logout() {
    if (focus.supported) { try { await emergencyRelease(); } catch (e) { setError('Logged out, but focus release failed. Use Screen Time settings to release selected apps.'); } }
    let revoked = true;
    try { await request('/auth/logout', {}, undefined, 5000); } catch { revoked = false; }
    await clearAccount(); setSnapshot(null); setPractice(false); setSelectedLesson(null);
    setFeedback(null); setOffline(false); setReviewPlan(false); setAuthOpen(false); setTab('today');
    if (!revoked) setNotice('Logged out on this device. The server session could not be revoked while disconnected.');
  }
  
  const preferences = <View style={s.stack}>
    <Label>Practice days per week</Label><Chips options={[1, 2, 3, 4, 5, 6, 7].map(value => ({ label: `${value} day${value === 1 ? '' : 's'}`, value }))} value={days} onChange={setDays} />
    <Label>Practice sessions per day</Label><Chips options={[1, 2, 3, 4].map(value => ({ label: String(value), value }))} value={sessionsPerDay} onChange={setSessionsPerDay} /><Body muted>This is a goal, not a limit. Each completed daily interview counts.</Body><Label>Time for each session</Label><Chips options={[10, 15, 20, 30].map(value => ({ label: `${value} min`, value }))} value={minutes} onChange={setMinutes} />
    <Body muted>Your target adjusts technical question count and difficulty. Passing is based on answers, not a timer.</Body>
    <Label>Earned app access</Label><Chips options={[15, 30, 60].map(value => ({ label: `${value} min`, value }))} value={unlockMinutes} onChange={setUnlockMinutes} />
  </View>;

  function renderContent() {
    if (!snapshot) {
    if (!authOpen) return <Welcome onSignup={() => { setSignup(true); setAuthOpen(true); }} onLogin={() => { setSignup(false); setAuthOpen(true); }} />;
    return <View style={s.stack}>
      <Button title="Back" secondary onPress={() => { setAuthOpen(false); setError(''); }} />
      <Label>{signup ? 'Your next chapter starts here' : 'Pick up your progress'}</Label>
      <Title>{signup ? 'Make room for\nwhat’s next.' : 'Welcome back.'}</Title>
      <Card><Title small>{signup ? 'Create your account' : 'Log in to Unscroll'}</Title>
        {signup && <Field label="Your name" value={name} onChangeText={setName} autoComplete="name" />}
        <Field label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" />
        <Field label="Password" value={password} onChangeText={setPassword} secureTextEntry autoComplete={signup ? 'new-password' : 'current-password'} placeholder="At least 8 characters" />
        <Button title={signup ? 'Create account' : 'Log in'} busy={busy} disabled={!email.trim() || password.length < 8 || (signup && !name.trim())} onPress={() => { void act(authenticate); }} />
        <Button title={signup ? 'Already have an account? Log in' : 'New here? Create account'} secondary onPress={() => { setSignup(!signup); setError(''); }} />
      </Card>
      <Button title={showServer ? 'Hide server connection' : 'Server connection'} secondary onPress={() => setShowServer(!showServer)} />
      {showServer && <Card><Field label="Server URL" value={serverUrl} onChangeText={setServerUrl} autoCapitalize="none" placeholder="http://192.168.1.100:3001" /><Body muted>On your phone, use the computer’s Wi-Fi IP address. Account data and resume text are stored in server SQLite. AI mode sends answers and relevant resume context to your configured provider.</Body><Button title="Test connection" secondary busy={busy} onPress={() => { void act(async () => { await configureApi(serverUrl); await request('/health'); setNotice('Server connected.'); }); }} /></Card>}
    </View>;
  }

    if (practice) {
      if (feedback) return <View style={s.stack}><AnswerFeedback feedback={feedback} /><Button title={session?.status === 'completed' ? 'See your results' : session?.status === 'review' ? 'I understand · try a different question' : 'Next question'} busy={busy} onPress={() => { void act(nextQuestion); }} />{session?.status === 'review' && <Body muted>Review what was missing. A different question checks that you learned it.</Body>}</View>;
      if (session?.status === 'completed') return <View style={s.stack}><Card green><Label>{session.kind === 'placement' ? 'Placement complete' : session.kind === 'checkpoint' ? 'Knowledge checkpoint complete' : 'Practice complete'}</Label><Title>{session.kind === 'placement' ? `Your starting level:\n${capitalize(profile!.level)}` : session.kind === 'checkpoint' ? `Your checkpoint score:\n${Math.round(session.attempts.reduce((sum, attempt) => sum + attempt.feedback.score, 0) / Math.max(1, session.attempts.length))}%` : 'Prepared looks\ngood on you.'}</Title><Body>{session.kind === 'placement' ? 'Your answers set your starting point. Lessons and practice help you move toward master.' : session.kind === 'checkpoint' ? 'Your current level stays the same. Use the feedback and roadmap to choose your next lesson. Checkpoints do not unlock apps.' : `You earned ${profile!.unlockMinutes} minutes of app access.`}</Body>{session.kind === 'daily' && <Body muted>{focus.supported && focus.authorized ? 'Selected iPhone apps have an unlock request. Check focus status below.' : 'Practice mode: Expo Go cannot block or unlock other apps.'}</Body>}</Card><Button title="Back to your dashboard" onPress={() => { setPractice(false); setTab('today'); }} /></View>;
      if (!session || !question) return <Card><Body>No active interview.</Body><Button title="Back to dashboard" onPress={() => setPractice(false)} /></Card>;
      return <View style={s.stack}><View style={s.row}><Label>{session.kind === 'placement' ? 'Find your starting point' : session.kind === 'checkpoint' ? 'Test your knowledge' : 'Today’s interview'}</Label><Text style={s.pill}>{session.index + 1}/{session.questions.length}</Text></View><Meter value={100 * session.index / session.questions.length} /><Label>{question.kind === 'behavioral' ? 'Speak with your interviewer' : 'Technical practice'} · {question.topic}</Label><Reveal key={question.id}><Title small>{question.title}</Title></Reveal><Card><Body>{question.prompt}</Body>{question.starter && <Text selectable style={s.code}>{question.starter}</Text>}</Card>{question.kind === 'technical' && <TechnicalCoach key={question.id} sessionId={session.id} questionId={question.id} offline={offline} onError={setError} />}{question.kind === 'behavioral' && <VoiceAnswer key={question.id} prompt={question.prompt} enabled={speechAvailable} onTranscript={setAnswer} onError={setError} />}<Field label={question.kind === 'behavioral' ? 'Your answer or voice transcript' : 'Your solution and reasoning'} multiline value={answer} onChangeText={setAnswer} autoCorrect={question.kind === 'behavioral'} autoCapitalize="sentences" placeholder={question.kind === 'behavioral' ? 'Describe the situation, your action, and the result…' : 'Write your approach, code if relevant, and explain the tradeoffs…'} style={question.kind === 'technical' ? s.codeInput : undefined} /><Body muted>{question.kind === 'technical' ? 'Answers receive technical rubric or AI review. Code is not executed.' : 'You can edit your transcript before submitting.'}</Body><Button title="Submit answer" busy={busy} disabled={offline || answer.trim().length < 10} onPress={() => { void act(submitAnswer); }} /><Button title="Save and leave interview" secondary onPress={() => setPractice(false)} /></View>;
    }
    if (needsOnboarding) return <View style={s.stack}>
    <Label>{profile!.placementComplete ? 'Review your plan' : 'Make your plan'} · {step + 1} of 4</Label>{session && ['active', 'review'].includes(session.status) && <Card green><Body>Your saved interview is ready. Finish it before changing your plan.</Body><Button title="Resume saved interview" onPress={() => { setReviewPlan(false); setPractice(true); setFeedback(session.status === 'review' ? session.review || null : null); }} /></Card>}<Meter value={(step + 1) / 4 * 100} />
    {step === 0 ? <><Title>Make it yours.</Title><Body muted>{profile!.placementComplete ? 'Your progress is saved. Review your goal, then continue where you left off.' : 'We’ll tailor interviews to your field and next opportunity.'}</Body><Field label="Your major" value={major} onChangeText={setMajor} /><Chips options={['Computer Science', 'Software Engineering', 'Data Science', 'Cybersecurity', 'Electrical Engineering', 'Mechanical Engineering', 'Civil Engineering', 'Business', 'Finance', 'Accounting', 'Marketing', 'Economics', 'Psychology', 'Communications', 'Education', 'Political Science', 'Biology', 'Chemistry', 'Nursing', 'Public Health'].map(value => ({ label: value, value }))} value={major} onChange={setMajor} /><Field label="Target companies" value={companies} onChangeText={setCompanies} placeholder="Google, Microsoft, a local startup…" /><Body muted>Up to five names, separated by commas. Coaching uses your goals as context, without claiming to predict their interview questions.</Body><Label>What are you preparing for?</Label><Chips options={[{ label: 'Internship', value: 'internship' }, { label: 'Full-time role', value: 'full-time' }]} value={target} onChange={setTarget} /></>
      : step === 1 ? <><Title>{'A rhythm you\ncan keep.'}</Title><Body muted>Choose your daily and weekly study goals.</Body>{preferences}</>
      : step === 2 ? <><Title>{'Make room\nto focus.'}</Title><FocusApps selected={focusApps} onChange={setFocusApps} />{focus.supported && <Card><Body>{focus.reason}</Body><Button title={focus.authorized ? 'Screen Time connected' : 'Connect Screen Time'} secondary busy={busy} disabled={focus.authorized} onPress={() => { void act(async () => { await authorizeFocus(); await refreshFocus(); }); }} /><Button title="Choose apps on this iPhone" secondary busy={busy} disabled={!focus.authorized} onPress={() => { void act(async () => { await chooseFocusApps(); await refreshFocus(); }); }} /><Body muted>{focus.selectedCount} apps selected on this device.</Body></Card>}</>
      : <><Title>{'Your experience\nis your story.'}</Title><Body muted>Add a PDF or text resume to personalize your interview. You can also paste resume text.</Body><Button title="Upload resume · PDF or TXT" secondary busy={busy} onPress={() => { void act(uploadResume); }} />{profile!.resumeName && <Card green><Body>✓ {profile!.resumeName}</Body></Card>}<Field label="Or paste resume text" multiline value={resumeText} onChangeText={setResumeText} placeholder="Education, projects, work experience and skills…" /><Body muted>{profile!.placementComplete ? 'Your placement and completed lessons will be kept.' : 'Next: two behavioral and two technical questions to find your starting level.'}</Body></>}
    <Button title={step === 3 ? profile!.placementComplete ? 'Save plan and resume progress' : 'Save plan and start placement' : 'Continue'} busy={busy} disabled={!major.trim() || offline || (step === 3 && !profile!.resumeName && resumeText.trim().length < 40) || (step === 3 && resumeText.trim().length > 0 && resumeText.trim().length < 40)} onPress={() => { void act(async () => { if (step < 3) setStep(step + 1); else { if (session && ['active', 'review'].includes(session.status)) { setReviewPlan(false); setPractice(true); setFeedback(session.status === 'review' ? session.review || null : null); return; } if (resumeText.trim()) await accept(await request<Snapshot>('/resume', { name: 'Pasted resume', text: resumeText })); await saveProfile(); setReviewPlan(false); setResumeText(''); if (!profile!.placementComplete) await startSession('placement'); else setTab('progress'); } }); }} />
    {step > 0 && <Button title="Back" secondary onPress={() => setStep(step - 1)} />}
  </View>;

    if (selectedLesson) return <View style={s.stack}><Button title="Back to lessons" secondary onPress={() => { setSelectedLesson(null); setFeedback(null); }} /><Label>{selectedLesson.topic} · {selectedLesson.minutes} min</Label><Title>{selectedLesson.title}</Title><Body muted>{selectedLesson.summary}</Body>{selectedLesson.sections.map(section => <Card key={section.title}><Title small>{section.title}</Title><Body>{section.body}</Body></Card>)}<TechnicalCoach key={selectedLesson.id} lessonId={selectedLesson.id} offline={offline} onError={setError} /><Card><Label>Check your understanding</Label><Body>{selectedLesson.check.prompt}</Body>{selectedLesson.check.choices.map((choice, i) => <Pressable accessibilityRole="radio" accessibilityState={{ checked: lessonChoice === i }} aria-checked={lessonChoice === i} key={choice} onPress={() => setLessonChoice(i)} style={[s.choice, lessonChoice === i && { borderColor: colors.accent, backgroundColor: colors.pale }]}><Body>{choice}</Body></Pressable>)}<Body muted>{profile!.completedLessonIds.includes(selectedLesson.id) ? 'Completed. You can review the lesson anytime.' : now - lessonStartedAt < 15000 ? 'Read the lesson before checking your answer. Ready in ' + Math.max(1, Math.ceil((15000 - (now - lessonStartedAt)) / 1000)) + ' seconds.' : 'Choose the answer that best applies the lesson.'}</Body><Button title="Check answer and finish lesson" busy={busy} disabled={lessonChoice < 0 || offline || (!profile!.completedLessonIds.includes(selectedLesson.id) && now - lessonStartedAt < 15000)} onPress={() => { void act(async () => { const data = await request<{ feedback: Feedback; snapshot: Snapshot }>(`/lessons/${selectedLesson.id}/complete`, { answer: lessonChoice }); await accept(data.snapshot); setNotice(data.feedback.passed ? 'Lesson complete. Your learning progress is saved.' : data.feedback.explanation); if (!data.feedback.passed) setError(data.feedback.explanation); }); }} /></Card></View>;

    if (tab === 'today') return <Dashboard snapshot={snapshot} focus={focus} remaining={remaining} busy={busy} offline={offline} recommended={LESSONS.find(lesson => levelOrder.indexOf(lesson.level) <= levelOrder.indexOf(profile!.level) && !profile!.completedLessonIds.includes(lesson.id))} onManage={() => setTab('settings')} onLearn={() => setTab('learn')} onStart={() => { void act(async () => { if (session?.status === 'active' || session?.status === 'review') { setPractice(true); setFeedback(session.status === 'review' ? session.review || null : null); } else await startSession(needsPlacement ? 'placement' : 'daily'); }); }} />;

    if (tab === 'practice') return <PracticeHub onCheckpoint={() => { void act(() => startSession('checkpoint')); }} snapshot={snapshot} busy={busy} offline={offline} ai={gradingMode === 'ai'} onLearn={() => setTab('learn')} onStart={() => { void act(async () => { if (session?.status === 'active' || session?.status === 'review') { setPractice(true); setFeedback(session.status === 'review' ? session.review || null : null); } else await startSession(needsPlacement ? 'placement' : 'daily'); }); }} />;
    if (tab === 'learn') return <Lessons profile={profile!} lessons={LESSONS} busy={busy} onOpen={lesson => { void act(() => openLesson(lesson)); }} />;

    if (tab === 'progress') return <Progress snapshot={snapshot} />;

    return <View style={s.stack}><Label>Your profile</Label><View style={s.row}><Avatar name={profile!.name} image={avatar} large /><View style={{flex: 1, gap: 8}}><Title small>{profile!.name}</Title><Body muted>{capitalize(profile!.level)} · {profile!.major}</Body><Body muted>{profile!.target === 'internship' ? 'Internship goal' : 'Full-time goal'}</Body></View></View><Button title="Choose profile photo" secondary busy={busy} onPress={() => { void act(uploadAvatar); }} /><Card green><Label>Your next opportunity</Label><Body>{profile!.targetCompanies?.length ? profile!.targetCompanies.join(' · ') : 'Add target companies in your study preferences.'}</Body><Button title="View your roadmap" secondary onPress={() => setTab('progress')} /></Card><Title small>Settings</Title><Card><Title small>Appearance</Title><Chips options={[{ label: 'Light', value: 'light' }, { label: 'Dark', value: 'dark' }, { label: 'System', value: 'system' }]} value={mode} onChange={setMode} /><Body muted>System follows your phone’s appearance. Your choice is saved on this device.</Body><Label>Accent color</Label><Chips options={[{ label: 'Pink', value: 'pink' }, { label: 'Red', value: 'red' }, { label: 'Blue', value: 'blue' }, { label: 'Green', value: 'green' }]} value={accent} onChange={setAccent} />{persistenceError && <Message text={persistenceError} />}</Card><Card><Title small>Focus apps</Title><Body>{focus.reason}</Body>{!focus.supported ? <Body muted>To test actual app blocking, use the native iPhone development build described in docs/IPHONE.md.</Body> : <><Button title={focus.authorized ? 'Screen Time connected' : 'Connect Screen Time'} secondary disabled={focus.authorized} busy={busy} onPress={() => { void act(async () => { await authorizeFocus(); await accept(await request<Snapshot>('/me')); }); }} /><Button title="Choose apps on this iPhone" secondary disabled={!focus.authorized} busy={busy} onPress={() => { void act(async () => { await chooseFocusApps(); await refreshFocus(); }); }} /><Body muted>{focus.selectedCount} apps selected. Start a daily interview to pause them.</Body><Button title="Release focus · emergency exit" secondary busy={busy} onPress={() => { void act(async () => { await emergencyRelease(); await refreshFocus(); setNotice('Focus released until you explicitly resume blocking or start a new interview. Your progress is saved.'); }); }} /></>}{focus.emergencyReleased && <Button title="Resume app blocking" secondary busy={busy} disabled={!focus.authorized || focus.selectedCount === 0} onPress={() => { void act(async () => { await lockFocus(); await refreshFocus(); setNotice('Focus resumed. Emergency exit remains available.'); }); }} />}<FocusApps selected={focusApps} onChange={setFocusApps} /></Card><Card><Title small>Study preferences</Title>{preferences}<Field label="Your major" value={major} onChangeText={setMajor} /><Field label="Target companies" value={companies} onChangeText={setCompanies} placeholder="Up to five names, separated by commas" /><Chips options={[{ label: 'Internship', value: 'internship' }, { label: 'Full-time', value: 'full-time' }]} value={target} onChange={setTarget} /><Button title="Save preferences" busy={busy} disabled={offline} onPress={() => { void act(async () => { await saveProfile(); setNotice('Study plan updated. New settings apply to your next interview.'); }); }} /></Card><Card><Title small>Your resume</Title><Body muted>{profile!.resumeName || 'No resume saved yet.'}</Body><Button title="Replace resume" secondary busy={busy} disabled={offline} onPress={() => { void act(uploadResume); }} /></Card><Card><Title small>Connection & account</Title><Body muted>{profile!.email}</Body><Field label="Server URL" value={serverUrl} onChangeText={setServerUrl} autoCapitalize="none" /><Button title="Save connection and refresh" secondary busy={busy} onPress={() => { void act(async () => { await configureApi(serverUrl); await accept(await request<Snapshot>('/me')); setOffline(false); await health(); setNotice('Connected.'); }); }} /><Body muted>{gradingMode === 'ai' ? 'AI coaching enabled. Voice recordings and answer text are sent to your configured provider.' : 'Rubric coaching enabled. Add GROQ_API_KEY or OPENAI_API_KEY on the server to enable AI and voice transcription.'}</Body><Button title="Log out" secondary busy={busy} onPress={() => { void act(logout); }} /></Card></View>;
  }

  if (!ready || !introDone) return <BrandIntro />;
  const showTabs = !!snapshot && !needsOnboarding && !practice && !selectedLesson;
  return <SafeAreaView style={s.app}><StatusBar style={isDark ? 'light' : 'dark'} /><KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <View style={s.header}><Text style={s.brand}>unscroll<Text style={{ color: colors.accent }}>.</Text></Text><View style={{flexDirection: 'row', alignItems: 'center', gap: 10}}><AmbientMotion />{snapshot && !needsOnboarding && <Avatar name={snapshot.profile.name} image={avatar} onPress={() => { setPractice(false); setSelectedLesson(null); setTab('settings'); }} />}</View></View>
    <ScrollView ref={scroll} keyboardShouldPersistTaps="handled" contentContainerStyle={s.scroll}><View style={s.content}>
      {error !== '' && <Message text={error} />}{notice !== '' && <Card green><Body>{notice}</Body></Card>}
      {offline && <Button title="Reconnect" secondary busy={busy} onPress={() => { void act(async () => { await accept(await request<Snapshot>('/me')); setOffline(false); await health(); }); }} />}
      {renderContent()}
    </View></ScrollView>
    {showTabs && <Navigation tab={tab} onChange={item => { setTab(item); setError(''); setNotice(''); }} />}
  </KeyboardAvoidingView></SafeAreaView>;
}

function appStyles(colors: ReturnType<typeof useTheme>['colors']) { return StyleSheet.create({
  app: { flex: 1, backgroundColor: colors.background }, loading: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 18, backgroundColor: colors.background },
  header: { width: '100%', maxWidth: 430, alignSelf: 'center', paddingHorizontal: 24, paddingVertical: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  brand: { color: colors.ink, fontWeight: '700', fontSize: 17, letterSpacing: -0.3 }, dot: { width: 9, height: 9, backgroundColor: colors.accent, borderRadius: 5 },
  scroll: { flexGrow: 1, paddingBottom: 28 }, content: { width: '100%', maxWidth: 430, alignSelf: 'center', paddingHorizontal: 24, gap: 18 }, stack: { gap: 22 }, hero: { paddingVertical: 25, gap: 18 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 }, pill: { color: colors.accent, backgroundColor: colors.surface, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, fontSize: 12, fontWeight: '600' },
  streak: { alignItems: 'center', gap: 3 }, streakNumber: { color: colors.ink, fontSize: 24, fontWeight: '700' }, score: { fontSize: 36, fontWeight: '700', color: colors.accent },
  code: { fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', color: colors.ink, backgroundColor: colors.background, padding: 14, borderRadius: 12, lineHeight: 22 }, codeInput: { fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', minHeight: 220, fontSize: 14 },
  choice: { padding: 16, borderRadius: 12, borderColor: colors.line, borderWidth: 1, minHeight: 48 }, lessonNumber: { fontSize: 28, color: colors.accent, fontWeight: '600' },
  metricGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 }, metric: { flexGrow: 1, width: '45%', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: 20, padding: 22, gap: 8 }, metricValue: { fontSize: 30, color: colors.ink, fontWeight: '700' },
  activity: { flexDirection: 'row', flexWrap: 'wrap', gap: 13, alignItems: 'flex-end' }, activityDay: { gap: 8, alignItems: 'center' }, activityBar: { width: 24, backgroundColor: colors.accent, borderRadius: 6 },
  nav: { width: '100%', maxWidth: 430, alignSelf: 'center', flexDirection: 'row', borderTopWidth: 1, borderTopColor: colors.line, padding: 12, gap: 4, backgroundColor: colors.background }, navItem: { flex: 1, minHeight: 48, borderRadius: 12, justifyContent: 'center', alignItems: 'center' }, navText: { fontSize: 13, color: colors.muted },
});

}
