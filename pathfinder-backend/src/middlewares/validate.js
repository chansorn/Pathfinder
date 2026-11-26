import { badRequest } from '../utils/AppError.js';

// validate({ body, query, params }) -> parsed values end up in req.valid.*
// (express 5 won't let us overwrite req.query, hence req.valid)
export const validate = (schemas) => (req, res, next) => {
  req.valid = {};
  for (const part of ['params', 'query', 'body']) {
    if (!schemas[part]) continue;

    const result = schemas[part].safeParse(req[part] ?? {});
    if (!result.success) {
      const details = result.error.issues.map((i) => ({
        field: i.path.join('.') || part,
        message: i.message,
      }));
      const first = details[0];
      return next(badRequest(`ข้อมูลไม่ถูกต้อง: ${first.field} - ${first.message}`, 'VALIDATION_ERROR', details));
    }
    req.valid[part] = result.data;
  }
  next();
};
