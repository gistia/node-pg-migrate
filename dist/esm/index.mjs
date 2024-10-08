// src/migration.ts
import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, readdir } from "node:fs/promises";
import { basename, extname, join, resolve } from "node:path";
import { cwd } from "node:process";

// src/operations/casts/dropCast.ts
function dropCast(mOptions) {
  const _drop = (sourceType, targetType, options = {}) => {
    const { ifExists = false } = options;
    const ifExistsStr = ifExists ? " IF EXISTS" : "";
    return `DROP CAST${ifExistsStr} (${sourceType} AS ${targetType});`;
  };
  return _drop;
}

// src/operations/casts/createCast.ts
function createCast(mOptions) {
  const _create = (sourceType, targetType, options = {}) => {
    const { functionName, argumentTypes, inout = false, as } = options;
    let conversion = "";
    if (functionName) {
      const args = argumentTypes || [sourceType];
      conversion = ` WITH FUNCTION ${mOptions.literal(functionName)}(${args.join(", ")})`;
    } else if (inout) {
      conversion = " WITH INOUT";
    } else {
      conversion = " WITHOUT FUNCTION";
    }
    const implicit = as ? ` AS ${as}` : "";
    return `CREATE CAST (${sourceType} AS ${targetType})${conversion}${implicit};`;
  };
  _create.reverse = dropCast(mOptions);
  return _create;
}

// src/utils/decamelize.ts
var REPLACEMENT = "$1_$2";
function decamelize(text) {
  if (text.length < 2) {
    return text.toLowerCase();
  }
  const decamelized = text.replace(
    new RegExp("([\\p{Lowercase_Letter}\\d])(\\p{Uppercase_Letter})", "gu"),
    REPLACEMENT
  );
  return decamelized.replace(
    new RegExp("(\\p{Uppercase_Letter})(\\p{Uppercase_Letter}\\p{Lowercase_Letter}+)", "gu"),
    REPLACEMENT
  ).toLowerCase();
}

// src/utils/identity.ts
function identity(v) {
  return v;
}

// src/utils/quote.ts
function quote(str) {
  return `"${str}"`;
}

// src/utils/createSchemalize.ts
function createSchemalize(options, _legacyShouldQuote) {
  const { shouldDecamelize, shouldQuote } = typeof options === "boolean" ? {
    shouldDecamelize: options,
    shouldQuote: _legacyShouldQuote
  } : options;
  if (typeof options === "boolean") {
    console.warn(
      "createSchemalize(shouldDecamelize, shouldQuote) is deprecated. Use createSchemalize({ shouldDecamelize, shouldQuote }) instead."
    );
  }
  const transform = [
    shouldDecamelize ? decamelize : identity,
    shouldQuote ? quote : identity
  ].reduce((acc, fn) => fn === identity ? acc : (str) => acc(fn(str)));
  return (value) => {
    if (typeof value === "object") {
      const { schema, name } = value;
      return (schema ? `${transform(schema)}.` : "") + transform(name);
    }
    return transform(value);
  };
}

// src/utils/createTransformer.ts
function createTransformer(literal) {
  return (statement, mapping = {}) => Object.keys(mapping).reduce((str, param) => {
    const val = mapping?.[param];
    return str.replace(
      new RegExp(`{${param}}`, "g"),
      val === void 0 ? "" : typeof val === "string" || typeof val === "object" && val !== null && "name" in val ? literal(val) : String(escapeValue(val))
    );
  }, statement);
}

// src/utils/escapeValue.ts
function escapeValue(val) {
  if (val === null) {
    return "NULL";
  }
  if (typeof val === "boolean") {
    return val.toString();
  }
  if (typeof val === "string") {
    let dollars;
    const ids = new StringIdGenerator();
    let index;
    do {
      index = ids.next();
      dollars = `$pg${index}$`;
    } while (val.includes(dollars));
    return `${dollars}${val}${dollars}`;
  }
  if (typeof val === "number") {
    return val;
  }
  if (Array.isArray(val)) {
    const arrayStr = val.map(escapeValue).join(",").replace(/ARRAY/g, "");
    return `ARRAY[${arrayStr}]`;
  }
  if (isPgLiteral(val)) {
    return val.value;
  }
  return "";
}

// src/utils/formatLines.ts
function formatLines(lines, replace = "  ", separator = ",") {
  return lines.map((line) => line.replace(/(?:\r\n|\r|\n)+/g, " ")).join(`${separator}
`).replace(/^/gm, replace);
}

// src/utils/formatParams.ts
function formatParam(mOptions) {
  return (param) => {
    const {
      mode,
      name,
      type,
      default: defaultValue
    } = applyType(param, mOptions.typeShorthands);
    const options = [];
    if (mode) {
      options.push(mode);
    }
    if (name) {
      options.push(mOptions.literal(name));
    }
    if (type) {
      options.push(type);
    }
    if (defaultValue) {
      options.push(`DEFAULT ${escapeValue(defaultValue)}`);
    }
    return options.join(" ");
  };
}
function formatParams(params, mOptions) {
  return `(${params.map(formatParam(mOptions)).join(", ")})`;
}

// src/utils/getMigrationTableSchema.ts
function getMigrationTableSchema(options) {
  return options.migrationsSchema === void 0 ? getSchemas(options.schema)[0] : options.migrationsSchema;
}

// src/utils/toArray.ts
function toArray(item) {
  return Array.isArray(item) ? [...item] : [item];
}

// src/utils/getSchemas.ts
function getSchemas(schema) {
  const schemas = toArray(schema).filter(
    (s) => typeof s === "string" && s.length > 0
  );
  return schemas.length > 0 ? schemas : ["public"];
}

// src/utils/intersection.ts
function intersection(list1, list2) {
  return list1.filter((element) => list2.includes(element));
}

// src/utils/makeComment.ts
function makeComment(object, name, text = null) {
  const literal = escapeValue(text);
  return `COMMENT ON ${object} ${name} IS ${literal};`;
}

// src/utils/PgLiteral.ts
var PgLiteral = class _PgLiteral {
  /**
   * Creates a new `PgLiteral` instance.
   *
   * @param value The string value.
   */
  constructor(value) {
    this.value = value;
  }
  /**
   * Creates a new `PgLiteral` instance.
   *
   * @param str The string value.
   * @returns The new `PgLiteral` instance.
   */
  static create(str) {
    return new _PgLiteral(str);
  }
  /**
   * Indicates that this object is a `PgLiteral`.
   */
  literal = true;
  /**
   * Returns the string value.
   *
   * @returns The string value.
   */
  toString() {
    return this.value;
  }
};
function isPgLiteral(val) {
  return val instanceof PgLiteral || typeof val === "object" && val !== null && "literal" in val && val.literal === true;
}

// src/utils/StringIdGenerator.ts
var StringIdGenerator = class {
  constructor(chars = "abcdefghijklmnopqrstuvwxyz") {
    this.chars = chars;
  }
  ids = [0];
  next() {
    const idsChars = this.ids.map((id) => this.chars[id]);
    this.increment();
    return idsChars.join("");
  }
  increment() {
    for (let i = this.ids.length - 1; i >= 0; i -= 1) {
      this.ids[i] += 1;
      if (this.ids[i] < this.chars.length) {
        return;
      }
      this.ids[i] = 0;
    }
    this.ids.unshift(0);
  }
};

// src/utils/types.ts
var TYPE_ADAPTERS = Object.freeze({
  int: "integer",
  string: "text",
  float: "real",
  double: "double precision",
  datetime: "timestamp",
  bool: "boolean"
});
var DEFAULT_TYPE_SHORTHANDS = Object.freeze({
  id: { type: "serial", primaryKey: true }
  // convenience type for serial primary keys
});
function applyTypeAdapters(type) {
  return type in TYPE_ADAPTERS ? TYPE_ADAPTERS[type] : type;
}
function toType(type) {
  return typeof type === "string" ? { type } : type;
}
function removeType({
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  type,
  ...rest
}) {
  return rest;
}
function applyType(type, extendingTypeShorthands = {}) {
  const typeShorthands = {
    ...DEFAULT_TYPE_SHORTHANDS,
    ...extendingTypeShorthands
  };
  const options = toType(type);
  let ext = null;
  const types = [options.type];
  while (typeShorthands[types[types.length - 1]]) {
    ext = {
      ...toType(typeShorthands[types[types.length - 1]]),
      ...ext === null ? {} : removeType(ext)
    };
    if (types.includes(ext.type)) {
      throw new Error(
        `Shorthands contain cyclic dependency: ${types.join(", ")}, ${ext.type}`
      );
    } else {
      types.push(ext.type);
    }
  }
  return {
    ...ext,
    ...options,
    type: applyTypeAdapters(ext?.type ?? options.type)
  };
}

// src/operations/domains/alterDomain.ts
function alterDomain(mOptions) {
  const _alter = (domainName, options) => {
    const {
      default: defaultValue,
      notNull,
      allowNull = false,
      check,
      constraintName
    } = options;
    const actions = [];
    if (defaultValue === null) {
      actions.push("DROP DEFAULT");
    } else if (defaultValue !== void 0) {
      actions.push(`SET DEFAULT ${escapeValue(defaultValue)}`);
    }
    if (notNull) {
      actions.push("SET NOT NULL");
    } else if (notNull === false || allowNull) {
      actions.push("DROP NOT NULL");
    }
    if (check) {
      actions.push(
        `${constraintName ? `CONSTRAINT ${mOptions.literal(constraintName)} ` : ""}CHECK (${check})`
      );
    }
    return `${actions.map((action) => `ALTER DOMAIN ${mOptions.literal(domainName)} ${action}`).join(";\n")};`;
  };
  return _alter;
}

// src/operations/domains/dropDomain.ts
function dropDomain(mOptions) {
  const _drop = (domainName, options = {}) => {
    const { ifExists = false, cascade = false } = options;
    const ifExistsStr = ifExists ? " IF EXISTS" : "";
    const cascadeStr = cascade ? " CASCADE" : "";
    const domainNameStr = mOptions.literal(domainName);
    return `DROP DOMAIN${ifExistsStr} ${domainNameStr}${cascadeStr};`;
  };
  return _drop;
}

// src/operations/domains/createDomain.ts
function createDomain(mOptions) {
  const _create = (domainName, type, options = {}) => {
    const {
      default: defaultValue,
      collation,
      notNull = false,
      check,
      constraintName
    } = options;
    const constraints = [];
    if (collation) {
      constraints.push(`COLLATE ${collation}`);
    }
    if (defaultValue !== void 0) {
      constraints.push(`DEFAULT ${escapeValue(defaultValue)}`);
    }
    if (notNull && check) {
      throw new Error(`"notNull" and "check" can't be specified together`);
    } else if (notNull || check) {
      if (constraintName) {
        constraints.push(`CONSTRAINT ${mOptions.literal(constraintName)}`);
      }
      if (notNull) {
        constraints.push("NOT NULL");
      } else if (check) {
        constraints.push(`CHECK (${check})`);
      }
    }
    const constraintsStr = constraints.length > 0 ? ` ${constraints.join(" ")}` : "";
    const typeStr = applyType(type, mOptions.typeShorthands).type;
    const domainNameStr = mOptions.literal(domainName);
    return `CREATE DOMAIN ${domainNameStr} AS ${typeStr}${constraintsStr};`;
  };
  _create.reverse = (domainName, type, options) => dropDomain(mOptions)(domainName, options);
  return _create;
}

// src/operations/domains/renameDomain.ts
function renameDomain(mOptions) {
  const _rename = (domainName, newDomainName) => {
    const domainNameStr = mOptions.literal(domainName);
    const newDomainNameStr = mOptions.literal(newDomainName);
    return `ALTER DOMAIN ${domainNameStr} RENAME TO ${newDomainNameStr};`;
  };
  _rename.reverse = (domainName, newDomainName) => _rename(newDomainName, domainName);
  return _rename;
}

// src/operations/extensions/dropExtension.ts
function dropExtension(mOptions) {
  const _drop = (_extensions, options = {}) => {
    const { ifExists = false, cascade = false } = options;
    const extensions = toArray(_extensions);
    const ifExistsStr = ifExists ? " IF EXISTS" : "";
    const cascadeStr = cascade ? " CASCADE" : "";
    return extensions.map((extension) => {
      const extensionStr = mOptions.literal(extension);
      return `DROP EXTENSION${ifExistsStr} ${extensionStr}${cascadeStr};`;
    });
  };
  return _drop;
}

// src/operations/extensions/createExtension.ts
function createExtension(mOptions) {
  const _create = (_extensions, options = {}) => {
    const { ifNotExists = false, schema } = options;
    const extensions = toArray(_extensions);
    const ifNotExistsStr = ifNotExists ? " IF NOT EXISTS" : "";
    const schemaStr = schema ? ` SCHEMA ${mOptions.literal(schema)}` : "";
    return extensions.map((extension) => {
      const extensionStr = mOptions.literal(extension);
      return `CREATE EXTENSION${ifNotExistsStr} ${extensionStr}${schemaStr};`;
    });
  };
  _create.reverse = dropExtension(mOptions);
  return _create;
}

// src/operations/functions/dropFunction.ts
function dropFunction(mOptions) {
  const _drop = (functionName, functionParams = [], options = {}) => {
    const { ifExists = false, cascade = false } = options;
    const ifExistsStr = ifExists ? " IF EXISTS" : "";
    const cascadeStr = cascade ? " CASCADE" : "";
    const paramsStr = formatParams(functionParams, mOptions);
    const functionNameStr = mOptions.literal(functionName);
    return `DROP FUNCTION${ifExistsStr} ${functionNameStr}${paramsStr}${cascadeStr};`;
  };
  return _drop;
}

