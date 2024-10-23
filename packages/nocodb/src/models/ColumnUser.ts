import { Base, Column } from '~/models';
import {
  MetaTable
} from '~/utils/globals';
import Noco from '~/Noco';
import type { ProtectColumnReqType, UserType } from 'nocodb-sdk';
import { extractProps } from '~/helpers/extractProps';
import { NcError } from 'src/helpers/catchError';
import { NcContext } from 'src/interface/config';

export default class ColumnUser {
  fk_column_id: string;
  fk_user_id: string;

  constructor(data: ColumnUser) {
    Object.assign(this, data);
  }

  protected static castType(columnUser: ColumnUser): ColumnUser {
    return columnUser && new ColumnUser(columnUser);
  }

  public static async updateProtectColumn(
    context: NcContext,
    columnId: string,
    protectColumn: ProtectColumnReqType,
    user: UserType,
    ncMeta = Noco.ncMeta,
  ) {
    const column = await Column.get(context, {
      colId: columnId,
    });

    if (!column) {
      NcError.fieldNotFound(columnId);
    }

    await Column.update(context, columnId, {
      ...column,
      protect_type: protectColumn.protect_type
    });

    await ncMeta.metaDelete(
      context.workspace_id,
      context.base_id,
      MetaTable.COLUMN_USERS,
      {
        fk_column_id: columnId
      },
    );

    if (protectColumn.protect_type == 'owner' || protectColumn.protect_type == 'custom') {
      let insertObj = []
      
      if (protectColumn.protect_type == 'owner') {
        insertObj.push({
          fk_column_id: columnId,
          fk_user_id: user.id
        })
      } else {
        insertObj = protectColumn.user_list.map((columnUser) => {
          return {
            fk_column_id: columnId,
            fk_user_id: columnUser
          }
        });
      }

      await ncMeta.bulkMetaInsert(
        context.workspace_id,
        context.base_id,
        MetaTable.COLUMN_USERS,
        insertObj,
        true,
      );
    }
  }

  static async getUsersList(context: NcContext, columnId: string, ncMeta = Noco.ncMeta) {
    const column = await Column.get(context, {colId: columnId});

    if (!column) {
      NcError.fieldNotFound(columnId);
    }

    const qb1 = ncMeta
    .knex(MetaTable.TABLE_USERS)
    .select(
      `${MetaTable.TABLE_USERS}.fk_user_id`
    );

    qb1.where(
      `${MetaTable.TABLE_USERS}.fk_model_id`,
      ncMeta.knex.raw(`?`, [ column.fk_model_id ]),
    ).andWhereNot(
      `${MetaTable.TABLE_USERS}.roles`,
      ncMeta.knex.raw(`?`, [ 'table-level-owner' ]),
    ).andWhereNot(
      `${MetaTable.TABLE_USERS}.roles`,
      ncMeta.knex.raw(`?`, [ 'no-access' ]),
    );

    const baseUsers = await qb1;

    const qb2 = ncMeta
      .knex(MetaTable.USERS)
      .select(
        `${MetaTable.USERS}.id as fk_user_id`,
        `${MetaTable.USERS}.email`,
        `${MetaTable.USERS}.display_name`,
        `${MetaTable.COLUMN_USERS}.fk_column_id`,
      );

    qb2.leftJoin(MetaTable.COLUMN_USERS, function () {
      this.on(
        `${MetaTable.COLUMN_USERS}.fk_user_id`,
        '=',
        `${MetaTable.USERS}.id`,
      ).andOn(
        `${MetaTable.COLUMN_USERS}.fk_column_id`, 
        '=',
        ncMeta.knex.raw('?', [columnId])
      );
    });

    qb2.whereIn(
      `${MetaTable.USERS}.id`,
      baseUsers.map(e => e.fk_user_id)
    );

    const columnUsers = await qb2;

    return {user_list : columnUsers};
  }

}
