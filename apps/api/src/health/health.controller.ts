import { Controller, Get } from '@nestjs/common';
import { Public } from '../auth/decorators';

export interface HealthStatus {
  status: 'ok';
}

@Controller('health')
export class HealthController {
  @Public()
  @Get()
  check(): HealthStatus {
    return { status: 'ok' };
  }
}
