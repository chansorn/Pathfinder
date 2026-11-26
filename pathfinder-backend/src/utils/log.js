import { AsyncLocalStorage } from 'node:async_hooks';

// Holds the current request id for the duration of a request, so any log line
// (even deep inside a service) can be traced back to the request that caused it.
export const requestContext = new AsyncLocalStorage();

const prefix = () => {
  const id = requestContext.getStore()?.id;
  return id ? [`[${id}]`] : [];
};

export const log = {
  info: (...args) => console.log(...prefix(), ...args),
  warn: (...args) => console.warn(...prefix(), ...args),
  error: (...args) => console.error(...prefix(), ...args),
};
