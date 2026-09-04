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

export type CaseReportContentNode = {
  type:
    | 'text'
    | 'section'
    | 'text_field'
    | 'date_time_field'
    | 'option'
    | 'dropdown'
    | 'date_time_field_calc'
    | 'checkbox'
    | 'documents';
  value: string | null;
  fields: CaseReportContentNode[] | null;
  label: string;
} & Record<string, string | null | number | CaseReportContentNode[]>;

export type CaseReportContentValues = {
  [key: string]: string | null | number | boolean | CaseReportContentValues;
};

export const extractContentNodeValues = ({
  type,
  value,
  fields,
  label,
}: CaseReportContentNode): CaseReportContentValues[keyof CaseReportContentValues] => {
  switch (type) {
    case 'section': {
      const sectionEntries = (fields || []).map(node => [
        node.label,
        extractContentNodeValues(node),
      ]);
      return Object.fromEntries(sectionEntries);
    }
    case 'checkbox': {
      return value === label;
    }
    default: {
      return value;
    }
  }
};