// src/operations/functions/createFunction.ts
function createFunction(mOptions) {
  const _create = (functionName, functionParams = [], functionOptions, definition) => {
    const {
      replace = false,
      returns = "void",
      language,
      window = false,
      behavior = "VOLATILE",
      security = "INVOKER",
      onNull = false,
      parallel,
      set
    } = functionOptions;
    const options = [];
    if (behavior) {
      options.push(behavior);
    }
    if (language) {
      options.push(`LANGUAGE ${language}`);
    } else {
      throw new Error(
        `Language for function ${functionName} have to be specified`
      );
    }
    if (security !== "INVOKER") {
      options.push(`SECURITY ${security}`);
    }
    if (window) {
      options.push("WINDOW");
    }
    if (onNull) {
      options.push("RETURNS NULL ON NULL INPUT");
    }
    if (parallel) {
      options.push(`PARALLEL ${parallel}`);
    }
    if (set) {
      for (const { configurationParameter, value } of set) {
        if (value === "FROM CURRENT") {
          options.push(
            `SET ${mOptions.literal(configurationParameter)} FROM CURRENT`
          );
        } else {
          options.push(
            `SET ${mOptions.literal(configurationParameter)} TO ${value}`
          );
        }
      }
    }
    const replaceStr = replace ? " OR REPLACE" : "";
    const paramsStr = formatParams(functionParams, mOptions);
    const functionNameStr = mOptions.literal(functionName);
    return `CREATE${replaceStr} FUNCTION ${functionNameStr}${paramsStr}
  RETURNS ${returns}
  AS ${escapeValue(definition)}
  ${options.join("\n  ")};`;
  };
  _create.reverse = dropFunction(mOptions);
  return _create;
}

// src/operations/functions/renameFunction.ts
function renameFunction(mOptions) {
  const _rename = (oldFunctionName, functionParams = [], newFunctionName) => {
    const paramsStr = formatParams(functionParams, mOptions);
    const oldFunctionNameStr = mOptions.literal(oldFunctionName);
    const newFunctionNameStr = mOptions.literal(newFunctionName);
    return `ALTER FUNCTION ${oldFunctionNameStr}${paramsStr} RENAME TO ${newFunctionNameStr};`;
  };
  _rename.reverse = (oldFunctionName, functionParams, newFunctionName) => _rename(newFunctionName, functionParams, oldFunctionName);
  return _rename;
}

// src/operations/grants/shared.ts
function isAllTablesOptions(options) {
  return "schema" in options;
}
function asRolesStr(roles, mOptions) {
  return toArray(roles).map((role) => role === "PUBLIC" ? role : mOptions.literal(role)).join(", ");
}
function asTablesStr(options, mOptions) {
  return isAllTablesOptions(options) ? `ALL TABLES IN SCHEMA ${mOptions.literal(options.schema)}` : toArray(options.tables).map(mOptions.literal).join(", ");
}

// src/operations/grants/revokeOnSchemas.ts
function revokeOnSchemas(mOptions) {
  const _revokeOnSchemas = (options) => {
    const {
      privileges,
      schemas,
      roles,
      onlyGrantOption = false,
      cascade = false
    } = options;
    const rolesStr = asRolesStr(roles, mOptions);
    const schemasStr = toArray(schemas).map(mOptions.literal).join(", ");
    const privilegesStr = toArray(privileges).map(String).join(", ");
    const onlyGrantOptionStr = onlyGrantOption ? " GRANT OPTION FOR" : "";
    const cascadeStr = cascade ? " CASCADE" : "";
    return `REVOKE${onlyGrantOptionStr} ${privilegesStr} ON SCHEMA ${schemasStr} FROM ${rolesStr}${cascadeStr};`;
  };
  return _revokeOnSchemas;
}

// src/operations/grants/grantOnSchemas.ts
function grantOnSchemas(mOptions) {
  const _grantOnSchemas = (options) => {
    const { privileges, schemas, roles, withGrantOption = false } = options;
    const rolesStr = asRolesStr(roles, mOptions);
    const schemasStr = toArray(schemas).map(mOptions.literal).join(", ");
    const privilegesStr = toArray(privileges).map(String).join(", ");
    const withGrantOptionStr = withGrantOption ? " WITH GRANT OPTION" : "";
    return `GRANT ${privilegesStr} ON SCHEMA ${schemasStr} TO ${rolesStr}${withGrantOptionStr};`;
  };
  _grantOnSchemas.reverse = revokeOnSchemas(mOptions);
  return _grantOnSchemas;
}

// src/operations/grants/revokeOnTables.ts
function revokeOnTables(mOptions) {
  const _revokeOnTables = (options) => {
    const {
      privileges,
      roles,
      onlyGrantOption = false,
      cascade = false
    } = options;
    const rolesStr = asRolesStr(roles, mOptions);
    const privilegesStr = toArray(privileges).map(String).join(", ");
    const tablesStr = asTablesStr(options, mOptions);
    const onlyGrantOptionStr = onlyGrantOption ? " GRANT OPTION FOR" : "";
    const cascadeStr = cascade ? " CASCADE" : "";
    return `REVOKE${onlyGrantOptionStr} ${privilegesStr} ON ${tablesStr} FROM ${rolesStr}${cascadeStr};`;
  };
  return _revokeOnTables;
}

// src/operations/grants/grantOnTables.ts
function grantOnTables(mOptions) {
  const _grantOnTables = (options) => {
    const { privileges, roles, withGrantOption = false } = options;
    const rolesStr = asRolesStr(roles, mOptions);
    const privilegesStr = toArray(privileges).map(String).join(", ");
    const tablesStr = asTablesStr(options, mOptions);
    const withGrantOptionStr = withGrantOption ? " WITH GRANT OPTION" : "";
    return `GRANT ${privilegesStr} ON ${tablesStr} TO ${rolesStr}${withGrantOptionStr};`;
  };
  _grantOnTables.reverse = revokeOnTables(mOptions);
  return _grantOnTables;
}

// src/operations/grants/revokeRoles.ts
function revokeRoles(mOptions) {
  const _revokeRoles = (roles, rolesFrom, options = {}) => {
    const { onlyAdminOption = false, cascade = false } = options;
    const rolesStr = toArray(roles).map(mOptions.literal).join(", ");
    const rolesToStr = toArray(rolesFrom).map(mOptions.literal).join(", ");
    const onlyAdminOptionStr = onlyAdminOption ? " ADMIN OPTION FOR" : "";
    const cascadeStr = cascade ? " CASCADE" : "";
    return `REVOKE${onlyAdminOptionStr} ${rolesStr} FROM ${rolesToStr}${cascadeStr};`;
  };
  return _revokeRoles;
}

// src/operations/grants/grantRoles.ts
function grantRoles(mOptions) {
  const _grantRoles = (rolesFrom, rolesTo, options = {}) => {
    const { withAdminOption = false } = options;
    const rolesFromStr = toArray(rolesFrom).map(mOptions.literal).join(", ");
    const rolesToStr = toArray(rolesTo).map(mOptions.literal).join(", ");
    const withAdminOptionStr = withAdminOption ? " WITH ADMIN OPTION" : "";
    return `GRANT ${rolesFromStr} TO ${rolesToStr}${withAdminOptionStr};`;
  };
  _grantRoles.reverse = revokeRoles(mOptions);
  return _grantRoles;
}

// src/operations/indexes/shared.ts
function generateIndexName(table, columns, options, schemalize) {
  if (options.name) {
    return typeof table === "object" ? { schema: table.schema, name: options.name } : options.name;
  }
  const cols = columns.map((col) => schemalize(typeof col === "string" ? col : col.name)).join("_");
  const uniq = "unique" in options && options.unique ? "_unique" : "";
  return typeof table === "object" ? {
    schema: table.schema,
    name: `${table.name}_${cols}${uniq}_index`
  } : `${table}_${cols}${uniq}_index`;
}
function generateColumnString(column, mOptions) {
  const name = mOptions.schemalize(column);
  const isSpecial = /[ ().]/.test(name);
  return isSpecial ? name : mOptions.literal(name);
}
function generateColumnsString(columns, mOptions) {
  return columns.map(
    (column) => typeof column === "string" ? generateColumnString(column, mOptions) : [
      generateColumnString(column.name, mOptions),
      column.opclass ? mOptions.literal(column.opclass) : void 0,
      column.sort
    ].filter((s) => typeof s === "string" && s !== "").join(" ")
  ).join(", ");
}

// src/operations/indexes/dropIndex.ts
function dropIndex(mOptions) {
  const _drop = (tableName, rawColumns, options = {}) => {
    const { concurrently = false, ifExists = false, cascade = false } = options;
    const columns = toArray(rawColumns);
    const concurrentlyStr = concurrently ? " CONCURRENTLY" : "";
    const ifExistsStr = ifExists ? " IF EXISTS" : "";
    const indexName = generateIndexName(
      tableName,
      columns,
      options,
      mOptions.schemalize
    );
    const cascadeStr = cascade ? " CASCADE" : "";
    const indexNameStr = mOptions.literal(indexName);
    return `DROP INDEX${concurrentlyStr}${ifExistsStr} ${indexNameStr}${cascadeStr};`;
  };
  return _drop;
}

// src/operations/indexes/createIndex.ts
function createIndex(mOptions) {
  const _create = (tableName, rawColumns, options = {}) => {
    const {
      opclass,
      unique = false,
      concurrently = false,
      ifNotExists = false,
      method,
      where,
      include
    } = options;
    const columns = toArray(rawColumns);
    if (opclass) {
      mOptions.logger.warn(
        "Using opclass is deprecated. You should use it as part of column definition e.g. pgm.createIndex('table', [['column', 'opclass', 'ASC']])"
      );
      const lastIndex = columns.length - 1;
      const lastColumn = columns[lastIndex];
      if (typeof lastColumn === "string") {
        columns[lastIndex] = { name: lastColumn, opclass };
      } else if (lastColumn.opclass) {
        throw new Error(
          "There is already defined opclass on column, can't override it with global one"
        );
      } else {
        columns[lastIndex] = { ...lastColumn, opclass };
      }
    }
    const indexName = generateIndexName(
      typeof tableName === "object" ? tableName.name : tableName,
      columns,
      options,
      mOptions.schemalize
    );
    const columnsString = generateColumnsString(columns, mOptions);
    const uniqueStr = unique ? " UNIQUE" : "";
    const concurrentlyStr = concurrently ? " CONCURRENTLY" : "";
    const ifNotExistsStr = ifNotExists ? " IF NOT EXISTS" : "";
    const methodStr = method ? ` USING ${method}` : "";
    const whereStr = where ? ` WHERE ${where}` : "";
    const includeStr = include ? ` INCLUDE (${toArray(include).map(mOptions.literal).join(", ")})` : "";
    const indexNameStr = mOptions.literal(indexName);
    const tableNameStr = mOptions.literal(tableName);
    return `CREATE${uniqueStr} INDEX${concurrentlyStr}${ifNotExistsStr} ${indexNameStr} ON ${tableNameStr}${methodStr} (${columnsString})${includeStr}${whereStr};`;
  };
  _create.reverse = dropIndex(mOptions);
  return _create;
}

// src/operations/materializedViews/shared.ts
function dataClause(data) {
  return data === void 0 ? "" : ` WITH${data ? "" : " NO"} DATA`;
}
function storageParameterStr(storageParameters) {
  return (key) => {
    const value = storageParameters[key] === true ? "" : ` = ${storageParameters[key]}`;
    return `${key}${value}`;
  };
}

// src/operations/materializedViews/alterMaterializedView.ts
function alterMaterializedView(mOptions) {
  const _alter = (viewName, options) => {
    const { cluster, extension, storageParameters = {} } = options;
    const clauses = [];
    if (cluster !== void 0) {
      if (cluster) {
        clauses.push(`CLUSTER ON ${mOptions.literal(cluster)}`);
      } else {
        clauses.push("SET WITHOUT CLUSTER");
      }
    }
    if (extension) {
      clauses.push(`DEPENDS ON EXTENSION ${mOptions.literal(extension)}`);
    }
    const withOptions = Object.keys(storageParameters).filter((key) => storageParameters[key] !== null).map(storageParameterStr(storageParameters)).join(", ");
    if (withOptions) {
      clauses.push(`SET (${withOptions})`);
    }
    const resetOptions = Object.keys(storageParameters).filter((key) => storageParameters[key] === null).join(", ");
    if (resetOptions) {
      clauses.push(`RESET (${resetOptions})`);
    }
    const clausesStr = formatLines(clauses);
    const viewNameStr = mOptions.literal(viewName);
    return `ALTER MATERIALIZED VIEW ${viewNameStr}
${clausesStr};`;
  };
  return _alter;
}

// src/operations/materializedViews/dropMaterializedView.ts
function dropMaterializedView(mOptions) {
  const _drop = (viewName, options = {}) => {
    const { ifExists = false, cascade = false } = options;
    const ifExistsStr = ifExists ? " IF EXISTS" : "";
    const cascadeStr = cascade ? " CASCADE" : "";
    const viewNameStr = mOptions.literal(viewName);
    return `DROP MATERIALIZED VIEW${ifExistsStr} ${viewNameStr}${cascadeStr};`;
  };
  return _drop;
}

// src/operations/materializedViews/createMaterializedView.ts
function createMaterializedView(mOptions) {
  const _create = (viewName, options, definition) => {
    const {
      ifNotExists = false,
      columns = [],
      tablespace,
      storageParameters = {},
      data
    } = options;
    const columnNames = toArray(columns).map(mOptions.literal).join(", ");
    const withOptions = Object.keys(storageParameters).map(storageParameterStr(storageParameters)).join(", ");
    const ifNotExistsStr = ifNotExists ? " IF NOT EXISTS" : "";
    const columnsStr = columnNames ? `(${columnNames})` : "";
    const withOptionsStr = withOptions ? ` WITH (${withOptions})` : "";
    const tablespaceStr = tablespace ? ` TABLESPACE ${mOptions.literal(tablespace)}` : "";
    const dataStr = dataClause(data);
    const viewNameStr = mOptions.literal(viewName);
    return `CREATE MATERIALIZED VIEW${ifNotExistsStr} ${viewNameStr}${columnsStr}${withOptionsStr}${tablespaceStr} AS ${definition}${dataStr};`;
  };
  _create.reverse = dropMaterializedView(mOptions);
  return _create;
}

