import { Controller, Get, Patch, Body, Headers } from '@nestjs/common';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  async getProfile(@Headers('x-user-id') userId: string) {
    return this.usersService.getProfile(userId || 'demo-user-alex');
  }

  @Patch('profile')
  async updateProfile(
    @Headers('x-user-id') userId: string,
    @Body('name') name: string,
  ) {
    return this.usersService.updateProfile(userId || 'demo-user-alex', name);
  }
}
