import { SCHEMA as CAPTURE_SCHEMA } from '../../../src/modules/capture/capture.extraction';
import { SCHEMA as BODY_SCHEMA } from '../../../src/modules/inbound/inbound.body-extraction';

/**
 * The shape rules structured outputs actually enforces.
 *
 * These schemas are only ever validated by the API, at the moment somebody
 * forwards a real document — so a mistake here is invisible in development and
 * then breaks every read at once. That is exactly what happened:
 *
 *   output_config.format.schema: Invalid schema: Enum value 'receipt' does not
 *   match declared type '['string', 'null']'
 *
 * Every document failed, and the message never reached the screen. These tests
 * are the cheap version of that feedback.
 */

type Node = Record<string, any>;

/** Every schema object in the tree, including nested items and properties. */
function walk(node: unknown, path = '$'): [string, Node][] {
  if (!node || typeof node !== 'object') return [];
  const n = node as Node;
  const found: [string, Node][] = [[path, n]];
  for (const [key, value] of Object.entries(n)) {
    if (key === 'properties' && value && typeof value === 'object') {
      for (const [prop, sub] of Object.entries(value as Node)) {
        found.push(...walk(sub, `${path}.${prop}`));
      }
    } else if (key === 'items') {
      found.push(...walk(value, `${path}[]`));
    } else if (key === 'anyOf' && Array.isArray(value)) {
      value.forEach((sub, i) => found.push(...walk(sub, `${path}|${i}`)));
    }
  }
  return found;
}

describe.each([
  ['capture', CAPTURE_SCHEMA as unknown as Node],
  ['email body', BODY_SCHEMA as unknown as Node],
])('%s schema — what structured outputs accepts', (_name, schema) => {
  const nodes = walk(schema);

  it('never declares `type` as an array', () => {
    /**
     * The documented types are the basic ones. A union has to be written as
     * anyOf, and `{type: ['string','null']}` — perfectly ordinary JSON Schema —
     * is refused.
     */
    const unions = nodes.filter(([, n]) => Array.isArray(n.type));
    expect(unions.map(([p]) => p)).toEqual([]);
  });

  it('never combines an enum with a nullable union', () => {
    // The exact rejection that broke document reading.
    const bad = nodes.filter(([, n]) => n.enum && Array.isArray(n.type));
    expect(bad.map(([p]) => p)).toEqual([]);
  });

  it('puts null in an anyOf branch, never inside the enum list', () => {
    const withNullInEnum = nodes.filter(
      ([, n]) => Array.isArray(n.enum) && n.enum.includes(null)
    );
    expect(withNullInEnum.map(([p]) => p)).toEqual([]);
  });

  it('sets additionalProperties false on every object', () => {
    // Required, not optional: "additionalProperties (must be set to false)".
    const objects = nodes.filter(([, n]) => n.type === 'object');
    expect(objects.length).toBeGreaterThan(0);
    const missing = objects.filter(([, n]) => n.additionalProperties !== false);
    expect(missing.map(([p]) => p)).toEqual([]);
  });

  it('uses no numeric or string constraints, which are unsupported', () => {
    const banned = ['minimum', 'maximum', 'multipleOf', 'minLength', 'maxLength', 'pattern'];
    const offenders = nodes.filter(([, n]) => banned.some((k) => k in n));
    expect(offenders.map(([p]) => p)).toEqual([]);
  });

  it('serialises to JSON, since that is how it is sent', () => {
    expect(() => JSON.stringify(schema)).not.toThrow();
    expect(JSON.parse(JSON.stringify(schema))).toBeTruthy();
  });
});
