import {
  Controller,
  Get,
  Patch,
  Post,
  Param,
  Sse,
  Headers,
  MessageEvent,
} from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { NotificationsSseService } from './notifications-sse.service';
import { Observable } from 'rxjs';

@Controller('notifications')
export class NotificationsController {
  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly sseService: NotificationsSseService,
  ) {}

  @Get()
  async getNotifications(@Headers('x-user-id') userId: string) {
    const callerId = userId || 'demo-user-alex';
    return this.notificationsService.getUserNotifications(callerId);
  }

  @Patch(':id/read')
  async markAsRead(
    @Param('id') id: string,
    @Headers('x-user-id') userId: string,
  ) {
    const callerId = userId || 'demo-user-alex';
    return this.notificationsService.markAsRead(id, callerId);
  }

  @Post('read-all')
  async markAllAsRead(@Headers('x-user-id') userId: string) {
    const callerId = userId || 'demo-user-alex';
    return this.notificationsService.markAllAsRead(callerId);
  }

  @Sse('sse/:userId')
  sse(@Param('userId') userId: string): Observable<MessageEvent> {
    return this.sseService.getEventStream(userId);
  }
}
