import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class SubmitStandupDto {
  @IsString()
  @IsNotEmpty({ message: 'Team ID is required' })
  teamId: string;

  @IsString()
  @IsNotEmpty({ message: 'Yesterday section is required' })
  yesterday: string;

  @IsString()
  @IsNotEmpty({ message: 'Today section is required' })
  today: string;

  @IsString()
  @IsOptional()
  blockers?: string;
}
