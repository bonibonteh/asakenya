/* CONTENT (kept separate from UI; move to CMS/DB later) */
const ASSOCIATIONS=[
 {slug:'asa-tuk',short:'ASA TUK',uni:'Technical University of Kenya',city:'Nairobi town',ll:[36.82,-1.29],off:[-62,-30],pres:'Bonface Oino',web:'https://asatuk.netlify.app',contact:'Alex Muthui',phone:'+254 754 224786',links:{Join:'https://asatuk.netlify.app/join',News:'https://asatuk.netlify.app/news',FAQ:'https://asatuk.netlify.app/faq'},social:{Instagram:'https://www.instagram.com/asa_tuk/',TikTok:'https://www.tiktok.com/@asa_tuk',X:'https://x.com/asa_tuk'}},
 {slug:'asa-uon',short:'ASA UoN',uni:'University of Nairobi',city:'Nairobi',ll:[36.82,-1.29],off:[-70,28],pres:'Mary Thenge',email:'asauonofficial@gmail.com',ig:'@asa_uon'},
 {slug:'asa-ku',short:'ASA KU',uni:'Kenyatta University',city:'Nairobi town',ll:[36.82,-1.29],off:[-10,68],pres:'Hussein Sudi'},
 {slug:'asa-jkuat',short:'ASA JKUAT',uni:'Jomo Kenyatta University of Agriculture and Technology',city:'Kiambu',ll:[36.82,-1.29],off:[62,30],pres:'Joy Kingori'},
 {slug:'asa-tum',short:'ASA TUM',uni:'Technical University of Mombasa',city:'Mombasa',ll:[39.67,-4.05],off:[0,0],pres:'Beavan Bwire'}
].map(a=>({...a,status:'approved'}));
const EXEC=[['President','Mary Thenge','University of Nairobi'],['Vice President','Bonface Oino','Technical University of Kenya'],['Secretary General','Bwire Bevan','Technical University of Mombasa'],['Deputy Secretary General','Clara Kamau','Kenyatta University'],['Treasurer','Laban Ombaso','Technical University of Mombasa'],['Welfare Director','Hussein Sudi','Kenyatta University'],['Events Director','Joy Too','Technical University of Kenya'],['Media Strategist','Sharon Micheni','Jomo Kenyatta University of Agriculture and Technology']];
const LEG=[['JKUAT University President','Joy Kingori'],['UoN University President','Mary Thenge'],['KU University President','Hussein Sudi'],['TUK University President','Bonface Oino'],['TUM University President','Beavan Bwire']];
const APPROACH=[['Unity and representation',['Unite architecture students and graduate architects in Kenya.','Represent architecture students nationally and internationally.','Foster collaboration among institutions offering architecture programmes.','Establish partnerships with industry stakeholders.']],['Excellence and growth',['Promote academic excellence and research.','Facilitate professional development and mentorship.','Promote leadership and innovation.','Bridge school and professional practice.']],['Impact and advocacy',['Organise conferences, seminars, workshops and competitions.','Promote sustainable architecture and environmental stewardship.','Advocate for the welfare of architecture students.','Encourage community engagement and social responsibility.']]];
const BENEFITS=[['Events',['Member-only events','Discounted conference and event registration','Priority registration where applicable','Automatic access to member event links']],['Opportunities',['Internships and scholarships','Industrial attachment opportunities','Competitions and calls for applications']],['Mentorship',['Access to mentorship programmes','Professional networking','Firm and architect engagement opportunities']],['Resources',['ASA publications and student resources','Event recordings','Guides and documents','Competition resources']],['Student recognition',['Student showcases','Design competitions and awards','Featured projects']]];
const CAL=['ASA Connect','Sports Day','Guest lecture','National gala dinner'];
const OPPS=[];
const EVENTS=[
 {title:'ASA Kenya Official Launch',association:'ASA Kenya',date:'2026-10-10',show:'Saturday, 10 October 2026',location:'Senior Common Room, Technical University of Kenya',description:'ASA Kenya launches officially. All JKUAT, UoN, KU, TUK and TUM members are invited.',link:'https://www.instagram.com/p/DdyUXnpDI5m/?stkn=N3dtZGtka3I4Z3F0',lt:'See the invitation on Instagram',status:'approved',anim:1},
 {title:"Studio Bingo: It's Studio Time",association:'ASA UoN',date:'2026-10-02',show:'Friday, 2 October 2026',location:'Second-year studio',description:'An afternoon of games and interaction, with a special welcome for first years. Live architecture bingo, a pop-a-balloon prize wall, architecture-themed icebreakers, drawing and creative challenges, and architecture trivia. Free for all. The poster listed 4 PM to 6 PM; the programme ran from 1:30 PM to 6:00 PM.',pics:[['images/photo-6.jpg','Poster for Studio Bingo, a games afternoon on 2 October 2026, free for all'],['images/photo-7.jpg','The day programme for Studio Bingo, from 1:30 PM arrival to a 6:00 PM close']],status:'approved'}];
