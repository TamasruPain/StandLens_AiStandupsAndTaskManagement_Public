import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  IsEnum,
} from 'class-validator';
import { DigestVisibility, DigestTriggerPermission } from '@prisma/client';

export class CreateTeamDto {
  @IsString()
  @IsNotEmpty({ message: 'Team name is required' })
  name: string;

  @IsString()
  @IsNotEmpty({ message: 'Company name is required' })
  companyName: string;

  @IsBoolean()
  @IsOptional()
  discoverable?: boolean;
}

export class UpdateTeamDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  companyName?: string;

  @IsBoolean()
  @IsOptional()
  discoverable?: boolean;

  @IsEnum(DigestVisibility)
  @IsOptional()
  digestVisibility?: DigestVisibility;

  @IsEnum(DigestTriggerPermission)
  @IsOptional()
  digestTriggerPermission?: DigestTriggerPermission;
}
