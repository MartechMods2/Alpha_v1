import { createHash, randomInt } from 'node:crypto';
const catalog = {};
const add = (name, category, description, example, run) => { catalog[name] = {name,category,description,example,run}; };
const nums = (text, min=1, max=100) => {
  const parts = text.trim().split(/[\s,]+/).filter(Boolean);
  if (parts.length<min || parts.length>max) throw new Error(`Supply ${min}–${max} numbers separated by spaces.`);
  const values=parts.map(Number);
  if (values.some(v=>!Number.isFinite(v) || Math.abs(v)>1e12)) throw new Error('Use finite numbers between -1 trillion and 1 trillion.');
  return values;
};
const pair = fn => text => fn(...nums(text,2,2));
const triple = fn => text => fn(...nums(text,3,3));
const positive = (...values) => {if(values.some(v=>v<=0)) throw new Error('Values must be greater than zero.');};
const nonzero = value => {if(value===0) throw new Error('Cannot divide by zero.');return value;};
const lines = text => text.split('\n').map(s=>s.trim()).filter(Boolean);
const words = text => text.match(/[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu)||[];
const title = text => text.toLowerCase().replace(/\b\w/g,c=>c.toUpperCase());
const gcd = (a,b) => {if(!Number.isSafeInteger(a)||!Number.isSafeInteger(b)) throw new Error('Use integers.');a=Math.abs(a);b=Math.abs(b);while(b){[a,b]=[b,a%b];}return a;};
const date = text => {if(!/^\d{4}-\d{2}-\d{2}$/.test(text)) throw new Error('Use YYYY-MM-DD.');const d=new Date(text+'T00:00:00Z');if(!Number.isFinite(+d)||d.toISOString().slice(0,10)!==text) throw new Error('Invalid calendar date.');return d;};
const dateArgs = text => text.trim().split(/\s+/);
const pipes = (text,min=2) => {const a=text.split('|').map(s=>s.trim());if(a.length<min||a.some(s=>!s)) throw new Error('Separate nonempty fields with |.');return a;};

// Text cleanup, composition and review.
const textTools = [
 ['trimtext','Remove surrounding whitespace','  Hello Alpha  ',t=>t.trim()],
 ['compacttext','Collapse repeated whitespace','Hello   Alpha',t=>t.replace(/\s+/g,' ').trim()],
 ['paragraphcount','Count nonempty paragraphs','Hello\n\nWelcome',t=>t.split(/\n\s*\n/).filter(s=>s.trim()).length],
 ['sentencecount','Count sentence-ending punctuation groups','Hello. Welcome!',t=>(t.match(/[.!?]+(?:\s|$)/g)||[]).length],
 ['longestword','Find the longest word','Build useful communities',t=>words(t).sort((a,b)=>b.length-a.length)[0]||'No words.'],
 ['shortestword','Find the shortest word','Build a community',t=>words(t).sort((a,b)=>a.length-b.length)[0]||'No words.'],
 ['wordfrequency','Show ten most frequent words','hello hello alpha',t=>{const counts=new Map();for(const w of words(t.toLowerCase()))counts.set(w,(counts.get(w)||0)+1);return [...counts].sort((a,b)=>b[1]-a[1]).slice(0,10).map(([w,n])=>`${w}: ${n}`).join('\n');}],
 ['uniquevocabs','List distinct words alphabetically','Hello hello Alpha',t=>[...new Set(words(t.toLowerCase()))].sort().join(', ')],
 ['averagewordlength','Calculate mean word length','Hello Alpha',t=>{const w=words(t);return w.length?w.reduce((n,s)=>n+[...s].length,0)/w.length:0;}],
 ['textbytes','Count UTF-8 bytes','Hello Alpha',t=>Buffer.byteLength(t,'utf8')],
 ['reverselines','Reverse line order','One\nTwo',t=>lines(t).reverse().join('\n')],
 ['sortlength','Sort lines from shortest to longest','Community\nAlpha',t=>lines(t).sort((a,b)=>a.length-b.length).join('\n')],
 ['bullettext','Turn lines into bullet points','Plan\nBuild\nTest',t=>lines(t).map(s=>`• ${s}`).join('\n')],
 ['checklisttext','Turn lines into a checklist','Plan\nBuild',t=>lines(t).map(s=>`☐ ${s}`).join('\n')],
 ['quoteeach','Quote each line','Alpha\nMartech',t=>lines(t).map(s=>`“${s}”`).join('\n')],
 ['unaccent','Remove combining accents','café déjà vu',t=>t.normalize('NFD').replace(/\p{M}/gu,'')],
 ['swapcase','Swap letter case','Hello Alpha',t=>[...t].map(c=>c===c.toUpperCase()?c.toLowerCase():c.toUpperCase()).join('')],
 ['pascalcase','Make a PascalCase identifier','Hello Alpha',t=>words(t).map(title).join('')],
 ['initials','Extract name initials','Martech Alpha Team',t=>words(t).map(w=>w[0].toUpperCase()).join('')],
 ['acronymexpand','Format phrase with its acronym','National Information Technology',t=>`${words(t).map(w=>w[0].toUpperCase()).join('')} — ${t}`],
 ['dedupewords','Remove repeated words preserving order','hello alpha hello',t=>[...new Set(words(t))].join(' ')],
 ['palindromecheck','Check a normalized palindrome','Never odd or even',t=>{const s=words(t.toLowerCase()).join('');return s&&s===[...s].reverse().join('')?'Palindrome':'Not a palindrome';}],
 ['findreplace','Replace literal text: text | search | replacement','Hello Alpha | Alpha | Team',t=>{const a=t.split('|').map(s=>s.trim());if(a.length!==3||!a[1])throw Error('Use text | search | replacement.');return a[0].split(a[1]).join(a[2]);}],
 ['textslice','Extract characters: text | start | end','Hello Alpha | 0 | 5',t=>{const a=pipes(t,3);return [...a[0]].slice(...nums(a.slice(1).join(' '),2,2)).join('');}],
 ['textrepeat','Repeat text up to 20 times: count | text','3 | Go Alpha',t=>{const [n,s]=pipes(t);const count=Number(n);if(!Number.isInteger(count)||count<1||count>20)throw Error('Use a count of 1–20.');return Array(count).fill(s).join('\n');}],
];
for(const [n,d,e,f] of textTools)add(n,'Text',d,e,f);

// Numerical helpers and statistics.
const numericTools = [
 ['numsum','Sum a number list','10 20 30',t=>nums(t).reduce((a,b)=>a+b,0)],
 ['numproduct','Multiply a number list','2 3 4',t=>nums(t).reduce((a,b)=>a*b,1)],
 ['nummean','Calculate arithmetic mean','10 20 30',t=>{const a=nums(t);return a.reduce((x,y)=>x+y,0)/a.length;}],
 ['nummedian','Calculate median','9 2 4',t=>{const a=nums(t).sort((a,b)=>a-b);const n=a.length;return n%2?a[(n-1)/2]:(a[n/2-1]+a[n/2])/2;}],
 ['nummode','Find all most frequent numbers','2 2 3 3 4',t=>{const m=new Map();for(const n of nums(t))m.set(n,(m.get(n)||0)+1);const max=Math.max(...m.values());return [...m].filter(([,n])=>n===max).map(([n])=>n).join(', ');}],
 ['numrange','Calculate max minus min','3 8 12',t=>{const a=nums(t);return Math.max(...a)-Math.min(...a);}],
 ['nummin','Find minimum','3 8 12',t=>Math.min(...nums(t))],
 ['nummax','Find maximum','3 8 12',t=>Math.max(...nums(t))],
 ['numsort','Sort numbers ascending','9 2 4',t=>nums(t).sort((a,b)=>a-b).join(', ')],
 ['numvariance','Population variance','2 4 6',t=>{const a=nums(t),m=a.reduce((x,y)=>x+y,0)/a.length;return a.reduce((n,x)=>n+(x-m)**2,0)/a.length;}],
 ['numstddev','Population standard deviation','2 4 6',t=>Math.sqrt(catalog.numvariance.run(t))],
 ['numrms','Root mean square','3 4',t=>{const a=nums(t);return Math.sqrt(a.reduce((n,x)=>n+x*x,0)/a.length);}],
 ['numgcd','Greatest common divisor','24 36',pair(gcd)],
 ['numlcm','Least common multiple','12 18',pair((a,b)=>a===0||b===0?0:Math.abs(a/gcd(a,b)*b))],
 ['primecheck','Check integer primality up to 1 billion','97',t=>{const [n]=nums(t,1,1);if(!Number.isInteger(n)||n>1e9)throw Error('Use an integer up to 1 billion.');if(n<2)return 'Not prime';for(let i=2;i*i<=n;i++)if(n%i===0)return 'Not prime';return 'Prime';}],
 ['factorlist','List positive integer factors up to 1 billion','36',t=>{const [n]=nums(t,1,1);if(!Number.isInteger(n)||n<1||n>1e9)throw Error('Use an integer from 1 to 1 billion.');const a=[];for(let i=1;i*i<=n;i++)if(n%i===0){a.push(i);if(i*i!==n)a.push(n/i);}return a.sort((a,b)=>a-b).join(', ');}],
 ['factorialcalc','Factorial of 0–100','5',t=>{const [n]=nums(t,1,1);if(!Number.isInteger(n)||n<0||n>100)throw Error('Use an integer from 0 to 100.');let p=1n;for(let i=2n;i<=BigInt(n);i++)p*=i;return p.toString();}],
 ['fibonaccilist','First 1–50 Fibonacci numbers','8',t=>{const [n]=nums(t,1,1);if(!Number.isInteger(n)||n<1||n>50)throw Error('Use a count of 1–50.');let a=0,b=1;return Array.from({length:n},()=>{const out=a;[a,b]=[b,a+b];return out;}).join(', ');}],
 ['fractionreduce','Reduce numerator denominator','24 36',pair((a,b)=>{nonzero(b);const g=gcd(a,b),sign=b<0?-1:1;return `${a/g*sign}/${b/g*sign}`;})],
 ['ratiosimplify','Simplify an integer ratio','18 24',pair((a,b)=>{const g=gcd(a,b);nonzero(g);return `${a/g}:${b/g}`;})],
 ['percentof','Calculate percent of value: percent value','15 200',pair((p,v)=>p/100*v)],
 ['whatpercent','Find part as percentage of whole','25 200',pair((part,whole)=>part/nonzero(whole)*100)],
 ['rounddigits','Round value to 0–10 decimal places','3.14159 2',pair((v,n)=>{if(!Number.isInteger(n)||n<0||n>10)throw Error('Use 0–10 decimal places.');return v.toFixed(n);})],
 ['weightedmean','Weighted mean: values | weights','10 20 | 1 3',t=>{const [v,w]=pipes(t),a=nums(v),b=nums(w);if(a.length!==b.length||b.some(x=>x<0))throw Error('Match values to nonnegative weights.');return a.reduce((s,x,i)=>s+x*b[i],0)/nonzero(b.reduce((s,x)=>s+x,0));}],
];
for(const [n,d,e,f] of numericTools)add(n,'Numbers',d,e,f);

const geometryTools = [
 ['squarearea','Square area: side','5',t=>{const [s]=nums(t,1,1);positive(s);return s*s;}],
 ['squareperimeter','Square perimeter: side','5',t=>{const [s]=nums(t,1,1);positive(s);return 4*s;}],
 ['rectanglearea','Rectangle area: length width','8 5',pair((a,b)=>{positive(a,b);return a*b;})],
 ['rectangleperimeter','Rectangle perimeter: length width','8 5',pair((a,b)=>{positive(a,b);return 2*(a+b);})],
 ['trianglearea','Triangle area: base height','8 5',pair((a,b)=>{positive(a,b);return a*b/2;})],
 ['circlearea','Circle area: radius','7',t=>{const [r]=nums(t,1,1);positive(r);return Math.PI*r*r;}],
 ['circlecircumference','Circle circumference: radius','7',t=>{const [r]=nums(t,1,1);positive(r);return 2*Math.PI*r;}],
 ['cubediagonal','Cube space diagonal: side','4',t=>{const [s]=nums(t,1,1);positive(s);return s*Math.sqrt(3);}],
 ['cubevolume','Cube volume: side','4',t=>{const [s]=nums(t,1,1);positive(s);return s**3;}],
 ['cubesurface','Cube surface area: side','4',t=>{const [s]=nums(t,1,1);positive(s);return 6*s*s;}],
 ['cuboidvolume','Cuboid volume: length width height','4 5 6',triple((a,b,c)=>{positive(a,b,c);return a*b*c;})],
 ['cylindervolume','Cylinder volume: radius height','3 8',pair((r,h)=>{positive(r,h);return Math.PI*r*r*h;})],
 ['cylindersurface','Cylinder total surface: radius height','3 8',pair((r,h)=>{positive(r,h);return 2*Math.PI*r*(r+h);})],
 ['conevolume','Cone volume: radius height','3 8',pair((r,h)=>{positive(r,h);return Math.PI*r*r*h/3;})],
 ['spherevolume','Sphere volume: radius','3',t=>{const [r]=nums(t,1,1);positive(r);return 4/3*Math.PI*r**3;}],
 ['spheresurface','Sphere surface area: radius','3',t=>{const [r]=nums(t,1,1);positive(r);return 4*Math.PI*r*r;}],
 ['hypotenuse','Right triangle hypotenuse: two legs','3 4',pair((a,b)=>{positive(a,b);return Math.hypot(a,b);})],
 ['distance2d','Distance: x1 y1 x2 y2','0 0 3 4',t=>{const [a,b,c,d]=nums(t,4,4);return Math.hypot(c-a,d-b);}],
 ['midpoint2d','Midpoint: x1 y1 x2 y2','0 0 4 6',t=>{const [a,b,c,d]=nums(t,4,4);return `(${(a+c)/2}, ${(b+d)/2})`;}],
 ['slope2d','Slope: x1 y1 x2 y2','0 0 4 6',t=>{const [a,b,c,d]=nums(t,4,4);return (d-b)/nonzero(c-a);}],
];
for(const [n,d,e,f] of geometryTools)if(d)add(n,'Geometry',d,e,f);
add('cuboidsurface','Geometry','Cuboid surface area: length width height','4 5 6',triple((a,b,c)=>{positive(a,b,c);return 2*(a*b+a*c+b*c);}));

const moneyTools = [
 ['discountprice','Price after discount: price percent','10000 15',pair((v,p)=>{if(v<0||p<0||p>100)throw Error('Use nonnegative price and 0–100% discount.');return v*(1-p/100);})],
 ['discountsaved','Discount amount: price percent','10000 15',pair((v,p)=>{if(v<0||p<0||p>100)throw Error('Use nonnegative price and 0–100% discount.');return v*p/100;})],
 ['markupprice','Selling price: cost markup percent','5000 20',pair((c,p)=>{if(c<0||p<0)throw Error('Use nonnegative cost and markup.');return c*(1+p/100);})],
 ['profitamount','Profit: revenue cost','12000 9000',pair((r,c)=>r-c)],
 ['profitmargin','Profit margin percent: revenue cost','12000 9000',pair((r,c)=>{positive(r);return (r-c)/r*100;})],
 ['markuppercent','Markup percent: selling cost','12000 9000',pair((s,c)=>{positive(c);return (s-c)/c*100;})],
 ['taxadd','Add user-supplied tax: price percent','10000 7.5',pair((v,p)=>{if(v<0||p<0)throw Error('Use nonnegative values.');return v*(1+p/100);})],
 ['taxextract','Extract user-supplied tax: inclusive price percent','10750 7.5',pair((v,p)=>{if(v<0||p<0)throw Error('Use nonnegative values.');return v-v/(1+p/100);})],
 ['simpleinterest','Interest: principal annual-percent years','100000 5 2',triple((p,r,y)=>{if(p<0||r<0||y<0)throw Error('Use nonnegative values.');return p*r*y/100;})],
 ['compoundbalance','Annual compounding: principal percent years','100000 5 2',triple((p,r,y)=>{if(p<0||r<0||y<0||y>100)throw Error('Use nonnegative values and up to 100 years.');return p*(1+r/100)**y;})],
 ['savingsmonths','Months to save: target current monthly','100000 20000 10000',triple((t,c,m)=>{positive(m);return Math.ceil(Math.max(0,t-c)/m);})],
 ['unitprice','Cost per item: total quantity','12000 24',pair((t,q)=>{positive(q);return t/q;})],
 ['breakevenunits','Break-even units: fixed-cost price variable-cost','100000 2000 1000',triple((f,p,v)=>{if(f<0||v<0||p<=v)throw Error('Use nonnegative costs and price greater than variable cost.');return Math.ceil(f/(p-v));})],
 ['budgetremaining','Budget remaining: budget expense-list','50000 10000 15000',t=>{const [b,...e]=nums(t,2);return b-e.reduce((a,c)=>a+c,0);}],
 ['contributionperperson','Equal contribution: target people','100000 20',pair((t,n)=>{positive(n);if(!Number.isInteger(n))throw Error('People must be an integer.');return t/n;})],
];
for(const [n,d,e,f] of moneyTools)add(n,'Money arithmetic',d,e,f);

const dateTools = [
 ['weekdayof','Weekday for a calendar date','2026-10-02',t=>date(t).toLocaleDateString('en-GB',{weekday:'long',timeZone:'UTC'})],
 ['isleapyear','Check Gregorian leap year','2028',t=>{const [y]=nums(t,1,1);if(!Number.isInteger(y)||y<1||y>9999)throw Error('Use a year from 1 to 9999.');return y%4===0&&(y%100!==0||y%400===0)?'Leap year':'Not a leap year';}],
 ['adddays','Add calendar days: date count','2026-10-02 10',t=>{const [s,n]=dateArgs(t),d=date(s);const [v]=nums(n||'',1,1);if(!Number.isInteger(v)||Math.abs(v)>36600)throw Error('Use whole days within ±36600.');d.setUTCDate(d.getUTCDate()+v);if(d.getUTCFullYear()<1||d.getUTCFullYear()>9999)throw Error('Result must stay within years 1–9999.');return d.toISOString().slice(0,10);}],
 ['monthlength','Days in month: year month','2026 2',pair((y,m)=>{if(!Number.isInteger(y)||y<100||y>9999||!Number.isInteger(m)||m<1||m>12)throw Error('Use year 100–9999 and month 1–12.');return new Date(Date.UTC(y,m,0)).getUTCDate();})],
 ['dayofyear','Day number within a year','2026-10-02',t=>{const d=date(t);return Math.floor((+d-+date(t.slice(0,4)+'-01-01'))/86400000)+1;}],
 ['quarterof','Calendar quarter','2026-10-02',t=>`Q${Math.floor(date(t).getUTCMonth()/3)+1}`],
 ['weekendcheck','Check Saturday or Sunday','2026-10-03',t=>[0,6].includes(date(t).getUTCDay())?'Weekend':'Weekday'],
 ['durationformat','Format seconds as days/hours/minutes/seconds','90061',t=>{let [v]=nums(t,1,1);if(v<0||!Number.isInteger(v))throw Error('Use nonnegative whole seconds.');const d=Math.floor(v/86400);v%=86400;const h=Math.floor(v/3600);v%=3600;return `${d}d ${h}h ${Math.floor(v/60)}m ${v%60}s`;}],
 ['studyallocation','Equal study time: minutes subjects','120 4',pair((m,s)=>{positive(m,s);if(!Number.isInteger(s))throw Error('Subject count must be an integer.');return `${m/s} minutes per subject`;} )],
];
for(const [n,d,e,f] of dateTools)add(n,'Planning',d,e,f);

const json = t => {try{return JSON.parse(t);}catch{throw Error('Supply valid JSON.');}};
const devTools = [
 ['jsonpretty','Format valid JSON','{"alpha":true}',t=>JSON.stringify(json(t),null,2)],
 ['jsoncompact','Minify valid JSON','{ "alpha": true }',t=>JSON.stringify(json(t))],
 ['jsonkeys','List top-level object keys','{"alpha":true,"mode":"fast"}',t=>{const v=json(t);if(!v||Array.isArray(v)||typeof v!=='object')throw Error('Supply a JSON object.');return Object.keys(v).join('\n');}],
 ['jsonvalues','List top-level object values','{"alpha":true,"count":3}',t=>{const v=json(t);if(!v||Array.isArray(v)||typeof v!=='object')throw Error('Supply a JSON object.');return JSON.stringify(Object.values(v));}],
 ['jsonvalidate','Validate JSON syntax','{"alpha":true}',t=>{const v=json(t);return `Valid JSON (${Array.isArray(v)?'array':v===null?'null':typeof v}).`;}],
 ['jsonarraylength','Count JSON array items','[1,2,3]',t=>{const v=json(t);if(!Array.isArray(v))throw Error('Supply a JSON array.');return v.length;}],
 ['htmlescape','Escape HTML text','<Alpha & Martech>',t=>t.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))],
 ['htmlunescape','Decode common HTML entities','&lt;Alpha&gt;',t=>t.replace(/&(amp|lt|gt|quot|#39);/g,(_,v)=>({amp:'&',lt:'<',gt:'>',quot:'"','#39':"'"}[v]))],
 ['striphtmltext','Strip markup for plain text; not a security sanitizer','<b>Hello</b> Alpha',t=>t.replace(/<[^>]*>/g,'')],
 ['urlparts','Inspect URL components without fetching it','https://example.com/path?q=alpha',t=>{let u;try{u=new URL(t);}catch{throw Error('Supply an absolute URL.');}return JSON.stringify({protocol:u.protocol,host:u.host,path:u.pathname,query:u.search,fragment:u.hash},null,2);}],
 ['urlquery','List URL query parameters without fetching','https://example.com/?q=alpha&page=2',t=>{try{return [...new URL(t).searchParams].map(([k,v])=>`${k}: ${v}`).join('\n')||'No query parameters.';}catch{throw Error('Supply an absolute URL.');}}],
 ['urlclean','Remove common tracking parameters without fetching','https://example.com/?utm_source=chat&q=alpha',t=>{let u;try{u=new URL(t);}catch{throw Error('Supply an absolute URL.');}for(const k of [...u.searchParams.keys()])if(/^utm_/i.test(k)||['fbclid','gclid'].includes(k))u.searchParams.delete(k);return u.href;}],
 ['sha512text','Hash text with SHA-512','Hello Alpha',t=>createHash('sha512').update(t).digest('hex')],
 ['sha384text','Hash text with SHA-384','Hello Alpha',t=>createHash('sha384').update(t).digest('hex')],
 ['hexencode','Encode UTF-8 text as hex','Hello Alpha',t=>Buffer.from(t).toString('hex')],
 ['hexdecode','Decode valid UTF-8 hex bytes','48656c6c6f',t=>{if(!/^(?:[0-9a-f]{2})+$/i.test(t))throw Error('Use complete hexadecimal byte pairs.');return new TextDecoder('utf-8',{fatal:true}).decode(Buffer.from(t,'hex'));}],
 ['unicodepoints','Inspect Unicode code points','Alpha ⚡',t=>[...t].map(c=>`${c}: U+${c.codePointAt(0).toString(16).toUpperCase().padStart(4,'0')}`).join('\n')],
 ['utf8bytes','Show UTF-8 hexadecimal byte sequence','Alpha',t=>[...Buffer.from(t)].map(v=>v.toString(16).padStart(2,'0')).join(' ')],
 ['listtojson','Convert nonempty lines to JSON array','Alpha\nMartech',t=>JSON.stringify(lines(t),null,2)],
 ['jsontolist','Convert a JSON scalar array to lines','["Alpha","Martech"]',t=>{const a=json(t);if(!Array.isArray(a)||a.some(v=>v!==null&&typeof v==='object'))throw Error('Use a JSON array of scalar values.');return a.map(String).join('\n');}],
];
for(const [n,d,e,f] of devTools)add(n,'Developer',d,e,f);
add('decisionmatrix','Planning','Rank options by weighted criteria: labels | weights | score rows','Phone A,Phone B | 2 1 | 8 5; 6 9',t=>{const [labelText,weightText,scoreText]=pipes(t,3),labels=labelText.split(',').map(s=>s.trim()),weights=nums(weightText),rows=scoreText.split(';').map(s=>nums(s));if(labels.length!==rows.length||rows.some(r=>r.length!==weights.length)||weights.some(w=>w<0))throw Error('Match labels, score rows and nonnegative weights.');nonzero(weights.reduce((a,b)=>a+b,0));return rows.map((r,i)=>({label:labels[i],score:r.reduce((s,v,j)=>s+v*weights[j],0)})).sort((a,b)=>b.score-a.score).map(r=>`${r.label}: ${r.score}`).join('\n');});
export const PRACTICAL_TOOLS = Object.freeze(catalog);
export const runPracticalTool = (name, input) => {
  const tool=catalog[name];if(!tool)throw Error('Unknown tool.');
  if(typeof input!=='string'||!input.trim()||input.length>4000)throw Error('Supply 1–4000 characters.');
  const result=tool.run(input);
  if(typeof result==='number'&&!Number.isFinite(result))throw Error('Result is outside supported numerical range.');
  return String(result).slice(0,12000);
};