const HUB=[['Competitions','Design briefs and contests, national and international.'],['Internships','Practice and attachment placements with firms.'],['Scholarships','Funding for study, travel and research.'],['Mentorship','Pair up with architects and senior students.'],['Workshops','Hands-on skills, software and craft sessions.'],['Site visits','Walk live projects and finished buildings.'],['Exhibitions','Show student work, see what others made.'],['Fellowships','Longer programmes for emerging designers.'],['Calls for papers','Write, present and publish.'],['Research','Studies, labs and academic collaborations.'],['Volunteering','Give time to community and chapter projects.'],['Resources','Guides, recordings and competition material.']];
const AREAS=['Competitions','Workshops','Site visits','Exhibitions','Mentorship','Research','Innovation challenges','Architecture week','Career events','Student resources','Scholarships'];
const TIERS=['Strategic partner','Gold partner','Silver partner','Supporting partner'];
const INV=[['Student','Join your university association.'],['Member association','Join the national network.'],['Professional','Become a mentor or collaborator.'],['Company','Partner with ASA Kenya.'],['University','Collaborate with ASA Kenya.'],['Media','Partner on architecture student stories.']];
const $=s=>document.querySelector(s),el=(t,h,c)=>{const e=document.createElement(t);if(h)e.innerHTML=h;if(c)e.className=c;return e};
const slug=x=>x.toLowerCase().replace(/[^a-z]+/g,'-').replace(/^-|-$/g,'');
const WORK=[],RESOURCES=[],PARTNERS=[{name:'The Architects Alliance',url:'https://thearchitectsalliance.org/',note:'Current ASA Kenya partner. Partnership details to be confirmed.'}];
const WORKCATS=[['Concept','The idea and intent behind a project.'],['Site','Context, analysis and the place a project responds to.'],['Process','Sketches, iterations and design development.'],['Drawings','Plans, sections, elevations and details.'],['Model','Physical and digital models.'],['Final','Final boards, renders and presentation.']];
const RESCATS=['Design','Research','Urbanism','Construction','Sustainability','Digital Design','Representation','Professional Practice','Competition Resources'].map(n=>[n,n+' references and learning materials made available through ASA Kenya.']);RESCATS[0][1]='Architecture design references and learning materials made available through ASA Kenya.';
const DIR={hub:{base:'Student Hub',sheet:'STUDENT HUB',tab:'hub',items:HUB.filter(h=>h[0]!='Resources'),data:OPPS,empty:n=>`No ${n.toLowerCase()} have been published yet. Opportunities will appear here after review by ASA Kenya.`,cta:n=>[n=='Competitions'?'Submit a competition':'Submit an opportunity','Submit an opportunity']},
 'student-work':{base:'Student work',sheet:'STUDENT WORK',tab:'work',items:WORKCATS,data:WORK,empty:()=>'No student work has been published in this category yet.',cta:()=>['Submit student work','Submit student work']},
 resources:{base:'Resource centre',sheet:'RESOURCE CENTRE',tab:'resources',items:RESCATS,data:RESOURCES,suffix:1,empty:()=>'No resources have been published in this category yet.',cta:()=>['Ask for help','Resource help'],help:1}};
