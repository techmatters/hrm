const supertest = require('supertest');
const Sequelize = require('sequelize');
const app = require('../../app');
const contactModel = require('../../models/contact.js');
const mocks = require('./mocks');

const server = app.listen();
const request = supertest.agent(server);

const { contact1, contact2, broken1, broken2, invalid1 } = mocks;

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

  // First test post so dabatabe wont be empty
  describe('POST', () => {
    test('should return 401', async () => {
      const response = await request.post(route).send(contact1);

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Authorization failed');
    });

    test('should return 200', async () => {
      const contacts = [contact1, contact2, broken1, broken2, invalid1];
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
            .send({ firstName: 'jh', lastName: 'he' }); // should match all contacts, but filter non-data/invalids

          expect(response.status).toBe(200);
          const [c2, c1] = response.body; // result is sorted DESC
          expect(c1.overview.callType).toBe(contact1.form.callType);
          expect(c2.overview.callType).toBe(contact2.form.callType);
        });
      });

      describe('multiple input search without name search', () => {
        test('should return 200', async () => {
          const response = await request
            .post(subRoute)
            .set(headers)
            .send({ counselor: 'fake-worker-123' }); // should match contact1 & broken1

          expect(response.status).toBe(200);
          const [b1, c1] = response.body; // result is sorted DESC
          expect(response.body).toHaveLength(2);
          expect(c1.overview.callType).toBe(contact1.form.callType);
          expect(c1.details).toStrictEqual(contact1.form);
          expect(b1.overview.callType).toBe(broken1.form.callType);
          expect(b1.details).toStrictEqual(broken1.form);
        });
      });

      describe('single input search', () => {
        test('should return 200', async () => {
          const response = await request
            .post(subRoute)
            .set(headers)
            .send({ singleInput: 'qwerty' }); // should match contact1 & contact2

          expect(response.status).toBe(200);
          const [c2, c1] = response.body; // result is sorted DESC
          expect(c1.overview.callType).toBe(contact1.form.callType);
          expect(c2.overview.callType).toBe(contact2.form.callType);
        });
      });
    });
  });
});
