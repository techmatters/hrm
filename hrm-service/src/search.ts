/**
 * Type that describes the payload sent when performing a search operation (contacts & cases)
 */
export type SearchParameters = {
  helpline?: string;
  firstName?: string;
  lastName?: string;
  counselor?: string;
  phoneNumber?: string;
  dateFrom?: string;
  dateTo?: string;
  contactNumber?: string;
  onlyDataContacts?: boolean;
  closedCases?: boolean;
};
