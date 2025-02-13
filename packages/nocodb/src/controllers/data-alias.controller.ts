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
  Res,
  UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import { GlobalGuard } from '~/guards/global/global.guard';
import { parseHrtimeToMilliSeconds } from '~/helpers';
import { Acl } from '~/middlewares/extract-ids/extract-ids.middleware';
import { DatasService } from '~/services/datas.service';
import { DataApiLimiterGuard } from '~/guards/data-api-limiter.guard';
import { TenantContext } from '~/decorators/tenant-context.decorator';
import { NcContext, NcRequest } from '~/interface/config';

@Controller()
@UseGuards(DataApiLimiterGuard, GlobalGuard)
export class DataAliasController {
  constructor(private readonly datasService: DatasService) {}

  // todo: Handle the error case where view doesnt belong to model
  @Get([
    '/api/v1/db/data/:orgs/:baseName/:tableName',
    '/api/v1/db/data/:orgs/:baseName/:tableName/views/:viewName',
  ])
  @Acl('dataList', {scope: 'table'})
  async dataList(
    @TenantContext() context: NcContext,
    @Req() req: NcRequest,
    @Res() res: Response,
    @Param('baseName') baseName: string,
    @Param('tableName') tableName: string,
    @Param('viewName') viewName: string,
    @Query('opt') opt: string,
  ) {
    const startTime = process.hrtime();
    const responseData = await this.datasService.dataList(context, {
      query: req.query,
      baseName: baseName,
      tableName: tableName,
      viewName: viewName,
      disableOptimization: opt === 'false',
    });
    const elapsedMilliSeconds = parseHrtimeToMilliSeconds(
      process.hrtime(startTime),
    );
    res.setHeader('xc-db-response', elapsedMilliSeconds);
    if (responseData['stats']) {
      responseData['stats'].apiHandlingTime = elapsedMilliSeconds;
    }

    res.json(responseData);
  }

  @Get([
    '/api/v1/db/data/:orgs/:baseName/:tableName/find-one',
    '/api/v1/db/data/:orgs/:baseName/:tableName/views/:viewName/find-one',
  ])
  @Acl('dataFindOne', {scope: 'table'})
  async dataFindOne(
    @TenantContext() context: NcContext,
    @Req() req: NcRequest,
    @Param('baseName') baseName: string,
    @Param('tableName') tableName: string,
    @Param('viewName') viewName: string,
  ) {
    return await this.datasService.dataFindOne(context, {
      query: req.query,
      baseName: baseName,
      tableName: tableName,
      viewName: viewName,
    });
  }

  @Get([
    '/api/v1/db/data/:orgs/:baseName/:tableName/groupby',
    '/api/v1/db/data/:orgs/:baseName/:tableName/views/:viewName/groupby',
  ])
  @Acl('dataGroupBy', {scope: 'table'})
  async dataGroupBy(
    @TenantContext() context: NcContext,
    @Req() req: NcRequest,
    @Param('baseName') baseName: string,
    @Param('tableName') tableName: string,
    @Param('viewName') viewName: string,
  ) {
    return await this.datasService.dataGroupBy(context, {
      query: req.query,
      baseName: baseName,
      tableName: tableName,
      viewName: viewName,
    });
  }

  @Get([
    '/api/v1/db/data/:orgs/:baseName/:tableName/count',
    '/api/v1/db/data/:orgs/:baseName/:tableName/views/:viewName/count',
  ])
  @Acl('dataCount', {scope: 'table'})
  async dataCount(
    @TenantContext() context: NcContext,
    @Req() req: NcRequest,
    @Res() res: Response,
    @Param('baseName') baseName: string,
    @Param('tableName') tableName: string,
    @Param('viewName') viewName: string,
  ) {
    const countResult = await this.datasService.dataCount(context, {
      query: req.query,
      baseName: baseName,
      tableName: tableName,
      viewName: viewName,
    });

    res.json(countResult);
  }

  @Post([
    '/api/v1/db/data/:orgs/:baseName/:tableName',
    '/api/v1/db/data/:orgs/:baseName/:tableName/views/:viewName',
  ])
  @HttpCode(200)
  async dataInsert(
    @TenantContext() context: NcContext,
    @Req() req: NcRequest,
    @Param('baseName') baseName: string,
    @Param('tableName') tableName: string,
    @Param('viewName') viewName: string,
    @Body() body: any,
    @Query('opt') opt: string,
  ) {
    return await this.datasService.dataInsert(context, {
      baseName: baseName,
      tableName: tableName,
      viewName: viewName,
      body: body,
      cookie: req,
      disableOptimization: opt === 'false',
    });
  }

