import { Test, TestingModule } from '@nestjs/testing';
import { TeamsService } from './teams.service';
import { PrismaService } from '../prisma/prisma.service';
import { TeamRole } from '@prisma/client';

describe('TeamsService', () => {
  let service: TeamsService;

  const mockPrismaService = {
    team: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    teamMember: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
    joinRequest: {
      findMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TeamsService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<TeamsService>(TeamsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createTeam', () => {
    it('should create a team with caller as OWNER', async () => {
      const dto = {
        name: 'Acme Devs',
        companyName: 'Acme Corp',
        discoverable: true,
      };
      const expectedTeam = {
        id: 'team-1',
        ...dto,
        members: [{ userId: 'user-1', role: TeamRole.OWNER }],
      };

      mockPrismaService.team.create.mockResolvedValue(expectedTeam);

      const result = await service.createTeam('user-1', dto);

      expect(result).toEqual(expectedTeam);
      expect(mockPrismaService.team.create).toHaveBeenCalledWith({
        data: {
          name: dto.name,
          companyName: dto.companyName,
          discoverable: true,
          members: {
            create: {
              userId: 'user-1',
              role: TeamRole.OWNER,
            },
          },
        },
        include: {
          members: {
            include: {
              user: {
                select: { id: true, name: true, email: true, image: true },
              },
            },
          },
        },
      });
    });
  });
});
