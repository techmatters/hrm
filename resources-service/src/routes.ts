import { IRouter, Router } from 'express';
import resourceRoutes from './resource/resource-routes-v0';

export const apiV0 = () => {
  const router: IRouter = Router();

  router.use(resourceRoutes);
  return router;
};
