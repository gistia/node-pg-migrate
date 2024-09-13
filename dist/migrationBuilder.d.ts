import * as casts from './operations/casts';
import * as domains from './operations/domains';
import * as extensions from './operations/extensions';
import * as functions from './operations/functions';
import * as grants from './operations/grants';
import * as indexes from './operations/indexes';
import * as mViews from './operations/materializedViews';
import * as operators from './operations/operators';
import * as policies from './operations/policies';
import * as roles from './operations/roles';
import * as schemas from './operations/schemas';
import * as sequences from './operations/sequences';
import * as sql from './operations/sql';
import type { ColumnDefinitions } from './operations/tables';
import * as tables from './operations/tables';
import * as triggers from './operations/triggers';
import * as types from './operations/types';
import * as views from './operations/views';
import type { DB, Logger, MigrationBuilder } from './types';
import { PgLiteral } from './utils';
export default class MigrationBuilderImpl implements MigrationBuilder {
    readonly createExtension: (...args: Parameters<extensions.CreateExtension>) => void;
    readonly dropExtension: (...args: Parameters<extensions.DropExtension>) => void;
    readonly addExtension: (...args: Parameters<extensions.CreateExtension>) => void;
    readonly createTable: (...args: Parameters<tables.CreateTable>) => void;
    readonly dropTable: (...args: Parameters<tables.DropTable>) => void;
    readonly renameTable: (...args: Parameters<tables.RenameTable>) => void;
    readonly alterTable: (...args: Parameters<tables.AlterTable>) => void;
    readonly addColumns: (...args: Parameters<tables.AddColumns>) => void;
    readonly dropColumns: (...args: Parameters<tables.DropColumns>) => void;
    readonly renameColumn: (...args: Parameters<tables.RenameColumn>) => void;
    readonly alterColumn: (...args: Parameters<tables.AlterColumn>) => void;
    readonly addColumn: (...args: Parameters<tables.AddColumns>) => void;
    readonly dropColumn: (...args: Parameters<tables.DropColumns>) => void;
    readonly addConstraint: (...args: Parameters<tables.CreateConstraint>) => void;
    readonly dropConstraint: (...args: Parameters<tables.DropConstraint>) => void;
    readonly renameConstraint: (...args: Parameters<tables.RenameConstraint>) => void;
    readonly createConstraint: (...args: Parameters<tables.CreateConstraint>) => void;
    readonly createType: (...args: Parameters<types.CreateType>) => void;
    readonly dropType: (...args: Parameters<types.DropType>) => void;
    readonly addType: (...args: Parameters<types.CreateType>) => void;
    readonly renameType: (...args: Parameters<types.RenameType>) => void;
    readonly renameTypeAttribute: (...args: Parameters<types.RenameTypeAttribute>) => void;
    readonly renameTypeValue: (...args: Parameters<types.RenameTypeValue>) => void;
    readonly addTypeAttribute: (...args: Parameters<types.AddTypeAttribute>) => void;
    readonly dropTypeAttribute: (...args: Parameters<types.DropTypeAttribute>) => void;
    readonly setTypeAttribute: (...args: Parameters<types.SetTypeAttribute>) => void;
    readonly addTypeValue: (...args: Parameters<types.AddTypeValue>) => void;
    readonly createIndex: (...args: Parameters<indexes.CreateIndex>) => void;
    readonly dropIndex: (...args: Parameters<indexes.DropIndex>) => void;
    readonly addIndex: (...args: Parameters<indexes.CreateIndex>) => void;
    readonly createRole: (...args: Parameters<roles.CreateRole>) => void;
    readonly dropRole: (...args: Parameters<roles.DropRole>) => void;
    readonly alterRole: (...args: Parameters<roles.AlterRole>) => void;
    readonly renameRole: (...args: Parameters<roles.RenameRole>) => void;
    readonly createFunction: (...args: Parameters<functions.CreateFunction>) => void;
    readonly dropFunction: (...args: Parameters<functions.DropFunction>) => void;
    readonly renameFunction: (...args: Parameters<functions.RenameFunction>) => void;
    readonly createTrigger: (...args: Parameters<triggers.CreateTrigger>) => void;
    readonly dropTrigger: (...args: Parameters<triggers.DropTrigger>) => void;
    readonly renameTrigger: (...args: Parameters<triggers.RenameTrigger>) => void;
    readonly createSchema: (...args: Parameters<schemas.CreateSchema>) => void;
    readonly dropSchema: (...args: Parameters<schemas.DropSchema>) => void;
    readonly renameSchema: (...args: Parameters<schemas.RenameSchema>) => void;
    readonly createDomain: (...args: Parameters<domains.CreateDomain>) => void;
    readonly dropDomain: (...args: Parameters<domains.DropDomain>) => void;
    readonly alterDomain: (...args: Parameters<domains.AlterDomain>) => void;
    readonly renameDomain: (...args: Parameters<domains.RenameDomain>) => void;
    readonly createSequence: (...args: Parameters<sequences.CreateSequence>) => void;
    readonly dropSequence: (...args: Parameters<sequences.DropSequence>) => void;
    readonly alterSequence: (...args: Parameters<sequences.AlterSequence>) => void;
    readonly renameSequence: (...args: Parameters<sequences.RenameSequence>) => void;
    readonly createOperator: (...args: Parameters<operators.CreateOperator>) => void;
    readonly dropOperator: (...args: Parameters<operators.DropOperator>) => void;
    readonly createOperatorClass: (...args: Parameters<operators.CreateOperatorClass>) => void;
    readonly dropOperatorClass: (...args: Parameters<operators.DropOperatorClass>) => void;
    readonly renameOperatorClass: (...args: Parameters<operators.RenameOperatorClass>) => void;
    readonly createOperatorFamily: (...args: Parameters<operators.CreateOperatorFamily>) => void;
    readonly dropOperatorFamily: (...args: Parameters<operators.DropOperatorFamily>) => void;
    readonly renameOperatorFamily: (...args: Parameters<operators.RenameOperatorFamily>) => void;
    readonly addToOperatorFamily: (...args: Parameters<operators.AddToOperatorFamily>) => void;
    readonly removeFromOperatorFamily: (...args: Parameters<operators.RemoveFromOperatorFamily>) => void;
    readonly createPolicy: (...args: Parameters<policies.CreatePolicy>) => void;
    readonly dropPolicy: (...args: Parameters<policies.DropPolicy>) => void;
    readonly alterPolicy: (...args: Parameters<policies.AlterPolicy>) => void;
    readonly renamePolicy: (...args: Parameters<policies.RenamePolicy>) => void;
    readonly createView: (...args: Parameters<views.CreateView>) => void;
    readonly dropView: (...args: Parameters<views.DropView>) => void;
    readonly alterView: (...args: Parameters<views.AlterView>) => void;
    readonly alterViewColumn: (...args: Parameters<views.AlterViewColumn>) => void;
    readonly renameView: (...args: Parameters<views.RenameView>) => void;
    readonly createMaterializedView: (...args: Parameters<mViews.CreateMaterializedView>) => void;
    readonly dropMaterializedView: (...args: Parameters<mViews.DropMaterializedView>) => void;
    readonly alterMaterializedView: (...args: Parameters<mViews.AlterMaterializedView>) => void;
    readonly renameMaterializedView: (...args: Parameters<mViews.RenameMaterializedView>) => void;
    readonly renameMaterializedViewColumn: (...args: Parameters<mViews.RenameMaterializedViewColumn>) => void;
    readonly refreshMaterializedView: (...args: Parameters<mViews.RefreshMaterializedView>) => void;
    readonly grantRoles: (...args: Parameters<grants.GrantRoles>) => void;
    readonly revokeRoles: (...args: Parameters<grants.RevokeRoles>) => void;
    readonly grantOnSchemas: (...args: Parameters<grants.GrantOnSchemas>) => void;
    readonly revokeOnSchemas: (...args: Parameters<grants.RevokeOnSchemas>) => void;
    readonly grantOnTables: (...args: Parameters<grants.GrantOnTables>) => void;
    readonly revokeOnTables: (...args: Parameters<grants.RevokeOnTables>) => void;
    readonly createCast: (...args: Parameters<casts.CreateCast>) => void;
    readonly dropCast: (...args: Parameters<casts.DropCast>) => void;
    readonly sql: (...args: Parameters<sql.Sql>) => void;
    readonly func: (sql: string) => PgLiteral;
    readonly db: DB;
    private _steps;
    private _REVERSE_MODE;
    private _useTransaction;
    constructor(db: DB, typeShorthands: ColumnDefinitions | undefined, shouldDecamelize: boolean, logger: Logger);
    enableReverseMode(): this;
    noTransaction(): this;
    isUsingTransaction(): boolean;
    getSql(): string;
    getSqlSteps(): string[];
}
