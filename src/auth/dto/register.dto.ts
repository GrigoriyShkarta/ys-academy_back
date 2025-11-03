import { IsEmail, IsNotEmpty } from 'class-validator';

export class RegisterDto {
  @IsEmail({}, { message: 'Email должен быть валидным' })
  email: string;

  @IsNotEmpty({ message: 'Имя обязательно' })
  name: string;

  @IsNotEmpty({ message: 'Пароль обязателен' })
  password: string;
}
