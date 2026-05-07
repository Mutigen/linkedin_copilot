'use strict';

const { generateCommentFromBody } = require('../../lib/api-runtime');

function readBody(req) {
  if (typeof req.body === 'string') {
    return req.body ? JSON.parse(req.body) : {};
  }

  return req.body || {};
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Methode nicht erlaubt' });
    return;
  }

  try {
    const data = await generateCommentFromBody(readBody(req));
    res.status(200).json(data);
  } catch (error) {
    res.status(error.statusCode || 500).json({ error: error.message });
  }
};