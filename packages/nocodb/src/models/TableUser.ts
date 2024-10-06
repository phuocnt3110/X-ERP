import { ProjectRoles, TableRoles, RolesObj, OrgUserRoles } from 'nocodb-sdk';
import type { TableType } from 'nocodb-sdk';
import type User from '~/models/User';
import {
  CacheDelDirection,
  CacheGetType,
  CacheScope,
  MetaTable,
} from '~/utils/globals';
import Noco from '~/Noco';
import NocoCache from '~/cache/NocoCache';
import { extractProps } from '~/helpers/extractProps';
import { parseMetaProp } from '~/utils/modelUtils';
import { NcContext } from 'src/interface/config';

export default class TableUser {
  fk_model_id: string;
  fk_user_id: string;
  roles?: string;

  constructor(data: TableUser) {
    Object.assign(this, data);
  }

  protected static castType(tableUser: TableUser): TableUser {
    return tableUser && new TableUser(tableUser);
  }

  public static async bulkInsert(
    context: NcContext,
    tableUsers: Partial<TableUser>[],
    ncMeta = Noco.ncMeta,
  ) {
    const insertObj = tableUsers.map((tableUser) =>
      extractProps(tableUser, ['fk_user_id', 'fk_model_id', 'roles']),
    );

    const bulkData = await ncMeta.bulkMetaInsert(
      context.workspace_id,
      context.base_id,
      MetaTable.TABLE_USERS,
      insertObj,
      true,
    );

    const uniqueFks: string[] = [
      ...new Set(bulkData.map((d) => d.fk_model_id)),
    ] as string[];

    for (const fk of uniqueFks) {
      await NocoCache.deepDel(
        `${CacheScope.TABLE_USER}:${fk}:list`,
        CacheDelDirection.PARENT_TO_CHILD,
      );
    }

    for (const d of bulkData) {
      await NocoCache.set(
        `${CacheScope.TABLE_USER}:${d.fk_model_id}:${d.fk_user_id}`,
        d,
      );

      await NocoCache.appendToList(
        CacheScope.TABLE_USER,
        [d.fk_model_id],
        `${CacheScope.TABLE_USER}:${d.fk_model_id}:${d.fk_user_id}`,
      );
    }
  }

  public static async insert(
    context: NcContext,
    tableUser: Partial<TableUser>,
    ncMeta = Noco.ncMeta,
  ) {
    const insertObj = extractProps(tableUser, [
      'fk_user_id',
      'fk_model_id',
      'roles',
    ]);

    const { fk_model_id, fk_user_id } = await ncMeta.metaInsert2(
      context.workspace_id,
      context.base_id,
      MetaTable.TABLE_USERS,
      insertObj,
      true,
    );

    const res = await this.get(fk_model_id, fk_user_id, ncMeta);

    await NocoCache.appendToList(
      CacheScope.TABLE_USER,
      [fk_model_id],
      `${CacheScope.TABLE_USER}:${fk_model_id}:${fk_user_id}`,
    );

    return res;
  }

  // public static async update(id, user: Partial<TableUser>, ncMeta = Noco.ncMeta) {
  //   // return await ncMeta.metaUpdate(null, null, MetaTable.USERS, id, insertObj);
  // }
  static async get(tableId: string, userId: string, ncMeta = Noco.ncMeta) {
    let tableUser =
      tableId &&
      userId &&
      (await NocoCache.get(
        `${CacheScope.TABLE_USER}:${tableId}:${userId}`,
        CacheGetType.TYPE_OBJECT,
      ));
    if (!tableUser || !tableUser.roles) {
      const queryBuilder = ncMeta
        .knex(MetaTable.USERS)
        .select(
          `${MetaTable.USERS}.id`,
          `${MetaTable.USERS}.email`,
          `${MetaTable.USERS}.display_name`,
          `${MetaTable.USERS}.invite_token`,
          `${MetaTable.USERS}.roles as main_roles`,
          `${MetaTable.USERS}.created_at as created_at`,
          `${MetaTable.TABLE_USERS}.fk_model_id`,
          `${MetaTable.TABLE_USERS}.roles as roles`,
        );

      queryBuilder.leftJoin(MetaTable.TABLE_USERS, function () {
        this.on(
          `${MetaTable.TABLE_USERS}.fk_user_id`,
          '=',
          `${MetaTable.USERS}.id`,
        ).andOn(
          `${MetaTable.TABLE_USERS}.fk_model_id`,
          '=',
          ncMeta.knex.raw('?', [tableId]),
        );
      });

      queryBuilder.where(`${MetaTable.USERS}.id`, userId);

      tableUser = await queryBuilder.first();

      if (tableUser) {
        await NocoCache.set(
          `${CacheScope.TABLE_USER}:${tableId}:${userId}`,
          tableUser,
        );
      }
    }
    return this.castType(tableUser);
  }

