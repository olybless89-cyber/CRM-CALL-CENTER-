import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentTenant } from '../common/decorators/current-tenant.decorator';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { PERMISSIONS } from '../rbac/permissions.constants';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { AssignRoleDto } from './dto/assign-role.dto';

@ApiTags('users')
@Controller({ path: 'users', version: '1' })
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.USERS_READ)
  list(@CurrentTenant() tenantId: string) {
    return this.usersService.listForTenant(tenantId);
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.USERS_READ)
  get(@CurrentTenant() tenantId: string, @Param('id') id: string) {
    return this.usersService.getForTenant(tenantId, id);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.USERS_CREATE)
  create(
    @CurrentTenant() tenantId: string,
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: CreateUserDto,
  ) {
    return this.usersService.createForTenant(tenantId, actor.id, dto);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.USERS_UPDATE)
  update(
    @CurrentTenant() tenantId: string,
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
  ) {
    return this.usersService.updateForTenant(tenantId, actor.id, id, dto);
  }

  @Delete(':id')
  @RequirePermissions(PERMISSIONS.USERS_DELETE)
  deactivate(
    @CurrentTenant() tenantId: string,
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.usersService.deactivateForTenant(tenantId, actor.id, id);
  }

  @Get(':id/roles')
  @RequirePermissions(PERMISSIONS.ROLES_READ)
  listRoles(@CurrentTenant() tenantId: string, @Param('id') id: string) {
    return this.usersService.listRoles(tenantId, id);
  }

  @Post(':id/roles')
  @RequirePermissions(PERMISSIONS.ROLES_ASSIGN)
  assignRole(
    @CurrentTenant() tenantId: string,
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: AssignRoleDto,
  ) {
    return this.usersService.assignRole(tenantId, actor.id, id, dto.roleKey);
  }
}
