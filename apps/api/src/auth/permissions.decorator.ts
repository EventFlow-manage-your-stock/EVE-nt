import { SetMetadata } from '@nestjs/common';
import { Permission } from './permissions.enum';

export const PERMISSIONS_KEY = 'permissions';
// Dekorator przyjmuje listę wymaganych uprawnień dla danego endpointu
export const RequirePermissions = (...permissions: Permission[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);