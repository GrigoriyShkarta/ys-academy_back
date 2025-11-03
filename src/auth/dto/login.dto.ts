import { IsEmail, IsNotEmpty } from 'class-validator';

export class LoginDto {
  @IsEmail({}, { message: 'Email должен быть валидным' })
  email: string;

  @IsNotEmpty({ message: 'Пароль обязателен' })
  password: string;
}
