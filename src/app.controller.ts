import { Controller, Get, Query } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  async getContact(@Query() query: any): Promise<string> {
    return this.appService.getContact(query);
  }
}