// src/operations/materializedViews/refreshMaterializedView.ts
function refreshMaterializedView(mOptions) {
  const _refresh = (viewName, options = {}) => {
    const { concurrently = false, data } = options;
    const concurrentlyStr = concurrently ? " CONCURRENTLY" : "";
    const dataStr = dataClause(data);
    const viewNameStr = mOptions.literal(viewName);
    return `REFRESH MATERIALIZED VIEW${concurrentlyStr} ${viewNameStr}${dataStr};`;
  };
  _refresh.reverse = _refresh;
  return _refresh;
}

// src/operations/materializedViews/renameMaterializedView.ts
function renameMaterializedView(mOptions) {
  const _rename = (viewName, newViewName) => {
    const viewNameStr = mOptions.literal(viewName);
    const newViewNameStr = mOptions.literal(newViewName);
    return `ALTER MATERIALIZED VIEW ${viewNameStr} RENAME TO ${newViewNameStr};`;
  };
  _rename.reverse = (viewName, newViewName) => _rename(newViewName, viewName);
  return _rename;
}

// src/operations/materializedViews/renameMaterializedViewColumn.ts
function renameMaterializedViewColumn(mOptions) {
  const _rename = (viewName, columnName, newColumnName) => {
    const viewNameStr = mOptions.literal(viewName);
    const columnNameStr = mOptions.literal(columnName);
    const newColumnNameStr = mOptions.literal(newColumnName);
    return `ALTER MATERIALIZED VIEW ${viewNameStr} RENAME COLUMN ${columnNameStr} TO ${newColumnNameStr};`;
  };
  _rename.reverse = (viewName, columnName, newColumnName) => _rename(viewName, newColumnName, columnName);
  return _rename;
}

// src/operations/operators/shared.ts
function operatorMap(mOptions) {
  return ({ type, number, name, params = [] }) => {
    const nameStr = mOptions.literal(name);
    if (String(type).toLowerCase() === "operator") {
      if (params.length > 2) {
        throw new Error("Operator can't have more than 2 parameters");
      }
      const paramsStr = params.length > 0 ? formatParams(params, mOptions) : "";
      return `OPERATOR ${number} ${nameStr}${paramsStr}`;
    }
    if (String(type).toLowerCase() === "function") {
      const paramsStr = formatParams(params, mOptions);
      return `FUNCTION ${number} ${nameStr}${paramsStr}`;
    }
    throw new Error('Operator "type" must be either "function" or "operator"');
  };
}

// src/operations/operators/removeFromOperatorFamily.ts
var removeFromOperatorFamily = (mOptions) => {
  const method = (operatorFamilyName, indexMethod, operatorList) => {
    const operatorFamilyNameStr = mOptions.literal(operatorFamilyName);
    const operatorListStr = operatorList.map(operatorMap(mOptions)).join(",\n  ");
    return `ALTER OPERATOR FAMILY ${operatorFamilyNameStr} USING ${indexMethod} DROP
  ${operatorListStr};`;
  };
  return method;
};

// src/operations/operators/addToOperatorFamily.ts
var addToOperatorFamily = (mOptions) => {
  const method = (operatorFamilyName, indexMethod, operatorList) => {
    const operatorFamilyNameStr = mOptions.literal(operatorFamilyName);
    const operatorListStr = operatorList.map(operatorMap(mOptions)).join(",\n  ");
    return `ALTER OPERATOR FAMILY ${operatorFamilyNameStr} USING ${indexMethod} ADD
  ${operatorListStr};`;
  };
  method.reverse = removeFromOperatorFamily(mOptions);
  return method;
};

// src/operations/operators/dropOperator.ts
function dropOperator(mOptions) {
  const _drop = (operatorName, options = {}) => {
    const {
      left = "none",
      right = "none",
      ifExists = false,
      cascade = false
    } = options;
    const operatorNameStr = mOptions.schemalize(operatorName);
    const leftStr = mOptions.literal(left);
    const rightStr = mOptions.literal(right);
    const ifExistsStr = ifExists ? " IF EXISTS" : "";
    const cascadeStr = cascade ? " CASCADE" : "";
    return `DROP OPERATOR${ifExistsStr} ${operatorNameStr}(${leftStr}, ${rightStr})${cascadeStr};`;
  };
  return _drop;
}

// src/operations/operators/createOperator.ts
function createOperator(mOptions) {
  const _create = (operatorName, options) => {
    const {
      procedure,
      left,
      right,
      commutator,
      negator,
      restrict,
      join: join2,
      hashes = false,
      merges = false
    } = options;
    const defs = [];
    defs.push(`PROCEDURE = ${mOptions.literal(procedure)}`);
    if (left) {
      defs.push(`LEFTARG = ${mOptions.literal(left)}`);
    }
    if (right) {
      defs.push(`RIGHTARG = ${mOptions.literal(right)}`);
    }
    if (commutator) {
      defs.push(`COMMUTATOR = ${mOptions.schemalize(commutator)}`);
    }
    if (negator) {
      defs.push(`NEGATOR = ${mOptions.schemalize(negator)}`);
    }
    if (restrict) {
      defs.push(`RESTRICT = ${mOptions.literal(restrict)}`);
    }
    if (join2) {
      defs.push(`JOIN = ${mOptions.literal(join2)}`);
    }
    if (hashes) {
      defs.push("HASHES");
    }
    if (merges) {
      defs.push("MERGES");
    }
    const operatorNameStr = mOptions.schemalize(operatorName);
    return `CREATE OPERATOR ${operatorNameStr} (${defs.join(", ")});`;
  };
  _create.reverse = dropOperator(mOptions);
  return _create;
}

// src/operations/operators/dropOperatorClass.ts
function dropOperatorClass(mOptions) {
  const _drop = (operatorClassName, indexMethod, options = {}) => {
    const { ifExists = false, cascade = false } = options;
    const operatorClassNameStr = mOptions.literal(operatorClassName);
    const ifExistsStr = ifExists ? " IF EXISTS" : "";
    const cascadeStr = cascade ? " CASCADE" : "";
    return `DROP OPERATOR CLASS${ifExistsStr} ${operatorClassNameStr} USING ${indexMethod}${cascadeStr};`;
  };
  return _drop;
}

// src/operations/operators/createOperatorClass.ts
function createOperatorClass(mOptions) {
  const _create = (operatorClassName, type, indexMethod, operatorList, options) => {
    const { default: isDefault, family } = options;
    const operatorClassNameStr = mOptions.literal(operatorClassName);
    const defaultStr = isDefault ? " DEFAULT" : "";
    const typeStr = mOptions.literal(applyType(type).type);
    const indexMethodStr = mOptions.literal(indexMethod);
    const familyStr = family ? ` FAMILY ${family}` : "";
    const operatorListStr = operatorList.map(operatorMap(mOptions)).join(",\n  ");
    return `CREATE OPERATOR CLASS ${operatorClassNameStr}${defaultStr} FOR TYPE ${typeStr} USING ${indexMethodStr}${familyStr} AS
  ${operatorListStr};`;
  };
  _create.reverse = (operatorClassName, type, indexMethod, operatorList, options) => dropOperatorClass(mOptions)(operatorClassName, indexMethod, options);
  return _create;
}

// src/operations/operators/dropOperatorFamily.ts
function dropOperatorFamily(mOptions) {
  const _drop = (operatorFamilyName, indexMethod, options = {}) => {
    const { ifExists = false, cascade = false } = options;
    const operatorFamilyNameStr = mOptions.literal(operatorFamilyName);
    const ifExistsStr = ifExists ? " IF EXISTS" : "";
    const cascadeStr = cascade ? " CASCADE" : "";
    return `DROP OPERATOR FAMILY${ifExistsStr} ${operatorFamilyNameStr} USING ${indexMethod}${cascadeStr};`;
  };
  return _drop;
}

// src/operations/operators/createOperatorFamily.ts
function createOperatorFamily(mOptions) {
  const _create = (operatorFamilyName, indexMethod) => {
    const operatorFamilyNameStr = mOptions.literal(operatorFamilyName);
    return `CREATE OPERATOR FAMILY ${operatorFamilyNameStr} USING ${indexMethod};`;
  };
  _create.reverse = dropOperatorFamily(mOptions);
  return _create;
}

// src/operations/operators/renameOperatorClass.ts
function renameOperatorClass(mOptions) {
  const _rename = (oldOperatorClassName, indexMethod, newOperatorClassName) => {
    const oldOperatorClassNameStr = mOptions.literal(oldOperatorClassName);
    const newOperatorClassNameStr = mOptions.literal(newOperatorClassName);
    return `ALTER OPERATOR CLASS ${oldOperatorClassNameStr} USING ${indexMethod} RENAME TO ${newOperatorClassNameStr};`;
  };
  _rename.reverse = (oldOperatorClassName, indexMethod, newOperatorClassName) => _rename(newOperatorClassName, indexMethod, oldOperatorClassName);
  return _rename;
}

// src/operations/operators/renameOperatorFamily.ts
function renameOperatorFamily(mOptions) {
  const _rename = (oldOperatorFamilyName, indexMethod, newOperatorFamilyName) => {
    const oldOperatorFamilyNameStr = mOptions.literal(oldOperatorFamilyName);
    const newOperatorFamilyNameStr = mOptions.literal(newOperatorFamilyName);
    return `ALTER OPERATOR FAMILY ${oldOperatorFamilyNameStr} USING ${indexMethod} RENAME TO ${newOperatorFamilyNameStr};`;
  };
  _rename.reverse = (oldOperatorFamilyName, indexMethod, newOperatorFamilyName) => _rename(newOperatorFamilyName, indexMethod, oldOperatorFamilyName);
  return _rename;
}

// src/operations/policies/shared.ts
function makeClauses({ role, using, check }) {
  const roles = toArray(role).join(", ");
  const clauses = [];
  if (roles) {
    clauses.push(`TO ${roles}`);
  }
  if (using) {
    clauses.push(`USING (${using})`);
  }
  if (check) {
    clauses.push(`WITH CHECK (${check})`);
  }
  return clauses;
}

// src/operations/policies/alterPolicy.ts
function alterPolicy(mOptions) {
  const _alter = (tableName, policyName, options = {}) => {
    const clausesStr = makeClauses(options).join(" ");
    const policyNameStr = mOptions.literal(policyName);
    const tableNameStr = mOptions.literal(tableName);
    return `ALTER POLICY ${policyNameStr} ON ${tableNameStr} ${clausesStr};`;
  };
  return _alter;
}

// src/operations/policies/dropPolicy.ts
function dropPolicy(mOptions) {
  const _drop = (tableName, policyName, options = {}) => {
    const { ifExists = false } = options;
    const ifExistsStr = ifExists ? " IF EXISTS" : "";
    const policyNameStr = mOptions.literal(policyName);
    const tableNameStr = mOptions.literal(tableName);
    return `DROP POLICY${ifExistsStr} ${policyNameStr} ON ${tableNameStr};`;
  };
  return _drop;
}

// src/operations/policies/createPolicy.ts
function createPolicy(mOptions) {
  const _create = (tableName, policyName, options = {}) => {
    const { role = "PUBLIC", command = "ALL" } = options;
    const createOptions = {
      ...options,
      role
    };
    const clauses = [`FOR ${command}`, ...makeClauses(createOptions)];
    const clausesStr = clauses.join(" ");
    const policyNameStr = mOptions.literal(policyName);
    const tableNameStr = mOptions.literal(tableName);
    return `CREATE POLICY ${policyNameStr} ON ${tableNameStr} ${clausesStr};`;
  };
  _create.reverse = dropPolicy(mOptions);
  return _create;
}

// src/operations/policies/renamePolicy.ts
function renamePolicy(mOptions) {
  const _rename = (tableName, policyName, newPolicyName) => {
    const policyNameStr = mOptions.literal(policyName);
    const newPolicyNameStr = mOptions.literal(newPolicyName);
    const tableNameStr = mOptions.literal(tableName);
    return `ALTER POLICY ${policyNameStr} ON ${tableNameStr} RENAME TO ${newPolicyNameStr};`;
  };
  _rename.reverse = (tableName, policyName, newPolicyName) => _rename(tableName, newPolicyName, policyName);
  return _rename;
}

