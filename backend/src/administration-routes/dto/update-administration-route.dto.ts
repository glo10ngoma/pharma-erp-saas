import { PartialType } from '@nestjs/swagger';
import { CreateAdministrationRouteDto } from './create-administration-route.dto';

export class UpdateAdministrationRouteDto extends PartialType(CreateAdministrationRouteDto) {}
