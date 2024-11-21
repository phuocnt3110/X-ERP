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
import { GlobalGuard } from '~/guards/global/global.guard';
import { DatasService } from '~/services/datas.service';
import { Acl } from '~/middlewares/extract-ids/extract-ids.middleware';
import { DataApiLimiterGuard } from '~/guards/data-api-limiter.guard';
import { TenantContext } from '~/decorators/tenant-context.decorator';
import { NcContext, NcRequest } from '~/interface/config';

@Controller()
@UseGuards(DataApiLimiterGuard, GlobalGuard)
export class DatasController {
  constructor(private readonly datasService: DatasService) {}

  @Get('/data/:viewId/')
  @Acl('dataList', {scope: 'table'})
  async dataList(
    @TenantContext() context: NcContext,
    @Req() req: NcRequest,
    @Param('viewId') viewId: string,
  ) {
    return await this.datasService.dataListByViewId(context, {
      viewId: viewId,
      query: req.query,
    });
  }

  @Get('/data/:viewId/:rowId/mm/:colId')
  @Acl('mmList', {scope: 'table'})
  async mmList(
    @TenantContext() context: NcContext,
    @Req() req: NcRequest,
    @Param('viewId') viewId: string,
    @Param('colId') colId: string,
    @Param('rowId') rowId: string,
  ) {
    return await this.datasService.mmList(context, {
      viewId: viewId,
      colId: colId,
      rowId: rowId,
      query: req.query,
    });
  }

  @Get('/data/:viewId/:rowId/mm/:colId/exclude')
  @Acl('mmExcludedList', {scope: 'table'})
  async mmExcludedList(
    @TenantContext() context: NcContext,
    @Req() req: NcRequest,
    @Param('viewId') viewId: string,
    @Param('colId') colId: string,
    @Param('rowId') rowId: string,
  ) {
    return await this.datasService.mmExcludedList(context, {
      viewId: viewId,
      colId: colId,
      rowId: rowId,
      query: req.query,
    });
  }

  @Get('/data/:viewId/:rowId/hm/:colId/exclude')
  @Acl('hmExcludedList', {scope: 'table'})
  async hmExcludedList(
    @TenantContext() context: NcContext,
    @Req() req: NcRequest,
    @Param('viewId') viewId: string,
    @Param('colId') colId: string,
    @Param('rowId') rowId: string,
  ) {
    await this.datasService.hmExcludedList(context, {
      viewId: viewId,
      colId: colId,
      rowId: rowId,
      query: req.query,
    });
  }

  @Get('/data/:viewId/:rowId/bt/:colId/exclude')
  @Acl('btExcludedList', {scope: 'table'})
  async btExcludedList(
    @TenantContext() context: NcContext,
    @Req() req: NcRequest,
    @Param('viewId') viewId: string,
    @Param('colId') colId: string,
    @Param('rowId') rowId: string,
  ) {
    return await this.datasService.btExcludedList(context, {
      viewId: viewId,
      colId: colId,
      rowId: rowId,
      query: req.query,
    });
  }

  @Get('/data/:viewId/:rowId/hm/:colId')
  @Acl('hmList', {scope: 'table'})
  async hmList(
    @TenantContext() context: NcContext,
    @Req() req: NcRequest,
    @Param('viewId') viewId: string,
    @Param('colId') colId: string,
    @Param('rowId') rowId: string,
  ) {
    return await this.datasService.hmList(context, {
      viewId: viewId,
      colId: colId,
      rowId: rowId,
      query: req.query,
    });
  }

  @Get('/data/:viewId/:rowId')
  @Acl('dataRead', {scope: 'table'})
  async dataRead(
    @TenantContext() context: NcContext,
    @Req() req: NcRequest,
    @Param('viewId') viewId: string,
    @Param('rowId') rowId: string,
  ) {
    return await this.datasService.dataReadByViewId(context, {
      viewId,
      rowId,
      query: req.query,
    });
  }

  @Post('/data/:viewId/')
  @HttpCode(200)
  @Acl('dataInsert', {scope: 'table'})
  async dataInsert(
    @TenantContext() context: NcContext,
    @Req() req: NcRequest,
    @Param('viewId') viewId: string,
    @Body() body: any,
  ) {
    return await this.datasService.dataInsertByViewId(context, {
      viewId: viewId,
      body: body,
      cookie: req,
    });
  }

  @Patch('/data/:viewId/:rowId')
  @Acl('dataUpdate', {scope: 'table'})
  async dataUpdate(
    @TenantContext() context: NcContext,
    @Req() req: NcRequest,
    @Param('viewId') viewId: string,
    @Param('rowId') rowId: string,
    @Body() body: any,
  ) {
    return await this.datasService.dataUpdateByViewId(context, {
      viewId: viewId,
      rowId: rowId,
      body: body,
      cookie: req,
    });
  }

  @Delete('/data/:viewId/:rowId')
  @Acl('dataDelete', {scope: 'table'})
  async dataDelete(
    @TenantContext() context: NcContext,
    @Req() req: NcRequest,
    @Param('viewId') viewId: string,
    @Param('rowId') rowId: string,
  ) {
    return await this.datasService.dataDeleteByViewId(context, {
      viewId: viewId,
      rowId: rowId,
      cookie: req,
    });
  }

  @Delete('/data/:viewId/:rowId/:relationType/:colId/:childId')
  @Acl('relationDataDelete', {scope: 'table'})
  async relationDataDelete(
    @TenantContext() context: NcContext,
    @Req() req: NcRequest,
    @Param('viewId') viewId: string,
    @Param('rowId') rowId: string,
    @Param('relationType') relationType: string,
    @Param('colId') colId: string,
    @Param('childId') childId: string,
  ) {
    await this.datasService.relationDataDelete(context, {
      viewId: viewId,
      colId: colId,
      childId: childId,
      rowId: rowId,
      cookie: req,
    });

    return { msg: 'The relation data has been deleted successfully' };
  }

  @Post('/data/:viewId/:rowId/:relationType/:colId/:childId')
  @HttpCode(200)
  @Acl('relationDataAdd', {scope: 'table'})
  async relationDataAdd(
    @TenantContext() context: NcContext,
    @Req() req: NcRequest,
    @Param('viewId') viewId: string,
    @Param('rowId') rowId: string,
    @Param('relationType') relationType: string,
    @Param('colId') colId: string,
    @Param('childId') childId: string,
  ) {
    await this.datasService.relationDataAdd(context, {
      viewId: viewId,
      colId: colId,
      childId: childId,
      rowId: rowId,
      cookie: req,
    });

    return { msg: 'The relation data has been created successfully' };
  }
}
