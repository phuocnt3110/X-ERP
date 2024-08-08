import type { LookupType } from 'nocodb-sdk';
import Column from '~/models/Column';
import Noco from '~/Noco';
import NocoCache from '~/cache/NocoCache';
import { extractProps } from '~/helpers/extractProps';
import { CacheGetType, CacheScope, MetaTable } from '~/utils/globals';

export default class XLookupColumn implements LookupType {
  parentId: string;
  fk_parent_column_id: string;
  fk_child_column_id: string;
  fk_lookup_column_id: string;
  fk_column_id: string;

  constructor(data: Partial<XLookupColumn>) {
    Object.assign(this, data);
  }

  public async getChildColumn(): Promise<Column> {
    return await Column.get({
      colId: this.fk_child_column_id,
    });
  }

  public async getParentColumn(): Promise<Column> {
    return await Column.get(context, {
      colId: this.fk_parent_column_id,
    });
  }

  public async getLookupColumn(): Promise<Column> {
    return await Column.get({
      colId: this.fk_lookup_column_id,
    });
  }

  public static async insert(
    data: Partial<XLookupColumn>,
    ncMeta = Noco.ncMeta,
  ) {
    const insertObj = extractProps(data, [
      'parentId',
      'fk_parent_column_id',
      'fk_column_id',
      'fk_child_column_id',
      'fk_lookup_column_id',
    ]);

    await ncMeta.metaInsert2(null, null, MetaTable.COL_XLOOKUP, insertObj);

    return this.read(data.fk_column_id, ncMeta).then(async (lookupColumn) => {
      await NocoCache.appendToList(
        CacheScope.COL_XLOOKUP,
        [data.fk_lookup_column_id],
        `${CacheScope.COL_XLOOKUP}:${data.fk_column_id}`,
      );

      await NocoCache.appendToList(
        CacheScope.COL_XLOOKUP,
        [data.fk_parent_column_id],
        `${CacheScope.COL_XLOOKUP}:${data.fk_column_id}`,
      );

      return lookupColumn;
    });
  }

  public static async read(columnId: string, ncMeta = Noco.ncMeta) {
    let colData =
      columnId &&
      (await NocoCache.get(
        `${CacheScope.COL_XLOOKUP}:${columnId}`,
        CacheGetType.TYPE_OBJECT,
      ));
    if (!colData) {
      colData = await ncMeta.metaGet2(
        null, //,
        null, //model.db_alias,
        MetaTable.COL_XLOOKUP,
        { fk_column_id: columnId },
      );
      await NocoCache.set(`${CacheScope.COL_XLOOKUP}:${columnId}`, colData);
    }
    return colData ? new XLookupColumn(colData) : null;
  }

  id: string;
}