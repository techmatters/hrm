const request = require('supertest');
const app = require('../../app');
const mocks = require('./mocks');

const { contact1, contact2 } = mocks;

const headers = {
  'Content-Type': 'application/json',
  Authorization: `Basic ${Buffer.from(process.env.API_KEY).toString('base64')}`,
};

// Called hooks which runs before anything.
beforeAll(done => {
  // log('\n Test started \n');
  done();
});

afterAll(async done => {
  // log('\n Test Finished \n');
  done();
});

describe('/contacts', () => {
  const route = '/contacts';

  // First test post so dabatabe wont be empty
  describe('POST', () => {
    test('should return 401', async () => {
      const response = await request(app)
        .post(route)
        .send(contact1);

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Authorization failed');
    });

    test('should return 200', async () => {
      const response1 = await request(app)
        .post(route)
        .set(headers)
        .send(contact1);

      const response2 = await request(app)
        .post(route)
        .set(headers)
        .send(contact2);

      expect(response1.status).toBe(200);
      expect(response2.status).toBe(200);
      expect(response1.body.rawJson.callType).toBe(contact1.form.callType);
      expect(response2.body.rawJson.callType).toBe(contact2.form.callType);
    });
  });

  describe('GET', () => {
    test('should return 401', async () => {
      const response = await request(app).get(route);

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Authorization failed');
    });

    test('should return 200', async () => {
      const response = await request(app)
        .get(route)
        .set(headers);

      expect(response.status).toBe(200);
      expect(response.body).not.toHaveLength(0);
    });
  });

  describe('/search', () => {
    const subRoute = `${route}/search`;

    test('should return 401', async () => {
      const response = await request(app)
        .post(subRoute)
        .send({});

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Authorization failed');
    });

    describe('multiple input search', () => {
      test('should return 200', async () => {
        const response = await request(app)
          .post(subRoute)
          .set(headers)
          .send({ firstName: 'jh', lastName: 'he' }); // should match both contacts created on /contacts POST

        expect(response.status).toBe(200);
        const [c2, c1] = response.body; // result is sorted DESC
        expect(c1.overview.callType).toBe(contact1.form.callType);
        expect(c2.overview.callType).toBe(contact2.form.callType);
      });
    });

    describe('single input search', () => {
      test('should return 200', async () => {
        const response = await request(app)
          .post(subRoute)
          .set(headers)
          .send({ singleInput: 'qwerty' }); // should match both contacts created on /contacts POST

        expect(response.status).toBe(200);
        const [c2, c1] = response.body; // result is sorted DESC
        expect(c1.overview.callType).toBe(contact1.form.callType);
        expect(c2.overview.callType).toBe(contact2.form.callType);
      });
    });
  });
});
