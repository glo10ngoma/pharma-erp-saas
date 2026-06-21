import { PartialType } from '@nestjs/swagger';
import { CreateGalenicFormDto } from './create-galenic-form.dto';

export class UpdateGalenicFormDto extends PartialType(CreateGalenicFormDto) {}
