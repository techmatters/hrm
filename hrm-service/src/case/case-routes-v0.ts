import createError from 'http-errors';
import * as casesDb from './case-data-access';
import * as caseApi from './case';
import { SafeRouter, publicEndpoint } from '../permissions';
import { getActions } from '../permissions';
import { asyncHandler } from '../utils';
import { getCase } from './case';

const casesRouter = SafeRouter();

/**
 * @openapi
 * /cases:
 *   get:
 *     tags:
 *       - Cases
 *     summary: list cases for a helpline
 *     operationId: getCases
 *     parameters:
 *       - in: query
 *         name: helpline
 *         required: false
 *         schema:
 *           type: string
 *     responses:
 *       '200':
 *         description: Fetched cases
 *         content:
 *             application/json:
 *               schema:
 *                 type: array
 *                 items:
 *                   allOf:
 *                     - $ref: '#/components/schemas/SequelizeRecord'
 *                     - $ref: '#/components/schemas/Case'
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 */
casesRouter.get('/', publicEndpoint, async (req, res) => {
  const { accountSid } = req;
  const { sortDirection, sortBy, limit, offset, ...search } = req.query;
  const cases = await caseApi.searchCases(
    accountSid,
    { sortDirection, sortBy, limit, offset },
    { filters: { includeOrphans: false }, ...search },
  );
  res.json(cases);
});

/**
 * @openapi
 * /cases:
 *   post:
 *     tags:
 *       - Cases
 *     summary: create case
 *     operationId: createCase
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Case'
 *       description: Case to create
 *     responses:
 *       '200':
 *         description: Created case
 *         content:
 *             application/json:
 *               schema:
 *                 allOf:
 *                   - $ref: '#/components/schemas/SequelizeRecord'
 *                   - $ref: '#/components/schemas/Case'
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 */
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
    const caseObj = await getCase(id, accountSid);

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

  const caseFromDB = await caseApi.getCase(id, accountSid);

  if (!caseFromDB) {
    throw createError(404);
  }

  res.json(caseFromDB);
});

casesRouter.put('/:id', canEditCase, async (req, res) => {
  const { accountSid, user } = req;
  const { id } = req.params;
  const updatedCase = await caseApi.updateCase(id, req.body, accountSid, user.workerSid);
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

casesRouter.post('/search', publicEndpoint, async (req, res) => {
  const { accountSid } = req;
  const searchResults = await caseApi.searchCases(accountSid, req.query, req.body);
  res.json(searchResults);
});

export default casesRouter.expressRouter;
