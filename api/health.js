'use strict';

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Methode nicht erlaubt' });
    return;
  }

  res.status(200).json({ status: 'ok' });
};