'use strict';

/* Consistent success envelope: { success, message, data, meta } */
function ok(res, data = null, message = 'OK', meta = undefined) {
  return res.status(200).json({ success: true, message, data, meta });
}

function created(res, data = null, message = 'Created') {
  return res.status(201).json({ success: true, message, data });
}

function noContent(res) {
  return res.status(204).send();
}

module.exports = { ok, created, noContent };
