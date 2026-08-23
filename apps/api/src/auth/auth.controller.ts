import { Controller, Post, Body, HttpCode, HttpStatus, BadRequestException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { Public } from './decorators/public.decorator';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  // @Post('register')
  // async register(
  //   @Body() body: { email: string; passwordRaw: string; companyName: string },
  // ) {
  //   return this.authService.register(
  //     body.email,
  //     body.passwordRaw,
  //     body.companyName,
  //   );
  // }
  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('login')
  async login(@Body() body: { email: string; passwordRaw: string }) {
    // Przekazujemy odebrane parametry prosto do serwisu
    return this.authService.login(body.email, body.passwordRaw);
  }

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('forgot-password')
  async forgotPassword(@Body('email') email: string) {
    if (!email) throw new BadRequestException('Brak adresu e-mail');
    return this.authService.forgotPassword(email);
  }

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('reset-password')
  async resetPassword(@Body() body: { token: string; passwordRaw: string }) {
    if (!body.token || !body.passwordRaw) throw new BadRequestException('Brak wymaganych danych');
    return this.authService.resetPassword(body.token, body.passwordRaw);
  }
  
}