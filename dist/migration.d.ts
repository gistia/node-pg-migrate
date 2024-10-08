import type { QueryResult } from 'pg';
import type { DBConnection } from './db';
import MigrationBuilder from './migrationBuilder';
import type { ColumnDefinitions } from './operations/tables';
import type { Logger, MigrationAction, MigrationBuilderActions, MigrationDirection, RunnerOption } from './types';
export interface RunMigration {
    readonly path: string;
    readonly name: string;
    readonly timestamp: number;
}
export declare enum FilenameFormat {
    timestamp = "timestamp",
    utc = "utc"
}
export interface CreateOptionsTemplate {
    templateFileName: string;
}
export interface CreateOptionsDefault {
    language?: 'js' | 'ts' | 'sql';
    ignorePattern?: string;
}
export type CreateOptions = {
    filenameFormat?: FilenameFormat | `${FilenameFormat}`;
} & (CreateOptionsTemplate | CreateOptionsDefault);
export declare function loadMigrationFiles(dir: string, ignorePattern?: string): Promise<string[]>;
export declare function getTimestamp(logger: Logger, filename: string): number;
export declare class Migration implements RunMigration {
    static create(name: string, directory: string, options?: CreateOptions): Promise<string>;
    readonly db: DBConnection;
    readonly path: string;
    readonly name: string;
    readonly timestamp: number;
    up?: false | MigrationAction;
    down?: false | MigrationAction;
    readonly options: RunnerOption;
    readonly typeShorthands?: ColumnDefinitions;
    readonly logger: Logger;
    constructor(db: DBConnection, migrationPath: string, { up, down }: MigrationBuilderActions, options: RunnerOption, typeShorthands?: ColumnDefinitions, logger?: Logger);
    _getMarkAsRun(action: MigrationAction): string;
    _apply(action: MigrationAction, pgm: MigrationBuilder): Promise<unknown>;
    _getAction(direction: MigrationDirection): MigrationAction;
    apply(direction: MigrationDirection): Promise<unknown>;
    markAsRun(direction: MigrationDirection): Promise<QueryResult>;
}
