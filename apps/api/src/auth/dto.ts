import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsNotEmpty,
  IsString,
  Length,
  MaxLength,
} from 'class-validator';

const toTrimmedLowercase = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;

export class LoginDto {
  @Transform(toTrimmedLowercase)
  @IsEmail()
  email!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  password!: string;
}

export class RegistroDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @Length(2, 100)
  nombre!: string;

  @Transform(toTrimmedLowercase)
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @IsString()
  @Length(8, 128)
  password!: string;
}

export class RecuperarDto {
  @Transform(toTrimmedLowercase)
  @IsEmail()
  @MaxLength(254)
  email!: string;
}

export class RestablecerDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  token!: string;

  @IsString()
  @Length(8, 128)
  password!: string;
}
