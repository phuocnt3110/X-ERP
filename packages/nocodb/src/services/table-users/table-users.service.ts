import { Injectable } from '@nestjs/common';
import {
  AppEvents,
  extractRolesObj,
  OrgUserRoles,
  PluginCategory,
  TableRoles,
} from 'nocodb-sdk';
import { v4 as uuidv4 } from 'uuid';
import * as ejs from 'ejs';
import validator from 'validator';
import type { TableUserReqType, UserType } from 'nocodb-sdk';
import type { NcContext, NcRequest } from '~/interface/config';
import { validatePayload } from '~/helpers';
import Noco from '~/Noco';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';
import { NcError } from '~/helpers/catchError';
import NcPluginMgrv2 from '~/helpers/NcPluginMgrv2';
import { PagedResponseImpl } from '~/helpers/PagedResponse';
import { Model, TableUser, User } from '~/models';
import { MetaTable } from '~/utils/globals';
import { extractProps } from '~/helpers/extractProps';
import { getTableRolePower } from '~/utils/roleHelper';

@Injectable()
export class TableUsersService {
  constructor(protected appHooksService: AppHooksService) {}

  async userList(param: { tableId: string; mode?: 'full' | 'viewer' }) {
    const tableUsers = await TableUser.getUsersList({
      table_id: param.tableId,
      mode: param.mode,
    });

    return new PagedResponseImpl(tableUsers, {
      count: tableUsers.length,
    });
  }

  async userInvite(
    context: NcContext,
    param: {
    tableId: string;
    tableUser: TableUserReqType;
    req: NcRequest;
  }): Promise<any> {
    validatePayload(
      'swagger.json#/components/schemas/TableUserReq',
      param.tableUser,
    );

    if (
      getTableRolePower({
        table_roles: extractRolesObj(param.tableUser.roles),
      }) > getTableRolePower(param.req.user)
    ) {
      NcError.badRequest(`Insufficient privilege to invite with this role`);
    }

    if (
      ![
        TableRoles.CREATOR,
        TableRoles.EDITOR,
        TableRoles.COMMENTER,
        TableRoles.VIEWER,
        TableRoles.NO_ACCESS,
      ].includes(param.tableUser.roles as TableRoles)
    ) {
      NcError.badRequest('Invalid role');
    }

    const emails = (param.tableUser.email || '')
      .toLowerCase()
      .split(/\s*,\s*/)
      .map((v) => v.trim());

    // check for invalid emails
    const invalidEmails = emails.filter((v) => !validator.isEmail(v));
    if (!emails.length) {
      return NcError.badRequest('Invalid email address');
    }
    if (invalidEmails.length) {
      NcError.badRequest('Invalid email address : ' + invalidEmails.join(', '));
    }

    const invite_token = uuidv4();
    const error = [];

    for (const email of emails) {
      // add user to table if user already exist
      const user = await User.getByEmail(email);

      const table = await Model.get(context, param.tableId);

      if (!table) {
        return NcError.tableNotFound(param.tableId);
      }

      if (user) {
        // check if this user has been added to this table
        const tableUser = await TableUser.get(param.tableId, user.id);

        const table = await Model.get(context, param.tableId);

        if (!table) {
          return NcError.tableNotFound(param.tableId);
        }

        if (tableUser && tableUser.roles) {
          NcError.badRequest(
            `${user.email} with role ${tableUser.roles} already exists in this table`,
          );
        }

        await TableUser.insert(context, {
          fk_model_id: param.tableId,
          fk_user_id: user.id,
          roles: param.tableUser.roles || 'editor',
        });

        this.appHooksService.emit(AppEvents.TABLE_INVITE, {
          table,
          user,
          invitedBy: param.req.user,
          ip: param.req.clientIp,
          req: param.req,
        });
      } 
      // else {
      //   try {
      //     // create new user with invite token
      //     const user = await User.insert({
      //       invite_token,
      //       invite_token_expires: new Date(Date.now() + 24 * 60 * 60 * 1000),
      //       email,
      //       roles: OrgUserRoles.VIEWER,
      //       token_version: randomTokenString(),
      //     });

      //     // add user to table
      //     await TableUser.insert({
      //       table_id: param.tableId,
      //       fk_user_id: user.id,
      //       roles: param.tableUser.roles,
      //     });

      //     this.appHooksService.emit(AppEvents.PROJECT_INVITE, {
      //       table,
      //       user,
      //       invitedBy: param.req.user,
      //       ip: param.req.clientIp,
      //       req: param.req,
      //     });

      //     // in case of single user check for smtp failure
      //     // and send back token if failed
      //     if (
      //       emails.length === 1 &&
      //       !(await this.sendInviteEmail(email, invite_token, param.req))
      //     ) {
      //       return { invite_token, email };
      //     } else {
      //       this.sendInviteEmail(email, invite_token, param.req);
      //     }
      //   } catch (e) {
      //     console.log(e);
      //     if (emails.length === 1) {
      //       throw e;
      //     } else {
      //       error.push({ email, error: e.message });
      //     }
      //   }
      // }
    }

    if (emails.length === 1) {
      return {
        msg: 'The user has been invited successfully',
      };
    } else {
      return { invite_token, emails, error };
    }
  }

