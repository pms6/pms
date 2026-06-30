'use strict';

const ApiError = require('../utils/ApiError');

/**
 * Validate req against a zod schema shaped as { body?, query?, params? }.
 * On success, replaces each part with the parsed (coerced) value.
 *
 *   const schema = z.object({ body: z.object({ name: z.string() }) });
 *   router.post('/', validate(schema), handler);
 */
function validate(schema) {
  return (req, _res, next) => {
    const result = schema.safeParse({
      body: req.body,
      query: req.query,
      params: req.params,
    });

    if (!result.success) {
      const details = result.error.issues.map((i) => ({
        path: i.path.join('.'),
        message: i.message,
      }));
      return next(ApiError.badRequest('Validation failed', details));
    }

    if (result.data.body) req.body = result.data.body;
    if (result.data.query) req.query = result.data.query;
    if (result.data.params) req.params = result.data.params;
    return next();
  };
}

module.exports = { validate };
