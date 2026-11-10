import test from 'node:test';
import assert from 'node:assert/strict';
import {COMMERCIAL_TARGETS, fingerprint, configuredForDispatch, submitEmail} from '../src/company-os/commercial.mjs';
const env = {RESEND_API_KEY:'TEST_ONLY_NO_REAL_CREDENTIAL_987654321',OUTREACH_FROM:'operations@noetfield.com',OUTREACH_ALLOWED_RECIPIENTS:'support@ayetstudios.com'};
test('publisher signups and no fabricated sponsor address',()=>{
 assert.equal(COMMERCIAL_TARGETS.length,4);
 assert.equal(COMMERCIAL_TARGETS[0].portal_url,'https://torox.io/register/');
 assert.equal(COMMERCIAL_TARGETS[2].to_email,null);
});
test('disallow outbound without credentials or recipient allowlist',()=>{
 assert.equal(configuredForDispatch({},'support@ayetstudios.com'),false);
 assert.equal(configuredForDispatch(env,'unlisted@example.org'),false);
 assert.equal(configuredForDispatch(env,'support@ayetstudios.com'),true);
});
test('portal cannot be emailed',async()=>{
 const t={id:'example-id-12345',key:'torox_publisher',channel:'portal',to_email:'support@ayetstudios.com',subject:'test',message:'test'};
 await assert.rejects(submitEmail(t,{env,fetcher:()=>{throw Error('network never called')}}),/INVALID_APPROVED_EMAIL/);
});
test('email send uses idempotency and requires provider message id',async()=>{
 const t={id:'test-id-12345678',key:'ayet_publisher',channel:'email',to_email:'support@ayetstudios.com',subject:'Application',message:'Early-stage Canadian publisher'};
 const mock=async(url,request)=>{
  assert.equal(url,'https://api.resend.com/emails');
  assert.equal(request.headers['Idempotency-Key'],'earnloop/'+t.id);
  assert.deepEqual(JSON.parse(request.body).to,['support@ayetstudios.com']);
  return {ok:true,json:async()=>({id:'test-provider-message-id'})};
 };
 assert.equal(await submitEmail(t,{env,fetcher:mock}),'test-provider-message-id');
 await assert.rejects(submitEmail(t,{env,fetcher:async()=>({ok:true,json:async()=>({})})}),/DID_NOT_CONFIRM_MESSAGE_ID/);
});
test('approval fingerprint protects edited payload',()=>{
 const x={to_email:'support@ayetstudios.com',subject:'Application',message:'Unaltered'};
 assert.notEqual(fingerprint(x),fingerprint({...x,message:'Altered'}));
});