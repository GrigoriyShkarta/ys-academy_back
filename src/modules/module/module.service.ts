import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { FileService } from '../file/file.service';

@Injectable()
export class ModuleService {
  constructor(
    private readonly prisma: PrismaService,
    private fileService: FileService,
  ) {}

  async createModule() {}

  async updateModule() {}

  async deleteModule() {}

  async getModules() {}

  async getModule() {}
}
