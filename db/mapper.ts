import { Case, CaseRecord } from './case';
import { Contact, ContactRecord } from './contact';

export function mapCaseRecordsetToObjectGraph(records: readonly {case: CaseRecord, caseId: number, contact?: ContactRecord, contactId: number, csamReportRecord?: any}[]) {
  const graph: Case[] = [];
  records.reduce(
    (current , newRecord)=> {
      let targetCase: Case;
      if (current && current.caseId == newRecord.caseId) {
        if (!newRecord.contact) {
          throw new Error('Data consistency error. There should never be multiple records for the same case without associated contacts');
        }
        if (graph.length === 0) {
          throw new Error('Data consistency error. There should never be multiple records for the same case without associated contacts');
        }
        targetCase = graph[graph.length-1];
      }
      else {
        targetCase = { ...newRecord.case, connectedContacts: []}
        graph.push(targetCase)
      }
      if (newRecord.contact) {
        let targetContact: Contact;
        if (current && current.contact && current.contactId == newRecord.contactId) {
          targetContact = targetCase.connectedContacts[targetCase.connectedContacts.length-1];
        } else {
          targetContact = { ...newRecord.contact, csamReports: [] };
          targetCase.connectedContacts.push(targetContact);
        }
        if (newRecord.csamReportRecord) {
          targetContact.csamReports.push(newRecord.csamReportRecord)
        }
      }
      return newRecord
    }, null
  );
  return graph;
}