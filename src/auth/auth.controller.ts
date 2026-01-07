import { Body, Controller, Post, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  async register(@Body() body: RegisterDto) {
    return this.authService.register(body);
  }

  @Post('login')
  async login(@Body() body: LoginDto) {
    const user = await this.authService.validateUser(body.email, body.password);
    if (!user) {
      throw new UnauthorizedException('validation.invalid_email_or_password');
    }
    if (user.accessExpiryDate && new Date(user.accessExpiryDate) < new Date()) {
      await this.authService.deactivateUser(user.id);
      throw new UnauthorizedException('validation.user_is_not_active');
    }
    if (!user.isActive) {
      throw new UnauthorizedException('validation.user_is_not_active');
    }
    return this.authService.login(user);
  }

  @Post('refresh')
  async refresh(@Body() body: { refresh_token: string }) {
    return this.authService.refreshToken(body.refresh_token);
  }
}