  public static async getUsersList(
    {
      table_id,
      mode = 'full',
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      include_ws_deleted = true,
    }: {
      table_id: string;
      mode?: 'full' | 'viewer';
      include_ws_deleted?: boolean;
    },
    ncMeta = Noco.ncMeta,
  ): Promise<(Partial<User> & TableUser)[]> {
    const cachedList = await NocoCache.getList(CacheScope.TABLE_USER, [table_id]);
    let { list: tableUsers } = cachedList;
    const { isNoneList } = cachedList;

    const fullVersionCols = [
      'invite_token',
      'main_roles',
      'created_at',
      'fk_model_id',
      'roles',
    ];

    if (!isNoneList && !tableUsers.length) {
      const queryBuilder = ncMeta
        .knex(MetaTable.USERS)
        .select(
          `${MetaTable.USERS}.id`,
          `${MetaTable.USERS}.email`,
          `${MetaTable.USERS}.display_name`,
          `${MetaTable.USERS}.invite_token`,
          `${MetaTable.USERS}.roles as main_roles`,
          `${MetaTable.USERS}.created_at as created_at`,
          `${MetaTable.TABLE_USERS}.fk_model_id`,
          `${MetaTable.TABLE_USERS}.roles as roles`,
        );

      queryBuilder.leftJoin(MetaTable.TABLE_USERS, function () {
        this.on(
          `${MetaTable.TABLE_USERS}.fk_user_id`,
          '=',
          `${MetaTable.USERS}.id`,
        ).andOn(
          `${MetaTable.TABLE_USERS}.fk_model_id`,
          '=',
          ncMeta.knex.raw('?', [table_id]),
        );
      });

      tableUsers = await queryBuilder;

      tableUsers = tableUsers.map((tableUser) => {
        tableUser.fk_model_id = table_id;
        return this.castType(tableUser);
      });

      await NocoCache.setList(CacheScope.TABLE_USER, [table_id], tableUsers, [
        'fk_model_id',
        'id',
      ]);
    }

    if (mode === 'full') {
      return tableUsers;
    }

    // remove full version props if viewer
    for (const user of tableUsers) {
      for (const prop of fullVersionCols) {
        delete user[prop];
      }
    }

    return tableUsers;
  }

  public static async getUsersCount(
    {
      table_id,
      query,
    }: {
      table_id: string;
      query?: string;
    },
    ncMeta = Noco.ncMeta,
  ): Promise<number> {
    const queryBuilder = ncMeta.knex(MetaTable.USERS);

    if (query) {
      queryBuilder.where('email', 'like', `%${query.toLowerCase?.()}%`);
    }

    queryBuilder.leftJoin(MetaTable.TABLE_USERS, function () {
      this.on(
        `${MetaTable.TABLE_USERS}.fk_user_id`,
        '=',
        `${MetaTable.USERS}.id`,
      ).andOn(
        `${MetaTable.TABLE_USERS}.fk_model_id`,
        '=',
        ncMeta.knex.raw('?', [table_id]),
      );
    });

    return (await queryBuilder.count('id', { as: 'count' }).first()).count;
  }

  static async updateRoles(
    context: NcContext,
    tableId,
    userId,
    roles: string,
    ncMeta = Noco.ncMeta,
  ) {
    // set meta
    const res = await ncMeta.metaUpdate(
      context.workspace_id,
      context.base_id,
      MetaTable.TABLE_USERS,
      {
        roles,
      },
      {
        fk_user_id: userId,
        fk_model_id: tableId,
      },
    );

    await NocoCache.update(`${CacheScope.TABLE_USER}:${tableId}:${userId}`, {
      roles,
    });

    return res;
  }

  static async update(
    tableId,
    userId,
    tableUser: Partial<TableUser>,
    ncMeta = Noco.ncMeta,
  ) {
    const updateObj = extractProps(tableUser, ['starred', 'hidden', 'order']);

    // set meta
    await ncMeta.metaUpdate(null, null, MetaTable.TABLE_USERS, updateObj, {
      fk_user_id: userId,
      fk_model_id: tableId,
    });

    await NocoCache.update(
      `${CacheScope.TABLE_USER}:${tableId}:${userId}`,
      updateObj,
    );

    return await this.get(tableId, userId, ncMeta);
  }

  static async delete(context: NcContext, tableId: string, userId: string, ncMeta = Noco.ncMeta) {
    // delete meta
    const response = await ncMeta.metaDelete(
      context.workspace_id,
      context.base_id,
      MetaTable.TABLE_USERS,
      {
        fk_user_id: userId,
        fk_model_id: tableId,
      },
    );

    // delete list cache to refresh list
    await NocoCache.deepDel(
      `${CacheScope.BASE_USER}:${tableId}:list`,
      CacheDelDirection.PARENT_TO_CHILD,
    );

    return response;
  }

