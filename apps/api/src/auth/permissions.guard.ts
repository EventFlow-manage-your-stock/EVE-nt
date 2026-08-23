import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Permission } from './permissions.enum';
import { PERMISSIONS_KEY } from './permissions.decorator';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPermissions = this.reflector.getAllAndOverride<Permission[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredPermissions) return true;

    const { user } = context.switchToHttp().getRequest();
    
    if (!user || !user.permissions || !Array.isArray(user.permissions)) {
      throw new ForbiddenException('Brak wymaganych uprawnień w systemie.');
    }

    const hasPermission = requiredPermissions.every((permission) =>
      user.permissions.includes(permission),
    );

    if (!hasPermission) {
      throw new ForbiddenException('Twoje konto lub przypisane role nie posiadają wystarczających uprawnień do tej akcji.');
    }

    return true;
  }
}