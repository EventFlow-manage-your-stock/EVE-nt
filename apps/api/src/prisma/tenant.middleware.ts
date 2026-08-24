import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { TenantContextService } from './tenant-context.service';
import * as jwt from 'jsonwebtoken';

@Injectable()
export class TenantMiddleware implements NestMiddleware {
  constructor(private tenantContextService: TenantContextService) {}

  use(req: Request, res: Response, next: NextFunction) {
    const authHeader = req.headers.authorization;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      try {
        const secret = process.env.JWT_SECRET;
        if (!secret) {
          throw new Error('Brak konfiguracji JWT_SECRET w środowisku.');
        }

        // BEZPIECZEŃSTWO: Używamy weryfikacji kryptograficznej zapobiegającej sfałszowanym tokenom
        const decoded = jwt.verify(token, secret) as jwt.JwtPayload;
        
        if (decoded && decoded.tenantId) {
          // NAPRAWA BŁĘDU 500: Wymuszenie rzutowania na Number, aby Prisma dostała Int, a nie String
          return this.tenantContextService.run(Number(decoded.tenantId), () => {
            next();
          });
        }
      } catch (err) {
        // Ignorujemy błędy. Jeśli token jest zły, JwtAuthGuard sam odrzuci to zapytanie (401).
      }
    }
    
    next();
  }
}