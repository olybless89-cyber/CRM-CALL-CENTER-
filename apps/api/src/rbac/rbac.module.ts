import { Module } from '@nestjs/common';
import { RbacService } from './rbac.service';
import { PermissionsGuard } from '../common/guards/permissions.guard';

@Module({
  providers: [RbacService, PermissionsGuard],
  exports: [RbacService, PermissionsGuard],
})
export class RbacModule {}
