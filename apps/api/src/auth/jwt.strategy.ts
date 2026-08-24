import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private prisma: PrismaService) {
    const secret = process.env.JWT_SECRET;
    
    // BEZPIECZEŃSTWO: Brak podatności na domyślny klucz
    if (!secret || secret === 'twoj-sekret') {
      throw new Error('KRYTYCZNY BŁĄD: Zmienna środowiskowa JWT_SECRET nie jest skonfigurowana!');
    }

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  async validate(payload: any) {
    // Odpytujemy standardowego klienta (omijamy filtr rozszerzenia, ponieważ weryfikujemy JWT)
    const uzytkownik = await this.prisma.uzytkownik.findUnique({
      where: { id: payload.sub },
    });

    if (!uzytkownik || !uzytkownik.aktywny) {
      throw new UnauthorizedException('Konto nie istnieje lub zostało zdezaktywowane.');
    }

    // BEZPIECZEŃSTWO: Double-check organizacji
    if (uzytkownik.id_organizacji !== payload.tenantId) {
      throw new UnauthorizedException('Naruszenie bezpieczeństwa: Niezgodność przypisania organizacji.');
    }

    return { 
      id: uzytkownik.id, 
      email: uzytkownik.email, 
      id_organizacji: uzytkownik.id_organizacji,
      role: payload.role,
      permissions: payload.permissions
    };
  }
}