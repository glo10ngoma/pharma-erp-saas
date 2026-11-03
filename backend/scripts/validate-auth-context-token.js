const assert = require('node:assert/strict');
const { JwtService } = require('@nestjs/jwt');
const { AuthService } = require('../dist/auth/auth.service');

async function main() {
  const jwt = new JwtService({ secret: 'context-token-regression-test-only', signOptions: { expiresIn: '1h' } });
  const permissions = ['sales.create', 'pos_sync.execute'];
  const profile = { userId: 'user-1', fullName: 'Test', role: 'SUPER_ADMIN', tenantId: 'platform', permissions };
  const incoming = jwt.verify(await jwt.signAsync(profile));
  // Reproduce the production failure with the original spread-based payload.
  await assert.rejects(jwt.signAsync({ ...incoming, tenantId: 'cana' }), /already has an "exp"/);
  const sites = [{ id: 'matete', code: 'MATETE', name: 'Test site' }];
  const repository = {
    findAccessibleTenants: async () => [{ id: 'platform' }, { id: 'cana' }],
    findAccessibleSites: async (_user, tenantId) => tenantId === 'cana' ? sites : [],
  };
  const service = new AuthService(repository, jwt);
  const switched = await service.switchOrganization(incoming, 'cana');
  const decoded = jwt.verify(switched.accessToken);
  assert.equal(decoded.tenantId, 'cana');
  assert.equal(decoded.siteId, 'matete');
  assert.equal(decoded.homeTenantId, 'platform');
  assert.deepEqual(decoded.permissions, permissions);
  assert.equal(decoded.exp - decoded.iat, 3600);
  const second = await service.switchSite(decoded, 'matete');
  assert.equal(jwt.verify(second.accessToken).homeTenantId, 'platform');
  await assert.rejects(service.switchOrganization(incoming, 'unassigned'), /TENANT_NOT_ALLOWED/);
  await assert.rejects(service.switchSite(decoded, 'other-site'), /SITE_NOT_ALLOWED/);
  // Site-scoped users retain their home identity; unrelated JWT metadata is not copied.
  const scoped = { ...incoming, role: 'ADMIN', homeTenantId: 'cana', homeSiteId: 'matete', tenantId: 'cana', siteId: 'matete', arbitraryClaim: 'must-not-be-carried' };
  const scopedToken = jwt.verify((await service.switchOrganization(scoped, 'cana')).accessToken);
  assert.equal(scopedToken.homeSiteId, 'matete');
  assert.equal(scopedToken.arbitraryClaim, undefined);
  const noSites = await service.switchOrganization(incoming, 'platform');
  assert.equal(jwt.verify(noSites.accessToken).siteId, undefined);
  console.log('AUTH_CONTEXT_TOKEN=PASS; production failure reproduced; organization/site switching, expiry, home identity and access denials verified');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
