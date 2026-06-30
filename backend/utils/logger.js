'use strict';

/* Minimal structured logger. Swap for pino/winston later without touching callers. */
function ts() {
  return new Date().toISOString();
}

const logger = {
  info: (msg, meta) => console.log(`[${ts()}] INFO  ${msg}`, meta || ''),
  warn: (msg, meta) => console.warn(`[${ts()}] WARN  ${msg}`, meta || ''),
  error: (msg, meta) => console.error(`[${ts()}] ERROR ${msg}`, meta || ''),
  debug: (msg, meta) => {
    if (process.env.NODE_ENV !== 'production') {
      console.debug(`[${ts()}] DEBUG ${msg}`, meta || '');
    }
  },
};

module.exports = logger;
