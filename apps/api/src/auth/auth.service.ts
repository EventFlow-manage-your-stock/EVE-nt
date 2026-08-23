import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import * as jwt from 'jsonwebtoken';
import * as nodemailer from 'nodemailer';

@Injectable()
export class AuthService {
  private transporter: nodemailer.Transporter;

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {
    // Inicjalizacja klienta SMTP do wysyłki maili
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'localhost',
      port: Number(process.env.SMTP_PORT) || 465,
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }

  async login(email: string, passwordRaw: string) {
    const uzytkownik = await this.prisma.extendedClient.uzytkownik.findFirst({
      where: { email },
      include: { 
        organizacja: true,
        role: {
          include: { rola: true }
        }
      },
    });

    if (!uzytkownik) {
      throw new UnauthorizedException('Nieprawidłowe dane logowania');
    }

    const isPasswordValid = await bcrypt.compare(passwordRaw, uzytkownik.haslo);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Nieprawidłowe dane logowania');
    }

    if (!uzytkownik.aktywny || !uzytkownik.organizacja.aktywny) {
      throw new UnauthorizedException('Konto lub organizacja są nieaktywne');
    }

    // 1. Zbieranie uprawnień ze wszystkich ról użytkownika
    const rolePermissions = new Set<string>();
    for (const userRole of uzytkownik.role) {
      const upr = userRole.rola.uprawnienia;
      if (Array.isArray(upr)) {
        upr.forEach((p: string) => rolePermissions.add(p));
      }
    }

    // 2. Odejmowanie uprawnień z czarnej listy (Zablokowane dla tego użytkownika)
    const blocked = Array.isArray(uzytkownik.zablokowane_uprawnienia) ? uzytkownik.zablokowane_uprawnienia : [];
    blocked.forEach((p: string) => rolePermissions.delete(p));

    const permissions = Array.from(rolePermissions);

    // 3. Budowa payloadu dla tokena JWT i stanu Frontendowego
    const payload = {
      sub: uzytkownik.id,
      email: uzytkownik.email,
      orgId: uzytkownik.id_organizacji,
      role: uzytkownik.role[0]?.rola.nazwa || 'Użytkownik',
      permissions
    };

    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: uzytkownik.id,
        email: uzytkownik.email,
        imie: uzytkownik.imie,
        nazwisko: uzytkownik.nazwisko,
        organizacja: uzytkownik.organizacja.nazwa,
        role: payload.role,
        permissions: payload.permissions
      }
    };
  }

  async forgotPassword(email: string) {
    const user = await this.prisma.extendedClient.uzytkownik.findFirst({ where: { email, aktywny: true } });
    
    // Niezależnie czy mail istnieje czy nie, odpowiadamy tak samo (zapobiega wyliczaniu kont przez hakerów)
    if (!user) {
      return { success: true, message: 'Jeśli adres e-mail istnieje w bazie, wysłano na niego link.' };
    }

    const secret = process.env.JWT_SECRET + user.haslo;
    const payload = { sub: user.id, email: user.email };
    const token = jwt.sign(payload, secret, { expiresIn: '1h' });

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const resetLink = `${baseUrl}/reset-password?token=${token}`;

    const resetToken = crypto.randomBytes(32).toString('hex');
    const tokenExpiry = new Date(Date.now() + 3600000); // Token ważny 1 godzinę

    await this.prisma.uzytkownik.updateMany({
      where: { email },
      data: { token_resetu_hasla: resetToken, data_waznosci_tokenu: tokenExpiry }
    });


    // Właściwa wysyłka HTML na E-mail
    try {
      await this.transporter.sendMail({
        from: process.env.SMTP_FROM || '"EventFlow WMS" <no-reply@eventflow.pl>',
        to: user.email,
        subject: 'Resetowanie hasła w systemie EventFlow',
        html: `
          <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #06B6D4;">Witaj, ${user.imie}!</h2>
            <p>Otrzymaliśmy prośbę o zresetowanie hasła dla Twojego konta w systemie EventFlow.</p>
            <p>Aby ustawić nowe hasło, kliknij w poniższy przycisk. Link jest ważny przez 1 godzinę i można go użyć tylko raz.</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${resetLink}" style="display: inline-block; padding: 14px 28px; background-color: #06B6D4; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: bold;">Ustaw nowe hasło</a>
            </div>
            <p>Jeśli to nie Ty prosiłeś/aś o zmianę, zignoruj tę wiadomość. Twoje konto jest bezpieczne.</p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;" />
            <p style="font-size: 11px; color: #94a3b8; text-align: center;">Wiadomość wygenerowana automatycznie przez system EventFlow.</p>
          </div>
        `,
      });
    } catch (err) {
      console.error('Błąd wysyłki SMTP:', err);
      // Nie rzucamy wyjątku 500, żeby nie pokazywać na zewnątrz, że wysyłka e-mail nie działa
    }

    return { success: true,message: 'Jeśli adres istnieje w bazie, wysłano na niego link do resetu hasła.' };
  }

  async resetPassword(token: string, passwordRaw: string) {
    try {
      // Dekodujemy payload by zdobyć ID usera (bez weryfikacji podpisu, bo nie znamy jeszcze hasła)
      const decoded: any = jwt.decode(token);
      if (!decoded || !decoded.sub) {
        throw new BadRequestException('Błędny lub zniekształcony link.');
      }

      // Pobieramy użytkownika
      const user = await this.prisma.extendedClient.uzytkownik.findUnique({
        where: { id: decoded.sub },
      });

      if (!user || !user.aktywny) {
        throw new BadRequestException('Konto użytkownika jest nieaktywne.');
      }

      // Odtwarzamy ten sam secret (z aktualnym hashem usera)
      const secret = process.env.JWT_SECRET + user.haslo;

      // Terz twarda weryfikacja JWT (czy nie wygasł i czy secret się zgadza)
      jwt.verify(token, secret);

      // Skoro weryfikacja przeszła, zmieniamy hasło
      const hashed = await bcrypt.hash(passwordRaw, 10);
      await this.prisma.extendedClient.uzytkownik.update({
        where: { id: user.id },
        data: { haslo: hashed },
      });

      return { message: 'Hasło zostało zmienione. Możesz się teraz bezpiecznie zalogować.' };
      
    } catch (e: any) {
      console.error('Błąd resetu hasła:', e.message);
      throw new BadRequestException('Link wygasł lub został już użyty. Wygeneruj nowy link z poziomu logowania.');
    }
  }
}