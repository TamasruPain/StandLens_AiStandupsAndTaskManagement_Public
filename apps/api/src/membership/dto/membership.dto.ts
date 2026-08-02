import { IsEnum, IsNotEmpty } from 'class-validator';
import { JoinRequestStatus, TeamRole } from '@prisma/client';

export class UpdateJoinRequestDto {
  @IsEnum(JoinRequestStatus, { message: 'Status must be ACCEPTED or DECLINED' })
  @IsNotEmpty()
  status: JoinRequestStatus;
}

export class UpdateMemberRoleDto {
  @IsEnum(TeamRole, { message: 'Role must be ADMIN or MEMBER' })
  @IsNotEmpty()
  role: TeamRole;
}
