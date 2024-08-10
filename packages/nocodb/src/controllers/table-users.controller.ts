import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { TableRoles, TableUserReqType } from 'nocodb-sdk';
import { GlobalGuard } from '~/guards/global/global.guard';
import { TableUsersService } from '~/services/table-users/table-users.service';
import { NcError } from '~/helpers/catchError';
import { Acl } from '~/middlewares/extract-ids/extract-ids.middleware';
import { MetaApiLimiterGuard } from '~/guards/meta-api-limiter.guard';
import { TenantContext } from '~/decorators/tenant-context.decorator';
import { NcContext, NcRequest } from 'src/interface/config';

@UseGuards(MetaApiLimiterGuard, GlobalGuard)
@Controller()
export class TableUsersController {
  constructor(protected readonly tableUsersService: TableUsersService) {}

  @Get([
    '/api/v1/db/meta/tables/:tableId/users',
    '/api/v2/meta/tables/:tableId/users',
  ])
  @Acl('tableUserList', {scope: 'table'})
  async userList(@Param('tableId') tableId: string, @Req() req: Request) {
    const tableRoles = Object.keys(req.user?.table_roles ?? {});
    const mode =
      tableRoles.includes(TableRoles.OWNER) ||
      tableRoles.includes(TableRoles.CREATOR)
        ? 'full'
        : 'viewer';

    return {
      users: await this.tableUsersService.userList({
        tableId,
        mode,
      }),
    };
  }

  @Post([
    '/api/v1/db/meta/tables/:tableId/users',
    '/api/v2/meta/tables/:tableId/users',
  ])
  @HttpCode(200)
  @Acl('newTableUser', {scope: 'table'})
  async userInvite(
    @TenantContext() context: NcContext,
    @Param('tableId') tableId: string,
    @Req() req: NcRequest,
    @Body() body: TableUserReqType,
  ): Promise<any> {
    // todo: move this to a service
    if (!body.email) {
      NcError.badRequest('Email is required');
    }
    return await this.tableUsersService.userInvite(context, {
      tableId,
      tableUser: body,
      req,
    });
  }

  @Patch([
    '/api/v1/db/meta/tables/:tableId/users/:userId',
    '/api/v2/meta/tables/:tableId/users/:userId',
  ])
  @Acl('tableUserUpdate', {scope: 'table'})
  async tableUserUpdate(
    @TenantContext() context: NcContext,
    @Param('tableId') tableId: string,
    @Param('userId') userId: string,
    @Req() req: Request,
    @Body()
    body: TableUserReqType & {
      table_id: string;
    },
  ): Promise<any> {
    await this.tableUsersService.tableUserUpdate(context, {
      tableUser: body,
      tableId,
      userId,
      req,
    });
    return {
      msg: 'The user has been updated successfully',
    };
  }

  @Delete([
    '/api/v1/db/meta/tables/:tableId/users/:userId',
    '/api/v2/meta/tables/:tableId/users/:userId',
  ])
  @Acl('tableUserDelete', {scope: 'table'})
  async tableUserDelete(
    @TenantContext() context: NcContext,
    @Param('tableId') tableId: string,
    @Param('userId') userId: string,
    @Req() req: Request,
  ): Promise<any> {
    await this.tableUsersService.tableUserDelete(context, {
      tableId,
      userId,
      req,
    });
    return {
      msg: 'The user has been deleted successfully',
    };
  }
}