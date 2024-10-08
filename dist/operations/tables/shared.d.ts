import type { Literal, MigrationOptions } from '../../types';
import type { IfNotExistsOption, Name, Value } from '../generalTypes';
import { type SequenceOptions } from '../sequences';
export type Action = 'NO ACTION' | 'RESTRICT' | 'CASCADE' | 'SET NULL' | 'SET DEFAULT';
export interface ReferencesOptions {
    referencesConstraintName?: string;
    referencesConstraintComment?: string;
    references: Name;
    onDelete?: Action;
    onUpdate?: Action;
    match?: 'FULL' | 'SIMPLE';
}
export type SequenceGeneratedOptions = {
    precedence: 'ALWAYS' | 'BY DEFAULT';
} & SequenceOptions;
export interface ColumnDefinition extends Partial<ReferencesOptions> {
    type: string;
    collation?: string;
    unique?: boolean;
    primaryKey?: boolean;
    notNull?: boolean;
    default?: Value;
    check?: string;
    deferrable?: boolean;
    deferred?: boolean;
    comment?: string | null;
    /**
     * @deprecated use sequenceGenerated
     */
    generated?: SequenceGeneratedOptions;
    sequenceGenerated?: SequenceGeneratedOptions;
    expressionGenerated?: string;
}
export interface ColumnDefinitions {
    [name: string]: ColumnDefinition | string;
}
export type Like = 'COMMENTS' | 'CONSTRAINTS' | 'DEFAULTS' | 'IDENTITY' | 'INDEXES' | 'STATISTICS' | 'STORAGE' | 'ALL';
export interface LikeOptions {
    including?: Like | Like[];
    excluding?: Like | Like[];
}
export interface ForeignKeyOptions extends ReferencesOptions {
    columns: Name | Name[];
}
export interface ConstraintOptions {
    check?: string | string[];
    unique?: Name | Array<Name | Name[]>;
    primaryKey?: Name | Name[];
    foreignKeys?: ForeignKeyOptions | ForeignKeyOptions[];
    exclude?: string;
    deferrable?: boolean;
    deferred?: boolean;
    comment?: string;
}
export interface TableOptions extends IfNotExistsOption {
    temporary?: boolean;
    inherits?: Name;
    like?: Name | {
        table: Name;
        options?: LikeOptions;
    };
    constraints?: ConstraintOptions;
    comment?: string | null;
}
export declare function parseReferences(options: ReferencesOptions, literal: Literal): string;
export declare function parseDeferrable(options: {
    deferred?: boolean;
}): string;
export declare function parseColumns(tableName: Name, columns: ColumnDefinitions, mOptions: MigrationOptions): {
    columns: string[];
    constraints: ConstraintOptions;
    comments: string[];
};
export declare function parseConstraints(table: Name, options: ConstraintOptions, optionName: string | null, literal: Literal): {
    constraints: string[];
    comments: string[];
};
export declare function parseLike(like: Name | {
    table: Name;
    options?: LikeOptions;
}, literal: Literal): string;
