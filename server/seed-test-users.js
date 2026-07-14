// One-off seed for e2e page tests: creates a real user (role 1), provider
// (role 2) and admin (role 0), signs genuine JWTs the same way the controllers
// do, and writes the localStorage payloads to e2e/.auth.json so the Playwright
// suite can drive protected + admin pages as a logged-in session (real happy path).
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('./models');

const SECRET = process.env.JWT_SECRET;

async function ensureUser({ email, role, firstName, lastName }) {
  const password = await bcrypt.hash('Test@1234', 10);
  const loginTime = 1000000 + Math.floor(role === '0' ? 111 : role === '1' ? 222 : 333);
  const base = {
    role, firstName, lastName, email,
    countryCode: '+1', phoneNumber: '5550100' + role,
    password,
    isProfileComplete: '1', otpVerify: '1', status: '1',
    loginTime,
  };
  let user = await db.users.findOne({ where: { email }, paranoid: false });
  if (user) {
    await user.update({ ...base, deletedAt: null });
  } else {
    user = await db.users.create(base);
  }
  return user;
}

(async () => {
  try {
    await db.sequelize.authenticate();

    const user = await ensureUser({ email: 'e2e-user@vership.test', role: '1', firstName: 'E2E', lastName: 'User' });
    const provider = await ensureUser({ email: 'e2e-provider@vership.test', role: '2', firstName: 'E2E', lastName: 'Provider' });
    const admin = await ensureUser({ email: 'e2e-admin@vership.test', role: '0', firstName: 'E2E', lastName: 'Admin' });

    const userToken = jwt.sign({ id: user.id, loginTime: user.loginTime }, SECRET);
    const providerToken = jwt.sign({ id: provider.id, loginTime: provider.loginTime }, SECRET);
    const adminToken = jwt.sign({ id: admin.id, name: admin.firstName, email: admin.email, role: admin.role }, SECRET);

    const shape = (u) => ({
      id: u.id, role: u.role, firstName: u.firstName, lastName: u.lastName,
      email: u.email, countryCode: u.countryCode, phoneNumber: u.phoneNumber,
      image: '', isProfileComplete: u.isProfileComplete, status: u.status,
      loginTime: u.loginTime, otpVerify: u.otpVerify, profile_step: u.profile_step,
    });

    const out = {
      user: { token: userToken, user: shape(user) },
      provider: { token: providerToken, user: shape(provider) },
      admin: { admin_token: adminToken, admin_userData: { token: adminToken, id: admin.id, name: admin.firstName, email: admin.email, role: admin.role } },
    };

    const outPath = path.join(__dirname, '..', 'e2e', '.auth.json');
    fs.writeFileSync(outPath, JSON.stringify(out, null, 2));
    console.log('Seeded users. Wrote', outPath);
    console.log('user id', user.id, 'provider id', provider.id, 'admin id', admin.id);
    process.exit(0);
  } catch (e) {
    console.error('SEED FAILED:', e);
    process.exit(1);
  }
})();
