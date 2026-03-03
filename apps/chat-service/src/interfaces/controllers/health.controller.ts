import { Controller, Get } from '@nestjs/common';
import { HealthCheckService, HealthCheck, MemoryHealthIndicator, MongooseHealthIndicator } from '@nestjs/terminus';

@Controller('health')
export class HealthController {
  constructor(
    private health: HealthCheckService,
    private memory: MemoryHealthIndicator,
    private mongoose: MongooseHealthIndicator,
  ) {}

  @Get()
  @HealthCheck()
  check() {
    return this.health.check([
      () => this.memory.checkHeap('memory_heap', 150 * 1024 * 1024),
      () => this.mongoose.pingCheck('mongodb'),
    ]);
  }
}
