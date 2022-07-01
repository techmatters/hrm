import twilio, { Twilio } from 'twilio';
import { appendMediaUrls, Contact } from '../contact/contact-data-access';
import { RetrieveContactRecordingJob } from './job-data-access';
import { ContactMediaType } from '../contact/contact-json';
import axios from 'axios';

async function retrieveContactRecordingUrl(client: Twilio, contact: Contact) {
  const call = await client.calls(contact.channelSid).fetch();
  console.log('Call found:', call);
  if (call.status === 'completed' || call.status === 'canceled') {
    const authTokenKey = `TWILIO_AUTH_TOKEN_${contact.accountSid}`;
    const authToken = process.env[authTokenKey];
    // Unfortunately the objects returned as the RecordingInstance type by the twilio client don't include the media URLS
    // So we need to request them directly
    const recordingsResponse = await axios.get(
      `https://api.twilio.com//2010-04-01/Accounts/${contact.accountSid}/Calls/${contact.channelSid}/Recordings.json`,
      {
        auth: {
          username: contact.accountSid,
          password: authToken,
        },
      },
    );
    if (recordingsResponse.status === 200) {
      const { recordings } = recordingsResponse.data;
      console.log('recordings found:', recordings);
      return recordings.map(r => (<any>r).media_url);
    } else {
      throw new Error(
        `Error fetching recordings, status ${recordingsResponse.status}. Response: ${recordingsResponse.data}`,
      );
    }
  } else {
    return null;
  }
}

/**
 * This is the implementation of the job's workload to look up the external media URL and store it on the contact
 * Jobs like this might be placed on queues and run in separate lambdas in a prod implementation.
 * @param client
 * @param contact
 */
export async function processRetrieveContactRecordingUrlJob(job: RetrieveContactRecordingJob) {
  const { resource } = job;
  const authTokenKey = `TWILIO_AUTH_TOKEN_${resource.accountSid}`;
  const authToken = process.env[authTokenKey];
  const client = twilio(resource.accountSid, authToken);
  return retrieveContactRecordingUrl(client, resource);
}

/**
 * This is the implementation of the job's 'when completed' hook, which can be used to do any required follow up work in HRM when a job completes
 * @param job
 */
export async function processRetrieveContactRecordingUrlCompletion(
  job: RetrieveContactRecordingJob,
) {
  await appendMediaUrls(
    job.resource.accountSid,
    job.resource.id,
    job.completionPayload.map(url => ({ url, type: ContactMediaType.RECORDING })),
  );
}
