import { Controller, Get } from '@nestjs/common';
import { HealthCheckService, HealthCheck, MemoryHealthIndicator } from '@nestjs/terminus';
import { PrismaHealthIndicator } from '../../infrastructure/persistence/prisma.health';

@Controller('health')
export class HealthController {
  constructor(
    private health: HealthCheckService,
    private memory: MemoryHealthIndicator,
    private prisma: PrismaHealthIndicator,
  ) {}

  @Get()
  @HealthCheck()
  check() {
    return this.health.check([
      () => this.memory.checkHeap('memory_heap', 150 * 1024 * 1024),
      () => this.prisma.isHealthy('database'),
    ]);
  }
}
