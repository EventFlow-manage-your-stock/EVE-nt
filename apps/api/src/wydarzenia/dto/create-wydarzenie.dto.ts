import { IsString, IsNotEmpty, IsOptional, IsDateString } from 'class-validator';

export class CreateWydarzenieDto {
  @IsString()
  @IsNotEmpty()
  nazwa: string;

  @IsDateString()
  @IsNotEmpty()
  data_start: string;

  @IsDateString()
  @IsNotEmpty()
  data_koniec: string;

  @IsOptional()
  id_statusu_wydarzenia?: number;
}