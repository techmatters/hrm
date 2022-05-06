import { Contact, ContactRawJson, patch } from './contact-data-access';

export type PatchPayload = {
  rawJson: Partial<
    Pick<ContactRawJson, 'callerInformation' | 'childInformation' | 'caseInformation'>
  >;
};

export const patchContact = async (
  accountSid: string,
  updatedBy: string,
  contactId: string,
  contactPatch: PatchPayload,
): Promise<Contact> => {
  const {
    childInformation,
    callerInformation,
    caseInformation: fullCaseInformation,
  } = contactPatch.rawJson;
  const { categories, ...caseInformation } = fullCaseInformation ?? {};
  const updated = await patch(accountSid, contactId, {
    updatedBy,
    childInformation,
    callerInformation,
    categories: <Record<string, Record<string, boolean>>>categories,
    caseInformation: Object.entries(caseInformation).length
      ? <Record<string, string | boolean>>caseInformation
      : undefined,
  });
  if (!updated) {
    throw new Error(`Contact not found with id ${contactId}`);
  }
  return updated;
};
