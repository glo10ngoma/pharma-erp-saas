const assert = require('assert/strict');
const fs = require('fs');
const vm = require('vm');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
function load(file, stubs) {
  const module = { exports: {} };
  const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2020 } }).outputText;
  vm.runInNewContext(source, { module, exports: module.exports, require: (name) => {
    if (name in stubs) return stubs[name];
    if (name.startsWith('react')) return require(name);
    throw new Error(`Unexpected dependency: ${name}`);
  }});
  return module.exports;
}
const errors = load('src/modules/auth/organization-selection-error.ts', {});
assert.match(errors.organizationSelectionError({response:{status:403}}), /pas autorisé/);
assert.match(errors.organizationSelectionError({response:{status:500,data:{message:'SQL internal details'}}}), /service rencontre/);
assert.match(errors.organizationSelectionError({response:{status:401}}), /session a expiré/);
assert.match(errors.organizationSelectionError({code:'ERR_NETWORK'}), /injoignable/);
assert.doesNotMatch(errors.organizationSelectionError(null), /autorisé/);

async function run() {
  let navigated;
  let calls = 0;
  let release;
  const auth = { loading:false, currentUser:{id:'u',fullName:'Test'}, availableOrganizations:[{id:'cana',name:'CANA',code:'CANA'}], switchOrganization: async () => { calls++; return new Promise(resolve => { release = resolve; }); } };
  const effects = [];
  const states = [];
  const hooks = { ...React, useEffect: (fn) => effects.push(fn), useRef: (value) => ({current:value}), useState: (value) => [value, next => states.push(next)] };
  const { OrganizationSelectPage } = load('src/modules/auth/OrganizationSelectPage.tsx', {
    react:hooks, '../../auth/AuthContext':{useAuth:()=>auth}, 'react-router-dom':{useNavigate:()=>path=>{navigated=path;}}, './organization-selection-error':errors, './organization-select.css':{},
  });
  const tree = OrganizationSelectPage();
  // StrictMode may replay the same mount effect: only one request should run.
  effects[0](); effects[0]();
  assert.equal(calls,1);
  release({siteId:'matete'});
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(navigated,'/dashboard');
  const buttons=[];
  function walk(node) { if (!node || typeof node !== 'object') return; if(node.type==='button') buttons.push(node); React.Children.forEach(node.props?.children,walk); }
  walk(tree);
  const open = buttons.find(button=>button.props.className==='organization-selection-option');
  auth.switchOrganization=async()=>({});
  open.props.onClick();
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(navigated,'/site-select');
  auth.switchOrganization=async()=>{throw {response:{status:500}};};
  open.props.onClick();
  await new Promise(resolve=>setImmediate(resolve));
  assert.match(states.findLast(value=>typeof value==='string' && value.includes('service')),/service rencontre/);
  // Server rendering checks the actual user-visible empty/loading/list states.
  const { OrganizationSelectPage: View } = load('src/modules/auth/OrganizationSelectPage.tsx', { '../../auth/AuthContext':{useAuth:()=>auth}, 'react-router-dom':{useNavigate:()=>()=>{}}, './organization-selection-error':errors, './organization-select.css':{} });
  assert.match(renderToStaticMarkup(React.createElement(View)), /CANA/);
  auth.availableOrganizations=[];
  assert.match(renderToStaticMarkup(React.createElement(View)), /Aucune organisation disponible/);
  auth.loading=true;
  assert.match(renderToStaticMarkup(React.createElement(View)), /Chargement de vos organisations/);
  console.log('PASS: organization selection, duplicate guard, routing, errors and rendered states');
}
run().catch(error=>{console.error(error);process.exitCode=1;});
