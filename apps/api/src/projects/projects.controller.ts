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
import { ProjectsService } from './projects.service';
import { CreateProjectDto, UpdateProjectDto } from './dto/project.dto';

@Controller('projects')
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  private getUserId(headers: Record<string, string>): string {
    const userId = headers['x-user-id'];
    if (!userId) {
      throw new UnauthorizedException('x-user-id header is required');
    }
    return userId;
  }

  @Post()
  async createProject(
    @Headers() headers: Record<string, string>,
    @Body() dto: CreateProjectDto,
  ) {
    const userId = this.getUserId(headers);
    return this.projectsService.createProject(userId, dto);
  }

  @Get()
  async getProjects(
    @Headers() headers: Record<string, string>,
    @Query('teamId') teamId?: string,
  ) {
    const userId = this.getUserId(headers);
    if (teamId) {
      return this.projectsService.getProjectsForTeam(userId, teamId);
    }
    return this.projectsService.getUserProjects(userId);
  }

  @Get('my')
  async getMyProjects(@Headers() headers: Record<string, string>) {
    const userId = this.getUserId(headers);
    return this.projectsService.getUserProjects(userId);
  }

  @Get(':id')
  async getProjectDetails(
    @Headers() headers: Record<string, string>,
    @Param('id') id: string,
  ) {
    const userId = this.getUserId(headers);
    return this.projectsService.getProjectDetails(userId, id);
  }

  @Patch(':id')
  async updateProject(
    @Headers() headers: Record<string, string>,
    @Param('id') id: string,
    @Body() dto: UpdateProjectDto,
  ) {
    const userId = this.getUserId(headers);
    return this.projectsService.updateProject(userId, id, dto);
  }

  @Delete(':id')
  async deleteProject(
    @Headers() headers: Record<string, string>,
    @Param('id') id: string,
  ) {
    const userId = this.getUserId(headers);
    return this.projectsService.deleteProject(userId, id);
  }
}