// src/operations/roles/shared.ts
function formatRoleOptions(roleOptions = {}) {
  const options = [];
  if (roleOptions.superuser !== void 0) {
    options.push(roleOptions.superuser ? "SUPERUSER" : "NOSUPERUSER");
  }
  if (roleOptions.createdb !== void 0) {
    options.push(roleOptions.createdb ? "CREATEDB" : "NOCREATEDB");
  }
  if (roleOptions.createrole !== void 0) {
    options.push(roleOptions.createrole ? "CREATEROLE" : "NOCREATEROLE");
  }
  if (roleOptions.inherit !== void 0) {
    options.push(roleOptions.inherit ? "INHERIT" : "NOINHERIT");
  }
  if (roleOptions.login !== void 0) {
    options.push(roleOptions.login ? "LOGIN" : "NOLOGIN");
  }
  if (roleOptions.replication !== void 0) {
    options.push(roleOptions.replication ? "REPLICATION" : "NOREPLICATION");
  }
  if (roleOptions.bypassrls !== void 0) {
    options.push(roleOptions.bypassrls ? "BYPASSRLS" : "NOBYPASSRLS");
  }
  if (roleOptions.limit) {
    options.push(`CONNECTION LIMIT ${Number(roleOptions.limit)}`);
  }
  if (roleOptions.password !== void 0) {
    const encrypted = roleOptions.encrypted === false ? "UNENCRYPTED" : "ENCRYPTED";
    options.push(`${encrypted} PASSWORD ${escapeValue(roleOptions.password)}`);
  }
  if (roleOptions.valid !== void 0) {
    const valid = roleOptions.valid ? escapeValue(roleOptions.valid) : "'infinity'";
    options.push(`VALID UNTIL ${valid}`);
  }
  if (roleOptions.inRole) {
    const inRole = toArray(roleOptions.inRole).join(", ");
    options.push(`IN ROLE ${inRole}`);
  }
  if (roleOptions.role) {
    const role = toArray(roleOptions.role).join(", ");
    options.push(`ROLE ${role}`);
  }
  if (roleOptions.admin) {
    const admin = toArray(roleOptions.admin).join(", ");
    options.push(`ADMIN ${admin}`);
  }
  return options.join(" ");
}

// src/operations/roles/alterRole.ts
function alterRole(mOptions) {
  const _alter = (roleName, roleOptions = {}) => {
    const options = formatRoleOptions(roleOptions);
    return options ? `ALTER ROLE ${mOptions.literal(roleName)} WITH ${options};` : "";
  };
  return _alter;
}

// src/operations/roles/dropRole.ts
function dropRole(mOptions) {
  const _drop = (roleName, options = {}) => {
    const { ifExists = false } = options;
    const ifExistsStr = ifExists ? " IF EXISTS" : "";
    const roleNameStr = mOptions.literal(roleName);
    return `DROP ROLE${ifExistsStr} ${roleNameStr};`;
  };
  return _drop;
}

// src/operations/roles/createRole.ts
function createRole(mOptions) {
  const _create = (roleName, roleOptions = {}) => {
    const options = formatRoleOptions({
      ...roleOptions,
      superuser: roleOptions.superuser || false,
      createdb: roleOptions.createdb || false,
      createrole: roleOptions.createrole || false,
      inherit: roleOptions.inherit !== false,
      login: roleOptions.login || false,
      replication: roleOptions.replication || false
    });
    const optionsStr = options ? ` WITH ${options}` : "";
    return `CREATE ROLE ${mOptions.literal(roleName)}${optionsStr};`;
  };
  _create.reverse = dropRole(mOptions);
  return _create;
}

// src/operations/roles/renameRole.ts
function renameRole(mOptions) {
  const _rename = (oldRoleName, newRoleName) => {
    const oldRoleNameStr = mOptions.literal(oldRoleName);
    const newRoleNameStr = mOptions.literal(newRoleName);
    return `ALTER ROLE ${oldRoleNameStr} RENAME TO ${newRoleNameStr};`;
  };
  _rename.reverse = (oldRoleName, newRoleName) => _rename(newRoleName, oldRoleName);
  return _rename;
}

// src/operations/schemas/dropSchema.ts
function dropSchema(mOptions) {
  const _drop = (schemaName, options = {}) => {
    const { ifExists = false, cascade = false } = options;
    const ifExistsStr = ifExists ? " IF EXISTS" : "";
    const cascadeStr = cascade ? " CASCADE" : "";
    const schemaNameStr = mOptions.literal(schemaName);
    return `DROP SCHEMA${ifExistsStr} ${schemaNameStr}${cascadeStr};`;
  };
  return _drop;
}

// src/operations/schemas/createSchema.ts
function createSchema(mOptions) {
  const _create = (schemaName, options = {}) => {
    const { ifNotExists = false, authorization } = options;
    const ifNotExistsStr = ifNotExists ? " IF NOT EXISTS" : "";
    const schemaNameStr = mOptions.literal(schemaName);
    const authorizationStr = authorization ? ` AUTHORIZATION ${authorization}` : "";
    return `CREATE SCHEMA${ifNotExistsStr} ${schemaNameStr}${authorizationStr};`;
  };
  _create.reverse = dropSchema(mOptions);
  return _create;
}

// src/operations/schemas/renameSchema.ts
function renameSchema(mOptions) {
  const _rename = (schemaName, newSchemaName) => {
    const schemaNameStr = mOptions.literal(schemaName);
    const newSchemaNameStr = mOptions.literal(newSchemaName);
    return `ALTER SCHEMA ${schemaNameStr} RENAME TO ${newSchemaNameStr};`;
  };
  _rename.reverse = (schemaName, newSchemaName) => _rename(newSchemaName, schemaName);
  return _rename;
}

// src/operations/sequences/shared.ts
function parseSequenceOptions(typeShorthands, options) {
  const { type, increment, minvalue, maxvalue, start, cache, cycle, owner } = options;
  const clauses = [];
  if (type) {
    clauses.push(`AS ${applyType(type, typeShorthands).type}`);
  }
  if (increment) {
    clauses.push(`INCREMENT BY ${increment}`);
  }
  if (minvalue) {
    clauses.push(`MINVALUE ${minvalue}`);
  } else if (minvalue === null || minvalue === false) {
    clauses.push("NO MINVALUE");
  }
  if (maxvalue) {
    clauses.push(`MAXVALUE ${maxvalue}`);
  } else if (maxvalue === null || maxvalue === false) {
    clauses.push("NO MAXVALUE");
  }
  if (start) {
    clauses.push(`START WITH ${start}`);
  }
  if (cache) {
    clauses.push(`CACHE ${cache}`);
  }
  if (cycle) {
    clauses.push("CYCLE");
  } else if (cycle === false) {
    clauses.push("NO CYCLE");
  }
  if (owner) {
    clauses.push(`OWNED BY ${owner}`);
  } else if (owner === null || owner === false) {
    clauses.push("OWNED BY NONE");
  }
  return clauses;
}

// src/operations/sequences/alterSequence.ts
function alterSequence(mOptions) {
  return (sequenceName, options) => {
    const { restart } = options;
    const clauses = parseSequenceOptions(mOptions.typeShorthands, options);
    if (restart) {
      if (restart === true) {
        clauses.push("RESTART");
      } else {
        clauses.push(`RESTART WITH ${restart}`);
      }
    }
    return `ALTER SEQUENCE ${mOptions.literal(sequenceName)}
  ${clauses.join("\n  ")};`;
  };
}

// src/operations/sequences/dropSequence.ts
function dropSequence(mOptions) {
  const _drop = (sequenceName, options = {}) => {
    const { ifExists = false, cascade = false } = options;
    const ifExistsStr = ifExists ? " IF EXISTS" : "";
    const cascadeStr = cascade ? " CASCADE" : "";
    const sequenceNameStr = mOptions.literal(sequenceName);
    return `DROP SEQUENCE${ifExistsStr} ${sequenceNameStr}${cascadeStr};`;
  };
  return _drop;
}

// src/operations/sequences/createSequence.ts
function createSequence(mOptions) {
  const _create = (sequenceName, options = {}) => {
    const { temporary = false, ifNotExists = false } = options;
    const temporaryStr = temporary ? " TEMPORARY" : "";
    const ifNotExistsStr = ifNotExists ? " IF NOT EXISTS" : "";
    const sequenceNameStr = mOptions.literal(sequenceName);
    const clausesStr = parseSequenceOptions(
      mOptions.typeShorthands,
      options
    ).join("\n  ");
    return `CREATE${temporaryStr} SEQUENCE${ifNotExistsStr} ${sequenceNameStr}
  ${clausesStr};`;
  };
  _create.reverse = dropSequence(mOptions);
  return _create;
}

// src/operations/sequences/renameSequence.ts
function renameSequence(mOptions) {
  const _rename = (sequenceName, newSequenceName) => {
    const sequenceNameStr = mOptions.literal(sequenceName);
    const newSequenceNameStr = mOptions.literal(newSequenceName);
    return `ALTER SEQUENCE ${sequenceNameStr} RENAME TO ${newSequenceNameStr};`;
  };
  _rename.reverse = (sequenceName, newSequenceName) => _rename(newSequenceName, sequenceName);
  return _rename;
}

// src/operations/sql.ts
function sql(mOptions) {
  const t = createTransformer(mOptions.literal);
  return (sqlStr, args) => {
    let statement = t(sqlStr, args);
    if (statement.lastIndexOf(";") !== statement.length - 1) {
      statement += ";";
    }
    return statement;
  };
}

// src/operations/tables/dropColumns.ts
function dropColumns(mOptions) {
  const _drop = (tableName, columns, options = {}) => {
    const { ifExists = false, cascade = false } = options;
    if (typeof columns === "string") {
      columns = [columns];
    } else if (!Array.isArray(columns) && typeof columns === "object") {
      columns = Object.keys(columns);
    }
    const ifExistsStr = ifExists ? "IF EXISTS " : "";
    const cascadeStr = cascade ? " CASCADE" : "";
    const lines = columns.map(mOptions.literal).map((column) => `DROP ${ifExistsStr}${column}${cascadeStr}`);
    return `ALTER TABLE ${mOptions.literal(tableName)}
${formatLines(lines)};`;
  };
  return _drop;
}

// src/operations/tables/shared.ts
function parseReferences(options, literal) {
  const { references, match, onDelete, onUpdate } = options;
  const clauses = [];
  clauses.push(
    typeof references === "string" && (references.startsWith('"') || references.endsWith(")")) ? `REFERENCES ${references}` : `REFERENCES ${literal(references)}`
  );
  if (match) {
    clauses.push(`MATCH ${match}`);
  }
  if (onDelete) {
    clauses.push(`ON DELETE ${onDelete}`);
  }
  if (onUpdate) {
    clauses.push(`ON UPDATE ${onUpdate}`);
  }
  return clauses.join(" ");
}
function parseDeferrable(options) {
  return `DEFERRABLE INITIALLY ${options.deferred ? "DEFERRED" : "IMMEDIATE"}`;
}
function parseColumns(tableName, columns, mOptions) {
  const extendingTypeShorthands = mOptions.typeShorthands;
  let columnsWithOptions = Object.keys(columns).reduce(
    (previous, column) => ({
      ...previous,
      [column]: applyType(columns[column], extendingTypeShorthands)
    }),
    {}
  );
  const primaryColumns = Object.entries(columnsWithOptions).filter(([, { primaryKey }]) => Boolean(primaryKey)).map(([columnName]) => columnName);
  const multiplePrimaryColumns = primaryColumns.length > 1;
  if (multiplePrimaryColumns) {
    columnsWithOptions = Object.fromEntries(
      Object.entries(columnsWithOptions).map(([columnName, options]) => [
        columnName,
        {
          ...options,
          primaryKey: false
        }
      ])
    );
  }
  const comments = Object.entries(columnsWithOptions).map(([columnName, { comment }]) => {
    return comment !== void 0 && makeComment(
      "COLUMN",
      `${mOptions.literal(tableName)}.${mOptions.literal(columnName)}`,
      comment
    );
  }).filter((comment) => Boolean(comment));
  return {
    columns: Object.entries(columnsWithOptions).map(([columnName, options]) => {
      const {
        type,
        collation,
        default: defaultValue,
        unique,
        primaryKey,
        notNull,
        check,
        references,
        referencesConstraintName,
        referencesConstraintComment,
        deferrable,
        expressionGenerated
      } = options;
      const sequenceGenerated = options.sequenceGenerated === void 0 ? options.generated : options.sequenceGenerated;
      const constraints = [];
      if (collation) {
        constraints.push(`COLLATE ${collation}`);
      }
      if (defaultValue !== void 0) {
        constraints.push(`DEFAULT ${escapeValue(defaultValue)}`);
      }
      if (unique) {
        constraints.push("UNIQUE");
      }
      if (primaryKey) {
        constraints.push("PRIMARY KEY");
      }
      if (notNull) {
        constraints.push("NOT NULL");
      }
      if (check) {
        constraints.push(`CHECK (${check})`);
      }
      if (references) {
        const name = referencesConstraintName || (referencesConstraintComment ? `${tableName}_fk_${columnName}` : "");
        const constraintName = name ? `CONSTRAINT ${mOptions.literal(name)} ` : "";
        constraints.push(
          `${constraintName}${parseReferences(options, mOptions.literal)}`
        );
        if (referencesConstraintComment) {
          comments.push(
            makeComment(
              `CONSTRAINT ${mOptions.literal(name)} ON`,
              mOptions.literal(tableName),
              referencesConstraintComment
            )
          );
        }
      }
      if (deferrable) {
        constraints.push(parseDeferrable(options));
      }
      if (sequenceGenerated) {
        const sequenceOptions = parseSequenceOptions(
          extendingTypeShorthands,
          sequenceGenerated
        ).join(" ");
        constraints.push(
          `GENERATED ${sequenceGenerated.precedence} AS IDENTITY${sequenceOptions ? ` (${sequenceOptions})` : ""}`
        );
      }
      if (expressionGenerated) {
        constraints.push(`GENERATED ALWAYS AS (${expressionGenerated}) STORED`);
      }
      const constraintsStr = constraints.length > 0 ? ` ${constraints.join(" ")}` : "";
      const sType = typeof type === "object" ? mOptions.literal(type) : type;
      return `${mOptions.literal(columnName)} ${sType}${constraintsStr}`;
    }),
    constraints: multiplePrimaryColumns ? { primaryKey: primaryColumns } : {},
    comments
  };
}
function parseConstraints(table, options, optionName, literal) {
  const {
    check,
    unique,
    primaryKey,
    foreignKeys,
    exclude,
    deferrable,
    comment
  } = options;
  const tableName = typeof table === "object" ? table.name : table;
  let constraints = [];
  const comments = [];
  if (check) {
    if (Array.isArray(check)) {
      for (const [i, ch] of check.entries()) {
        const name = literal(optionName || `${tableName}_chck_${i + 1}`);
        constraints.push(`CONSTRAINT ${name} CHECK (${ch})`);
      }
    } else {
      const name = literal(optionName || `${tableName}_chck`);
      constraints.push(`CONSTRAINT ${name} CHECK (${check})`);
    }
  }
  if (unique) {
    const uniqueArray = toArray(unique);
    const isArrayOfArrays = uniqueArray.some(
      (uniqueSet) => Array.isArray(uniqueSet)
    );
    for (const uniqueSet of isArrayOfArrays ? uniqueArray : [uniqueArray]) {
      const cols = toArray(uniqueSet);
      const name = literal(optionName || `${tableName}_uniq_${cols.join("_")}`);
      constraints.push(
        `CONSTRAINT ${name} UNIQUE (${cols.map(literal).join(", ")})`
      );
    }
  }
  if (primaryKey) {
    const name = literal(optionName || `${tableName}_pkey`);
    const key = toArray(primaryKey).map(literal).join(", ");
    constraints.push(`CONSTRAINT ${name} PRIMARY KEY (${key})`);
  }
  if (foreignKeys) {
    for (const fk of toArray(foreignKeys)) {
      const { columns, referencesConstraintName, referencesConstraintComment } = fk;
      const cols = toArray(columns);
      const name = literal(
        referencesConstraintName || optionName || `${tableName}_fk_${cols.join("_")}`
      );
      const key = cols.map(literal).join(", ");
      const referencesStr = parseReferences(fk, literal);
      constraints.push(
        `CONSTRAINT ${name} FOREIGN KEY (${key}) ${referencesStr}`
      );
      if (referencesConstraintComment) {
        comments.push(
          makeComment(
            `CONSTRAINT ${name} ON`,
            literal(table),
            referencesConstraintComment
          )
        );
      }
    }
  }
  if (exclude) {
    const name = literal(optionName || `${tableName}_excl`);
    constraints.push(`CONSTRAINT ${name} EXCLUDE ${exclude}`);
  }
  if (deferrable) {
    constraints = constraints.map(
      (constraint) => `${constraint} ${parseDeferrable(options)}`
    );
  }
  if (comment) {
    if (!optionName) {
      throw new Error("cannot comment on unspecified constraints");
    }
    comments.push(
      makeComment(
        `CONSTRAINT ${literal(optionName)} ON`,
        literal(table),
        comment
      )
    );
  }
  return {
    constraints,
    comments
  };
}
function parseLike(like, literal) {
  const formatOptions = (name, options2) => toArray(options2).filter((option) => option !== void 0).map((option) => ` ${name} ${option}`).join("");
  const table = typeof like === "string" || !("table" in like) ? like : like.table;
  const options = typeof like === "string" || !("options" in like) || like.options === void 0 ? "" : [
    formatOptions("INCLUDING", like.options.including),
    formatOptions("EXCLUDING", like.options.excluding)
  ].join("");
  return `LIKE ${literal(table)}${options}`;
}

