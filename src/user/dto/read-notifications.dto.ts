import { IsArray, IsNumber } from 'class-validator';

export class ReadNotificationsDto {
  @IsArray()
  @IsNumber({}, { each: true })
  notificationsIds: number[];
}
