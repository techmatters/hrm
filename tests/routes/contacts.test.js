const supertest = require('supertest');
const Sequelize = require('sequelize');
const app = require('../../app');
const contactModel = require('../../models/contact.js');
const mocks = require('./mocks');

const server = app.listen();
const request = supertest.agent(server);

const { contact1, contact2, broken1, broken2, withHelpline1, withHelpline2, noHelpline } = mocks;

const headers = {
  'Content-Type': 'application/json',
  Authorization: `Basic ${Buffer.from(process.env.API_KEY).toString('base64')}`,
};

const host = process.env.RDS_HOSTNAME || 'localhost';
const pass = process.env.RDS_PASSWORD || '';
const sequelize = new Sequelize('hrmdb', 'hrm', pass, {
  host,
  dialect: 'postgres',
});
const Contact = contactModel(sequelize, Sequelize);

beforeAll(async done => {
  // log('\n Test started \n');
  await Contact.destroy({
    where: {
      [Sequelize.Op.or]: [
        { twilioWorkerId: 'fake-worker-123' },
        { twilioWorkerId: 'fake-worker-987' },
      ],
    },
  });

  done();
});

afterAll(async done => {
  server.close(done);
  // log('\n Test Finished \n');
});

describe('/contacts route', () => {
  const route = '/contacts';

  // First test post so database wont be empty
  describe('POST', () => {
    test('should return 401', async () => {
      const response = await request.post(route).send(contact1);

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Authorization failed');
    });

    test('should return 200', async () => {
      const contacts = [
        contact1,
        contact2,
        broken1,
        broken2,
        withHelpline1,
        withHelpline2,
        noHelpline,
      ];
      const requests = contacts.map(item =>
        request
          .post(route)
          .set(headers)
          .send(item),
      );
      const responses = await Promise.all(requests);

      responses.forEach((res, index) => {
        expect(res.status).toBe(200);
        expect(res.body.rawJson.callType).toBe(contacts[index].form.callType);
      });
    });
  });

  describe('GET', () => {
    test('should return 401', async () => {
      const response = await request.get(route);

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Authorization failed');
    });

    test('should return 200', async () => {
      const response = await request.get(route).set(headers);

      expect(response.status).toBe(200);
      expect(response.body).not.toHaveLength(0);
    });
  });

  describe('/contacts/search route', () => {
    const subRoute = `${route}/search`;

    describe('POST', () => {
      test('should return 401', async () => {
        const response = await request.post(subRoute).send({});

        expect(response.status).toBe(401);
        expect(response.body.error).toBe('Authorization failed');
      });

      describe('multiple input search', () => {
        test('should return 200', async () => {
          const response = await request
            .post(subRoute)
            .set(headers)
            .send({ firstName: 'jh', lastName: 'he' }); // should filter non-data

          expect(response.status).toBe(200);
          expect(response.body).toHaveLength(2);
          const [c2, c1] = response.body; // result is sorted DESC
          expect(c1.details).toStrictEqual(contact1.form);
          expect(c2.details).toStrictEqual(contact2.form);
        });
      });

      describe('multiple input search that targets zero contacts', () => {
        test('should return 200', async () => {
          const response = await request
            .post(subRoute)
            .set(headers)
            .send({ firstName: 'jh', lastName: 'curie' });

          expect(response.status).toBe(200);
          expect(response.body).toHaveLength(0);
        });
      });

      describe('multiple input search with helpline', () => {
        test('should return 200', async () => {
          const response1 = await request
            .post(subRoute)
            .set(headers)
            .send({ firstName: 'ma', lastName: 'ur' }); // should match withHelpline1 & withHelpline2

          const response2 = await request
            .post(subRoute)
            .set(headers)
            .send({ firstName: 'ma', lastName: 'ur', helpline: 'Helpline 1' }); // should match withHelpline1 & noHelpline

          expect(response1.status).toBe(200);
          expect(response1.body).toHaveLength(3);
          const [nh, wh2, wh1] = response1.body; // result is sorted DESC
          expect(wh1.details).toStrictEqual(withHelpline1.form);
          expect(wh2.details).toStrictEqual(withHelpline2.form);
          expect(nh.details).toStrictEqual(noHelpline.form);

          expect(response2.status).toBe(200);
          expect(response2.body).toHaveLength(2);
          const [nh2, wh] = response2.body; // result is sorted DESC
          expect(wh.details).toStrictEqual(withHelpline1.form);
          expect(nh2.details).toStrictEqual(noHelpline.form);
        });
      });

      describe('multiple input search without name search', () => {
        test('should return 200', async () => {
          const response = await request
            .post(subRoute)
            .set(headers)
            .send({ counselor: 'fake-worker-123' }); // should match contact1 & broken1 & withHelpline1 & noHelpline

          expect(response.status).toBe(200);
          expect(response.body).toHaveLength(4);
          const [nh, wh1, b1, c1] = response.body; // result is sorted DESC
          expect(c1.details).toStrictEqual(contact1.form);
          expect(b1.details).toStrictEqual(broken1.form);
          expect(wh1.details).toStrictEqual(withHelpline1.form);
          expect(nh.details).toStrictEqual(noHelpline.form);
        });
      });

      describe('single input search', () => {
        test('should return 200', async () => {
          const response = await request
            .post(subRoute)
            .set(headers)
            .send({ singleInput: 'qwerty' }); // should match contact1 & contact2

          expect(response.status).toBe(200);
          expect(response.body).toHaveLength(2);
          const [c2, c1] = response.body; // result is sorted DESC
          expect(c1.details).toStrictEqual(contact1.form);
          expect(c2.details).toStrictEqual(contact2.form);
        });
      });
    });
  });
});