// src/operations/tables/addColumns.ts
function addColumns(mOptions) {
  const _add = (tableName, columns, options = {}) => {
    const { ifNotExists = false } = options;
    const { columns: columnLines, comments: columnComments = [] } = parseColumns(tableName, columns, mOptions);
    const ifNotExistsStr = ifNotExists ? "IF NOT EXISTS " : "";
    const columnsStr = formatLines(columnLines, `  ADD ${ifNotExistsStr}`);
    const tableNameStr = mOptions.literal(tableName);
    const alterTableQuery = `ALTER TABLE ${tableNameStr}
${columnsStr};`;
    const columnCommentsStr = columnComments.length > 0 ? `
${columnComments.join("\n")}` : "";
    return `${alterTableQuery}${columnCommentsStr}`;
  };
  _add.reverse = dropColumns(mOptions);
  return _add;
}

// src/operations/tables/dropConstraint.ts
function dropConstraint(mOptions) {
  const _drop = (tableName, constraintName, options = {}) => {
    const { ifExists = false, cascade = false } = options;
    const ifExistsStr = ifExists ? " IF EXISTS" : "";
    const cascadeStr = cascade ? " CASCADE" : "";
    const tableNameStr = mOptions.literal(tableName);
    const constraintNameStr = mOptions.literal(constraintName);
    return `ALTER TABLE ${tableNameStr} DROP CONSTRAINT${ifExistsStr} ${constraintNameStr}${cascadeStr};`;
  };
  return _drop;
}

// src/operations/tables/addConstraint.ts
function addConstraint(mOptions) {
  const _add = (tableName, constraintName, expressionOrOptions) => {
    const { constraints, comments } = typeof expressionOrOptions === "string" ? {
      constraints: [
        `${constraintName ? `CONSTRAINT ${mOptions.literal(constraintName)} ` : ""}${expressionOrOptions}`
      ],
      comments: []
    } : parseConstraints(
      tableName,
      expressionOrOptions,
      constraintName,
      mOptions.literal
    );
    const constraintStr = formatLines(constraints, "  ADD ");
    return [
      `ALTER TABLE ${mOptions.literal(tableName)}
${constraintStr};`,
      ...comments
    ].join("\n");
  };
  _add.reverse = (tableName, constraintName, expressionOrOptions) => {
    if (constraintName === null) {
      throw new Error(
        "Impossible to automatically infer down migration for addConstraint without naming constraint"
      );
    }
    if (typeof expressionOrOptions === "string") {
      throw new Error(
        "Impossible to automatically infer down migration for addConstraint with raw SQL expression"
      );
    }
    return dropConstraint(mOptions)(
      tableName,
      constraintName,
      expressionOrOptions
    );
  };
  return _add;
}

// src/operations/tables/alterColumn.ts
function alterColumn(mOptions) {
  return (tableName, columnName, options) => {
    const {
      default: defaultValue,
      type,
      collation,
      using,
      notNull,
      allowNull,
      comment
    } = options;
    const sequenceGenerated = options.sequenceGenerated === void 0 ? options.generated : options.sequenceGenerated;
    const actions = [];
    if (defaultValue === null) {
      actions.push("DROP DEFAULT");
    } else if (defaultValue !== void 0) {
      actions.push(`SET DEFAULT ${escapeValue(defaultValue)}`);
    }
    if (type) {
      const typeStr = applyTypeAdapters(type);
      const collationStr = collation ? ` COLLATE ${collation}` : "";
      const usingStr = using ? ` USING ${using}` : "";
      actions.push(`SET DATA TYPE ${typeStr}${collationStr}${usingStr}`);
    }
    if (notNull) {
      actions.push("SET NOT NULL");
    } else if (notNull === false || allowNull) {
      actions.push("DROP NOT NULL");
    }
    if (sequenceGenerated !== void 0) {
      if (sequenceGenerated) {
        const sequenceOptions = parseSequenceOptions(
          mOptions.typeShorthands,
          sequenceGenerated
        ).join(" ");
        actions.push(
          `ADD GENERATED ${sequenceGenerated.precedence} AS IDENTITY${sequenceOptions ? ` (${sequenceOptions})` : ""}`
        );
      } else {
        actions.push("DROP IDENTITY");
      }
    }
    const queries = [];
    if (actions.length > 0) {
      const columnsStr = formatLines(
        actions,
        `  ALTER ${mOptions.literal(columnName)} `
      );
      queries.push(
        `ALTER TABLE ${mOptions.literal(tableName)}
${columnsStr};`
      );
    }
    if (comment !== void 0) {
      queries.push(
        makeComment(
          "COLUMN",
          `${mOptions.literal(tableName)}.${mOptions.literal(columnName)}`,
          comment
        )
      );
    }
    return queries.join("\n");
  };
}

// src/operations/tables/alterTable.ts
function alterTable(mOptions) {
  const _alter = (tableName, options) => {
    const { levelSecurity } = options;
    const alterDefinition = [];
    if (levelSecurity) {
      alterDefinition.push(`${levelSecurity} ROW LEVEL SECURITY`);
    }
    return `ALTER TABLE ${mOptions.literal(tableName)}
  ${formatLines(alterDefinition)};`;
  };
  return _alter;
}

// src/operations/tables/dropTable.ts
function dropTable(mOptions) {
  const _drop = (tableName, options = {}) => {
    const { ifExists = false, cascade = false } = options;
    const ifExistsStr = ifExists ? " IF EXISTS" : "";
    const cascadeStr = cascade ? " CASCADE" : "";
    const tableNameStr = mOptions.literal(tableName);
    return `DROP TABLE${ifExistsStr} ${tableNameStr}${cascadeStr};`;
  };
  return _drop;
}

// src/operations/tables/createTable.ts
function createTable(mOptions) {
  const _create = (tableName, columns, options = {}) => {
    const {
      temporary = false,
      ifNotExists = false,
      inherits,
      like,
      constraints: optionsConstraints = {},
      comment
    } = options;
    const {
      columns: columnLines,
      constraints: crossColumnConstraints,
      comments: columnComments = []
    } = parseColumns(tableName, columns, mOptions);
    const dupes = intersection(
      Object.keys(optionsConstraints),
      Object.keys(crossColumnConstraints)
    );
    if (dupes.length > 0) {
      const dupesStr = dupes.join(", ");
      throw new Error(
        `There is duplicate constraint definition in table and columns options: ${dupesStr}`
      );
    }
    const constraints = {
      ...optionsConstraints,
      ...crossColumnConstraints
    };
    const { constraints: constraintLines, comments: constraintComments } = parseConstraints(tableName, constraints, "", mOptions.literal);
    const tableDefinition = [
      ...columnLines,
      ...constraintLines,
      ...like ? [parseLike(like, mOptions.literal)] : []
    ];
    const temporaryStr = temporary ? " TEMPORARY" : "";
    const ifNotExistsStr = ifNotExists ? " IF NOT EXISTS" : "";
    const inheritsStr = inherits ? ` INHERITS (${mOptions.literal(inherits)})` : "";
    const tableNameStr = mOptions.literal(tableName);
    const createTableQuery = `CREATE${temporaryStr} TABLE${ifNotExistsStr} ${tableNameStr} (
${formatLines(tableDefinition)}
)${inheritsStr};`;
    const comments = [...columnComments, ...constraintComments];
    if (comment !== void 0) {
      comments.push(makeComment("TABLE", mOptions.literal(tableName), comment));
    }
    return `${createTableQuery}${comments.length > 0 ? `
${comments.join("\n")}` : ""}`;
  };
  _create.reverse = dropTable(mOptions);
  return _create;
}

// src/operations/tables/renameColumn.ts
function renameColumn(mOptions) {
  const _rename = (tableName, columnName, newName) => {
    const tableNameStr = mOptions.literal(tableName);
    const columnNameStr = mOptions.literal(columnName);
    const newNameStr = mOptions.literal(newName);
    return `ALTER TABLE ${tableNameStr} RENAME ${columnNameStr} TO ${newNameStr};`;
  };
  _rename.reverse = (tableName, columnName, newName) => _rename(tableName, newName, columnName);
  return _rename;
}

// src/operations/tables/renameConstraint.ts
function renameConstraint(mOptions) {
  const _rename = (tableName, constraintName, newName) => {
    const tableNameStr = mOptions.literal(tableName);
    const constraintNameStr = mOptions.literal(constraintName);
    const newNameStr = mOptions.literal(newName);
    return `ALTER TABLE ${tableNameStr} RENAME CONSTRAINT ${constraintNameStr} TO ${newNameStr};`;
  };
  _rename.reverse = (tableName, constraintName, newName) => _rename(tableName, newName, constraintName);
  return _rename;
}

// src/operations/tables/renameTable.ts
function renameTable(mOptions) {
  const _rename = (tableName, newName) => {
    const tableNameStr = mOptions.literal(tableName);
    const newNameStr = mOptions.literal(newName);
    return `ALTER TABLE ${tableNameStr} RENAME TO ${newNameStr};`;
  };
  _rename.reverse = (tableName, newName) => _rename(newName, tableName);
  return _rename;
}

// src/operations/triggers/dropTrigger.ts
function dropTrigger(mOptions) {
  const _drop = (tableName, triggerName, options = {}) => {
    const { ifExists = false, cascade = false } = options;
    const ifExistsStr = ifExists ? " IF EXISTS" : "";
    const cascadeStr = cascade ? " CASCADE" : "";
    const triggerNameStr = mOptions.literal(triggerName);
    const tableNameStr = mOptions.literal(tableName);
    return `DROP TRIGGER${ifExistsStr} ${triggerNameStr} ON ${tableNameStr}${cascadeStr};`;
  };
  return _drop;
}

