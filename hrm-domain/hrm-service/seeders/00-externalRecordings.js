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

module.exports = {
  up: async queryInterface => {
    const [[{ id: identifierId }]] = await queryInterface.sequelize.query(
      `
      INSERT INTO public."Identifiers" ("identifier", "accountSid", "createdAt", "updatedAt", "createdBy")
      VALUES ('+1 555-555-5555', 'ACd8a2e89748318adf6ddff7df6948deaf', '2023-08-30 12:23:24.99+00', '2023-08-30 12:23:24.99+00', 'system')
      RETURNING id
    `,
      { returning: true },
    );
    const [[{ id: profileId }]] = await queryInterface.sequelize.query(
      `
      INSERT INTO "Profiles"("name", "accountSid", "createdAt", "updatedAt", "createdBy")
      VALUES (NULL, 'ACd8a2e89748318adf6ddff7df6948deaf', '2023-08-30 12:23:24.99+00', '2023-08-30 12:23:24.99+00', 'system')
      RETURNING id
    `,
      { returning: true },
    );
    await queryInterface.sequelize.query(`
      INSERT INTO "ProfilesToIdentifiers"("profileId", "identifierId", "accountSid", "createdAt", "updatedAt")
      VALUES (${profileId}, ${identifierId}, 'ACd8a2e89748318adf6ddff7df6948deaf', '2023-08-30 12:23:24.99+00', '2023-08-30 12:23:24.99+00');
    `);
    const [[{ id: aseloContactId }]] = await queryInterface.sequelize.query(
      `INSERT INTO "public"."Contacts"
      ("createdAt", "updatedAt", "rawJson", "queueName", "twilioWorkerId", "helpline", "number", "channel", "conversationDuration", "caseId", "accountSid", "timeOfContact", "taskId", "createdBy", "channelSid", "serviceSid", "updatedBy", "profileId", "identifierId")
      VALUES
      ('2023-08-30 12:23:24.99+00', '2023-08-30 12:23:24.99+00', '{"callType": "Child calling about self", "caseInformation": {"categories": {"Violence": {"Assault": false, "Bullying": false, "Child labour": false, "Active Threat": false, "Active Shooter": false, "Sexual violence": false, "Firearm posession": false, "Physical violence": false, "Unspecified/Other": false, "Mental/Emotional violence": false, "Online sexual abuse (OSA)": false, "Child/Early/Forced marriage": false, "Neglect (or negligent treatment)": false, "Online sexual exploitation (OSE)": false, "Information seeking about OSE/OSA": false, "Commercial sexual exploitation (offline)": false}, "Sexuality": {"Sexual behaviours": false, "Unspecified/Other": false, "Sexual orientation and gender identity": false}, "Accessibility": {"Education": false, "Homelessness": false, "Essential needs": false, "Unspecified/Other": false, "Mental health services": false, "Sexual health services": false, "Socio-economical services": false, "General healthcare services": false}, "Mental Health": {"Stress": false, "Anxiety": false, "Depression": false, "Suicidal attempt": false, "Unspecified/Other": false, "Traumatic distress": false, "Behavioural problems": false, "Self-harming behaviour": false, "Neurodevelopmental concerns": false, "Suicidal ideation or threats": false, "Problems with eating behaviour": false, "Emotional distress – mood problems": false, "Emotional distress – anger problems": false, "Addictive behaviours and substance use": false, "Emotional distress – fear and anxiety problems": false}, "Physical Health": {"COVID-19": false, "Nutrition": false, "Male circumcision": false, "Unspecified/Other": false, "Pregnancy and maternal care": false, "Sexual and reproductive health": false, "General medical or lifestyle concerns": false, "Medical or lifestyle information about HIV/AIDS": false}, "Missing children": {"Runaway": false, "Child abduction": false, "Unspecified/Other": true, "Lost, unaccounted for or otherwise missing child": false}, "Peer Relationships": {"Unspecified/Other": false, "Partner relationships": false, "Friends and friendships": false, "Classmates/colleagues relationships": false}, "Family Relationships": {"Unspecified/Other": false, "Relationship to caregiver": false, "Family health and wellbeing": false, "Relationship with sibling(s)": false, "Adoption, fostering, and extended family placement": false}, "Education and Occupation": {"Academic issues": false, "Problems at work": false, "Unspecified/Other": false, "Teacher and school problems": false}, "Discrimination and Exclusion": {"Gender": false, "Health": false, "Discrimination": false, "Unspecified/Other": false, "Financial situation": false, "Ethnicity/nationality": false, "Philosophical or religious beliefs": false, "Gender identity or expression and sexual orientation": false}}, "actionTaken": [], "callSummary": "aselo dev external recording", "mustCallBack": null, "repeatCaller": false, "urgencyLevel": "Critical", "keepConfidential": true, "okForCaseWorkerToCall": null, "howDidYouKnowAboutOurLine": "Unknown", "didYouDiscussRightsWithTheChild": null, "wouldTheChildRecommendUsToAFriend": null, "didTheChildFeelWeSolvedTheirProblem": null}, "contactlessTask": {"date": "2023-08-30", "time": "08:22", "channel": "", "helpline": "Childline", "createdOnBehalfOf": ""}, "childInformation": {"age": "0", "city": "", "gender": "Unknown", "phone1": "", "phone2": "", "region": "Unknown", "LGBTQI+": null, "district": "District B", "language": "Unknown", "lastName": "", "province": "Northern", "ethnicity": "", "firstName": "", "gradeLevel": "Unknown", "postalCode": "", "schoolName": "", "streetAddress": "", "childOnTheMove": "Unknown", "livingInPoverty": null, "livingSituation": "Unknown", "memberOfAnEthnic": null, "childWithDisability": null, "inConflictWithTheLaw": null, "livingInConflictZone": null}, "callerInformation": {"age": "Unknown", "gender": "Unknown", "phone1": "", "phone2": "", "district": "", "language": "Unknown", "lastName": "", "province": "", "ethnicity": "", "firstName": "", "postalCode": "", "streetAddress": "", "relationshipToChild": "Unknown"}, "definitionVersion": "demo-v1"}', 'Admin', 'WK96542043661866049ca3cc73a08a7733', '', '+1 555-555-5555', 'voice', 35, NULL, 'ACd8a2e89748318adf6ddff7df6948deaf', '2023-08-30 12:22:00+00', 'WT3dbd7ad0acd2a1730cf501968570c8e1', 'WK96542043661866049ca3cc73a08a7733', '', '', NULL, ${profileId}, ${identifierId})
      RETURNING ID
      `,
      { returning: true },
    );

    console.log('aseloContactId', aseloContactId);
    queryInterface.sequelize.query(`
      INSERT INTO "public"."ConversationMedias" ("contactId", "storeType", "accountSid", "storeTypeSpecificData", "createdAt", "updatedAt") VALUES
      (${aseloContactId}, 'twilio', 'ACd8a2e89748318adf6ddff7df6948deaf', '{"reservationSid": "WR0d394987ee0d4e824eaffb579785c942"}', '2023-08-30 12:23:24.997+00', '2023-08-30 12:23:24.997+00'),
      (${aseloContactId}, 'S3', 'ACd8a2e89748318adf6ddff7df6948deaf', '{"type": "recording", "location": {"key": "voice-recordings/ACd8a2e89748318adf6ddff7df6948deaf/mockConversationId/callRecording.wav", "bucket": "docs-bucket"}}', '2023-08-30 12:23:24.998+00', '2023-08-30 12:23:24.998+00')
      `);

    const [[{ id: mockContactId }]] = await queryInterface.sequelize.query(
      `
      INSERT INTO "public"."Contacts"
        ("createdAt", "updatedAt", "rawJson", "queueName", "twilioWorkerId", "helpline", "number", "channel", "conversationDuration", "caseId", "accountSid", "timeOfContact", "taskId", "createdBy", "channelSid", "serviceSid", "updatedBy", "profileId", "identifierId")
        VALUES
        ('2023-08-30 12:23:24.99+00', '2023-08-30 12:23:24.99+00', '{"callType": "Child calling about self", "caseInformation": {"categories": {"Violence": {"Assault": false, "Bullying": false, "Child labour": false, "Active Threat": false, "Active Shooter": false, "Sexual violence": false, "Firearm posession": false, "Physical violence": false, "Unspecified/Other": false, "Mental/Emotional violence": false, "Online sexual abuse (OSA)": false, "Child/Early/Forced marriage": false, "Neglect (or negligent treatment)": false, "Online sexual exploitation (OSE)": false, "Information seeking about OSE/OSA": false, "Commercial sexual exploitation (offline)": false}, "Sexuality": {"Sexual behaviours": false, "Unspecified/Other": false, "Sexual orientation and gender identity": false}, "Accessibility": {"Education": false, "Homelessness": false, "Essential needs": false, "Unspecified/Other": false, "Mental health services": false, "Sexual health services": false, "Socio-economical services": false, "General healthcare services": false}, "Mental Health": {"Stress": false, "Anxiety": false, "Depression": false, "Suicidal attempt": false, "Unspecified/Other": false, "Traumatic distress": false, "Behavioural problems": false, "Self-harming behaviour": false, "Neurodevelopmental concerns": false, "Suicidal ideation or threats": false, "Problems with eating behaviour": false, "Emotional distress – mood problems": false, "Emotional distress – anger problems": false, "Addictive behaviours and substance use": false, "Emotional distress – fear and anxiety problems": false}, "Physical Health": {"COVID-19": false, "Nutrition": false, "Male circumcision": false, "Unspecified/Other": false, "Pregnancy and maternal care": false, "Sexual and reproductive health": false, "General medical or lifestyle concerns": false, "Medical or lifestyle information about HIV/AIDS": false}, "Missing children": {"Runaway": false, "Child abduction": false, "Unspecified/Other": true, "Lost, unaccounted for or otherwise missing child": false}, "Peer Relationships": {"Unspecified/Other": false, "Partner relationships": false, "Friends and friendships": false, "Classmates/colleagues relationships": false}, "Family Relationships": {"Unspecified/Other": false, "Relationship to caregiver": false, "Family health and wellbeing": false, "Relationship with sibling(s)": false, "Adoption, fostering, and extended family placement": false}, "Education and Occupation": {"Academic issues": false, "Problems at work": false, "Unspecified/Other": false, "Teacher and school problems": false}, "Discrimination and Exclusion": {"Gender": false, "Health": false, "Discrimination": false, "Unspecified/Other": false, "Financial situation": false, "Ethnicity/nationality": false, "Philosophical or religious beliefs": false, "Gender identity or expression and sexual orientation": false}}, "actionTaken": [], "callSummary": "mock (no auth) external recording", "mustCallBack": null, "repeatCaller": false, "urgencyLevel": "Critical", "keepConfidential": true, "okForCaseWorkerToCall": null, "howDidYouKnowAboutOurLine": "Unknown", "didYouDiscussRightsWithTheChild": null, "wouldTheChildRecommendUsToAFriend": null, "didTheChildFeelWeSolvedTheirProblem": null}, "contactlessTask": {"date": "2023-08-30", "time": "08:22", "channel": "", "helpline": "Childline", "createdOnBehalfOf": ""}, "childInformation": {"age": "0", "city": "", "gender": "Unknown", "phone1": "", "phone2": "", "region": "Unknown", "LGBTQI+": null, "district": "District B", "language": "Unknown", "lastName": "", "province": "Northern", "ethnicity": "", "firstName": "", "gradeLevel": "Unknown", "postalCode": "", "schoolName": "", "streetAddress": "", "childOnTheMove": "Unknown", "livingInPoverty": null, "livingSituation": "Unknown", "memberOfAnEthnic": null, "childWithDisability": null, "inConflictWithTheLaw": null, "livingInConflictZone": null}, "callerInformation": {"age": "Unknown", "gender": "Unknown", "phone1": "", "phone2": "", "district": "", "language": "Unknown", "lastName": "", "province": "", "ethnicity": "", "firstName": "", "postalCode": "", "streetAddress": "", "relationshipToChild": "Unknown"}, "definitionVersion": "demo-v1"}', 'Admin', 'WK96542043661866049ca3cc73a08a7733', '', '+1 555-555-5555', 'voice', 35, NULL, 'ACd8a2e89748318adf6ddff7df6948deaf', '2023-08-30 12:22:00+00', 'WT3dbd7ad0acd2a1730cf501968570c8e2', 'WK96542043661866049ca3cc73a08a7733', '', '', NULL, ${profileId}, ${identifierId})
        RETURNING ID
      `,
      { returning: true },
    );

    console.log('mockContactId', mockContactId);
    queryInterface.sequelize.query(`
    INSERT INTO "public"."ConversationMedias" ("contactId", "storeType", "accountSid", "storeTypeSpecificData", "createdAt", "updatedAt") VALUES
      (${mockContactId}, 'twilio', 'ACd8a2e89748318adf6ddff7df6948deaf', '{"reservationSid": "WR0d394987ee0d4e824eaffb579785c942"}', '2023-08-30 12:23:24.997+00', '2023-08-30 12:23:24.997+00'),
      (${mockContactId}, 'S3', 'ACd8a2e89748318adf6ddff7df6948deaf', '{"type": "recording", "location": {"key": "voice-recordings/ACd8a2e89748318adf6ddff7df6948deaf/mockConversationId/callRecording.wav", "bucket": "mock-bucket"}}', '2023-08-30 12:23:24.998+00', '2023-08-30 12:23:24.998+00');
    `);
  },

  down: () => Promise.all([]),
};