  static async getTablesIdList(
    userId: string,
    ncMeta = Noco.ncMeta,
  ): Promise<TableUser[]> {
    return await ncMeta.metaList2(null, null, MetaTable.TABLE_USERS, {
      condition: { fk_user_id: userId },
    });
  }

  static async getTablesList(
    userId: string,
    baseId: any,
    sourceId: string,
    roles: RolesObj,
    ncMeta = Noco.ncMeta,
  ): Promise<TableType[]> {
  //   // TODO implement CacheScope.USER_TABLE
    const qb = ncMeta
      .knex(MetaTable.MODELS)
      .select(`${MetaTable.MODELS}.id`)
      .select(`${MetaTable.MODELS}.title`)
      .select(`${MetaTable.MODELS}.table_name`)
      .select(`${MetaTable.MODELS}.meta`)
      .select(`${MetaTable.MODELS}.schema`)
      .select(`${MetaTable.MODELS}.enabled`)
      .select(`${MetaTable.MODELS}.mm`)
      .select(`${MetaTable.MODELS}.tags`)
      .select(`${MetaTable.MODELS}.pinned`)
      .select(`${MetaTable.MODELS}.deleted`)
      .select(`${MetaTable.MODELS}.order`)
      .select(`${MetaTable.MODELS}.description`)
      .select(`${MetaTable.MODELS}.base_id`)
      .select(`${MetaTable.MODELS}.source_id`)
      .select(`${MetaTable.MODELS}.type`)
      .select(`${MetaTable.MODELS}.created_at`)
      .select(`${MetaTable.MODELS}.updated_at`)
      .select(`${MetaTable.TABLE_USERS}.updated_at as last_accessed`)
      .leftJoin(MetaTable.TABLE_USERS, function () {
        this.on(
          `${MetaTable.TABLE_USERS}.fk_model_id`,
          `${MetaTable.MODELS}.id`,
        );
        this.andOn(
          `${MetaTable.TABLE_USERS}.fk_user_id`,
          ncMeta.knex.raw('?', [userId]),
        );
      })
      .where(
        `${MetaTable.MODELS}.base_id`,
        ncMeta.knex.raw('?', [baseId])
      )
      .where(function () {
        this.where(`${MetaTable.MODELS}.deleted`, false).orWhereNull(
          `${MetaTable.MODELS}.deleted`,
        );
      }).where(function () {
        this.whereNull(`${MetaTable.TABLE_USERS}.roles`).orWhereNot(
          `${MetaTable.TABLE_USERS}.roles`,
          TableRoles.NO_ACCESS,
        );
      });

      if(sourceId) {
        qb.where(
          `${MetaTable.MODELS}.source_id`,
          ncMeta.knex.raw('?', [sourceId])
        )
      }

      if(roles[OrgUserRoles.SUPER_ADMIN]) {
        qb.select(
          ncMeta.knex.raw(`'${TableRoles.OWNER}' as table_roles`)
        )
      } else {
        qb.select(`${MetaTable.TABLE_USERS}.roles as table_roles`)
      }

      if(!roles[OrgUserRoles.SUPER_ADMIN] && !roles[ProjectRoles.OWNER]) {
        qb.where(
          `${MetaTable.TABLE_USERS}.fk_user_id`,
          ncMeta.knex.raw('?', [userId]),
        )
      }

      if(sourceId) {
        qb.where(
          `${MetaTable.MODELS}.source_id`,
          ncMeta.knex.raw('?', [sourceId])
        )
      }

    // filter shared with me tables
    // if (params.shared) {
    //   qb.where(function () {
    //     // include tables belongs project_user in which user is not owner
    //     this.where(function () {
    //       this.where(`${MetaTable.TABLE_USERS}.fk_user_id`, userId)
    //         .whereNot(`${MetaTable.TABLE_USERS}.roles`, TableRoles.OWNER)
    //         .whereNotNull(`${MetaTable.TABLE_USERS}.roles`);
    //     });
    //   });
    // }

    const tableList = await qb;

    if (tableList && tableList?.length) {
      const castedTableList = tableList
        // .filter((p) => !params?.type || p.type === params.type)
        .sort(
          (a, b) =>
            (a.order != null ? a.order : Infinity) -
            (b.order != null ? b.order : Infinity),
        );

      return castedTableList;
    } else {
      return [];
    }
  }

  static async updateOrInsert(
    context: NcContext,
    tableId,
    userId,
    tableUser: Partial<TableUser>,
    ncMeta = Noco.ncMeta,
  ) {
    const existingTableUser = await this.get(tableId, userId, ncMeta);

    if (existingTableUser) {
      return await this.update(tableId, userId, tableUser, ncMeta);
    } else {
      return await this.insert(context, { fk_model_id: tableId, fk_user_id: userId });
    }
  }
}
