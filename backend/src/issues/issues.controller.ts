import {
  Controller, Get, Post, Delete, Body, Param, Logger,
  BadRequestException, UseGuards,
} from '@nestjs/common';
import { IssuesService, type Issue } from './issues.service';
import { AdminKeyGuard } from '../common/admin-key.guard';
import { RateLimitGuard } from '../common/rate-limit.guard';

const ALLOWED_TYPES = ['av', 'climate', 'cleanliness', 'furniture', 'other'];
const MAX_NOTE = 500;

@Controller('api/issues')
export class IssuesController {
  private readonly logger = new Logger(IssuesController.name);

  constructor(private readonly issuesService: IssuesService) {}

  // Reporting is an on-panel action (like booking) — rate limited, not admin-gated.
  @UseGuards(RateLimitGuard)
  @Post()
  create(@Body() body: { roomId?: string; type?: string; note?: string }): Issue {
    const roomId = body?.roomId?.trim();
    const type = body?.type?.trim();
    if (!roomId) throw new BadRequestException('roomId is required');
    if (!type || !ALLOWED_TYPES.includes(type)) {
      throw new BadRequestException(`type must be one of: ${ALLOWED_TYPES.join(', ')}`);
    }
    const note = (body?.note ?? '').toString().slice(0, MAX_NOTE);
    const issue = this.issuesService.create(roomId, type, note);
    this.logger.warn(`Issue reported: room=${roomId} type=${type} note="${note}"`);
    return issue;
  }

  // Viewing / clearing reported issues is an admin action.
  @UseGuards(AdminKeyGuard)
  @Get()
  findAll(): Issue[] {
    return this.issuesService.findAll();
  }

  @UseGuards(AdminKeyGuard)
  @Delete(':id')
  remove(@Param('id') id: string): { success: true } {
    this.issuesService.remove(id);
    return { success: true };
  }
}
