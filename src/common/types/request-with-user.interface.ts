import { Request } from 'express';
import { JwtPayload } from '../../auth/types/jwt-payload.interface';

export interface RequestWithUser extends Request {
  user: JwtPayload;
}
