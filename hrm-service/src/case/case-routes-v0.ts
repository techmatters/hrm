import createError from 'http-errors'
import * as casesDb from './case-data-access';
import * as caseApi from './case';
import { getCaseActivities } from './activities';
import { searchCases } from './case';
const { SafeRouter, publicEndpoint, canEditCase } = require('../permissions');
const casesRouter = SafeRouter();

casesRouter.get('/', publicEndpoint, async (req, res) => {
  const { accountSid } = req;
  const cases = await caseApi.listCases(req.query, accountSid);
  res.json(cases);
});

casesRouter.post('/', publicEndpoint, async (req, res) => {
  const { accountSid, user } = req;
  const createdCase = await caseApi.createCase(req.body, accountSid, user.workerSid);

  res.json(createdCase);
});

casesRouter.put('/:id', canEditCase, async (req, res) => {
  const { accountSid, user } = req;
  const { id } = req.params;
  const updatedCase = await caseApi.updateCase(id, req.body, accountSid, user.workerSid);
  res.json(updatedCase);
});

casesRouter.delete('/:id', publicEndpoint, async (req, res) => {
  const { accountSid } = req;
  const { id } = req.params;
  const deleted = await casesDb.deleteById(id, accountSid);
  if (!deleted) {
    throw createError(404)
  }
  res.sendStatus(200);
});

casesRouter.get('/:caseId/activities/', publicEndpoint, async (req, res) => {
  const { accountSid } = req;
  const { caseId } = req.params;

  try {
    res.json(await getCaseActivities(caseId, accountSid));
  } catch (err) {
    if (err.message.match(/Case .* not found\./)) {
      throw createError(404);
    }
    else throw err;
  }
});

casesRouter.post('/search', publicEndpoint, async (req, res) => {
  const { accountSid } = req;
  const searchResults = await caseApi.searchCases(req.body, req.query, accountSid);
  res.json(searchResults);
});

export default casesRouter.expressRouter;