// src/operations/triggers/createTrigger.ts
function createTrigger(mOptions) {
  const _create = (tableName, triggerName, triggerOptions, definition) => {
    const {
      constraint = false,
      condition,
      operation,
      deferrable = false,
      deferred = false,
      functionParams = []
    } = triggerOptions;
    let { when, level = "STATEMENT", function: functionName } = triggerOptions;
    const operations = toArray(operation).join(" OR ");
    if (constraint) {
      when = "AFTER";
    }
    if (!when) {
      throw new Error('"when" (BEFORE/AFTER/INSTEAD OF) have to be specified');
    }
    const isInsteadOf = /instead\s+of/i.test(when);
    if (isInsteadOf) {
      level = "ROW";
    }
    if (definition) {
      functionName = functionName === void 0 ? triggerName : functionName;
    }
    if (!functionName) {
      throw new Error("Can't determine function name");
    }
    if (isInsteadOf && condition) {
      throw new Error("INSTEAD OF trigger can't have condition specified");
    }
    if (!operations) {
      throw new Error(
        '"operation" (INSERT/UPDATE[ OF ...]/DELETE/TRUNCATE) have to be specified'
      );
    }
    const defferStr = constraint ? `${deferrable ? `DEFERRABLE INITIALLY ${deferred ? "DEFERRED" : "IMMEDIATE"}` : "NOT DEFERRABLE"}
  ` : "";
    const conditionClause = condition ? `WHEN (${condition})
  ` : "";
    const constraintStr = constraint ? " CONSTRAINT" : "";
    const paramsStr = functionParams.map(escapeValue).join(", ");
    const triggerNameStr = mOptions.literal(triggerName);
    const tableNameStr = mOptions.literal(tableName);
    const functionNameStr = mOptions.literal(functionName);
    const triggerSQL = `CREATE${constraintStr} TRIGGER ${triggerNameStr}
  ${when} ${operations} ON ${tableNameStr}
  ${defferStr}FOR EACH ${level}
  ${conditionClause}EXECUTE PROCEDURE ${functionNameStr}(${paramsStr});`;
    const fnSQL = definition ? `${createFunction(mOptions)(
      functionName,
      [],
      { ...triggerOptions, returns: "trigger" },
      definition
    )}
` : "";
    return `${fnSQL}${triggerSQL}`;
  };
  _create.reverse = (tableName, triggerName, triggerOptions, definition) => {
    const triggerSQL = dropTrigger(mOptions)(
      tableName,
      triggerName,
      triggerOptions
    );
    const fnSQL = definition ? `
${dropFunction(mOptions)(triggerOptions.function || triggerName, [], triggerOptions)}` : "";
    return `${triggerSQL}${fnSQL}`;
  };
  return _create;
}

// src/operations/triggers/renameTrigger.ts
function renameTrigger(mOptions) {
  const _rename = (tableName, oldTriggerName, newTriggerName) => {
    const oldTriggerNameStr = mOptions.literal(oldTriggerName);
    const tableNameStr = mOptions.literal(tableName);
    const newTriggerNameStr = mOptions.literal(newTriggerName);
    return `ALTER TRIGGER ${oldTriggerNameStr} ON ${tableNameStr} RENAME TO ${newTriggerNameStr};`;
  };
  _rename.reverse = (tableName, oldTriggerName, newTriggerName) => _rename(tableName, newTriggerName, oldTriggerName);
  return _rename;
}

// src/operations/types/dropTypeAttribute.ts
function dropTypeAttribute(mOptions) {
  const _drop = (typeName, attributeName, options = {}) => {
    const { ifExists = false } = options;
    const ifExistsStr = ifExists ? " IF EXISTS" : "";
    const typeNameStr = mOptions.literal(typeName);
    const attributeNameStr = mOptions.literal(attributeName);
    return `ALTER TYPE ${typeNameStr} DROP ATTRIBUTE ${attributeNameStr}${ifExistsStr};`;
  };
  return _drop;
}

// src/operations/types/addTypeAttribute.ts
function addTypeAttribute(mOptions) {
  const _alterAttributeAdd = (typeName, attributeName, attributeType) => {
    const typeStr = applyType(attributeType, mOptions.typeShorthands).type;
    const typeNameStr = mOptions.literal(typeName);
    const attributeNameStr = mOptions.literal(attributeName);
    return `ALTER TYPE ${typeNameStr} ADD ATTRIBUTE ${attributeNameStr} ${typeStr};`;
  };
  _alterAttributeAdd.reverse = dropTypeAttribute(mOptions);
  return _alterAttributeAdd;
}

// src/operations/types/addTypeValue.ts
function addTypeValue(mOptions) {
  const _add = (typeName, value, options = {}) => {
    const { before, after, ifNotExists = false } = options;
    if (before && after) {
      throw new Error(`"before" and "after" can't be specified together`);
    }
    const beforeStr = before ? ` BEFORE ${escapeValue(before)}` : "";
    const afterStr = after ? ` AFTER ${escapeValue(after)}` : "";
    const ifNotExistsStr = ifNotExists ? " IF NOT EXISTS" : "";
    const valueStr = escapeValue(value);
    const typeNameStr = mOptions.literal(typeName);
    return `ALTER TYPE ${typeNameStr} ADD VALUE${ifNotExistsStr} ${valueStr}${beforeStr}${afterStr};`;
  };
  return _add;
}

// src/operations/types/dropType.ts
function dropType(mOptions) {
  const _drop = (typeName, options = {}) => {
    const { ifExists = false, cascade = false } = options;
    const ifExistsStr = ifExists ? " IF EXISTS" : "";
    const cascadeStr = cascade ? " CASCADE" : "";
    const typeNameStr = mOptions.literal(typeName);
    return `DROP TYPE${ifExistsStr} ${typeNameStr}${cascadeStr};`;
  };
  return _drop;
}

// src/operations/types/createType.ts
function createType(mOptions) {
  const _create = (typeName, options) => {
    if (Array.isArray(options)) {
      const optionsStr = options.map(escapeValue).join(", ");
      const typeNameStr = mOptions.literal(typeName);
      return `CREATE TYPE ${typeNameStr} AS ENUM (${optionsStr});`;
    }
    const attributes = Object.entries(options).map(([attributeName, attribute]) => {
      const typeStr = applyType(attribute, mOptions.typeShorthands).type;
      return `${mOptions.literal(attributeName)} ${typeStr}`;
    }).join(",\n");
    return `CREATE TYPE ${mOptions.literal(typeName)} AS (
${attributes}
);`;
  };
  _create.reverse = dropType(mOptions);
  return _create;
}

// src/operations/types/renameType.ts
function renameType(mOptions) {
  const _rename = (typeName, newTypeName) => {
    const typeNameStr = mOptions.literal(typeName);
    const newTypeNameStr = mOptions.literal(newTypeName);
    return `ALTER TYPE ${typeNameStr} RENAME TO ${newTypeNameStr};`;
  };
  _rename.reverse = (typeName, newTypeName) => _rename(newTypeName, typeName);
  return _rename;
}

// src/operations/types/renameTypeAttribute.ts
function renameTypeAttribute(mOptions) {
  const _rename = (typeName, attributeName, newAttributeName) => {
    const typeNameStr = mOptions.literal(typeName);
    const attributeNameStr = mOptions.literal(attributeName);
    const newAttributeNameStr = mOptions.literal(newAttributeName);
    return `ALTER TYPE ${typeNameStr} RENAME ATTRIBUTE ${attributeNameStr} TO ${newAttributeNameStr};`;
  };
  _rename.reverse = (typeName, attributeName, newAttributeName) => _rename(typeName, newAttributeName, attributeName);
  return _rename;
}

// src/operations/types/renameTypeValue.ts
function renameTypeValue(mOptions) {
  const _rename = (typeName, value, newValue) => {
    const valueStr = escapeValue(value);
    const newValueStr = escapeValue(newValue);
    const typeNameStr = mOptions.literal(typeName);
    return `ALTER TYPE ${typeNameStr} RENAME VALUE ${valueStr} TO ${newValueStr};`;
  };
  _rename.reverse = (typeName, value, newValue) => _rename(typeName, newValue, value);
  return _rename;
}

// src/operations/types/setTypeAttribute.ts
function setTypeAttribute(mOptions) {
  return (typeName, attributeName, attributeType) => {
    const typeStr = applyType(attributeType, mOptions.typeShorthands).type;
    const typeNameStr = mOptions.literal(typeName);
    const attributeNameStr = mOptions.literal(attributeName);
    return `ALTER TYPE ${typeNameStr} ALTER ATTRIBUTE ${attributeNameStr} SET DATA TYPE ${typeStr};`;
  };
}

// src/operations/views/shared.ts
function viewOptionStr(options) {
  return (key) => {
    const value = options[key] === true ? "" : ` = ${options[key]}`;
    return `${key}${value}`;
  };
}

// src/operations/views/alterView.ts
function alterView(mOptions) {
  const _alter = (viewName, viewOptions) => {
    const { checkOption, options = {} } = viewOptions;
    if (checkOption !== void 0) {
      if (options.check_option === void 0) {
        options.check_option = checkOption;
      } else {
        throw new Error(
          `"options.check_option" and "checkOption" can't be specified together`
        );
      }
    }
    const clauses = [];
    const withOptions = Object.keys(options).filter((key) => options[key] !== null).map(viewOptionStr(options)).join(", ");
    if (withOptions) {
      clauses.push(`SET (${withOptions})`);
    }
    const resetOptions = Object.keys(options).filter((key) => options[key] === null).join(", ");
    if (resetOptions) {
      clauses.push(`RESET (${resetOptions})`);
    }
    return clauses.map((clause) => `ALTER VIEW ${mOptions.literal(viewName)} ${clause};`).join("\n");
  };
  return _alter;
}

// src/operations/views/alterViewColumn.ts
function alterViewColumn(mOptions) {
  const _alter = (viewName, columnName, options) => {
    const { default: defaultValue } = options;
    const actions = [];
    if (defaultValue === null) {
      actions.push("DROP DEFAULT");
    } else if (defaultValue !== void 0) {
      actions.push(`SET DEFAULT ${escapeValue(defaultValue)}`);
    }
    const viewNameStr = mOptions.literal(viewName);
    const columnNameStr = mOptions.literal(columnName);
    return actions.map(
      (action) => `ALTER VIEW ${viewNameStr} ALTER COLUMN ${columnNameStr} ${action};`
    ).join("\n");
  };
  return _alter;
}

// src/operations/views/dropView.ts
function dropView(mOptions) {
  const _drop = (viewName, options = {}) => {
    const { ifExists = false, cascade = false } = options;
    const ifExistsStr = ifExists ? " IF EXISTS" : "";
    const cascadeStr = cascade ? " CASCADE" : "";
    const viewNameStr = mOptions.literal(viewName);
    return `DROP VIEW${ifExistsStr} ${viewNameStr}${cascadeStr};`;
  };
  return _drop;
}

// src/operations/views/createView.ts
function createView(mOptions) {
  const _create = (viewName, viewOptions, definition) => {
    const {
      temporary = false,
      replace = false,
      recursive = false,
      columns = [],
      options = {},
      checkOption
    } = viewOptions;
    const columnNames = toArray(columns).map(mOptions.literal).join(", ");
    const withOptions = Object.keys(options).map(viewOptionStr(options)).join(", ");
    const replaceStr = replace ? " OR REPLACE" : "";
    const temporaryStr = temporary ? " TEMPORARY" : "";
    const recursiveStr = recursive ? " RECURSIVE" : "";
    const columnStr = columnNames ? `(${columnNames})` : "";
    const withOptionsStr = withOptions ? ` WITH (${withOptions})` : "";
    const checkOptionStr = checkOption ? ` WITH ${checkOption} CHECK OPTION` : "";
    const viewNameStr = mOptions.literal(viewName);
    return `CREATE${replaceStr}${temporaryStr}${recursiveStr} VIEW ${viewNameStr}${columnStr}${withOptionsStr} AS ${definition}${checkOptionStr};`;
  };
  _create.reverse = dropView(mOptions);
  return _create;
}

// src/operations/views/renameView.ts
function renameView(mOptions) {
  const _rename = (viewName, newViewName) => {
    const viewNameStr = mOptions.literal(viewName);
    const newViewNameStr = mOptions.literal(newViewName);
    return `ALTER VIEW ${viewNameStr} RENAME TO ${newViewNameStr};`;
  };
  _rename.reverse = (viewName, newViewName) => _rename(newViewName, viewName);
  return _rename;
}

