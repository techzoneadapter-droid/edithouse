async function main(){
 const assert = require('node:assert/strict');
 const base='http://localhost:3009';
 const s=await fetch(base+'/api/ai/status');const data=await s.json();
 assert.equal(s.status,200);assert.equal(data.configured,false);assert.equal(data.modelCount,0);
 console.log('No-key status:',s.status,JSON.stringify({configured:data.configured,modelCount:data.modelCount,selected:data.selected}));
 const invalid=await fetch(base+'/api/settings/ai/connect',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({provider:'experiential',apiKey:'bad'})});
 console.log('Invalid key:',invalid.status,await invalid.text());
 assert.equal(invalid.status,401);
 const html=await fetch(base);console.log('Editor HTTP:',html.status);
 assert.equal(html.status,200);
 const forbidden=await fetch(base+'/api/settings/ai/connect',{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://example.com'},body:'{}'});
 console.log('Cross-origin rejected:',forbidden.status);
 assert.equal(forbidden.status,403);
}
main().catch(e=>{console.error(e.message);process.exit(1)});
