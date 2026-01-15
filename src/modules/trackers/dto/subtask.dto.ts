import { IsBoolean, IsInt, IsNotEmpty } from 'class-validator';

export class ToggleSubtaskDto {
  @IsInt()
  @IsNotEmpty()
  taskId: number;

  @IsInt()
  @IsNotEmpty()
  subtaskId: number;

  @IsInt()
  @IsNotEmpty()
  userId: number;

  @IsBoolean()
  @IsNotEmpty()
  completed: boolean;
}
