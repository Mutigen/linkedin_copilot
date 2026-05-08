'use strict';

process.env.LINKEDIN_COMMENT_MODEL_PROVIDER = 'none';
process.env.LINKEDIN_SKIP_OUTPUT_WRITE = 'true';

const assert = require('node:assert/strict');
const { generateCommentFromBody } = require('../lib/api-runtime');

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

async function run() {
  const personalResult = await generateCommentFromBody({ postText: personalHashtagPost });
  assert.equal(personalResult.ok, false);
  assert.equal(personalResult.primaryComment, null);
  assert.equal(personalResult.connectionDrafts.length, 0);

  const investorResult = await generateCommentFromBody({ postText: investorLanguagePost });
  assert.equal(investorResult.ok, true);
  assert.equal(investorResult.primaryComment.topic, 'Investor-Sprache');
  assert.match(investorResult.primaryComment.text, /Investorengesprächen|Funding-Gesprächen|Fundraising/);
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});