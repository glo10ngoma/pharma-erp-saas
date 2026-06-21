import { PartialType } from '@nestjs/swagger';
import { CreateInsurancePlanDto } from './create-insurance-plan.dto';

export class UpdateInsurancePlanDto extends PartialType(CreateInsurancePlanDto) {}
