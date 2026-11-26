import { randomUUID } from 'node:crypto';
import { requestContext } from '../utils/log.js';

// reuse an id from the client/proxy if it looks sane, otherwise make one
const SAFE_ID = /^[\w-]{8,64}$/;

export function requestId(req, res, next) {
  const incoming = req.get('x-request-id');
  req.id = incoming && SAFE_ID.test(incoming) ? incoming : randomUUID();
  res.set('X-Request-Id', req.id);
  requestContext.run({ id: req.id }, next);
}