  @Patch([
    '/api/v1/db/data/:orgs/:baseName/:tableName/:rowId',
    '/api/v1/db/data/:orgs/:baseName/:tableName/views/:viewName/:rowId',
  ])
  @Acl('dataUpdate', {scope: 'table', subScope: 'column'})
  async dataUpdate(
    @TenantContext() context: NcContext,
    @Req() req: NcRequest,
    @Param('baseName') baseName: string,
    @Param('tableName') tableName: string,
    @Param('viewName') viewName: string,
    @Param('rowId') rowId: string,
    @Query('opt') opt: string,
  ) {
    return await this.datasService.dataUpdate(context, {
      baseName: baseName,
      tableName: tableName,
      viewName: viewName,
      body: req.body,
      cookie: req,
      rowId: rowId,
      disableOptimization: opt === 'false',
    });
  }

  @Delete([
    '/api/v1/db/data/:orgs/:baseName/:tableName/:rowId',
    '/api/v1/db/data/:orgs/:baseName/:tableName/views/:viewName/:rowId',
  ])
  @Acl('dataDelete', {scope: 'table', subScope: 'column'})
  async dataDelete(
    @TenantContext() context: NcContext,
    @Req() req: NcRequest,
    @Param('baseName') baseName: string,
    @Param('tableName') tableName: string,
    @Param('viewName') viewName: string,
    @Param('rowId') rowId: string,
  ) {
    return await this.datasService.dataDelete(context, {
      baseName: baseName,
      tableName: tableName,
      viewName: viewName,
      cookie: req,
      rowId: rowId,
    });
  }

  @Get([
    '/api/v1/db/data/:orgs/:baseName/:tableName/:rowId',
    '/api/v1/db/data/:orgs/:baseName/:tableName/views/:viewName/:rowId',
  ])
  @Acl('dataRead', {scope: 'table'})
  async dataRead(
    @TenantContext() context: NcContext,
    @Req() req: NcRequest,
    @Param('baseName') baseName: string,
    @Param('tableName') tableName: string,
    @Param('viewName') viewName: string,
    @Param('rowId') rowId: string,
    @Query('opt') opt: string,
    @Query('getHiddenColumn') getHiddenColumn: boolean,
  ) {
    return await this.datasService.dataRead(context, {
      baseName: baseName,
      tableName: tableName,
      viewName: viewName,
      rowId: rowId,
      query: req.query,
      disableOptimization: opt === 'false',
      getHiddenColumn: getHiddenColumn,
    });
  }

  @Get([
    '/api/v1/db/data/:orgs/:baseName/:tableName/:rowId/exist',
    '/api/v1/db/data/:orgs/:baseName/:tableName/views/:viewName/:rowId/exist',
  ])
  @Acl('dataExist', {scope: 'table'})
  async dataExist(
    @TenantContext() context: NcContext,
    @Req() req: NcRequest,
    @Res() res: Response,
    @Param('baseName') baseName: string,
    @Param('tableName') tableName: string,
    @Param('viewName') viewName: string,
    @Param('rowId') rowId: string,
  ) {
    const exists = await this.datasService.dataExist(context, {
      baseName: baseName,
      tableName: tableName,
      viewName: viewName,
      rowId: rowId,
      query: req.query,
    });

    res.json(exists);
  }

  // todo: Handle the error case where view doesnt belong to model

  @Get([
    '/api/v1/db/data/:orgs/:baseName/:tableName/group/:columnId',
    '/api/v1/db/data/:orgs/:baseName/:tableName/views/:viewName/group/:columnId',
  ])
  @Acl('groupedDataList', {scope: 'table'})
  async groupedDataList(
    @TenantContext() context: NcContext,
    @Req() req: NcRequest,
    @Res() res: Response,
    @Param('baseName') baseName: string,
    @Param('tableName') tableName: string,
    @Param('viewName') viewName: string,
    @Param('columnId') columnId: string,
  ) {
    const startTime = process.hrtime();
    const groupedData = await this.datasService.groupedDataList(context, {
      baseName: baseName,
      tableName: tableName,
      viewName: viewName,
      query: req.query,
      columnId: columnId,
    });
    const elapsedSeconds = parseHrtimeToMilliSeconds(process.hrtime(startTime));
    res.setHeader('xc-db-response', elapsedSeconds);
    res.json(groupedData);
  }
}
