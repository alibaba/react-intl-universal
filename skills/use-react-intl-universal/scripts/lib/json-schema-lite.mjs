/*
 * Purpose:
 * Validate JSON values against the subset of JSON Schema used by the UI
 * inspection report contract without requiring external dependencies.
 */

/** Checks whether a value matches a JSON Schema type. */
function typeMatches(value, type) {
  if (type === 'null') return value === null;
  if (type === 'array') return Array.isArray(value);
  if (type === 'object') return value !== null && typeof value === 'object' && !Array.isArray(value);
  if (type === 'integer') return Number.isInteger(value);
  if (type === 'number') return typeof value === 'number' && Number.isFinite(value);
  return typeof value === type;
}

/** Checks whether two values are structurally equivalent. */
function sameValue(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

/** Resolves a local JSON Schema reference from the root schema. */
function resolveRef(rootSchema, ref) {
  if (!ref.startsWith('#/')) {
    throw new Error(`Only local JSON Schema references are supported: ${ref}`);
  }
  return ref
    .slice(2)
    .split('/')
    .map((part) => part.replaceAll('~1', '/').replaceAll('~0', '~'))
    .reduce((current, part) => current?.[part], rootSchema);
}

/** Appends an object key or array index to a diagnostic JSON path. */
function appendPath(base, part) {
  if (typeof part === 'number') return `${base}[${part}]`;
  return /^[A-Za-z_$][\w$-]*$/.test(part) ? `${base}.${part}` : `${base}[${JSON.stringify(part)}]`;
}

/** Recursively validates one value against a supported schema node. */
function validateNode(value, schema, rootSchema, path, errors) {
  if (!schema || typeof schema !== 'object') {
    errors.push({ path, message: 'Schema node is invalid.' });
    return;
  }

  if (schema.$ref) {
    const resolved = resolveRef(rootSchema, schema.$ref);
    if (!resolved) {
      errors.push({ path, message: `Schema reference does not resolve: ${schema.$ref}` });
      return;
    }
    validateNode(value, resolved, rootSchema, path, errors);
    return;
  }

  if (Object.hasOwn(schema, 'const') && !sameValue(value, schema.const)) {
    errors.push({ path, message: `Expected constant ${JSON.stringify(schema.const)}.` });
    return;
  }

  if (schema.enum && !schema.enum.some((candidate) => sameValue(candidate, value))) {
    errors.push({ path, message: `Expected one of ${schema.enum.map((item) => JSON.stringify(item)).join(', ')}.` });
    return;
  }

  const types = Array.isArray(schema.type) ? schema.type : schema.type ? [schema.type] : [];
  if (types.length && !types.some((type) => typeMatches(value, type))) {
    errors.push({ path, message: `Expected type ${types.join(' or ')}, received ${Array.isArray(value) ? 'array' : value === null ? 'null' : typeof value}.` });
    return;
  }

  if (schema.allOf) {
    for (const branch of schema.allOf) validateNode(value, branch, rootSchema, path, errors);
  }

  if (schema.anyOf || schema.oneOf) {
    const branches = schema.anyOf || schema.oneOf;
    const results = branches.map((branch) => {
      const branchErrors = [];
      validateNode(value, branch, rootSchema, path, branchErrors);
      return branchErrors;
    });
    const validCount = results.filter((branchErrors) => branchErrors.length === 0).length;
    const valid = schema.oneOf ? validCount === 1 : validCount > 0;
    if (!valid) {
      errors.push({ path, message: schema.oneOf ? 'Expected exactly one schema branch to match.' : 'Expected at least one schema branch to match.' });
      return;
    }
  }

  if (typeof value === 'string') {
    if (schema.minLength !== undefined && value.length < schema.minLength) {
      errors.push({ path, message: `Expected at least ${schema.minLength} character(s).` });
    }
    if (schema.maxLength !== undefined && value.length > schema.maxLength) {
      errors.push({ path, message: `Expected at most ${schema.maxLength} character(s).` });
    }
    if (schema.pattern && !(new RegExp(schema.pattern).test(value))) {
      errors.push({ path, message: `Value does not match ${schema.pattern}.` });
    }
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    if (schema.minimum !== undefined && value < schema.minimum) {
      errors.push({ path, message: `Expected a value greater than or equal to ${schema.minimum}.` });
    }
    if (schema.maximum !== undefined && value > schema.maximum) {
      errors.push({ path, message: `Expected a value less than or equal to ${schema.maximum}.` });
    }
    if (schema.exclusiveMinimum !== undefined && value <= schema.exclusiveMinimum) {
      errors.push({ path, message: `Expected a value greater than ${schema.exclusiveMinimum}.` });
    }
    if (schema.exclusiveMaximum !== undefined && value >= schema.exclusiveMaximum) {
      errors.push({ path, message: `Expected a value less than ${schema.exclusiveMaximum}.` });
    }
  }

  if (Array.isArray(value)) {
    if (schema.minItems !== undefined && value.length < schema.minItems) {
      errors.push({ path, message: `Expected at least ${schema.minItems} item(s).` });
    }
    if (schema.maxItems !== undefined && value.length > schema.maxItems) {
      errors.push({ path, message: `Expected at most ${schema.maxItems} item(s).` });
    }
    if (schema.uniqueItems) {
      const serialized = value.map((item) => JSON.stringify(item));
      if (new Set(serialized).size !== serialized.length) {
        errors.push({ path, message: 'Expected unique array items.' });
      }
    }
    if (schema.items) {
      value.forEach((item, index) => validateNode(item, schema.items, rootSchema, appendPath(path, index), errors));
    }
  }

  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    const properties = schema.properties || {};
    for (const key of schema.required || []) {
      if (!Object.hasOwn(value, key)) {
        errors.push({ path: appendPath(path, key), message: 'Required property is missing.' });
      }
    }
    for (const [key, child] of Object.entries(value)) {
      if (Object.hasOwn(properties, key)) {
        validateNode(child, properties[key], rootSchema, appendPath(path, key), errors);
      } else if (schema.additionalProperties === false) {
        errors.push({ path: appendPath(path, key), message: 'Unknown property is not allowed.' });
      } else if (schema.additionalProperties && typeof schema.additionalProperties === 'object') {
        validateNode(child, schema.additionalProperties, rootSchema, appendPath(path, key), errors);
      }
    }
  }
}

/** Validates a value and returns every structural contract error. */
export function validateJsonSchema(value, schema) {
  const errors = [];
  validateNode(value, schema, schema, '$', errors);
  return errors;
}
