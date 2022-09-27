process.env.PERMISSIONS_br = 'br';
process.env.PERMISSIONS_ca = 'ca';
process.env.PERMISSIONS_cl = 'cl';
process.env.PERMISSIONS_co = 'co';
process.env.PERMISSIONS_et = 'et';
process.env.PERMISSIONS_in = 'in';
process.env.PERMISSIONS_jm = 'jm';
process.env.PERMISSIONS_mw = 'mw';
process.env.PERMISSIONS_ro = 'ro';
process.env.PERMISSIONS_th = 'th';
process.env.PERMISSIONS_uk = 'uk';
process.env.PERMISSIONS_za = 'za';
process.env.PERMISSIONS_zm = 'zm';
process.env.PERMISSIONS_open = 'open';
process.env.PERMISSIONS_demo = 'demo';
process.env.PERMISSIONS_dev = 'dev';
process.env.PERMISSIONS_e2e = 'e2e';
process.env.PERMISSIONS_notConfigured = '';
process.env.PERMISSIONS_notExistsInRulesMap = 'notExistsInRulesMap';

process.env.INCLUDE_ERROR_IN_RESPONSE = true;

if (!process.env.ENABLE_TEST_DEBUG) {
  console.log = jest.fn(() => {});
  console.error = jest.fn(() => {});
  console.warn = jest.fn(() => {});
  console.debug = jest.fn(() => {});
}
