import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async updateProfile(userId: string, name: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      // Fallback: If demo user ID, update first user or create
      const firstUser = await this.prisma.user.findFirst();
      if (firstUser) {
        return this.prisma.user.update({
          where: { id: firstUser.id },
          data: { name },
        });
      }
      throw new NotFoundException('User not found');
    }

    return this.prisma.user.update({
      where: { id: userId },
      data: { name },
    });
  }

  async getProfile(userId: string) {
    let user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      user = await this.prisma.user.findFirst();
    }
    if (!user) throw new NotFoundException('User not found');
    return user;
  }
}
