'use strict';

process.env.LINKEDIN_COMMENT_MODEL_PROVIDER = 'none';
process.env.LINKEDIN_DM_MODEL_PROVIDER = 'none';
process.env.LINKEDIN_SKIP_OUTPUT_WRITE = 'true';

const assert = require('node:assert/strict');
const { generateCommentFromBody, generateDmFromBody } = require('../lib/api-runtime');

const personalHashtagPost = `Harry Stebbings
• Follower:in
Founder @ 20VC
2 Woche(n) •

The single biggest lesson I learned from my mother.

Only you set the limits of your achievements. No one else.

17 years ago, my mother was diagnosed with MS. She was told that in 5 years she would be in a wheelchair.

Fast forward 17 years. She has just walked from Dublin to Belfast. She walks two marathons a week and is a Pilates instructor. She is the single best mother and grandmother in the world.

Some heroes don't wear capes. Mothers don't but they are our heroes.

#Founder #funding #business #investing #vc #venturecapital #entrepreneur #startup`;

const investorLanguagePost = `Wir haben unsere Seed-Runde vorbereitet und gemerkt: Das Pitch Deck war nicht das Problem. Die Investoren haben verstanden, was wir bauen, aber nicht warum genau jetzt der Markt kippt. Seit wir die Story auf Timing, Risiko und Traction geschärft haben, sind die Gespräche viel konkreter geworden.`;

const founderLearningPost = `Profil von Jan Goslicki anzeigen
Jan Goslicki

  • 3.+

Serial Crypto Entrepreneur & Executive | COO & Co-Founder | Driving Innovation in Fintech and Blockchain

Zur Website

2 Woche(n) •

Folgen

The worst advice I ever received: "Focus on growth. Growth solves everything."

It doesn't.

Growth without sustainability is a bonfire. Impressive for 5 minutes. Then ashes.

As a founder, your job is not to impress investors with big numbers. Your job is to solve problems for your customers.

Help them make money. Help them survive. Help them get things done.

Vanity metrics look great in a pitch deck. They mean nothing in a bank account.

If you solve real problems, money follows. If you chase growth, you chase your own tail.

I made that mistake. I won't make it again.`;

async function run() {
  const personalResult = await generateCommentFromBody({ postText: personalHashtagPost });
  assert.equal(personalResult.ok, true);
  assert.equal(personalResult.primaryComment.topic, 'Claude LinkedIn Voice Agent');
  assert.match(personalResult.primaryComment.why, /Nutzer hat den Beitrag ausgewählt/);

  const investorResult = await generateCommentFromBody({ postText: investorLanguagePost });
  assert.equal(investorResult.ok, true);
  assert.equal(investorResult.primaryComment.topic, 'Claude LinkedIn Voice Agent');
  assert.match(investorResult.primaryComment.why, /Nutzer hat den Beitrag ausgewählt/);

  const founderLearningResult = await generateCommentFromBody({ postText: founderLearningPost });
  assert.equal(founderLearningResult.ok, true);
  assert.equal(founderLearningResult.primaryComment.topic, 'Claude LinkedIn Voice Agent');
  assert.match(founderLearningResult.primaryComment.why, /Nutzer hat den Beitrag ausgewählt/);

  const dmResult = await generateDmFromBody({
    signalText: 'Spannend, genau damit kämpfen wir auch gerade.',
    profile: 'Max Mustermann',
    postTopic: 'Investor-Sprache',
    userPoint: 'zwei verschiedene Zielgruppen',
    trigger: 'Kommentar auf meinen Post',
  });
  assert.equal(dmResult.ok, true);
  assert.equal(dmResult.primaryDm.stage, 'Like oder Kommentar auf meinen Post');
  assert.match(dmResult.primaryDm.text, /Danke|angedockt|konkret/);
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});