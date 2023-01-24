import { IRouter, Router } from 'express';
import { stub } from './resource-data-access';

const router: IRouter = Router();

router.get('/resource', async (req, res) => {
  const stubResult = await stub();
  res.json(stubResult);
});

export default router;
