import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || 'twoj-sekret', // Pamiętaj o ustawieniu w .env
    });
  }

  async validate(payload: any) {
      const uzytkownik = await this.prisma.extendedClient.uzytkownik.findUnique({
        where: { id: payload.sub },
      });
      if (!uzytkownik) {
        throw new UnauthorizedException();
      }
      return { 
         id: uzytkownik.id, 
         email: uzytkownik.email, 
         id_organizacji: uzytkownik.id_organizacji,
         permissions: payload.permissions || [] // <-- DODANE
       };
    }
}