  async tableUserUpdate(
    context: NcContext,
    param: {
    userId: string;
    // todo: update swagger
    tableUser: TableUserReqType & { table_id: string };
    // todo: refactor
    req: any;
    tableId: string;
  }): Promise<any> {
    validatePayload(
      'swagger.json#/components/schemas/TableUserReq',
      param.tableUser,
    );

    if (!param.tableId) {
      NcError.badRequest('Missing table id');
    }

    const table = await Model.get(context, param.tableId);

    if (!table) {
      return NcError.tableNotFound(param.tableId);
    }

    if (param.tableUser.roles.includes(TableRoles.OWNER)) {
      NcError.badRequest('Owner cannot be updated');
    }

    if (
      ![
        TableRoles.CREATOR,
        TableRoles.EDITOR,
        TableRoles.COMMENTER,
        TableRoles.VIEWER,
        TableRoles.NO_ACCESS,
      ].includes(param.tableUser.roles as TableRoles)
    ) {
      NcError.badRequest('Invalid role');
    }

    const user = await User.get(param.userId);

    if (!user) {
      NcError.badRequest(`User with id '${param.userId}' doesn't exist`);
    }

    const targetUser = await User.getWithRoles(context, param.userId, {
      user,
      tableId: param.tableId,
    });

    if (!targetUser) {
      NcError.badRequest(
        `User with id '${param.userId}' doesn't exist in this table`,
      );
    }

    if (
      getTableRolePower(targetUser) >= getTableRolePower(param.req.user)
    ) {
      NcError.badRequest(`Insufficient privilege to update user`);
    }

    await TableUser.updateRoles(
      context,
      param.tableId,
      param.userId,
      param.tableUser.roles,
    );

    this.appHooksService.emit(AppEvents.TABLE_USER_UPDATE, {
      table,
      user,
      updatedBy: param.req.user,
      ip: param.req.clientIp,
      tableUser: param.tableUser,
      req: param.req,
    });

    return {
      msg: 'User has been updated successfully',
    };
  }

  async tableUserDelete(
    context: NcContext,
    param: {
    tableId: string;
    userId: string;
    // todo: refactor
    req: any;
  }): Promise<any> {
    const table_id = param.tableId;

    if (param.req.user?.id === param.userId) {
      NcError.badRequest("Admin can't delete themselves!");
    }

    if (!param.req.user?.table_roles?.owner) {
      const user = await User.get(param.userId);
      if (user.roles?.split(',').includes('super'))
        NcError.forbidden(
          'Insufficient privilege to delete a super admin user.',
        );

      const tableUser = await TableUser.get(table_id, param.userId);
      if (tableUser?.roles?.split(',').includes('owner'))
        NcError.forbidden('Insufficient privilege to delete a owner user.');
    }

    await TableUser.delete(context, table_id, param.userId);
    return true;
  }

  // async tableUserInviteResend(param: {
  //   userId: string;
  //   tableUser: TableUserReqType;
  //   tableId: string;
  //   // todo: refactor
  //   req: any;
  // }): Promise<any> {
  //   const user = await User.get(param.userId);

  //   if (!user) {
  //     NcError.badRequest(`User with id '${param.userId}' not found`);
  //   }

  //   const table = await Model.get(param.tableId);

  //   if (!table) {
  //     return NcError.tableNotFound(param.tableId);
  //   }

  //   const invite_token = uuidv4();

  //   await User.update(user.id, {
  //     invite_token,
  //     invite_token_expires: new Date(Date.now() + 24 * 60 * 60 * 1000),
  //   });

  //   const pluginData = await Noco.ncMeta.metaGet2(
  //     null,
  //     null,
  //     MetaTable.PLUGIN,
  //     {
  //       category: PluginCategory.EMAIL,
  //       active: true,
  //     },
  //   );

  //   if (!pluginData) {
  //     NcError.badRequest(
  //       `No Email Plugin is found. Please go to App Store to configure first or copy the invitation URL to users instead.`,
  //     );
  //   }

  //   await this.sendInviteEmail(user.email, invite_token, param.req);

  //   this.appHooksService.emit(AppEvents.PROJECT_USER_RESEND_INVITE, {
  //     table,
  //     user,
  //     invitedBy: param.req.user,
  //     ip: param.req.clientIp,
  //     tableUser: param.tableUser,
  //     req: param.req,
  //   });

  //   return true;
  // }

  // todo: refactor the whole function
  // async sendInviteEmail(email: string, token: string, req: any): Promise<any> {
  //   try {
  //     const template = (await import('./ui/emailTemplates/invite')).default;

  //     const emailAdapter = await NcPluginMgrv2.emailAdapter();

  //     if (emailAdapter) {
  //       await emailAdapter.mailSend({
  //         to: email,
  //         subject: 'Verify email',
  //         html: ejs.render(template, {
  //           signupLink: `${req.ncSiteUrl}${
  //             Noco.getConfig()?.dashboardPath
  //           }#/signup/${token}`,
  //           tableName: req.body?.tableName,
  //           roles: (req.body?.roles || '')
  //             .split(',')
  //             .map((r) => r.replace(/^./, (m) => m.toUpperCase()))
  //             .join(', '),
  //           adminEmail: req.user?.email,
  //         }),
  //       });
  //       return true;
  //     }
  //   } catch (e) {
  //     console.log(
  //       'Warning : `mailSend` failed, Please configure emailClient configuration.',
  //       e.message,
  //     );
  //     throw e;
  //   }
  // }

  async tableUserMetaUpdate(
    context: NcContext,
    param: {
    body: any;
    tableId: string;
    user: UserType;
  }) {
    // update table user data
    const tableUserData = extractProps(param.body, [
      'starred',
      'order',
      'hidden',
    ]);

    if (Object.keys(tableUserData).length) {
      // create new table user if it doesn't exist
      if (!(await TableUser.get(param.tableId, param.user?.id))) {
        await TableUser.insert(context, {
          ...tableUserData,
          fk_model_id: param.tableId,
          fk_user_id: param.user?.id,
        });
      } else {
        await TableUser.update(param.tableId, param.user?.id, tableUserData);
      }
    }

    return true;
  }
}