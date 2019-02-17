const Saga = require('./');


jest.mock('hyperdb', () => {
  return () => ({
    ready: jest.fn((resolver) => resolver()),
    authorized: jest.fn((key, cb) => cb(null, true)),
    authorize: jest.fn(() => Promise.resolve()),
    createHistoryStream: jest.fn(),
    watch: jest.fn(() => ({ on: jest.fn() }))
  });
});

jest.mock('pump', (str1, str2, lastFn) => {
  return jest.fn()
});

const validPeer = {
  remoteUserData: JSON.stringify({
    username: 'test',
    key: 'k3y'
  }),
  on: jest.fn()
};

test('connect and close', async () => {
  expect.assertions(2);
  const saga = Saga('/tmp', null, 'test');
  expect(saga).toBeDefined();
  await saga.initialize();

  saga.on('join', data => {
    expect(data.username).toEqual(JSON.parse(validPeer.remoteUserData).username);
  })

  saga.connect(validPeer);
})
