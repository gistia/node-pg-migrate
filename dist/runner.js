"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var runner_exports = {};
__export(runner_exports, {
  default: () => runner_default,
  runner: () => runner
});
module.exports = __toCommonJS(runner_exports);
var import_node_module = require("node:module");
var import_node_path = require("node:path");
var import_db = __toESM(require("./db"));
var import_migration = require("./migration");
var import_sqlMigration = __toESM(require("./sqlMigration"));
var import_utils = require("./utils");
const PG_MIGRATE_LOCK_ID = 7241865325823964;
const idColumn = "id";
const nameColumn = "name";
const runOnColumn = "run_on";
async function loadMigrations(db, options, logger) {
  try {
    let shorthands = {};
    const files = await (0, import_migration.loadMigrationFiles)(options.dir, options.ignorePattern);
    const migrations = await Promise.all(
      files.map(async (file) => {
        const filePath = (0, import_node_path.resolve)(options.dir, file);
        const actions = (0, import_node_path.extname)(filePath) === ".sql" ? await (0, import_sqlMigration.default)(filePath) : (0, import_node_module.createRequire)((0, import_node_path.resolve)("_"))(filePath);
        shorthands = { ...shorthands, ...actions.shorthands };
        return new import_migration.Migration(
          db,
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
async function lock(db) {
  const [result] = await db.select(
    `SELECT pg_try_advisory_lock(${PG_MIGRATE_LOCK_ID}) AS "lockObtained"`
  );
  if (!result.lockObtained) {
    throw new Error("Another migration is already running");
  }
}
async function unlock(db) {
  const [result] = await db.select(
    `SELECT pg_advisory_unlock(${PG_MIGRATE_LOCK_ID}) AS "lockReleased"`
  );
  if (!result.lockReleased) {
    throw new Error("Failed to release migration lock");
  }
}
async function ensureMigrationsTable(db, options) {
  try {
    const schema = (0, import_utils.getMigrationTableSchema)(options);
    const { migrationsTable } = options;
    const fullTableName = (0, import_utils.createSchemalize)({
      shouldDecamelize: Boolean(options.decamelize),
      shouldQuote: true
    })({
      schema,
      name: migrationsTable
    });
    const migrationTables = await db.select(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = '${schema}' AND table_name = '${migrationsTable}'`
    );
    if (migrationTables && migrationTables.length === 1) {
      const primaryKeyConstraints = await db.select(
        `SELECT constraint_name FROM information_schema.table_constraints WHERE table_schema = '${schema}' AND table_name = '${migrationsTable}' AND constraint_type = 'PRIMARY KEY'`
      );
      if (!primaryKeyConstraints || primaryKeyConstraints.length !== 1) {
        await db.query(
          `ALTER TABLE ${fullTableName} ADD PRIMARY KEY (${idColumn})`
        );
      }
    } else {
      const type = options.isRedshift ? "INT IDENTITY(1, 1)" : "SERIAL";
      await db.query(
        `CREATE TABLE ${fullTableName} (${idColumn} ${type} PRIMARY KEY, ${nameColumn} varchar(255) NOT NULL, ${runOnColumn} timestamp NOT NULL)`
      );
    }
  } catch (error) {
    throw new Error(`Unable to ensure migrations table: ${error.stack}`);
  }
}
async function getRunMigrations(db, options) {
  const schema = (0, import_utils.getMigrationTableSchema)(options);
  const { migrationsTable } = options;
  const fullTableName = (0, import_utils.createSchemalize)({
    shouldDecamelize: Boolean(options.decamelize),
    shouldQuote: true
  })({
    schema,
    name: migrationsTable
  });
  return db.column(
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
  const db = (0, import_db.default)(
    options.dbClient || options.databaseUrl,
    logger
  );
  try {
    await db.createConnection();
    if (!options.noLock) {
      await lock(db);
    }
    if (options.schema) {
      const schemas = (0, import_utils.getSchemas)(options.schema);
      if (options.createSchema) {
        await Promise.all(
          schemas.map(
            (schema) => db.query(`CREATE SCHEMA IF NOT EXISTS "${schema}"`)
          )
        );
      }
      await db.query(
        `SET search_path TO ${schemas.map((s) => `"${s}"`).join(", ")}`
      );
    }
    if (options.migrationsSchema && options.createMigrationsSchema) {
      await db.query(
        `CREATE SCHEMA IF NOT EXISTS "${options.migrationsSchema}"`
      );
    }
    await ensureMigrationsTable(db, options);
    const [migrations, runNames] = await Promise.all([
      loadMigrations(db, options, logger),
      getRunMigrations(db, options)
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
      await db.query("BEGIN");
      try {
        await runMigrations(toRun, "apply", options.direction);
        await db.query("COMMIT");
      } catch (error) {
        logger.warn("> Rolling back attempted migration ...");
        await db.query("ROLLBACK");
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
    if (db.connected()) {
      if (!options.noLock) {
        await unlock(db).catch((error) => {
          logger.warn(error.message);
        });
      }
      await db.close();
    }
  }
}
var runner_default = runner;
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  runner
});
