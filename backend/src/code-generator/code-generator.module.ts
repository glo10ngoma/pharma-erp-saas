import { Module } from '@nestjs/common';
import { CodeGeneratorController } from './code-generator.controller';
import { CodeGeneratorService } from './code-generator.service';

@Module({
  controllers: [CodeGeneratorController],
  providers: [CodeGeneratorService],
})
export class CodeGeneratorModule {}
