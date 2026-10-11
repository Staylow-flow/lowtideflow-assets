const fs=require('fs'),vm=require('vm');
function Sheet(){this.d=[];}
Sheet.prototype={getLastRow(){return this.d.length},setFrozenRows(){},
 getRange(r,c,nr,nc){const sh=this;if(typeof r==='string'){const m=r.match(/^([A-Z])(\d+)/);c=m[1].charCodeAt(0)-64;r=+m[2];nr=1;nc=1;}nr=nr||1;nc=nc||1;
  return {setValues(v){for(let i=0;i<nr;i++){sh.d[r-1+i]=sh.d[r-1+i]||[];for(let j=0;j<nc;j++)sh.d[r-1+i][c-1+j]=v[i][j];}return this},
   getValues(){const o=[];for(let i=0;i<nr;i++){const row=[];for(let j=0;j<nc;j++)row.push(sh.d[r-1+i]&&sh.d[r-1+i][c-1+j]!==undefined?sh.d[r-1+i][c-1+j]:'');o.push(row)}return o},
   getValue(){return this.getValues()[0][0]},setFormula(f){sh.d[r-1][c-1]=f;return this},setFontWeight(){return this},insertCheckboxes(){for(let i=0;i<nr;i++){sh.d[r-1+i]=sh.d[r-1+i]||[];for(let j=0;j<nc;j++)sh.d[r-1+i][c-1+j]=false;}return this}}},
 appendRow(a){this.d.push(a)},deleteRow(i){this.d.splice(i-1,1)}};
function load(file){const ss={s:{},getSheetByName(n){return this.s[n]||null},insertSheet(n){return this.s[n]=new Sheet()}};
 const ctx={SpreadsheetApp:{getActiveSpreadsheet:()=>ss,openById:()=>ss,flush(){}},LockService:{getScriptLock:()=>({waitLock(){},releaseLock(){}})},
  ContentService:{MimeType:{JSON:'json'},createTextOutput:t=>({t,setMimeType(){return this}})}};
 vm.createContext(ctx);vm.runInContext(fs.readFileSync(file||__dirname+'/../Promos-CREW20-10-07-26-01.gs','utf8'),ctx);ctx.ss=ss;return ctx;}
module.exports=load;
if(require.main===module){const g=load();g.setupPromos();const get=p=>JSON.parse(g.doGet({parameter:p}).t);
 console.log(g.ss.s.Promos.d);
 console.log('check',get({action:'check',code:'crew20'}));
 for(let i=1;i<=10;i++){const r=get({action:'claim',code:'CREW20',email:'T'+i+'@x.com',quote:'q'+i});if(!r.ok)console.log('FAIL',i,r)}
 console.log('dup',get({action:'claim',code:'CREW20',email:'t1@X.com'}));
 console.log('11th',get({action:'claim',code:'CREW20',email:'t11@x.com'}));
 console.log('check',get({action:'check',code:'CREW20'}));
 console.log('bad email',get({action:'claim',code:'CREW20',email:'nope'}));
 console.log('unknown',get({action:'check',code:'ZZZ'}));
 g.resetPromoClaims();console.log('after reset',get({action:'check',code:'CREW20'}));
 g.ss.s.Promos.d[1][3]=false;console.log('inactive check',get({action:'check',code:'CREW20'}),'claim',get({action:'claim',code:'CREW20',email:'a@b.co'}));
 g.ss.s.Promos.d[1][3]=true;console.log('post',JSON.parse(g.doPost({parameter:{},postData:{contents:JSON.stringify({code:'CREW20',email:'p@q.co',quote:'z'})}}).t));
 console.log(g.ss.s.Promo_Claims.d);}
