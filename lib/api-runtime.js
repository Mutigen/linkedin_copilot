'use strict';

const fs = require('fs');
const { runCopilot } = require('../linkedin-copilot');

function parseRawPayload(body) {
  if (!body || typeof body !== 'object') return {};
  const b64data = String(body.b64data || '').trim();

  if (!b64data) return body;
  if (!b64data.startsWith('b64:')) {
    const error = new Error('b64data fehlt oder hat falsches Format');
    error.statusCode = 400;
    throw error;
  }

  return JSON.parse(Buffer.from(b64data.slice(4), 'base64').toString('utf8'));
}

function buildManualPost(postText) {
  return {
    authorName: 'Manueller Post',
    authorHeadline: 'Founder & CEO @ Manual Tech Startup | B2B SaaS | DACH',
    text: String(postText || '').trim(),
  };
}

function buildWarmSignal(body) {
  const profile = String(body.profile || '').trim();
  const trigger = String(body.trigger || '').trim() || 'Manuell im UI angefragt';
  const postTopic = String(body.postTopic || '').trim() || 'deinen Beitrag';
  const userPoint = String(body.userPoint || body.signalText || '').trim() || 'deinen Punkt';
  const stage = String(body.stage || '').trim() || 'Stufe 1';

  return {
    stage,
    trigger,
    reactionType: trigger,
    name: profile,
    profile,
    postTopic,
    userPoint,
    signalText: String(body.signalText || '').trim(),
  };
}

function formatCommentResponse(result) {
  const report = result.report;
  const commentDrafts = (report?.commentDrafts || []).map((draft) => ({
    profile: draft.profile,
    topic: draft.topic,
    why: draft.why,
    text: draft.text,
    modelModeration: draft.modelModeration || null,
  }));

  const connectionDrafts = (report?.connectionDrafts || []).map((draft) => ({
    profile: draft.profile,
    text: draft.text,
  }));

  return {
    ok: commentDrafts.length > 0,
    primaryComment: commentDrafts[0] || null,
    commentDrafts,
    connectionDrafts,
    notes: report?.notes || result.notes || [],
    errors: result.errors || [],
    markdownPath: result.markdownPath,
    jsonPath: result.jsonPath,
    commentModeration: result.commentModeration || null,
    message: commentDrafts.length > 0
      ? 'Kommentarentwürfe erzeugt.'
      : 'Kein passender Kommentar erzeugt. Versuch mehr Founder-/Startup-Kontext im Post oder nutze die DM-Funktion separat.',
  };
}

function formatDmResponse(result) {
  const report = result.report;
  const dmDrafts = (report?.dmDrafts || []).map((draft) => ({
    stage: draft.stage,
    trigger: draft.trigger,
    profile: draft.profile,
    text: draft.text,
    modelModeration: draft.modelModeration || null,
  }));

  return {
    ok: dmDrafts.length > 0,
    primaryDm: dmDrafts[0] || null,
    dmDrafts,
    notes: report?.notes || result.notes || [],
    errors: result.errors || [],
    markdownPath: result.markdownPath,
    jsonPath: result.jsonPath,
    dmModeration: result.dmModeration || null,
    message: dmDrafts.length > 0
      ? 'DM-Vorlage erzeugt.'
      : 'Keine DM-Vorlage erzeugt.',
  };
}

async function generateCommentFromBody(body) {
  const postText = String(body.postText || '').trim();
  if (!postText) {
    const error = new Error('postText fehlt');
    error.statusCode = 400;
    throw error;
  }

  const result = await runCopilot({
    useLinkedInMcp: false,
    manualPosts: [buildManualPost(postText)],
  });

  return formatCommentResponse(result);
}

async function generateDmFromBody(body) {
  const signalText = String(body.signalText || body.userPoint || body.trigger || '').trim();
  if (!signalText) {
    const error = new Error('signalText fehlt');
    error.statusCode = 400;
    throw error;
  }

  const result = await runCopilot({
    useLinkedInMcp: false,
    warmSignals: [buildWarmSignal(body)],
  });

  return formatDmResponse(result);
}

async function generateRawFromBody(body) {
  const payload = parseRawPayload(body);
  return runCopilot(payload);
}

module.exports = {
  generateCommentFromBody,
  generateDmFromBody,
  generateRawFromBody,
};