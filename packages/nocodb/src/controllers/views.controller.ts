import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ViewUpdateReqType } from 'nocodb-sdk';
import { PagedResponseImpl } from '~/helpers/PagedResponse';
import { GlobalGuard } from '~/guards/global/global.guard';
import { ViewsService } from '~/services/views.service';
import { Acl } from '~/middlewares/extract-ids/extract-ids.middleware';
import { MetaApiLimiterGuard } from '~/guards/meta-api-limiter.guard';
import { TenantContext } from '~/decorators/tenant-context.decorator';
import { NcContext, NcRequest } from '~/interface/config';

@Controller()
@UseGuards(MetaApiLimiterGuard, GlobalGuard)
export class ViewsController {
  constructor(private readonly viewsService: ViewsService) {}

  @Get([
    '/api/v1/db/meta/tables/:tableId/views',
    '/api/v2/meta/tables/:tableId/views',
  ])
  @Acl('viewList', {scope: 'table'})
  async viewList(
    @TenantContext() context: NcContext,
    @Param('tableId') tableId: string,
    @Req() req: NcRequest,
  ) {
    return new PagedResponseImpl(
      await this.viewsService.viewList(context, {
        tableId,
        user: req.user,
      }),
    );
  }

  @Patch(['/api/v1/db/meta/views/:viewId', '/api/v2/meta/views/:viewId'])
  @Acl('viewUpdate', {scope: 'table'})
  async viewUpdate(
    @TenantContext() context: NcContext,
    @Param('viewId') viewId: string,
    @Body() body: ViewUpdateReqType,
    @Req() req: NcRequest,
  ) {
    const result = await this.viewsService.viewUpdate(context, {
      viewId,
      view: body,
      user: req.user,
      req,
    });
    return result;
  }

  @Delete(['/api/v1/db/meta/views/:viewId', '/api/v2/meta/views/:viewId'])
  @Acl('viewDelete', {scope: 'table'})
  async viewDelete(
    @TenantContext() context: NcContext,
    @Param('viewId') viewId: string,
    @Req() req: NcRequest,
  ) {
    const result = await this.viewsService.viewDelete(context, {
      viewId,
      user: req.user,
      req,
    });
    return result;
  }

  @Post([
    '/api/v1/db/meta/views/:viewId/show-all',
    '/api/v2/meta/views/:viewId/show-all',
  ])
  @HttpCode(200)
  @Acl('showAllColumns', {scope: 'table'})
  async showAllColumns(
    @TenantContext() context: NcContext,
    @Param('viewId') viewId: string,
    @Query('ignoreIds') ignoreIds: string[],
  ) {
    return await this.viewsService.showAllColumns(context, {
      viewId,
      ignoreIds,
    });
  }
  @Post([
    '/api/v1/db/meta/views/:viewId/hide-all',
    '/api/v2/meta/views/:viewId/hide-all',
  ])
  @HttpCode(200)
  @Acl('hideAllColumns', {scope: 'table'})
  async hideAllColumns(
    @TenantContext() context: NcContext,
    @Param('viewId') viewId: string,
    @Query('ignoreIds') ignoreIds: string[],
  ) {
    return await this.viewsService.hideAllColumns(context, {
      viewId,
      ignoreIds,
    });
  }

  @Post([
    '/api/v1/db/meta/views/:viewId/share',
    '/api/v2/meta/views/:viewId/share',
  ])
  @HttpCode(200)
  @Acl('shareView', {scope: 'table'})
  async shareView(
    @TenantContext() context: NcContext,
    @Param('viewId') viewId: string,
    @Req() req: NcRequest,
  ) {
    return await this.viewsService.shareView(context, {
      viewId,
      user: req.user,
      req,
    });
  }

  @Get([
    '/api/v1/db/meta/tables/:tableId/share',
    '/api/v2/meta/tables/:tableId/share',
  ])
  @Acl('shareViewList', {scope: 'table'})
  async shareViewList(
    @TenantContext() context: NcContext,
    @Param('tableId') tableId: string,
  ) {
    return new PagedResponseImpl(
      await this.viewsService.shareViewList(context, {
        tableId,
      }),
    );
  }

  @Patch([
    '/api/v1/db/meta/views/:viewId/share',
    '/api/v2/meta/views/:viewId/share',
  ])
  @Acl('shareViewUpdate', {scope: 'table'})
  async shareViewUpdate(
    @TenantContext() context: NcContext,
    @Param('viewId') viewId: string,
    @Body() body: ViewUpdateReqType,
    @Req() req: NcRequest,
  ) {
    return await this.viewsService.shareViewUpdate(context, {
      viewId,
      sharedView: body,
      user: req.user,
      req,
    });
  }

  @Delete([
    '/api/v1/db/meta/views/:viewId/share',
    '/api/v2/meta/views/:viewId/share',
  ])
  @Acl('shareViewDelete', {scope: 'table'})
  async shareViewDelete(
    @TenantContext() context: NcContext,
    @Param('viewId') viewId: string,
    @Req() req: NcRequest,
  ) {
    return await this.viewsService.shareViewDelete(context, {
      viewId,
      user: req.user,
      req,
    });
  }
}
