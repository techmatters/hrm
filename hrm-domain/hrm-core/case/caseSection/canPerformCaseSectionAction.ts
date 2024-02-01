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
  | 'editCaseSummary'
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
 * It checks if the user can edit the case based on the fields it's trying to edit
 * according to the defined permission rules.
 */
export const canEditCaseSection = canPerformCaseAction((caseObj, req) => {
  const { sectionType } = req.params;
  return [
    SECTION_TYPE_ACTION_MAP[sectionType].edit ?? actionsMaps.case.EDIT_CASE_SUMMARY,
  ]; // Once we have dynamic case section permissions, we can remove this fallback
});

export const canAddCaseSection = canPerformCaseAction((caseObj, req) => {
  const { sectionType } = req.params;
  return [SECTION_TYPE_ACTION_MAP[sectionType].add ?? actionsMaps.case.EDIT_CASE_SUMMARY]; // Once we have dynamic case section permissions, we can remove this fallback
});
