import { Controller, Get } from '@nestjs/common';
import { HealthCheckService, HealthCheck, MemoryHealthIndicator } from '@nestjs/terminus';

@Controller('health')
export class HealthController {
  constructor(
    private health: HealthCheckService,
    private memory: MemoryHealthIndicator,
  ) {}

  @Get()
  @HealthCheck()
  check() {
    return this.health.check([
      () => this.memory.checkHeap('memory_heap', 300 * 1024 * 1024),
    ]);
  }

  @Get('status')
  getStatus() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }
}
