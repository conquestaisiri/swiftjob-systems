// Test adapter: never opens a network connection or reads production configuration.
export const types = { builtins: { TIMESTAMPTZ: 1184, TIMESTAMP: 1114, DATE: 1082, INTERVAL: 1186 }, setTypeParser() {} };
export function neon(url) {
  if (url !== 'postgresql://audit-local-only') throw new Error('Non-test database rejected');
  return async function query(sql, params = [], options = {}) {
    if (typeof sql !== 'string') throw new Error('Unsupported test query shape');
    const result = await globalThis.__auditDatabase.query(sql, params);
    const serialize = (value) => value instanceof Date ? value.toISOString() : value;
    const rows = options.arrayMode
      ? result.rows.map(row => result.fields.map(field => serialize(row[field.name])))
      : result.rows.map(row => Object.fromEntries(Object.entries(row).map(([key, value]) => [key, serialize(value)])));
    return options.fullResults ? { ...result, rows } : rows;
  };
}
