import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationType } from '@prisma/client';
import { NotificationsSseService } from './notifications-sse.service';
import { Cron, CronExpression } from '@nestjs/schedule';

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sseService: NotificationsSseService,
  ) {}

  async createNotification(
    userId: string,
    title: string,
    message: string,
    type: NotificationType,
    link?: string,
  ) {
    const notification = await this.prisma.notification.create({
      data: {
        userId,
        title,
        message,
        type,
        link,
      },
    });

    // Push the event real-time over SSE
    this.sseService.pushNotification(userId, notification);

    return notification;
  }

  async getUserNotifications(userId: string) {
    return this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async markAsRead(notificationId: string, userId: string) {
    const notification = await this.prisma.notification.findUnique({
      where: { id: notificationId },
    });

    if (!notification || notification.userId !== userId) {
      throw new NotFoundException(`Notification not found`);
    }

    return this.prisma.notification.update({
      where: { id: notificationId },
      data: { isRead: true },
    });
  }

  async markAllAsRead(userId: string) {
    return this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });
  }

  // Clean up old notifications (older than 30 days)
  // Runs every day at midnight (0 0 * * *)
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async handleNotificationsCleanup() {
    const cutOffDate = new Date();
    cutOffDate.setDate(cutOffDate.getDate() - 30);

    const result = await this.prisma.notification.deleteMany({
      where: {
        createdAt: {
          lt: cutOffDate,
        },
      },
    });

    console.log(
      `[NotificationsCleanup] Cleaned up ${result.count} notifications older than 30 days.`,
    );
  }
}
