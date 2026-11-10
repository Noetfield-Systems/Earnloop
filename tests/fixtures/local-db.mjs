import pg from 'pg';
import {PGlite} from '@electric-sql/pglite';
const db=new PGlite();let queue=Promise.resolve();let owner=false;
const query=async(sql,args)=>{if(!args&&sql.trim().split(';').filter(Boolean).length>1){await db.exec(sql);return {rows:[],rowCount:0};}const r=await db.query(sql,args);return {...r,rowCount:r.affectedRows??r.rows.length};};
// Serialize entire transactions in the single-connection test database.
pg.Pool=class{async query(sql,args){const next=queue.then(()=>query(sql,args));queue=next.catch(()=>{});return next;}async connect(){let release;const wait=queue;queue=new Promise(r=>release=r);await wait;return {query,release};}async end(){await db.close();}};
process.env.DATABASE_URL='test-local-only';process.env.PORT='3100';process.env.COMPANY_OS_ADMIN_TOKEN='local-integration-token-for-tests-only';
// Deterministic public source responses only in isolated local test server.
const original=globalThis.fetch;globalThis.fetch=(url,opts)=>String(url).startsWith('http://127.0.0.1')?original(url,opts):Promise.resolve(new Response('Test source; not production evidence'));