// src/migrationBuilder.ts
var MigrationBuilderImpl = class {
  createExtension;
  dropExtension;
  addExtension;
  createTable;
  dropTable;
  renameTable;
  alterTable;
  addColumns;
  dropColumns;
  renameColumn;
  alterColumn;
  addColumn;
  dropColumn;
  addConstraint;
  dropConstraint;
  renameConstraint;
  createConstraint;
  createType;
  dropType;
  addType;
  renameType;
  renameTypeAttribute;
  renameTypeValue;
  addTypeAttribute;
  dropTypeAttribute;
  setTypeAttribute;
  addTypeValue;
  createIndex;
  dropIndex;
  addIndex;
  createRole;
  dropRole;
  alterRole;
  renameRole;
  createFunction;
  dropFunction;
  renameFunction;
  createTrigger;
  dropTrigger;
  renameTrigger;
  createSchema;
  dropSchema;
  renameSchema;
  createDomain;
  dropDomain;
  alterDomain;
  renameDomain;
  createSequence;
  dropSequence;
  alterSequence;
  renameSequence;
  createOperator;
  dropOperator;
  createOperatorClass;
  dropOperatorClass;
  renameOperatorClass;
  createOperatorFamily;
  dropOperatorFamily;
  renameOperatorFamily;
  addToOperatorFamily;
  removeFromOperatorFamily;
  createPolicy;
  dropPolicy;
  alterPolicy;
  renamePolicy;
  createView;
  dropView;
  alterView;
  alterViewColumn;
  renameView;
  createMaterializedView;
  dropMaterializedView;
  alterMaterializedView;
  renameMaterializedView;
  renameMaterializedViewColumn;
  refreshMaterializedView;
  grantRoles;
  revokeRoles;
  grantOnSchemas;
  revokeOnSchemas;
  grantOnTables;
  revokeOnTables;
  createCast;
  dropCast;
  sql;
  func;
  db;
  _steps;
  _REVERSE_MODE;
  _useTransaction;
  constructor(db2, typeShorthands, shouldDecamelize, logger) {
    this._steps = [];
    this._REVERSE_MODE = false;
    this._useTransaction = true;
    const wrap = (operation) => (...args) => {
      if (this._REVERSE_MODE) {
        if (typeof operation.reverse !== "function") {
          const name = `pgm.${operation.name}()`;
          throw new Error(
            `Impossible to automatically infer down migration for "${name}"`
          );
        }
        this._steps = this._steps.concat(operation.reverse(...args));
      } else {
        this._steps = this._steps.concat(operation(...args));
      }
    };
    const options = {
      typeShorthands,
      schemalize: createSchemalize({ shouldDecamelize, shouldQuote: false }),
      literal: createSchemalize({ shouldDecamelize, shouldQuote: true }),
      logger
    };
    this.createExtension = wrap(createExtension(options));
    this.dropExtension = wrap(dropExtension(options));
    this.addExtension = this.createExtension;
    this.createTable = wrap(createTable(options));
    this.dropTable = wrap(dropTable(options));
    this.renameTable = wrap(renameTable(options));
    this.alterTable = wrap(alterTable(options));
    this.addColumns = wrap(addColumns(options));
    this.dropColumns = wrap(dropColumns(options));
    this.renameColumn = wrap(renameColumn(options));
    this.alterColumn = wrap(alterColumn(options));
    this.addColumn = this.addColumns;
    this.dropColumn = this.dropColumns;
    this.addConstraint = wrap(addConstraint(options));
    this.dropConstraint = wrap(dropConstraint(options));
    this.renameConstraint = wrap(renameConstraint(options));
    this.createConstraint = this.addConstraint;
    this.createType = wrap(createType(options));
    this.dropType = wrap(dropType(options));
    this.addType = this.createType;
    this.renameType = wrap(renameType(options));
    this.renameTypeAttribute = wrap(renameTypeAttribute(options));
    this.renameTypeValue = wrap(renameTypeValue(options));
    this.addTypeAttribute = wrap(addTypeAttribute(options));
    this.dropTypeAttribute = wrap(dropTypeAttribute(options));
    this.setTypeAttribute = wrap(setTypeAttribute(options));
    this.addTypeValue = wrap(addTypeValue(options));
    this.createIndex = wrap(createIndex(options));
    this.dropIndex = wrap(dropIndex(options));
    this.addIndex = this.createIndex;
    this.createRole = wrap(createRole(options));
    this.dropRole = wrap(dropRole(options));
    this.alterRole = wrap(alterRole(options));
    this.renameRole = wrap(renameRole(options));
    this.createFunction = wrap(createFunction(options));
    this.dropFunction = wrap(dropFunction(options));
    this.renameFunction = wrap(renameFunction(options));
    this.createTrigger = wrap(createTrigger(options));
    this.dropTrigger = wrap(dropTrigger(options));
    this.renameTrigger = wrap(renameTrigger(options));
    this.createSchema = wrap(createSchema(options));
    this.dropSchema = wrap(dropSchema(options));
    this.renameSchema = wrap(renameSchema(options));
    this.createDomain = wrap(createDomain(options));
    this.dropDomain = wrap(dropDomain(options));
    this.alterDomain = wrap(alterDomain(options));
    this.renameDomain = wrap(renameDomain(options));
    this.createSequence = wrap(createSequence(options));
    this.dropSequence = wrap(dropSequence(options));
    this.alterSequence = wrap(alterSequence(options));
    this.renameSequence = wrap(renameSequence(options));
    this.createOperator = wrap(createOperator(options));
    this.dropOperator = wrap(dropOperator(options));
    this.createOperatorClass = wrap(createOperatorClass(options));
    this.dropOperatorClass = wrap(dropOperatorClass(options));
    this.renameOperatorClass = wrap(renameOperatorClass(options));
    this.createOperatorFamily = wrap(createOperatorFamily(options));
    this.dropOperatorFamily = wrap(dropOperatorFamily(options));
    this.renameOperatorFamily = wrap(renameOperatorFamily(options));
    this.addToOperatorFamily = wrap(addToOperatorFamily(options));
    this.removeFromOperatorFamily = wrap(
      removeFromOperatorFamily(options)
    );
    this.createPolicy = wrap(createPolicy(options));
    this.dropPolicy = wrap(dropPolicy(options));
    this.alterPolicy = wrap(alterPolicy(options));
    this.renamePolicy = wrap(renamePolicy(options));
    this.createView = wrap(createView(options));
    this.dropView = wrap(dropView(options));
    this.alterView = wrap(alterView(options));
    this.alterViewColumn = wrap(alterViewColumn(options));
    this.renameView = wrap(renameView(options));
    this.createMaterializedView = wrap(createMaterializedView(options));
    this.dropMaterializedView = wrap(dropMaterializedView(options));
    this.alterMaterializedView = wrap(alterMaterializedView(options));
    this.renameMaterializedView = wrap(renameMaterializedView(options));
    this.renameMaterializedViewColumn = wrap(
      renameMaterializedViewColumn(options)
    );
    this.refreshMaterializedView = wrap(
      refreshMaterializedView(options)
    );
    this.grantRoles = wrap(grantRoles(options));
    this.revokeRoles = wrap(revokeRoles(options));
    this.grantOnSchemas = wrap(grantOnSchemas(options));
    this.revokeOnSchemas = wrap(revokeOnSchemas(options));
    this.grantOnTables = wrap(grantOnTables(options));
    this.revokeOnTables = wrap(revokeOnTables(options));
    this.createCast = wrap(createCast(options));
    this.dropCast = wrap(dropCast(options));
    this.sql = wrap(sql(options));
    this.func = PgLiteral.create;
    const wrapDB = (operation) => (...args) => {
      if (this._REVERSE_MODE) {
        throw new Error("Impossible to automatically infer down migration");
      }
      return operation(...args);
    };
    this.db = {
      query: wrapDB(db2.query),
      select: wrapDB(db2.select)
    };
  }
  enableReverseMode() {
    this._REVERSE_MODE = true;
    return this;
  }
  noTransaction() {
    this._useTransaction = false;
    return this;
  }
  isUsingTransaction() {
    return this._useTransaction;
  }
  getSql() {
    return `${this.getSqlSteps().join("\n")}
`;
  }
  getSqlSteps() {
    return this._REVERSE_MODE ? [...this._steps].reverse() : this._steps;
  }
};

// src/migration.ts
var SEPARATOR = "_";
async function loadMigrationFiles(dir, ignorePattern) {
  const dirContent = await readdir(`${dir}/`, { withFileTypes: true });
  const files = dirContent.map((file) => file.isFile() || file.isSymbolicLink() ? file.name : null).filter((file) => Boolean(file)).sort();
  const filter = new RegExp(`^(${ignorePattern})$`);
  return ignorePattern === void 0 ? files : files.filter((i) => !filter.test(i));
}
function getSuffixFromFileName(fileName) {
  return extname(fileName).slice(1);
}
async function getLastSuffix(dir, ignorePattern) {
  try {
    const files = await loadMigrationFiles(dir, ignorePattern);
    return files.length > 0 ? getSuffixFromFileName(files[files.length - 1]) : void 0;
  } catch {
    return void 0;
  }
}
function getTimestamp(logger, filename) {
  const prefix = filename.split(SEPARATOR)[0];
  if (prefix && /^\d+$/.test(prefix)) {
    if (prefix.length === 13) {
      return Number(prefix);
    }
    if (prefix && prefix.length === 17) {
      const year = prefix.slice(0, 4);
      const month = prefix.slice(4, 6);
      const date = prefix.slice(6, 8);
      const hours = prefix.slice(8, 10);
      const minutes = prefix.slice(10, 12);
      const seconds = prefix.slice(12, 14);
      const ms = prefix.slice(14, 17);
      return (/* @__PURE__ */ new Date(
        `${year}-${month}-${date}T${hours}:${minutes}:${seconds}.${ms}Z`
      )).valueOf();
    }
  }
  logger.error(`Can't determine timestamp for ${prefix}`);
  return Number(prefix) || 0;
}
async function resolveSuffix(directory, options) {
  const { language, ignorePattern } = options;
  return language || await getLastSuffix(directory, ignorePattern) || "js";
}
var Migration = class {
  // class method that creates a new migration file by cloning the migration template
  static async create(name, directory, options = {}) {
    const { filenameFormat = "timestamp" /* timestamp */ } = options;
    await mkdir(directory, { recursive: true });
    const now = /* @__PURE__ */ new Date();
    const time = filenameFormat === "utc" /* utc */ ? now.toISOString().replace(/\D/g, "") : now.valueOf();
    const templateFileName = "templateFileName" in options ? resolve(cwd(), options.templateFileName) : resolve(
      join("node_modules", "node-pg-migrate", "templates"),
      `migration-template.${await resolveSuffix(directory, options)}`
    );
    const suffix = getSuffixFromFileName(templateFileName);
    const newFile = join(directory, `${time}${SEPARATOR}${name}.${suffix}`);
    await new Promise((resolve3, reject) => {
      createReadStream(templateFileName).pipe(createWriteStream(newFile)).on("close", resolve3).on("error", reject);
    });
    return newFile;
  }
  db;
  path;
  name;
  timestamp;
  up;
  down;
  options;
  typeShorthands;
  logger;
  constructor(db2, migrationPath, { up, down }, options, typeShorthands, logger = console) {
    this.db = db2;
    this.path = migrationPath;
    this.name = basename(migrationPath, extname(migrationPath));
    this.timestamp = getTimestamp(logger, this.name);
    this.up = up;
    this.down = down;
    this.options = options;
    this.typeShorthands = typeShorthands;
    this.logger = logger;
  }
  _getMarkAsRun(action) {
    const schema = getMigrationTableSchema(this.options);
    const { migrationsTable } = this.options;
    const { name } = this;
    switch (action) {
      case this.down: {
        this.logger.info(`### MIGRATION ${this.name} (DOWN) ###`);
        return `DELETE FROM "${schema}"."${migrationsTable}" WHERE name='${name}';`;
      }
      case this.up: {
        this.logger.info(`### MIGRATION ${this.name} (UP) ###`);
        return `INSERT INTO "${schema}"."${migrationsTable}" (name, run_on) VALUES ('${name}', CURRENT_TIMESTAMP);`;
      }
      default: {
        throw new Error("Unknown direction");
      }
    }
  }
  async _apply(action, pgm) {
    if (action.length === 2) {
      await new Promise((resolve3) => {
        action(pgm, resolve3);
      });
    } else {
      await action(pgm);
    }
    const sqlSteps = pgm.getSqlSteps();
    sqlSteps.push(this._getMarkAsRun(action));
    if (!this.options.singleTransaction && pgm.isUsingTransaction()) {
      sqlSteps.unshift("BEGIN;");
      sqlSteps.push("COMMIT;");
    } else if (this.options.singleTransaction && !pgm.isUsingTransaction()) {
      this.logger.warn("#> WARNING: Need to break single transaction! <");
      sqlSteps.unshift("COMMIT;");
      sqlSteps.push("BEGIN;");
    } else if (!this.options.singleTransaction || !pgm.isUsingTransaction()) {
      this.logger.warn(
        "#> WARNING: This migration is not wrapped in a transaction! <"
      );
    }
    if (typeof this.logger.debug === "function") {
      this.logger.debug(`${sqlSteps.join("\n")}

`);
    }
    return sqlSteps.reduce(
      (promise, sql2) => promise.then(() => this.options.dryRun || this.db.query(sql2)),
      Promise.resolve()
    );
  }
  _getAction(direction) {
    if (direction === "down" && this.down === void 0) {
      this.down = this.up;
    }
    const action = this[direction];
    if (action === false) {
      throw new Error(
        `User has disabled ${direction} migration on file: ${this.name}`
      );
    }
    if (typeof action !== "function") {
      throw new Error(
        `Unknown value for direction: ${direction}. Is the migration ${this.name} exporting a '${direction}' function?`
      );
    }
    return action;
  }
  apply(direction) {
    const pgm = new MigrationBuilderImpl(
      this.db,
      this.typeShorthands,
      Boolean(this.options.decamelize),
      this.logger
    );
    const action = this._getAction(direction);
    if (this.down === this.up) {
      pgm.enableReverseMode();
    }
    return this._apply(action, pgm);
  }
  markAsRun(direction) {
    return this.db.query(this._getMarkAsRun(this._getAction(direction)));
  }
};

// src/runner.ts
import { createRequire } from "node:module";
import { extname as extname2, resolve as resolve2 } from "node:path";

// src/db.ts
import { inspect } from "node:util";
import pg from "pg";
function db(connection, logger = console) {
  const isExternalClient = typeof connection === "object" && "query" in connection && typeof connection.query === "function";
  const client = isExternalClient ? connection : new pg.Client(connection);
  let connectionStatus = isExternalClient ? "EXTERNAL" /* EXTERNAL */ : "DISCONNECTED" /* DISCONNECTED */;
  const beforeCloseListeners = [];
  const connected = () => connectionStatus === "CONNECTED" /* CONNECTED */ || connectionStatus === "EXTERNAL" /* EXTERNAL */;
  const createConnection = () => new Promise((resolve3, reject) => {
    if (connected()) {
      resolve3();
    } else if (connectionStatus === "ERROR" /* ERROR */) {
      reject(
        new Error("Connection already failed, do not try to connect again")
      );
    } else {
      client.connect((err) => {
        if (err) {
          connectionStatus = "ERROR" /* ERROR */;
          logger.error(`could not connect to postgres: ${inspect(err)}`);
          reject(err);
          return;
        }
        connectionStatus = "CONNECTED" /* CONNECTED */;
        resolve3();
      });
    }
  });
  const query = async (queryTextOrConfig, values) => {
    await createConnection();
    try {
      return await client.query(queryTextOrConfig, values);
    } catch (error) {
      const { message, position } = error;
      const string = typeof queryTextOrConfig === "string" ? queryTextOrConfig : queryTextOrConfig.text;
      if (message && position >= 1) {
        const endLineWrapIndexOf = string.indexOf("\n", position);
        const endLineWrapPos = endLineWrapIndexOf >= 0 ? endLineWrapIndexOf : string.length;
        const stringStart = string.slice(0, endLineWrapPos);
        const stringEnd = string.slice(endLineWrapPos);
        const startLineWrapPos = stringStart.lastIndexOf("\n") + 1;
        const padding = " ".repeat(position - startLineWrapPos - 1);
        logger.error(`Error executing:
${stringStart}
${padding}^^^^${stringEnd}

${message}
`);
      } else {
        logger.error(`Error executing:
${string}
${error}
`);
      }
      throw error;
    }
  };
  const select = async (queryTextOrConfig, values) => {
    const { rows } = await query(queryTextOrConfig, values);
    return rows;
  };
  const column = async (columnName, queryTextOrConfig, values) => {
    const rows = await select(queryTextOrConfig, values);
    return rows.map((r) => r[columnName]);
  };
  return {
    createConnection,
    query,
    select,
    column,
    connected,
    addBeforeCloseListener: (listener) => beforeCloseListeners.push(listener),
    close: async () => {
      await beforeCloseListeners.reduce(
        (promise, listener) => promise.then(listener).catch((error) => {
          logger.error(error.stack || error);
        }),
        Promise.resolve()
      );
      if (!isExternalClient) {
        connectionStatus = "DISCONNECTED" /* DISCONNECTED */;
        client.end();
      }
    }
  };
}
var db_default = db;

