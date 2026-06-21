import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { REQUIRE_PERMISSION_KEY } from '../decorators/require-permission.decorator';

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string>(
      REQUIRE_PERMISSION_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!required) return true;

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user?.permissions?.includes(required) && user?.role !== 'SUPER_ADMIN') {
      throw new ForbiddenException('PERMISSION_DENIED');
    }

    return true;
  }
}
