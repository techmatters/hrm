import createError from 'http-errors';
import * as casesDb from './case-data-access';
import * as caseApi from './case';
import { SafeRouter, publicEndpoint, RequestWithPermissions } from '../permissions';
import { getActions } from '../permissions';
import asyncHandler from '../async-handler';
import { getCase } from './case';

const casesRouter = SafeRouter();

/**
 * Returns a filterable list of cases for a helpline
 *
 * @param {string} req.accountSid - SID of the helpline
 * @param {CaseListConfiguration.sortDirection} req.query.sortDirection - Sort direction
 * @param {CaseListConfiguration.sortBy} req.query.sortBy - Sort by
 * @param {CaseListConfiguration.limit} req.query.limit - Limit
 * @param {CaseListConfiguration.offset} req.query.offset - Offset
 * @param {import('./case').SearchParameters} req.query.search
 *
 * @returns {import('./case').CaseSearchReturn} - List of cases
 */
casesRouter.get('/', publicEndpoint, async (req, res) => {
  const { accountSid } = req;
  const { sortDirection, sortBy, limit, offset, ...search } = req.query;
  const cases = await caseApi.searchCases(
    accountSid,
    { sortDirection, sortBy, limit, offset },
    { filters: { includeOrphans: false }, ...search },
    { can: req.can, user: req.user },
  );
  res.json(cases);
});

casesRouter.post('/', publicEndpoint, async (req, res) => {
  const { accountSid, user } = req;
  const createdCase = await caseApi.createCase(req.body, accountSid, user.workerSid);

  res.json(createdCase);
});

/**
 * It checks if the user can edit the case based on the fields it's trying to edit
 * according to the defined permission rules.
 */
const canEditCase = asyncHandler(async (req, res, next) => {
  if (!req.isAuthorized()) {
    const { accountSid, body, user, can } = req;
    const { id } = req.params;
    const caseObj = await getCase(id, accountSid, { can, user });

    if (!caseObj) throw createError(404);

    const actions = getActions(caseObj, body);
    console.debug(`Actions attempted in case edit (case #${id})`, actions);
    const canEdit = actions.every(action => can(user, action, caseObj));

    if (canEdit) {
      req.authorize();
    } else {
      req.unauthorize();
    }
  }

  next();
});

casesRouter.get('/:id', publicEndpoint, async (req, res) => {
  const { accountSid } = req;
  const { id } = req.params;

  const caseFromDB = await caseApi.getCase(id, accountSid, { can: req.can, user: req.user });

  if (!caseFromDB) {
    throw createError(404);
  }

  res.json(caseFromDB);
});

casesRouter.put('/:id', canEditCase, async (req, res) => {
  const { accountSid, user } = req;
  const { id } = req.params;
  const updatedCase = await caseApi.updateCase(id, req.body, accountSid, user.workerSid, {
    can: req.can,
    user,
  });
  if (!updatedCase) {
    throw createError(404);
  }
  res.json(updatedCase);
});

casesRouter.delete('/:id', publicEndpoint, async (req, res) => {
  const { accountSid } = req;
  const { id } = req.params;
  const deleted = await casesDb.deleteById(id, accountSid);
  if (!deleted) {
    throw createError(404);
  }
  res.sendStatus(200);
});

casesRouter.post('/search', publicEndpoint, async (req: RequestWithPermissions, res) => {
  const { accountSid } = req;
  const searchResults = await caseApi.searchCases(accountSid, req.query || {}, req.body || {}, {
    can: req.can,
    user: req.user,
  });
  res.json(searchResults);
});

export default casesRouter.expressRouter;
