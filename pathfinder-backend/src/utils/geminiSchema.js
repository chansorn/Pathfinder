import { z } from 'zod';

// Zod -> Gemini responseSchema (an OpenAPI subset), so each AI schema only lives in one place.
//
// Array lengths and number bounds are NOT sent as constraints: with real Gemini the bigger schemas
// (skills, tcas plan) failed with 400 "schema produces a constraint that has too many states".
// They go into the description as a hint instead, and zod still enforces them after the call
// (generateJson retries once if the answer doesn't fit).
export function toGeminiSchema(zodSchema) {
  return convert(z.toJSONSchema(zodSchema, { target: 'openapi-3.0' }));
}

const range = (min, max, unit = '') => {
  if (min != null && max != null) return min === max ? `${min}${unit}` : `${min}-${max}${unit}`;
  if (min != null) return `>= ${min}${unit}`;
  if (max != null) return `<= ${max}${unit}`;
  return null;
};

const withHint = (description, hint) => (hint ? [description, `(${hint})`].filter(Boolean).join(' ') : description);

function convert(js) {
  const out = {};
  if (js.description) out.description = js.description;

  if (js.enum) {
    out.type = 'STRING';
    out.enum = js.enum.map(String);
    return out;
  }

  switch (js.type) {
    case 'object': {
      const props = js.properties ?? {};
      out.type = 'OBJECT';
      out.properties = Object.fromEntries(Object.entries(props).map(([k, v]) => [k, convert(v)]));
      out.propertyOrdering = Object.keys(props);
      if (js.required?.length) out.required = js.required;
      break;
    }
    case 'array':
      out.type = 'ARRAY';
      out.items = convert(js.items ?? {});
      out.description = withHint(out.description, range(js.minItems, js.maxItems, ' items'));
      break;
    case 'integer':
    case 'number':
      out.type = js.type.toUpperCase();
      out.description = withHint(out.description, range(js.minimum, js.maximum));
      break;
    case 'boolean':
      out.type = 'BOOLEAN';
      break;
    default:
      // strings. regex patterns are dropped, zod checks them afterwards anyway
      out.type = 'STRING';
  }
  return out;
}