// src/sqlMigration.ts
import { readFile } from "node:fs/promises";
function createMigrationCommentRegex(direction) {
  return new RegExp(`^\\s*--[\\s-]*${direction}\\s+migration`, "im");
}
function getActions(content) {
  const upMigrationCommentRegex = createMigrationCommentRegex("up");
  const downMigrationCommentRegex = createMigrationCommentRegex("down");
  const upMigrationStart = content.search(upMigrationCommentRegex);
  const downMigrationStart = content.search(downMigrationCommentRegex);
  const upSql = upMigrationStart >= 0 ? content.slice(
    upMigrationStart,
    downMigrationStart < upMigrationStart ? void 0 : downMigrationStart
  ) : content;
  const downSql = downMigrationStart >= 0 ? content.slice(
    downMigrationStart,
    upMigrationStart < downMigrationStart ? void 0 : upMigrationStart
  ) : void 0;
  return {
    up: (pgm) => {
      pgm.sql(upSql);
    },
    down: downSql === void 0 ? false : (pgm) => {
      pgm.sql(downSql);
    }
  };
}
async function sqlMigration(sqlPath) {
  const content = await readFile(sqlPath, "utf8");
  return getActions(content);
}
var sqlMigration_default = sqlMigration;

// src/runner.ts
var PG_MIGRATE_LOCK_ID = 7241865325823964;
var idColumn = "id";
var nameColumn = "name";
var runOnColumn = "run_on";
async function loadMigrations(db2, options, logger) {
  try {
    let shorthands = {};
    const files = await loadMigrationFiles(options.dir, options.ignorePattern);
    const migrations = await Promise.all(
      files.map(async (file) => {
        const filePath = resolve2(options.dir, file);
        const actions = extname2(filePath) === ".sql" ? await sqlMigration_default(filePath) : createRequire(resolve2("_"))(filePath);
        shorthands = { ...shorthands, ...actions.shorthands };
        return new Migration(
          db2,
          filePath,
          actions,
          options,
          {
            ...shorthands
          },
          logger
        );
      })
    );
    return migrations.sort((m1, m2) => {
      const compare = m1.timestamp - m2.timestamp;
      if (compare !== 0) {
        return compare;
      }
      return m1.name.localeCompare(m2.name);
    });
  } catch (error) {
    throw new Error(`Can't get migration files: ${error.stack}`);
  }
}
async function lock(db2) {
  const [result] = await db2.select(
    `SELECT pg_try_advisory_lock(${PG_MIGRATE_LOCK_ID}) AS "lockObtained"`
  );
  if (!result.lockObtained) {
    throw new Error("Another migration is already running");
  }
}
async function unlock(db2) {
  const [result] = await db2.select(
    `SELECT pg_advisory_unlock(${PG_MIGRATE_LOCK_ID}) AS "lockReleased"`
  );
  if (!result.lockReleased) {
    throw new Error("Failed to release migration lock");
  }
}
async function ensureMigrationsTable(db2, options) {
  try {
    const schema = getMigrationTableSchema(options);
    const { migrationsTable } = options;
    const fullTableName = createSchemalize({
      shouldDecamelize: Boolean(options.decamelize),
      shouldQuote: true
    })({
      schema,
      name: migrationsTable
    });
    const migrationTables = await db2.select(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = '${schema}' AND table_name = '${migrationsTable}'`
    );
    if (migrationTables && migrationTables.length === 1) {
      const primaryKeyConstraints = await db2.select(
        `SELECT constraint_name FROM information_schema.table_constraints WHERE table_schema = '${schema}' AND table_name = '${migrationsTable}' AND constraint_type = 'PRIMARY KEY'`
      );
      if (!primaryKeyConstraints || primaryKeyConstraints.length !== 1) {
        await db2.query(
          `ALTER TABLE ${fullTableName} ADD PRIMARY KEY (${idColumn})`
        );
      }
    } else {
      const type = options.isRedshift ? "INT IDENTITY(1, 1)" : "SERIAL";
      await db2.query(
        `CREATE TABLE ${fullTableName} (${idColumn} ${type} PRIMARY KEY, ${nameColumn} varchar(255) NOT NULL, ${runOnColumn} timestamp NOT NULL)`
      );
    }
  } catch (error) {
    throw new Error(`Unable to ensure migrations table: ${error.stack}`);
  }
}
async function getRunMigrations(db2, options) {
  const schema = getMigrationTableSchema(options);
  const { migrationsTable } = options;
  const fullTableName = createSchemalize({
    shouldDecamelize: Boolean(options.decamelize),
    shouldQuote: true
  })({
    schema,
    name: migrationsTable
  });
  return db2.column(
    nameColumn,
    `SELECT ${nameColumn} FROM ${fullTableName} ORDER BY ${runOnColumn}, ${idColumn}`
  );
}
function getMigrationsToRun(options, runNames, migrations) {
  if (options.direction === "down") {
    const downMigrations = runNames.filter(
      (migrationName) => !options.file || options.file === migrationName
    ).map(
      (migrationName) => migrations.find(({ name }) => name === migrationName) || migrationName
    );
    const { count: count2 = 1 } = options;
    const toRun = (options.timestamp ? downMigrations.filter(
      (migration) => typeof migration === "object" && migration.timestamp >= count2
    ) : downMigrations.slice(-Math.abs(count2))).reverse();
    const deletedMigrations = toRun.filter(
      (migration) => typeof migration === "string"
    );
    if (deletedMigrations.length > 0) {
      const deletedMigrationsStr = deletedMigrations.join(", ");
      throw new Error(
        `Definitions of migrations ${deletedMigrationsStr} have been deleted.`
      );
    }
    return toRun;
  }
  const upMigrations = migrations.filter(
    ({ name }) => !runNames.includes(name) && (!options.file || options.file === name)
  );
  const { count = Number.POSITIVE_INFINITY } = options;
  return options.timestamp ? upMigrations.filter(({ timestamp }) => timestamp <= count) : upMigrations.slice(0, Math.abs(count));
}
function checkOrder(runNames, migrations) {
  const len = Math.min(runNames.length, migrations.length);
  for (let i = 0; i < len; i += 1) {
    const runName = runNames[i];
    const migrationName = migrations[i].name;
    if (runName !== migrationName) {
      throw new Error(
        `Not run migration ${migrationName} is preceding already run migration ${runName}`
      );
    }
  }
}
function runMigrations(toRun, method, direction) {
  return toRun.reduce(
    (promise, migration) => promise.then(() => migration[method](direction)),
    Promise.resolve()
  );
}
function getLogger(options) {
  const { log, logger, verbose } = options;
  let loggerObject = console;
  if (typeof logger === "object") {
    loggerObject = logger;
  } else if (typeof log === "function") {
    loggerObject = {
      debug: log,
      info: log,
      warn: log,
      error: log
    };
  }
  return verbose ? loggerObject : {
    debug: void 0,
    info: loggerObject.info.bind(loggerObject),
    warn: loggerObject.warn.bind(loggerObject),
    error: loggerObject.error.bind(loggerObject)
  };
}
async function runner(options) {
  const logger = getLogger(options);
  const db2 = db_default(
    options.dbClient || options.databaseUrl,
    logger
  );
  try {
    await db2.createConnection();
    if (!options.noLock) {
      await lock(db2);
    }
    if (options.schema) {
      const schemas = getSchemas(options.schema);
      if (options.createSchema) {
        await Promise.all(
          schemas.map(
            (schema) => db2.query(`CREATE SCHEMA IF NOT EXISTS "${schema}"`)
          )
        );
      }
      await db2.query(
        `SET search_path TO ${schemas.map((s) => `"${s}"`).join(", ")}`
      );
    }
    if (options.migrationsSchema && options.createMigrationsSchema) {
      await db2.query(
        `CREATE SCHEMA IF NOT EXISTS "${options.migrationsSchema}"`
      );
    }
    await ensureMigrationsTable(db2, options);
    const [migrations, runNames] = await Promise.all([
      loadMigrations(db2, options, logger),
      getRunMigrations(db2, options)
    ]);
    if (options.checkOrder) {
      checkOrder(runNames, migrations);
    }
    const toRun = getMigrationsToRun(
      options,
      runNames,
      migrations
    );
    if (toRun.length === 0) {
      logger.info("No migrations to run!");
      return [];
    }
    logger.info("> Migrating files:");
    for (const m of toRun) {
      logger.info(`> - ${m.name}`);
    }
    if (options.fake) {
      await runMigrations(toRun, "markAsRun", options.direction);
    } else if (options.singleTransaction) {
      await db2.query("BEGIN");
      try {
        await runMigrations(toRun, "apply", options.direction);
        await db2.query("COMMIT");
      } catch (error) {
        logger.warn("> Rolling back attempted migration ...");
        await db2.query("ROLLBACK");
        throw error;
      }
    } else {
      await runMigrations(toRun, "apply", options.direction);
    }
    return toRun.map((m) => ({
      path: m.path,
      name: m.name,
      timestamp: m.timestamp
    }));
  } finally {
    if (db2.connected()) {
      if (!options.noLock) {
        await unlock(db2).catch((error) => {
          logger.warn(error.message);
        });
      }
      await db2.close();
    }
  }
}

// src/types.ts
var PgType = /* @__PURE__ */ ((PgType2) => {
  PgType2["BIGINT"] = "bigint";
  PgType2["INT8"] = "int8";
  PgType2["BIGSERIAL"] = "bigserial";
  PgType2["BIT_1"] = "bit";
  PgType2["BIT_VARYING"] = "bit varying";
  PgType2["VARBIT"] = "varbit";
  PgType2["SERIAL8"] = "serial8";
  PgType2["BOOLEAN"] = "boolean";
  PgType2["BOOL"] = "bool";
  PgType2["BOX"] = "box";
  PgType2["BYTEA"] = "bytea";
  PgType2["CHARACTER"] = "character";
  PgType2["CHAR"] = "char";
  PgType2["CHARACTER_VARYING"] = "character varying";
  PgType2["VARCHAR"] = "varchar";
  PgType2["CIDR"] = "cidr";
  PgType2["CIRCLE"] = "circle";
  PgType2["DATE"] = "date";
  PgType2["DOUBLE_PRECISION"] = "double precision";
  PgType2["INET"] = "inet";
  PgType2["INTEGER"] = "integer";
  PgType2["INT"] = "int";
  PgType2["INT4"] = "int4";
  PgType2["INTERVAL"] = "interval";
  PgType2["JSON"] = "json";
  PgType2["JSONB"] = "jsonb";
  PgType2["LINE"] = "line";
  PgType2["LSEG"] = "lseg";
  PgType2["MACADDR"] = "macaddr";
  PgType2["MONEY"] = "money";
  PgType2["NUMERIC"] = "numeric";
  PgType2["PATH"] = "path";
  PgType2["PG_LSN"] = "pg_lsn";
  PgType2["POINT"] = "point";
  PgType2["POLYGON"] = "polygon";
  PgType2["REAL"] = "real";
  PgType2["FLOAT4"] = "float4";
  PgType2["SMALLINT"] = "smallint";
  PgType2["INT2"] = "int2";
  PgType2["SMALLSERIAL"] = "smallserial";
  PgType2["SERIAL2"] = "serial2";
  PgType2["SERIAL"] = "serial";
  PgType2["SERIAL4"] = "serial4";
  PgType2["TEXT"] = "text";
  PgType2["TIME"] = "time";
  PgType2["TIME_WITHOUT_TIME_ZONE"] = "without time zone";
  PgType2["TIME_WITH_TIME_ZONE"] = "time with time zone";
  PgType2["TIMETZ"] = "timetz";
  PgType2["TIMESTAMP"] = "timestamp";
  PgType2["TIMESTAMP_WITHOUT_TIME_ZONE"] = "timestamp without time zone";
  PgType2["TIMESTAMP_WITH_TIME_ZONE"] = "timestamp with time zone";
  PgType2["TIMESTAMPTZ"] = "timestamptz";
  PgType2["TSQUERY"] = "tsquery";
  PgType2["TSVECTOR"] = "tsvector";
  PgType2["TXID_SNAPSHOT"] = "txid_snapshot";
  PgType2["UUID"] = "uuid";
  PgType2["XML"] = "xml";
  return PgType2;
})(PgType || {});
export {
  Migration,
  PgLiteral,
  PgType,
  runner as default,
  isPgLiteral,
  runner
};
