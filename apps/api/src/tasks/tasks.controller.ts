import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Headers,
  UnauthorizedException,
} from '@nestjs/common';
import { TasksService } from './tasks.service';
import {
  CreateTaskDto,
  UpdateTaskDto,
  CreateTaskCommentDto,
} from './dto/task.dto';

@Controller('tasks')
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  private getUserId(headers: Record<string, string>): string {
    const userId = headers['x-user-id'];
    if (!userId) {
      throw new UnauthorizedException('x-user-id header is required');
    }
    return userId;
  }

  @Post()
  async createTask(
    @Headers() headers: Record<string, string>,
    @Body() dto: CreateTaskDto,
  ) {
    const userId = this.getUserId(headers);
    return this.tasksService.createTask(userId, dto);
  }

  @Get()
  async getTasks(
    @Headers() headers: Record<string, string>,
    @Query('projectId') projectId: string,
  ) {
    const userId = this.getUserId(headers);
    return this.tasksService.getTasksForProject(userId, projectId);
  }

  @Get('team/:teamId/workload')
  async getTeamWorkload(
    @Headers() headers: Record<string, string>,
    @Param('teamId') teamId: string,
  ) {
    const userId = this.getUserId(headers);
    return this.tasksService.getTeamMembersWorkload(userId, teamId);
  }

  @Get('leader/pending-reviews')
  async getLeaderPendingReviews(@Headers() headers: Record<string, string>) {
    const userId = this.getUserId(headers);
    return this.tasksService.getTasksPendingReviewForLeader(userId);
  }

  @Get('my/assigned')
  async getMyAssignedTasks(@Headers() headers: Record<string, string>) {
    const userId = this.getUserId(headers);
    return this.tasksService.getUserAssignedTasks(userId);
  }

  @Get(':id')
  async getTask(
    @Headers() headers: Record<string, string>,
    @Param('id') id: string,
  ) {
    const userId = this.getUserId(headers);
    return this.tasksService.getTaskDetails(userId, id);
  }

  @Patch(':id')
  async updateTask(
    @Headers() headers: Record<string, string>,
    @Param('id') id: string,
    @Body() dto: UpdateTaskDto,
  ) {
    const userId = this.getUserId(headers);
    return this.tasksService.updateTask(userId, id, dto);
  }

  @Delete(':id')
  async deleteTask(
    @Headers() headers: Record<string, string>,
    @Param('id') id: string,
  ) {
    const userId = this.getUserId(headers);
    return this.tasksService.deleteTask(userId, id);
  }

  @Post(':id/comments')
  async addComment(
    @Headers() headers: Record<string, string>,
    @Param('id') id: string,
    @Body() dto: CreateTaskCommentDto,
  ) {
    const userId = this.getUserId(headers);
    return this.tasksService.addComment(userId, id, dto);
  }

  @Post(':id/subtasks')
  async createSubtask(
    @Headers() headers: Record<string, string>,
    @Param('id') id: string,
    @Body() body: { title: string },
  ) {
    const userId = this.getUserId(headers);
    return this.tasksService.createSubtask(userId, id, body.title);
  }

  @Patch(':id/subtasks/:subtaskId')
  async toggleSubtask(
    @Headers() headers: Record<string, string>,
    @Param('id') id: string,
    @Param('subtaskId') subtaskId: string,
    @Body() body: { isDone: boolean },
  ) {
    const userId = this.getUserId(headers);
    return this.tasksService.toggleSubtask(userId, id, subtaskId, body.isDone);
  }

  @Delete(':id/subtasks/:subtaskId')
  async deleteSubtask(
    @Headers() headers: Record<string, string>,
    @Param('id') id: string,
    @Param('subtaskId') subtaskId: string,
  ) {
    const userId = this.getUserId(headers);
    return this.tasksService.deleteSubtask(userId, id, subtaskId);
  }
}
