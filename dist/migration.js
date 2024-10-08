"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
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
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
var migration_exports = {};
__export(migration_exports, {
  FilenameFormat: () => FilenameFormat,
  Migration: () => Migration,
  getTimestamp: () => getTimestamp,
  loadMigrationFiles: () => loadMigrationFiles
});
module.exports = __toCommonJS(migration_exports);
var import_node_fs = require("node:fs");
var import_promises = require("node:fs/promises");
var import_node_path = require("node:path");
var import_node_process = require("node:process");
var import_migrationBuilder = __toESM(require("./migrationBuilder"));
var import_utils = require("./utils");
var FilenameFormat = /* @__PURE__ */ ((FilenameFormat2) => {
  FilenameFormat2["timestamp"] = "timestamp";
  FilenameFormat2["utc"] = "utc";
  return FilenameFormat2;
})(FilenameFormat || {});
const SEPARATOR = "_";
async function loadMigrationFiles(dir, ignorePattern) {
  const dirContent = await (0, import_promises.readdir)(`${dir}/`, { withFileTypes: true });
  const files = dirContent.map((file) => file.isFile() || file.isSymbolicLink() ? file.name : null).filter((file) => Boolean(file)).sort();
  const filter = new RegExp(`^(${ignorePattern})$`);
  return ignorePattern === void 0 ? files : files.filter((i) => !filter.test(i));
}
function getSuffixFromFileName(fileName) {
  return (0, import_node_path.extname)(fileName).slice(1);
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
class Migration {
  constructor(db, migrationPath, { up, down }, options, typeShorthands, logger = console) {
    __publicField(this, "db");
    __publicField(this, "path");
    __publicField(this, "name");
    __publicField(this, "timestamp");
    __publicField(this, "up");
    __publicField(this, "down");
    __publicField(this, "options");
    __publicField(this, "typeShorthands");
    __publicField(this, "logger");
    this.db = db;
    this.path = migrationPath;
    this.name = (0, import_node_path.basename)(migrationPath, (0, import_node_path.extname)(migrationPath));
    this.timestamp = getTimestamp(logger, this.name);
    this.up = up;
    this.down = down;
    this.options = options;
    this.typeShorthands = typeShorthands;
    this.logger = logger;
  }
  // class method that creates a new migration file by cloning the migration template
  static async create(name, directory, options = {}) {
    const { filenameFormat = "timestamp" /* timestamp */ } = options;
    await (0, import_promises.mkdir)(directory, { recursive: true });
    const now = /* @__PURE__ */ new Date();
    const time = filenameFormat === "utc" /* utc */ ? now.toISOString().replace(/\D/g, "") : now.valueOf();
    const templateFileName = "templateFileName" in options ? (0, import_node_path.resolve)((0, import_node_process.cwd)(), options.templateFileName) : (0, import_node_path.resolve)(
      (0, import_node_path.join)("node_modules", "node-pg-migrate", "templates"),
      `migration-template.${await resolveSuffix(directory, options)}`
    );
    const suffix = getSuffixFromFileName(templateFileName);
    const newFile = (0, import_node_path.join)(directory, `${time}${SEPARATOR}${name}.${suffix}`);
    await new Promise((resolve2, reject) => {
      (0, import_node_fs.createReadStream)(templateFileName).pipe((0, import_node_fs.createWriteStream)(newFile)).on("close", resolve2).on("error", reject);
    });
    return newFile;
  }
  _getMarkAsRun(action) {
    const schema = (0, import_utils.getMigrationTableSchema)(this.options);
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
      await new Promise((resolve2) => {
        action(pgm, resolve2);
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
      (promise, sql) => promise.then(() => this.options.dryRun || this.db.query(sql)),
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
    const pgm = new import_migrationBuilder.default(
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
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  FilenameFormat,
  Migration,
  getTimestamp,
  loadMigrationFiles
});
