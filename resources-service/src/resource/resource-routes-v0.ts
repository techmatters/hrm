import { IRouter, Request, Router } from 'express';
import { getResource, searchResources } from './resource-model';
import { AccountSID } from '@tech-matters/twilio-worker-auth';
import createError from 'http-errors';

const resourceRoutes = () => {
  const router: IRouter = Router();

  router.get('/resource/:resourceId', async (req, res) => {
    const referrableResource = await getResource(<AccountSID>req.accountSid, req.params.resourceId);
    if (!referrableResource) {
      throw createError(404);
    }
    res.json(referrableResource);
  });

  router.post('/search', async (req: Request<{ nameSubstring: string; ids: string[] }>, res) => {
    const { limit, start } = req.query;
    const referrableResources = await searchResources(<AccountSID>req.accountSid, {
      ...req.body,
      pagination: {
        limit: parseInt((limit as string) || '20'),
        start: parseInt((start as string) || '0'),
      },
    });
    res.json(referrableResources);
  });

  return router;
};
export default resourceRoutes;
