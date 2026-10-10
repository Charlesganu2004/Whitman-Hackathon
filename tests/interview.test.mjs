import assert from 'node:assert/strict';
import test from 'node:test';
import { dialogueHistory, feedbackSpeech, greeting, hintButtonLabel, hintChip, hintCount, listeningLine, revealStagger, scoreLine, splitWords, standingLine, verdictLine } from '../src/core/interview.ts';
import { skillSummary } from '../src/core/skills.ts';

test('the word reveal keeps a long message inside its time budget and slows a little while Jarvis speaks', () => {
  assert.equal(revealStagger(0, false), 0);
  assert.equal(revealStagger(10, false), 35);
  assert.ok(revealStagger(200, false) * 200 <= 2500 + 1, 'a long question finishes within about 2.5 seconds');
  assert.equal(revealStagger(10, true), 60);
  assert.ok(revealStagger(500, true) * 500 <= 5000 + 1);
  assert.ok(revealStagger(40, true) > revealStagger(40, false));
  assert.deepEqual(splitWords('  one\ntwo   three '), ['one', 'two', 'three']);
});

test('Jarvis greets by first name and states what he listens for in a behavioral question', () => {
  assert.match(greeting('Charles Ganu'), /^Hi Charles, I am Jarvis/);
  assert.match(greeting('  '), /^Hi, I am Jarvis/);
  assert.match(listeningLine({ kind: 'behavioral' }), /situation, your task, your action and the result/);
  assert.equal(listeningLine({ kind: 'technical' }), '');
  for (const text of [greeting('A'), listeningLine({ kind: 'behavioral' })]) assert.ok(!text.includes('—'));
});

test('the hint button shows its cost before the first hint and the chip counts hints used', () => {
  assert.equal(hintButtonLabel(0), 'Get a hint · costs 10 evaluation points');
  assert.equal(hintButtonLabel(1), 'Get another hint');
  assert.equal(hintButtonLabel(3), 'No hints left');
  assert.equal(hintChip(0), 'Hints used: 0 of 3');
  assert.equal(hintChip(2), 'Hints used: 2 of 3');
  assert.equal(hintChip(9), 'Hints used: 3 of 3');
  assert.deepEqual([0, 1, 2, 3].map(hintCount), ['No hints', 'One hint', 'Two hints', 'Three hints']);
});

test('the result states the grade and what the hints took off toward the skill, plainly', () => {
  assert.equal(scoreLine({ score: 82, hintsUsed: 2, evaluationScore: 62 }, 'Technical discussion'), 'Answer score 82. Two hints used, so it counts as 62 toward Technical discussion.');
  assert.equal(scoreLine({ score: 82, hintsUsed: 1, evaluationScore: 72 }, 'Coding'), 'Answer score 82. One hint used, so it counts as 72 toward Coding.');
  assert.equal(scoreLine({ score: 70, hintsUsed: 0, evaluationScore: 70 }, 'Communication'), 'Answer score 70. No hints used, so it counts in full toward Communication.');
  assert.equal(scoreLine({ score: 70 }, 'Communication'), 'Answer score 70. No hints used, so it counts in full toward Communication.', 'an older attempt has no hint fields');
  assert.equal(verdictLine({ passed: true }), 'That answer passes.');
  assert.equal(verdictLine({ passed: false }), 'That is not a pass yet.');
});

test('the standing line names the skill, the level, the number and the evidence', () => {
  assert.equal(standingLine(skillSummary('coding', { score: 48, answers: 3 })), 'Your Coding standing is now Intermediate, 48 out of 100. Based on 3 answers.');
  assert.equal(standingLine(skillSummary('communication')), 'Communication is not measured yet.');
});

test('the spoken feedback is short: verdict, score and the first thing to work on', () => {
  const feedback = { passed: false, score: 55, strengths: ['Good comparison.'], improvements: ['Explain the empty case.'], explanation: 'Long reference text that is never spoken here.', mode: 'rubric' };
  assert.equal(feedbackSpeech(feedback), 'That is not a pass yet. Your score is 55. Explain the empty case.');
  assert.equal(feedbackSpeech({ ...feedback, passed: true, improvements: [] }), 'That answer passes. Your score is 55. Good comparison.');
  assert.ok(!feedbackSpeech(feedback).includes('Long reference text'));
});

test('the rolling history keeps the last eight turns, trimmed to the server limits', () => {
  const turns = Array.from({ length: 12 }, (_, index) => ({ role: index % 2 ? 'student' : 'interviewer', text: `turn ${index} ${'x'.repeat(index === 11 ? 3000 : 3)}` }));
  const history = dialogueHistory(turns);
  assert.equal(history.length, 8);
  assert.equal(history[0].text.startsWith('turn 4'), true);
  assert.equal(history.at(-1).text.length, 2000);
  assert.deepEqual(dialogueHistory([{ role: 'student', text: '   ' }]), []);
});

test('spoken text is trimmed to whole sentences within the server limit', async () => {
  const { speechText, pickVoice } = await import('../src/core/interview.ts');
  assert.equal(speechText('  Hello\n there.  '), 'Hello there.');
  const long = Array.from({ length: 20 }, (_, index) => `Sentence number ${index} says something fairly long.`).join(' ');
  const cut = speechText(long);
  assert.ok(cut.length <= 600 && cut.endsWith('.') && long.startsWith(cut));
  const noStops = 'word '.repeat(200).trim();
  const words = speechText(noStops);
  assert.ok(words.length <= 600 && words.endsWith('word'));
  assert.equal(speechText('x'.repeat(700), 600).length, 600);
  const voices = [
    { identifier: 'a', name: 'Fred', quality: 'Default', language: 'en-US' },
    { identifier: 'b', name: 'Samantha', quality: 'Enhanced', language: 'en-US' },
    { identifier: 'c', name: 'Zoe (Premium)', quality: 'Default', language: 'en-GB' },
    { identifier: 'd', name: 'Thomas', quality: 'Premium', language: 'fr-FR' },
  ];
  assert.equal(pickVoice(voices), 'c', 'Premium beats Enhanced beats default, and other languages are ignored');
  assert.equal(pickVoice(voices.filter(voice => voice.identifier !== 'c')), 'b');
  assert.equal(pickVoice([{ identifier: 'g', name: 'Google UK English', quality: 'Default', language: 'en-GB' }, { identifier: 'h', name: 'Google US English', quality: 'Default', language: 'en-US' }]), 'h');
  assert.equal(pickVoice([{ identifier: 'd', name: 'Thomas', quality: 'Premium', language: 'fr-FR' }]), undefined);
  assert.equal(pickVoice([]), undefined);
});
