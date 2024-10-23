import { RelationTypes, UITypes } from 'nocodb-sdk';
import type LookupColumn from '../models/LookupColumn';
import type XLookupColumn from '../models/XLookupColumn';
import type { BaseModelSqlv2 } from '~/db/BaseModelSqlv2';
import type {
  BarcodeColumn,
  Column,
  LinksColumn,
  LinkToAnotherRecordColumn,
  FormulaColumn,
  QrCodeColumn,
  RollupColumn,
} from '~/models';
import { Model } from '~/models';
import formulaQueryBuilderv2 from '~/db/formulav2/formulaQueryBuilderv2';
import genRollupSelectv2 from '~/db/genRollupSelectv2';
import { getAliasGenerator } from '~/utils';
import { NcError } from '~/helpers/catchError';
import { NcContext } from 'src/interface/config';

const LOOKUP_VAL_SEPARATOR = '___';

export async function getDisplayValueOfRefTable(
  context: NcContext,
  childCol: Column,
) {
  return await childCol
    .getColOptions(context)
    .then((colOpt) => colOpt.getRelatedTable())
    .then((model) => model.getColumns())
    .then((cols) => cols.find((col) => col.pv));
}

// this function will generate the query for xlookup column
// and return the query builder
// query result will be aggregated json array string in case of Myssql and Postgres
// and string with separator in case of sqlite and mysql
// this function is used for sorting and grouping of xlookup column at the moment
export default async function generateXLookupSelectQuery({
  column,
  baseModelSqlv2,
  alias,
  model: _model,
  getAlias = getAliasGenerator('__lk_slt_'),
}: {
  column: Column;
  baseModelSqlv2: BaseModelSqlv2;
  alias: string;
  model: Model;
  getAlias?: ReturnType<typeof getAliasGenerator>;
}): Promise<any> {
  const knex = baseModelSqlv2.dbDriver;

  const context = baseModelSqlv2.context;

  const rootAlias = alias;

  {
    let selectQb;
    const alias = getAlias();
    let lookupColOpt: XLookupColumn;
    let isBtLookup = true;

    lookupColOpt = await column.getColOptions<XLookupColumn>(context);

    await column.getColOptions<XLookupColumn>(context);
    {
      isBtLookup = false;
      const childColumn = await lookupColOpt.getChildColumn(context);
      const parentColumn = await lookupColOpt.getParentColumn(context);
      const childModel = await childColumn.getModel(context);
      await childModel.getColumns(context);
      const parentModel = await parentColumn.getModel(context);
      await parentModel.getColumns(context);

      selectQb = knex(
        knex.raw(`?? as ??`, [
          baseModelSqlv2.getTnPath(parentModel.table_name),
          alias,
        ]),
      );

      const mmTableAlias = getAlias();

      selectQb
        .innerJoin(
          baseModelSqlv2.getTnPath(parentModel.table_name, mmTableAlias),
          knex.ref(`${mmTableAlias}.${parentColumn.column_name}`),
          '=',
          knex.ref(`${alias}.${parentColumn.column_name}`),
        )
        .where(
          knex.ref(`${mmTableAlias}.${parentColumn.column_name}`),
          '=',
          knex.ref(
            `${
              rootAlias || baseModelSqlv2.getTnPath(childModel.table_name)
            }.${childColumn.column_name}`,
          ),
        );
    }
    let lookupColumn = await lookupColOpt.getLookupColumn(context);

    // if lookup column is qr code or barcode extract the referencing column
    if ([UITypes.QrCode, UITypes.Barcode].includes(lookupColumn.uidt)) {
      lookupColumn = await lookupColumn
        .getColOptions<BarcodeColumn | QrCodeColumn>(context)
        .then((barcode) => barcode.getValueColumn(context));
    }

    let prevAlias = alias;
    while (
      lookupColumn.uidt === UITypes.Lookup ||
      lookupColumn.uidt === UITypes.LinkToAnotherRecord
    ) {
      const nestedAlias = getAlias();

      let relationCol: Column<LinkToAnotherRecordColumn | LinksColumn>;
      let nestedLookupColOpt: LookupColumn;

      if (lookupColumn.uidt === UITypes.Lookup) {
        nestedLookupColOpt = await lookupColumn.getColOptions<LookupColumn>(context);
        relationCol = await nestedLookupColOpt.getRelationColumn(context);
      } else {
        relationCol = lookupColumn;
      }

      const relation =
        await relationCol.getColOptions<LinkToAnotherRecordColumn>(context);

      // if any of the relation in nested lookupColOpt is
      // not belongs to then throw error as we don't support
      if (relation.type === RelationTypes.BELONGS_TO) {
        const childColumn = await relation.getChildColumn(context);
        const parentColumn = await relation.getParentColumn(context);
        const childModel = await childColumn.getModel(context);
        await childModel.getColumns(context);
        const parentModel = await parentColumn.getModel(context);
        await parentModel.getColumns(context);

        selectQb.join(
          knex.raw(`?? as ??`, [
            baseModelSqlv2.getTnPath(parentModel.table_name),
            nestedAlias,
          ]),
          `${nestedAlias}.${parentColumn.column_name}`,
          `${prevAlias}.${childColumn.column_name}`,
        );
      } else if (relation.type === RelationTypes.HAS_MANY) {
        isBtLookup = false;
        const childColumn = await relation.getChildColumn(context);
        const parentColumn = await relation.getParentColumn(context);
        const childModel = await childColumn.getModel(context);
        await childModel.getColumns(context);
        const parentModel = await parentColumn.getModel(context);
        await parentModel.getColumns(context);

        selectQb.join(
          knex.raw(`?? as ??`, [
            baseModelSqlv2.getTnPath(childModel.table_name),
            nestedAlias,
          ]),
          `${nestedAlias}.${childColumn.column_name}`,
          `${prevAlias}.${parentColumn.column_name}`,
        );
      } else if (relation.type === RelationTypes.MANY_TO_MANY) {
        isBtLookup = false;
        const childColumn = await relation.getChildColumn(context);
        const parentColumn = await relation.getParentColumn(context);
        const childModel = await childColumn.getModel(context);
        await childModel.getColumns(context);
        const parentModel = await parentColumn.getModel(context);
        await parentModel.getColumns(context);

        const mmTableAlias = getAlias();

        const mmModel = await relation.getMMModel(context);
        const mmChildCol = await relation.getMMChildColumn(context);
        const mmParentCol = await relation.getMMParentColumn(context);

        selectQb
          .innerJoin(
            baseModelSqlv2.getTnPath(mmModel.table_name, mmTableAlias),
            knex.ref(`${mmTableAlias}.${mmChildCol.column_name}`),
            '=',
            knex.ref(`${prevAlias}.${childColumn.column_name}`),
          )
          .innerJoin(
            knex.raw('?? as ??', [
              baseModelSqlv2.getTnPath(parentModel.table_name),
              nestedAlias,
            ]),
            knex.ref(`${mmTableAlias}.${mmParentCol.column_name}`),
            '=',
            knex.ref(`${nestedAlias}.${parentColumn.column_name}`),
          )
          .where(
            knex.ref(`${mmTableAlias}.${mmChildCol.column_name}`),
            '=',
            knex.ref(
              `${alias || baseModelSqlv2.getTnPath(childModel.table_name)}.${
                childColumn.column_name
              }`,
            ),
          );
      }

      if (lookupColumn.uidt === UITypes.Lookup)
        lookupColumn = await nestedLookupColOpt.getLookupColumn(context);
      else lookupColumn = await getDisplayValueOfRefTable(context, relationCol);
      prevAlias = nestedAlias;
    }

    {
      // get basemodel and model of lookup column
      const model = await lookupColumn.getModel(context);
      const baseModelSqlv2 = await Model.getBaseModelSQL(context, {
        model,
        dbDriver: knex,
      });

      switch (lookupColumn.uidt) {
        case UITypes.Attachment:
          NcError.badRequest(
            'Group by using attachment column is not supported',
          );
          break;
        case UITypes.Links:
        case UITypes.Rollup:
          {
            const builder = (
              await genRollupSelectv2({
                baseModelSqlv2,
                knex,
                columnOptions:
                  (await lookupColumn.getColOptions(context)) as RollupColumn,
                alias: prevAlias,
              })
            ).builder;
            selectQb.select(builder);
          }
          break;
        case UITypes.Formula:
          {
            const builder = (
              await formulaQueryBuilderv2(
                baseModelSqlv2,
                (
                  await lookupColumn.getColOptions<FormulaColumn>(context)
                ).formula,
                lookupColumn.id,
                model,
                lookupColumn,
                await model.getAliasColMapping(context),
                prevAlias,
              )
            ).builder;

            selectQb.select(builder);
          }
          break;
        case UITypes.DateTime:
        case UITypes.LastModifiedTime:
        case UITypes.CreatedTime:
          {
            await baseModelSqlv2.selectObject({
              qb: selectQb,
              columns: [lookupColumn],
              alias: prevAlias,
            });
          }
          break;
        default:
          {
            selectQb.select(
              `${prevAlias}.${lookupColumn.column_name} as ${lookupColumn.id}`,
            );
          }

          break;
      }
    }
    // if all relation are belongs to then we don't need to do the aggregation
    if (isBtLookup) {
      return {
        builder: selectQb,
      };
    }

    const subQueryAlias = getAlias();

    if (baseModelSqlv2.isPg) {
      // alternate approach with array_agg
      return {
        builder: knex
          .select(knex.raw('json_agg(??)::text', [lookupColumn.id]))
          .from(selectQb.as(subQueryAlias)),
      };
      /*
      // alternate approach with array_agg
      return {
        builder: knex
          .select(knex.raw('array_agg(??)', [lookupColumn.id]))
          .from(selectQb),
      };*/
      // alternate approach with string aggregation
      // return {
      //   builder: knex
      //     .select(
      //       knex.raw('STRING_AGG(??::text, ?)', [
      //         lookupColumn.id,
      //         LOOKUP_VAL_SEPARATOR,
      //       ]),
      //     )
      //     .from(selectQb.as(subQueryAlias)),
      // };
    } else if (baseModelSqlv2.isMySQL) {
      return {
        builder: knex
          .select(
            knex.raw('cast(JSON_ARRAYAGG(??) as NCHAR)', [lookupColumn.id]),
          )
          .from(selectQb.as(subQueryAlias)),
      };

      // return {
      //   builder: knex
      //     .select(
      //       knex.raw('GROUP_CONCAT(?? ORDER BY ?? ASC SEPARATOR ?)', [
      //         lookupColumn.id,
      //         lookupColumn.id,
      //         LOOKUP_VAL_SEPARATOR,
      //       ]),
      //     )
      //     .from(selectQb.as(subQueryAlias)),
      // };
    } else if (baseModelSqlv2.isSqlite) {
      // ref: https://stackoverflow.com/questions/13382856/sqlite3-join-group-concat-using-distinct-with-custom-separator
      // selectQb.orderBy(`${lookupColumn.id}`, 'asc');
      return {
        builder: knex
          .select(
            knex.raw(`group_concat(??, ?)`, [
              lookupColumn.id,
              LOOKUP_VAL_SEPARATOR,
            ]),
          )
          .from(selectQb.as(subQueryAlias)),
      };
    } else if (baseModelSqlv2.isMssql) {
      // ref: https://stackoverflow.com/questions/13382856/sqlite3-join-group-concat-using-distinct-with-custom-separator
      // selectQb.orderBy(`${lookupColumn.id}`, 'asc');
      return {
        builder: knex
          .select(
            knex.raw(`STRING_AGG(??, ?)`, [
              lookupColumn.id,
              LOOKUP_VAL_SEPARATOR,
            ]),
          )
          .from(selectQb.as(subQueryAlias)),
      };
    }

    NcError.notImplemented(
      'Database not supported this operation on Lookup/LTAR',
    );
  }
}