function renderCat(b,sb){const D=DIR[b],it=D.items.find(i=>slug(i[0])==sb),nm=it[0],t=D.suffix&&!/resources$/i.test(nm)?nm+' Resources':nm;document.title='ASA Kenya | '+t;
 const draw=q=>{const l=D.data.filter(o=>o.status=='approved'&&o.category==nm&&(!q||JSON.stringify(o).toLowerCase().includes(q)));const box=$('#cl');box.innerHTML='';
  if(!l.length){box.append(el('div',q?`<b>No matches</b>`:`<b>None listed yet</b><p>${D.empty(nm)}</p>`,'empty'));return}
  l.forEach(o=>{const u=(x,y)=>x&&/^https:\/\//.test(x)?`<a href="${x}" target="_blank" rel="noopener noreferrer">${y}</a> `:'';box.append(el('div',`<div><h3>${o.title}</h3><p>${[o.organisation||o.author,o.location,o.type].filter(Boolean).join(', ')}</p><p>${o.description||''}</p>${o.eligibility?`<p><b>Eligibility:</b> ${o.eligibility}</p>`:''}${u(o.applyUrl,'Apply')}${u(o.officialUrl||o.url,'Official website')}${u(o.download,'Download')}</div><div>${o.deadline?`<div class="note">Deadline: ${o.deadline}</div>`:''}<span class="badge">Approved</span></div>`,'item'))})};
 const [cl,ct]=D.cta(nm);
 $('#cat').innerHTML=`<div class="wrap"><p class="note"><a href="#${D.tab}">${D.sheet}</a> / S-${String(D.items.indexOf(it)+1).padStart(2,'0')}</p><h2>${t}</h2><p class="sub">${it[1]}</p><label class="hs">Search ${t.toLowerCase()}<input id="cq" type="search" autocomplete="off"></label><div id="cl" style="margin-top:22px"></div>
 <p style="margin-top:26px"><a class="btn" href="#contact" data-type="${ct}">${cl}</a></p>${D.help?`<div class="cell" style="margin-top:30px"><h3>Need help?</h3><p>Looking for a resource, reference or guide? Tell ASA Kenya what you need and the team can review the request.</p><a class="btn o" href="#contact" data-type="Resource help">Ask for help</a></div>`:''}
 <div class="cats" role="navigation" aria-label="Other categories">${D.items.map(i=>`<a class="chip" href="#${b}/${slug(i[0])}"${i[0]==nm?' aria-current="page"':''}>${i[0]}</a>`).join('')}</div></div>`;
 draw('');$('#cq').oninput=e=>draw(e.target.value.trim().toLowerCase())}
/* TABS */
const TABS=[...document.querySelectorAll('main>section')];let cur='';
function route(){const raw=(location.hash||'#home').slice(1),[b,sb]=raw.split('/');let h=b,nav=b;
 if(sb&&DIR[b]&&DIR[b].items.some(i=>slug(i[0])==sb)){h='cat';nav=DIR[b].tab}else if(!TABS.some(s=>s.dataset.tab==h))h=nav='home';
 if(raw!=cur){cur=raw;if(h=='cat')renderCat(b,sb);document.body.dataset.tab=h;TABS.forEach(s=>s.classList.toggle('on',s.dataset.tab==h));
 document.querySelectorAll('#lk a').forEach(a=>a.getAttribute('href')=='#'+nav?a.setAttribute('aria-current','page'):a.removeAttribute('aria-current'));
 scrollTo(0,0);dispatchEvent(new Event('resize'));if(h=='home')document.title='ASA Kenya | Architecture Students Association of Kenya';else if(h!='cat')document.title='ASA Kenya | '+h[0].toUpperCase()+h.slice(1)}}
addEventListener('hashchange',route);route();
/* UI */
$('#mb').onclick=function(){const o=$('#lk').classList.toggle('open');this.setAttribute('aria-expanded',o)};
$('#lk').onclick=e=>{if(e.target.tagName=='A')$('#lk').classList.remove('open')};
let cat='All';
let q='';
function renderOpps(){const l=OPPS.filter(o=>o.status=='approved'&&(cat=='All'||o.category==cat)&&(!q||(o.title+' '+o.description+' '+o.organisation).toLowerCase().includes(q)));const box=$('#ol');box.innerHTML='';$('#hh').textContent=cat=='All'?'All opportunities':cat;
 document.querySelectorAll('#ht button.tile').forEach(t=>t.setAttribute('aria-pressed',t.dataset.c==cat));
 if(!l.length){box.append(el('div',`<b>${q?'No matches for "'+q.replace(/</g,'&lt;')+'"':'No '+(cat=='All'?'opportunities':cat.toLowerCase())+' published yet'}</b><p>Verified opportunities will appear here with deadlines and application links. Know of one? Submit it for review.</p>`,'empty'));return}
 l.forEach(o=>{const d=o.deadline?Math.ceil((new Date(o.deadline)-new Date())/864e5):null;box.append(el('div',`<div><h3>${o.title}</h3><p>${o.organisation}, ${o.location}. ${o.description}</p><a href="${o.applyUrl}">Apply</a> <a href="${o.officialUrl}">Official website</a></div><div>${d!==null&&d>=0&&d<=14?'<span class="badge">Deadline approaching</span>':''}<div class="note">${o.deadline||''}</div></div>`,'item'))})}
function mkTiles(box){HUB.forEach((h,i)=>{const res=h[0]=='Resources',n=OPPS.filter(o=>o.status=='approved'&&o.category==h[0]).length;
 const t=el('a',`<i>S-${String(i+1).padStart(2,'0')}</i><b>${h[0]}</b><span>${h[1]}</span><em>${res?'Open the library':n?n+' open':'None listed yet'}</em>`,'tile');t.href=res?'#resources':'#hub/'+slug(h[0]);t.dataset.c=h[0];t.style.transitionDelay=i*45+'ms';box.append(t)})}
mkTiles($('#ht'),0);mkTiles($('#hp'),1);renderOpps();$('#hq').oninput=e=>{q=e.target.value.trim().toLowerCase();renderOpps()};
const tio=new IntersectionObserver((en,o)=>en.forEach(x=>{if(x.isIntersecting){x.target.classList.add('in');o.unobserve(x.target)}}),{threshold:.1});document.querySelectorAll('.tile').forEach(t=>tio.observe(t));
function chips(id,arr,cb,all){const b=$(id);['All',...arr].forEach((c,i)=>{const x=el('button',c,'chip');x.type='button';x.setAttribute('aria-pressed',i==0);x.onclick=()=>{b.querySelectorAll('.chip').forEach(y=>y.setAttribute('aria-pressed',y==x));cb(c)};b.append(x)})}

const daysTo=d=>Math.round((new Date(d+'T00:00:00')-new Date(new Date().toDateString()))/864e5);
function launchHtml(e){const n=daysTo(e.date),U=['JKUAT','UoN','KU','TUK','TUM'],xs=[90,215,340,465,590];
 const cols=xs.map((x,i)=>`<rect class="col" x="${x-8}" y="110" width="16" height="120" fill="rgba(142,219,166,.18)" stroke="#8EDBA6" stroke-width="1.5" style="transition-delay:${.9+i*.35}s"/><text class="tx" x="${x}" y="250" text-anchor="middle" style="transition-delay:${1.2+i*.35}s">${U[i]}</text>`).join('');
 return `<div class="lw"><div class="lau"><svg viewBox="0 0 640 300" role="img" aria-label="Animated drawing: five university columns, JKUAT, UoN, KU, TUK and TUM, carry one beam labelled ASA Kenya."><line class="d" pathLength="1" x1="40" y1="230" x2="620" y2="230" stroke="#fff" stroke-width="1.5"/>${cols}
 <line class="d" pathLength="1" x1="60" y1="110" x2="620" y2="110" stroke="#E5333B" stroke-width="5" style="transition-delay:3.1s"/>
 <polyline class="d" pathLength="1" points="60,110 340,40 620,110" stroke="#E5333B" stroke-width="2" style="transition-delay:3.7s"/>
 <text class="tx big" x="340" y="92" text-anchor="middle" style="transition-delay:4.5s">ASA KENYA</text>
 <line class="d" pathLength="1" x1="90" y1="272" x2="590" y2="272" stroke="#8EDBA6" stroke-width="1" style="transition-delay:4.9s"/><path class="d" pathLength="1" d="M90 266v12M590 266v12" stroke="#8EDBA6" stroke-width="1" style="transition-delay:4.9s"/>
 <text class="tx" x="340" y="292" text-anchor="middle" style="transition-delay:5.4s">FIVE ASSOCIATIONS · ONE NATIONAL NETWORK</text></svg></div>
 <p class="lc"><b>${n>1?n+' days to go':n==1?'Tomorrow':n==0?'Today: ASA Kenya launches':'ASA Kenya has launched'}</b></p></div>`}
function armLau(b){b.querySelectorAll('.lau').forEach(x=>{if(matchMedia('(prefers-reduced-motion:reduce)').matches||!('IntersectionObserver'in window)){x.classList.add('go');return}
 let t,vis=false;const run=()=>{if(!x.isConnected)return;x.classList.add('rs');x.classList.remove('go');void x.offsetWidth;x.classList.remove('rs');x.classList.add('go');t=setTimeout(run,9500)};
 new IntersectionObserver(en=>{const on=en[0].isIntersecting;if(on&&!vis){vis=true;run()}else if(!on&&vis){vis=false;clearTimeout(t)}},{threshold:.4}).observe(x)})}
function renderEv(a){const b=$('#el');b.innerHTML='';const now=new Date(new Date().toDateString());
 const l=EVENTS.filter(e=>e.status=='approved'&&(a=='All'||e.association==a)).sort((x,y)=>new Date(x.date)-new Date(y.date));
 const up=l.filter(e=>new Date(e.date)>=now),pa=l.filter(e=>new Date(e.date)<now).reverse();
 const row=(e,past)=>el('div',`<div><h3>${e.title}</h3><p style="margin:.3em 0"><b>${e.show}</b>, ${e.location}</p><p>${e.description}</p>${e.anim?launchHtml(e):''}${e.link?`<a class="btn" href="${e.link}" target="_blank" rel="noopener noreferrer">${e.lt}</a>`:''}${e.pics?'<div class="pics">'+e.pics.map(p=>`<img src="${p[0]}" alt="${p[1]}" loading="lazy">`).join('')+'</div>':''}</div><span class="badge" style="background:${past?'var(--mut)':'var(--earth)'};align-self:start">${e.association}</span>`,'item');
 b.append(el('h3',`Upcoming`));if(!up.length)b.append(el('div',`<b>No upcoming events listed${a!='All'?' for '+a:''} yet</b><p>Check back soon, or submit an event.</p>`,'empty'));up.forEach(e=>b.append(row(e,0)));
 if(pa.length){{const ph=el('h3','Past events');ph.style.marginTop='40px';b.append(ph)}pa.forEach(e=>b.append(row(e,1)))}armLau(b)}
chips('#ec',['ASA Kenya',...ASSOCIATIONS.filter(a=>!a.nm).map(a=>a.short)],renderEv);renderEv('All');
$('#cal').innerHTML=CAL.map(c=>`<span class="chip" style="cursor:default">${c}: date to be confirmed</span>`).join('');
$('#ap').innerHTML=APPROACH.map(([h,l])=>`<div class="cell"><h3>${h}</h3><ul>${l.map(x=>`<li>${x}</li>`).join('')}</ul></div>`).join('');
$('#bn').innerHTML=BENEFITS.map(([h,l])=>`<div class="cell"><h3>${h}</h3><ul>${l.map(x=>`<li>${x}</li>`).join('')}</ul></div>`).join('');
$('#exd').textContent='Day-to-day coordination, programme implementation, administrative workflow execution and direct service delivery to chapters.';
$('#lgd').textContent='Supreme authority on policy formulation, resource distribution, national review and constitutional accountability.';
$('#ex').innerHTML=EXEC.map(([r,n,u])=>`<div class="cell"><div class="who"><small>${r}</small>${n}<small>${u}</small></div></div>`).join('');
$('#lg2').innerHTML=LEG.map(([r,n])=>`<div class="cell"><div class="who"><small>${r}</small>${n||'<span class="tbd" style="color:var(--earth)">To be confirmed</span>'}</div></div>`).join('');
$('#pa').innerHTML=AREAS.map(a=>`<div class="cell" style="border-color:rgba(255,255,255,.25)"><h3>${a}</h3></div>`).join('');
$('#pt').innerHTML=[['Strategic partnership','For organisations interested in long-term collaboration.'],['Programme partnership','For organisations interested in supporting events, education or student initiatives.'],['Resource partnership','For organisations providing knowledge, tools, learning material or professional support.']].map(([a,b])=>`<div class="cell" style="border-color:rgba(255,255,255,.25)"><h3>${a}</h3><p>${b}</p></div>`).join('');
$('#pp').innerHTML=PARTNERS.map(p=>`<div class="cell" style="border-color:rgba(255,255,255,.25)"><h3>${p.name}</h3><p>${p.note}</p><a class="btn" href="${p.url}" target="_blank" rel="noopener noreferrer">Visit partner website</a></div>`).join('');
$('#gi').innerHTML=INV.map(([a,b])=>`<div class="cell"><h3>${a}</h3><p>${b}</p></div>`).join('');
document.addEventListener('click',e=>{const a=e.target.closest('[data-type]');if(a)[...$('#ft').options].forEach(o=>{if(o.text==a.dataset.type)o.selected=true})});
const FORMSPREE_ENDPOINT="https://formspree.io/f/mbgdoblk";
$('#f').onsubmit=async e=>{e.preventDefault();const f=e.target,F=f.elements;let bad=0;const chk=(n,ok,msg)=>{const x=$('#e-'+n);x.textContent=ok?'':msg;F[n].setAttribute('aria-invalid',!ok);if(!ok&&!bad)F[n].focus();if(!ok)bad=1};
 chk('name',F['name'].value.trim(),'Please enter your name.');chk('email',/^\S+@\S+\.\S+$/.test(F['email'].value),'Please enter a valid email address.');chk('subject',F['subject'].value.trim(),'Please add a subject.');chk('message',F['message'].value.trim().length>9,'Please write at least 10 characters.');chk('website',!F['website'].value||/^https:\/\//.test(F['website'].value),'Links must start with https://');chk('consent',F['consent'].checked,'Please give your consent so ASA Kenya can respond.');
 if(bad)return;const ok=$('#ok'),btn=f.querySelector('button[type=submit]');if(btn.disabled)return;ok.style.display='block';
 F['_subject'].value='ASA Kenya website: '+F['type'].value+' - '+F['subject'].value.trim();
 btn.disabled=true;ok.textContent='Sending...';
 try{const r=await fetch(FORMSPREE_ENDPOINT,{method:'POST',headers:{Accept:'application/json'},body:new FormData(f)});ok.textContent=r.ok?'Thank you. Your message has been sent for review.':'Something went wrong. Please email contact.asakenya@gmail.com.';if(r.ok)f.reset()}catch(x){ok.textContent='Network error. Please try again or email contact.asakenya@gmail.com.'}finally{btn.disabled=false}};
/* MAP */
(function(){const hlt=(sl,on)=>{const l=document.querySelector('.cn[data-s="'+sl+'"]');if(l)l.classList.toggle('hl',on)};const P=[[34.0,4.2],[34.6,3.4],[34.9,1.9],[34.2,1.0],[34.4,.4],[34.0,.1],[33.9,-1],[37.6,-3.5],[37.7,-3.1],[39.2,-4.6],[39.8,-3.4],[40.2,-2.7],[40.9,-2.3],[41.5,-1.7],[41,-.9],[41,2.8],[41.9,3.98],[41,3.9],[39.8,3.9],[39,3.9],[38.1,3.6],[36.9,4.4],[35.9,4.6]];
 const X=l=>(l[0]-33.4)*48,Y=l=>(5.3-l[1])*48;let s='';for(let i=0;i<=420;i+=30)s+=`<line class="gr" x1="${i}" y1="0" x2="${i}" y2="470"/><line class="gr" x1="0" y1="${i}" x2="420" y2="${i}"/>`;
 s+=`<polygon class="st" points="${P.map(p=>X(p)+','+Y(p)).join(' ')}"/>`;
 let nodes='',hl='';const HX=215,HY=205;ASSOCIATIONS.forEach((a,i)=>{const cx=X(a.ll),cy=Y(a.ll);const x=cx+a.off[0],y=cy+a.off[1];if(a.off[0]||a.off[1])s+=`<line class="ln" x1="${cx}" y1="${cy}" x2="${x}" y2="${y}"/>`;
 hl+=`<line class="cn" pathLength="1" data-s="${a.slug}" x1="${x}" y1="${y}" x2="${HX}" y2="${HY}" style="transition-delay:${1.6+i*.25}s"/>`;nodes+=`<g class="n" style="transition-delay:${i*.25}s" tabindex="0" role="button" aria-label="${a.short} profile" data-s="${a.slug}"><circle cx="${x}" cy="${y}" r="9"/><text x="${x}" y="${y-15}" text-anchor="middle">${a.short}</text></g>`});
 let hub='';['Students','Associations','Events','Opportunities','Projects','Professionals','Partners'].forEach((n,j)=>{const sx=330,sy=62+j*22;hub+=`<line class="cn" pathLength="1" x1="${HX}" y1="${HY}" x2="${sx}" y2="${sy}" style="transition-delay:${3.8+j*.12}s"/><g class="sd" style="transition-delay:${4.2+j*.12}s"><circle cx="${sx}" cy="${sy}" r="3.5"/><text x="${sx+9}" y="${sy+3}">${n}</text></g>`});
 hub+=`<g class="hub" style="transition-delay:3.4s"><circle cx="${HX}" cy="${HY}" r="15"/><text x="${HX}" y="${HY+31}" text-anchor="middle">ASA KENYA</text></g>`;s+=hl+hub+nodes;
 s+=`<text x="${X([36.82,0])-50}" y="${Y([0,-1.29])-72}" fill="#8EDBA6" font-size="10" font-family="Archivo">Nairobi</text>`;
 $('#kmap').innerHTML=s;{const k=$('#kmap'),go=()=>{k.classList.add('go');setTimeout(()=>k.querySelectorAll('[style*=transition-delay]').forEach(x=>x.style.transitionDelay='0s'),6500)};if(matchMedia('(prefers-reduced-motion:reduce)').matches||!('IntersectionObserver'in window))go();else new IntersectionObserver((e,o)=>{if(e[0].isIntersecting){go();o.disconnect()}},{threshold:.3}).observe(k)}
 const show=slug=>{const a=ASSOCIATIONS.find(x=>x.slug==slug);document.querySelectorAll('.k g.n').forEach(g=>g.classList.toggle('sel',g.dataset.s==slug));
  $('#prof').innerHTML=`<h3>${a.short}</h3><p style="margin:0">${a.uni}</p><dl><dt>City</dt><dd>${a.city}</dd><dt>University president</dt><dd class="${a.pres?'':'tbd'}">${a.pres||'To be confirmed'}</dd><dt>Events</dt><dd>${EVENTS.filter(e=>e.association==a.short).map(e=>e.title).join(', ')||'<span class="tbd">None listed yet</span>'}</dd><dt>Website</dt><dd class="${a.web?'':'tbd'}">${a.web?`<a href="${a.web}" target="_blank" rel="noopener noreferrer">${a.web.replace(/^https?:\/\//,'')}</a>`:'To be provided'}</dd><dt>Social media</dt><dd class="${a.ig||a.social?'':'tbd'}">${a.ig||(a.social?'See links below':'To be provided')}</dd><dt>Contact</dt><dd>${a.contact?`${a.contact}<br><a href="https://wa.me/${a.phone.replace(/\D/g,'')}" target="_blank" rel="noopener noreferrer" aria-label="Chat with ${a.contact} on WhatsApp">${a.phone} (WhatsApp)</a>`:(a.email||'University representatives')}</dd></dl>${a.links?`<div class="tq">${Object.entries(a.links).map(([k,u])=>`<a class="btn o" href="${u}" target="_blank" rel="noopener noreferrer">${a.short}: ${k}</a>`).join("")}</div>`:'<button class="btn o" disabled style="opacity:.5;cursor:not-allowed">Official website: to be confirmed</button>'}${a.social?`<p style="margin:16px 0 0"><b>Follow ${a.short}</b></p><div class="soc">${socHtml(a.social,a.short)}</div>`:''}<p class="note" style="color:#BFE3C9">${a.nm?'Association name and details to be confirmed. ':''}Listed as a member university on the ASA Kenya site.</p>`};
 $('#prof').innerHTML='<h3>Select a node</h3><p>Choose an association on the map to see its profile.</p>';
 document.querySelectorAll('.k g.n').forEach(g=>{g.onclick=()=>show(g.dataset.s);g.onmouseenter=g.onfocus=()=>hlt(g.dataset.s,1);g.onmouseleave=g.onblur=()=>hlt(g.dataset.s,0);g.onkeydown=e=>{if(e.key=='Enter'||e.key==' '){e.preventDefault();show(g.dataset.s)}}})})();
/* STATS */
const STATS=[{v:ASSOCIATIONS.length,l:'Member universities',ok:true},{v:EXEC.length,l:'Executive council members',ok:true},{l:'Students',ok:false},{l:'Opportunities',ok:false}];
$('#st').innerHTML=STATS.map(s=>s.ok?`<div class="stat"><b data-n="${s.v}">0</b><span>${s.l}</span></div>`:`<div class="stat p"><b>Pending verification</b><span>${s.l}</span></div>`).join('');
const RM=matchMedia('(prefers-reduced-motion:reduce)').matches;
new IntersectionObserver((en,o)=>en.forEach(x=>{if(!x.isIntersecting)return;const b=x.target,n=+b.dataset.n;if(RM){b.textContent=n;return}let i=0;const t=setInterval(()=>{b.textContent=++i;if(i>=n)clearInterval(t)},160);o.unobserve(b)})).observe&&document.querySelectorAll('[data-n]').forEach(b=>{new IntersectionObserver((en,o)=>en.forEach(x=>{if(x.isIntersecting){o.unobserve(b);if(RM){b.textContent=b.dataset.n;return}let i=0;const t=setInterval(()=>{b.textContent=++i;if(i>=+b.dataset.n)clearInterval(t)},160)}})).observe(b)});
/* 3D HERO: lines > drawings > structure > buildings > city > network */
const STG=[['Lines','Every building starts as a line on paper.'],['Drawings','Lines become plans and sections.'],['Structure','Columns and slabs give the drawing a frame.'],['Buildings','Structure becomes built mass.'],['City','Buildings gather into Kenyan towns and cities.'],['Network','Five member universities, one national network.']];
STG.forEach((_,i)=>$('#pg').append(el('i')));
const hero=$('#hero');let P=0,Pt=0,mx=0,my=0;
function sp(p){const i=Math.min(5,Math.floor(p*6));$('#sh').textContent=STG[i][0];$('#sp').textContent=STG[i][1];[...$('#pg').children].forEach((x,j)=>x.className=j<=i?'on':'')}
const cl=(x,a,b)=>Math.min(1,Math.max(0,(x-a)/(b-a))),ez=t=>t*t*(3-2*t);
function init(){let gl;try{gl=new THREE.WebGLRenderer({canvas:$('#cv'),antialias:innerWidth>=760,powerPreference:'low-power'})}catch(e){document.body.classList.add('nogl');sp(.9);return}
 const mob=innerWidth<760;gl.setPixelRatio(Math.min(devicePixelRatio,mob?1.25:1.75));gl.setClearColor(0x06301A);
 const sc=new THREE.Scene(),cam=new THREE.PerspectiveCamera(45,1,.1,100),paper=0xD2EDDA,acc=0xE5333B;
 const M=(c,o)=>new THREE.LineBasicMaterial({color:c,transparent:true,opacity:o}),F=a=>new THREE.Float32BufferAttribute(a,3);
 // 1 LINES: plan grid drawn progressively
 const gp=[];for(let i=-10;i<=10;i+=2)gp.push(i,0,-10,i,0,10,-10,0,i,10,0,i);
 const grid=new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position',F(gp)),M(paper,.35));sc.add(grid);const gn=gp.length/3;
 // section line cutting the plan
 const sec=new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints([[-11,0,.5],[11,0,.5],[-11,0,.5],[-11,0,-1.6],[11,0,.5],[11,0,-1.6]].map(p=>new THREE.Vector3(...p))),new THREE.LineDashedMaterial({color:acc,dashSize:.7,gapSize:.35,transparent:true}));sec.computeLineDistances();sc.add(sec);
 // 2 STRUCTURE: columns and slabs rise
 const cp=[];for(let x=-6;x<=6;x+=3)for(let z=-6;z<=6;z+=3)cp.push(x,0,z,x,4,z);
 for(let y=2;y<=4;y+=2)for(let x=-6;x<=6;x+=3)cp.push(x,y,-6,x,y,6,-6,y,x,6,y,x);
 const frame=new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position',F(cp)),M(acc,.9));sc.add(frame);
 // 3 BUILDINGS / CITY: masses extrude upward (fixed seed)
 const bl=[],n=mob?10:18;let seed=7;const rnd=()=>(seed=(seed*16807)%2147483647)/2147483647;
 for(let i=0;i<n;i++){const w=1+rnd()*1.6,d=1+rnd()*1.6,h=1+rnd()*(i%5===0?7:3.5);
  const e=new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(w,h,d)),M(paper,.8));e.position.set(-9+rnd()*18,0,-9+rnd()*18);e.userData.h=h;e.scale.y=.001;sc.add(e);bl.push(e)}
 // 4 NETWORK: ASA Kenya centre, chapters, outer nodes
 const NP={'ASA KENYA':[0,9,0],'ASA TUK':[-5,5,-2],'ASA KU':[0,4.2,5],'ASA TUM':[6,5.2,-3]},nm=[],lp=[];
 const nodeM=c=>new THREE.MeshBasicMaterial({color:c,transparent:true,opacity:0});
 for(const k in NP){const m=new THREE.Mesh(new THREE.SphereGeometry(k==='ASA KENYA'?.4:.25,12,12),nodeM(k==='ASA KENYA'?0xffffff:acc));m.position.set(...NP[k]);sc.add(m);nm.push(m)}
 [[-9,8,6],[9,8,5],[-8,7,-8],[8,10,-8],[0,11,-8]].forEach(o=>{const m=new THREE.Mesh(new THREE.SphereGeometry(.14,8,8),nodeM(0x7FD39A));m.position.set(...o);sc.add(m);nm.push(m);lp.push(...NP['ASA KENYA'],...o)});
 ['ASA TUK','ASA KU','ASA TUM'].forEach(k=>lp.push(...NP['ASA KENYA'],...NP[k],...NP[k],NP[k][0],0,NP[k][2]));
 const net=new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position',F(lp)),M(acc,0));sc.add(net);
 const keys=Object.keys(NP).reverse(),labs=keys.map(k=>{const d=el('div',k,'nl');$('#nls').append(d);return d});
 const stick=$('.stick');function rs(){const w=stick.clientWidth,h=stick.clientHeight;if(!w)return;gl.setSize(w,h,false);cam.aspect=w/h;cam.fov=w/h<1?60:45;cam.updateProjectionMatrix()}rs();addEventListener('resize',rs);
 const v=new THREE.Vector3();let vis=true;new IntersectionObserver(e=>vis=e[0].isIntersecting).observe(hero);
 function draw(p){const q=ez(cl(p,.62,1));
  grid.geometry.setDrawRange(0,Math.floor(gn*cl(p,0,.18)/2)*2);
  sec.material.opacity=ez(cl(p,.08,.18))*(1-ez(cl(p,.3,.42)));
  const sp2=cl(p,.18,.4);frame.visible=sp2>0;frame.scale.y=Math.max(.001,sp2);
  bl.forEach((b,i)=>{const t=cl(p,.4+i*.012,.65);b.scale.y=Math.max(.001,t);b.position.y=b.userData.h*b.scale.y/2});
  const np=cl(p,.78,.98);net.material.opacity=np;nm.forEach(m=>m.material.opacity=Math.min(1,np*1.5));
  const a=p*1.6+mx*.5,rad=17-q*3,hh=6+q*8+my*2;cam.position.set(Math.sin(a)*rad,hh,Math.cos(a)*rad);cam.lookAt(0,q*5,0);gl.render(sc,cam);
  keys.forEach((k,i)=>{v.set(...NP[k]).project(cam);labs[i].style.left=(v.x*.5+.5)*stick.clientWidth+'px';labs[i].style.top=(-v.y*.5+.5)*stick.clientHeight+'px';labs[i].style.opacity=np>.6?1:0})}
 if(RM){Pt=P=.97;sp(P);draw(P);addEventListener('resize',()=>draw(P));return}
 (function loop(){requestAnimationFrame(loop);if(cur=='home'&&vis){P+=(Pt-P)*.08;draw(P)}})()}
function onScroll(){const r=hero.getBoundingClientRect();Pt=cl(-r.top,0,hero.offsetHeight-innerHeight);sp(Pt)}
addEventListener('scroll',()=>{if(cur=='home')onScroll()},{passive:true});onScroll();
addEventListener('pointermove',e=>{mx=e.clientX/innerWidth-.5;my=e.clientY/innerHeight-.5},{passive:true});
if(typeof THREE==='undefined'){document.body.classList.add('nogl');sp(.9)}else init();

/* SOCIAL: paste each official URL below. Icons with an empty url are not shown, so no link is ever broken. */
const SOCIAL=[
 {n:'LinkedIn',label:'Follow ASA Kenya on LinkedIn',url:'',svg:'<rect x="3.5" y="3.5" width="17" height="17" rx="3"/><path d="M8 10.5V16M8 7.8v.1M12 16v-5.5M12 12.8c0-1.4 1-2.3 2.3-2.3S16.5 11.400 16.500 13V16"/>'},
 {n:'Instagram',label:'Follow ASA Kenya on Instagram',url:'https://www.instagram.com/asa.kenya/',svg:'<rect x="3.5" y="3.5" width="17" height="17" rx="5"/><circle cx="12" cy="12" r="4"/><path d="M17.200 6.800v.1"/>'},
 {n:'X',label:'Follow ASA Kenya on X',url:'',svg:'<path d="M4 4l16 16M20 4L4 20"/>'},
 {n:'TikTok',label:'Follow ASA Kenya on TikTok',url:'',svg:'<path d="M14 4v10.500a3.800 3.800 0 1 1-3.800-3.800M14 4c.4 2.600 2.200 4.200 5 4.400"/>'},
 {n:'WhatsApp',label:'Chat with ASA Kenya on WhatsApp',url:'',svg:'<path d="M12 3.500a8.500 8.500 0 0 0-7.300 12.800L3.500 20.500l4.300-1.100A8.500 8.500 0 1 0 12 3.500z"/><path d="M9 8.800c0 3 2.200 5.500 5.700 6.200l1-1.300-2-1-.9.800c-1-.4-1.800-1.200-2.200-2.200l.8-.9-1-2z"/>'}
];
function socHtml(m,who){return SOCIAL.filter(x=>/^https:\/\//.test(m[x.n]||'')).map(x=>`<a href="${m[x.n]}" target="_blank" rel="noopener noreferrer" aria-label="Follow ${who} on ${x.n}" title="${x.n}"><svg viewBox="0 0 24 24" aria-hidden="true">${x.svg}</svg></a>`).join('')}
const ASAK_LINKS={'Join the ASA Kenya network':'https://asakenya.netlify.app/#contact'};
$('#tq').innerHTML='<b>ASA Kenya quick access</b>'+Object.entries(ASAK_LINKS).map(([k,u])=>`<a class="btn o" href="${u}" target="_blank" rel="noopener noreferrer">${k}</a>`).join('');
$('#soc').innerHTML=SOCIAL.filter(x=>/^https:\/\//.test(x.url)).map(x=>`<a href="${x.url}" target="_blank" rel="noopener noreferrer" aria-label="${x.label}" title="${x.n}"><svg viewBox="0 0 24 24" aria-hidden="true">${x.svg}</svg></a>`).join('');
if('IntersectionObserver'in window){const rio=new IntersectionObserver((en,o)=>en.forEach(x=>{if(x.isIntersecting){x.target.classList.add('in');o.unobserve(x.target)}}),{threshold:.08});
 const tagRv=()=>document.querySelectorAll('main>section:not(#hero):not(#tick) :is(h2,.sub,.cell,.stat,.item,.prof,.empty,.two>*,.case,.flow,.list):not(.rv):not(.tile)').forEach((e,i)=>{e.classList.add('rv');e.style.setProperty('--d',(i%6)*70+'ms');rio.observe(e)});
 tagRv();addEventListener('hashchange',()=>setTimeout(tagRv,60))}
document.addEventListener('pointermove',e=>{const t=e.target.closest&&e.target.closest('.tile');if(t){const r=t.getBoundingClientRect();t.style.setProperty('--mx',e.clientX-r.left+'px');t.style.setProperty('--my',e.clientY-r.top+'px')}},{passive:true});
if(typeof Lenis!=='undefined'&&!RM){try{new Lenis({autoRaf:true,lerp:.09})}catch(e){}}
