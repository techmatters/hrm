/**
 * Copyright (C) 2021-2023 Technology Matters
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published
 * by the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see https://www.gnu.org/licenses/.
 */

import { actionsMaps } from '../../permissions';
import { canPerformCaseAction } from '../canPerformCaseAction';
import { TKAction } from '../../permissions/rulesMap';

type CaseSectionActionValues = Exclude<
  (typeof actionsMaps.case)[TKAction<'case'>],
  | 'closeCase'
  | 'editChildIsAtRisk'
  | 'viewCase'
  | 'updateCaseContacts'
  | 'caseStatusTransition'
  | 'editCaseOverview'
  | 'reopenCase'
>;

const SECTION_TYPE_ACTION_MAP: Record<
  string,
  { edit: CaseSectionActionValues; add: CaseSectionActionValues }
> = {
  document: { edit: 'editDocument', add: 'addDocument' },
  note: { edit: 'editNote', add: 'addNote' },
  household: { edit: 'editHousehold', add: 'addHousehold' },
  perpetrator: { edit: 'editPerpetrator', add: 'addPerpetrator' },
  referral: { edit: 'editReferral', add: 'addReferral' },
  incident: { edit: 'editIncident', add: 'addIncident' },
};

/**
 * It checks if the user can edit the case section based on the section type
 * The current permissions are defined for 'well known' sections, once we have dynamic case section permissions, this lookup will change
 */
export const canEditCaseSection = canPerformCaseAction(
  (caseObj, req) => {
    const { sectionType } = req.params;
    return [
      SECTION_TYPE_ACTION_MAP[sectionType].edit ?? actionsMaps.case.EDIT_CASE_OVERVIEW,
    ]; // Once we have dynamic case section permissions, we can remove this fallback
  },
  req => req.params.caseId,
);

export const canAddCaseSection = canPerformCaseAction(
  (caseObj, { params }) => {
    const { sectionType } = params;
    return [
      SECTION_TYPE_ACTION_MAP[sectionType].add ?? actionsMaps.case.EDIT_CASE_OVERVIEW,
    ]; // Once we have dynamic case section permissions, we can remove this fallback
  },
  ({ params }) => params.caseId,
);

export const canViewCaseSection = canPerformCaseAction(
  () => [actionsMaps.case.VIEW_CASE],
  req => req.params.caseId,
);
