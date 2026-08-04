/* Tabi workspace layer. It keeps the original Japan prototype as seed data while
   introducing an account -> trips -> days model that can later be moved to Supabase. */
(function(){
  const KEY='tabi-workspace-v1';
  const oldDays=()=>JSON.parse(JSON.stringify(typeof days!=='undefined'?days:[]));
  const oldHotels=()=>JSON.parse(JSON.stringify(typeof hotels!=='undefined'?hotels:[]));
  const today=new Date().toISOString().slice(0,10);
  const seedUser={id:'ivan-local',name:'Ivan Lei',email:'ivan@example.com',avatar:'I'};
  const seedTrip={id:'japan-2026',name:'Japan for two',route:'Osaka · Kyoto · Amanohashidate · Kinosaki · Awaji',start:'2026-10-29',end:'2026-11-08',cover:'',status:'upcoming',travellers:2,days:oldDays(),hotels:oldHotels(),saved:[]};
  let workspace;
  try{workspace=JSON.parse(localStorage.getItem(KEY)||'null')}catch{workspace=null}
  if(!workspace||!workspace.users||!workspace.trips){workspace={currentUserId:null,currentTripId:null,users:[seedUser],trips:[seedTrip]};}
  if(!workspace.users.length)workspace.users=[seedUser];
  if(!workspace.trips.length)workspace.trips=[seedTrip];
  const currentUser=()=>workspace.users.find(u=>u.id===workspace.currentUserId);
  const ownedTrips=()=>workspace.trips.filter(t=>t.ownerId===workspace.currentUserId||(!t.ownerId&&workspace.currentUserId===seedUser.id));
  function save(){try{localStorage.setItem(KEY,JSON.stringify(workspace))}catch{}}
  function id(prefix){return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2,7)}`}
  function syncLegacyToTrip(){let trip=workspace.trips.find(t=>t.id===workspace.currentTripId);if(!trip)return;trip.days=oldDays();trip.hotels=oldHotels();trip.updatedAt=Date.now();save()}
  // Keep the ambient visual field tied to the same photos travellers see in the
  // active day's Stop cards. The CSS layer handles the blur, gradient and drift;
  // this small bridge only supplies the current image URL.
  function syncAmbientBackground(){
    if(typeof days==='undefined')return;
    const activeDay=days[typeof selected==='number'?selected:0];
    const active=(activeDay?.items||[]).find(item=>item?.[5]?.photo);
    const fallback=days.flatMap(day=>day?.items||[]).find(item=>item?.[5]?.photo);
    const photo=active?.[5]?.photo||fallback?.[5]?.photo||'';
    const value=photo?`url(${JSON.stringify(String(photo))})`:'none';
    const seed=`${workspace.currentTripId||'tabi'}-${activeDay?.city||'journey'}-${selected||0}`;
    let hash=0;for(let i=0;i<seed.length;i++)hash=((hash<<5)-hash)+seed.charCodeAt(i)|0;
    const hue=Math.abs(hash)%360, second=(hue+42+(Math.abs(hash>>4)%46))%360;
    const gradient=`radial-gradient(circle at 18% 18%,hsla(${hue},48%,52%,.82),transparent 54%),radial-gradient(circle at 84% 76%,hsla(${second},42%,38%,.72),transparent 58%),linear-gradient(135deg,hsl(${hue},28%,18%),hsl(${second},24%,10%))`;
    document.documentElement.style.setProperty('--workspace-photo',value);
    document.documentElement.style.setProperty('--ambient-gradient',gradient);
  }
  function loadTrip(trip){if(!trip)return;if(typeof days!=='undefined')days.splice(0,days.length,...JSON.parse(JSON.stringify(trip.days||[])));if(typeof hotels!=='undefined')hotels.splice(0,hotels.length,...JSON.parse(JSON.stringify(trip.hotels||[])));if(typeof selected!=='undefined')selected=0;workspace.currentTripId=trip.id;save();window.loadTripScopedData?.(trip);if(typeof renderDays==='function')renderDays();if(typeof renderHotels==='function')renderHotels();if(typeof renderItinerary==='function')renderItinerary();if(typeof showPage==='function')showPage('itinerary');updateWorkspaceChrome();renderTrips()}
  function dateLabel(value){if(!value)return 'Dates to shape';let d=new Date(`${value}T12:00:00`);return d.toLocaleDateString('en-AU',{day:'numeric',month:'short',year:'numeric'})}
  function tripStatus(trip){return trip.status==='archive'||(trip.end&&trip.end<today)?'archive':'upcoming'}
  function tripDays(trip){return (trip.days||[]).length||1}
  const tripColors=['#91b878','#79a9d1','#c77c61','#b8a47a','#8da6a3','#a88fc2'];
  function tripColor(trip){return trip.color||tripColors[Math.abs(String(trip.id||'trip').split('').reduce((n,c)=>n+c.charCodeAt(0),0))%tripColors.length]}
  function updateTripColor(input){const trip=workspace.trips.find(t=>t.id===input?.dataset.tripColor);if(!trip||!/^#[0-9a-f]{6}$/i.test(input.value))return;trip.color=input.value;trip.updatedAt=Date.now();save();const card=input.closest('.workspace-trip-card');card?.style.setProperty('--trip-color',trip.color);updateWorkspaceChrome();toast?.('Card color updated')}
  function renderTrips(filter='upcoming'){
    const grid=document.querySelector('#workspace-trip-grid');if(!grid)return;
    const trips=ownedTrips().filter(t=>tripStatus(t)===filter);
    if(!trips.length){grid.innerHTML=`<div class="workspace-empty">No ${filter==='archive'?'past':'upcoming'} trips yet.<br><button type="button" class="glass-button glass-button-accent" id="workspace-empty-new">+ Create a trip</button></div>`;grid.querySelector('#workspace-empty-new').onclick=openTripDialog;return}
    grid.innerHTML=trips.map(trip=>`<article class="workspace-trip-card" style="--trip-color:${tripColor(trip)}" data-trip-card="${trip.id}"><div class="trip-card-top"><span class="trip-status">${tripStatus(trip)==='archive'?'ARCHIVED':'UPCOMING'}</span><div class="trip-menu-wrap"><button type="button" class="trip-favorite ${trip.favorite?'is-favorite':''}" data-trip-favorite="${trip.id}" aria-label="${trip.favorite?'Remove trip from favorites':'Save trip to favorites'}" aria-pressed="${!!trip.favorite}">♡</button><button type="button" class="trip-menu" data-trip-menu="${trip.id}" aria-expanded="false" aria-label="More options for ${trip.name}">···</button><div class="trip-card-menu" data-trip-card-menu="${trip.id}" hidden><button type="button" data-trip-edit="${trip.id}">Change trip info</button><label class="trip-color-picker">Change card color <input type="color" value="${tripColor(trip)}" data-trip-color="${trip.id}" aria-label="Choose card color" /></label><button type="button" data-trip-delete="${trip.id}">Delete trip</button></div></div></div><div><h2>${escapeHtml(trip.name)}</h2><p>${escapeHtml(trip.route||'A route waiting to be shaped')}</p><div class="trip-card-meta"><span>${dateLabel(trip.start)} — ${dateLabel(trip.end)}</span><span>${tripDays(trip)} days · ${trip.travellers||2} travellers</span></div><div class="trip-card-actions"><button type="button" class="open-trip" data-trip-open="${trip.id}">Open trip ↗</button><button type="button" data-trip-archive="${trip.id}">${tripStatus(trip)==='archive'?'Restore':'Archive'}</button><button type="button" class="share-trip" data-trip-share="${trip.id}">Share ↗</button></div></div></article>`).join('');
    grid.querySelectorAll('[data-trip-open]').forEach(b=>b.onclick=event=>{event.preventDefault();event.stopPropagation();syncLegacyToTrip();let trip=workspace.trips.find(t=>t.id===b.dataset.tripOpen);if(trip)loadTrip(trip);document.querySelectorAll('.page').forEach(page=>page.classList.toggle('active',page.id==='itinerary'));document.querySelectorAll('[data-page]').forEach(link=>link.classList.toggle('active',link.dataset.page==='itinerary'));document.querySelector('#top-location')?.replaceChildren(document.createTextNode('ITINERARY'));window.scrollTo({top:0,behavior:'smooth'});setTimeout(()=>window.showPage?.('itinerary'),0)});
    grid.querySelectorAll('[data-trip-menu]').forEach(b=>b.onclick=event=>{event.stopPropagation();let menu=grid.querySelector(`[data-trip-card-menu="${b.dataset.tripMenu}"]`),open=menu?.hidden===false;grid.querySelectorAll('.trip-card-menu').forEach(x=>x.hidden=true);grid.querySelectorAll('[data-trip-menu]').forEach(x=>x.setAttribute('aria-expanded','false'));if(menu&&!open){menu.hidden=false;b.setAttribute('aria-expanded','true')}});
    grid.querySelectorAll('[data-trip-delete]').forEach(b=>b.onclick=()=>{b.closest('.trip-card-menu').hidden=true;deleteTrip(b.dataset.tripDelete)});
    grid.querySelectorAll('[data-trip-color]').forEach(input=>{input.onchange=event=>{event.stopPropagation();updateTripColor(event.target)};input.onclick=event=>event.stopPropagation()});
    grid.querySelectorAll('[data-trip-edit]').forEach(b=>b.onclick=()=>{b.closest('.trip-card-menu').hidden=true;openEditTripDialog(workspace.trips.find(t=>t.id===b.dataset.tripEdit))});
    grid.querySelectorAll('[data-trip-favorite]').forEach(b=>b.onclick=event=>{event.stopPropagation();const trip=workspace.trips.find(t=>t.id===b.dataset.tripFavorite);if(!trip)return;trip.favorite=!trip.favorite;save();b.classList.toggle('is-favorite',trip.favorite);b.setAttribute('aria-pressed',String(!!trip.favorite));b.setAttribute('aria-label',trip.favorite?'Remove trip from favorites':'Save trip to favorites');toast?.(trip.favorite?'Trip saved to favorites':'Trip removed from favorites')});
    grid.querySelectorAll('[data-trip-archive]').forEach(b=>b.onclick=()=>toggleArchive(b.dataset.tripArchive));
    grid.querySelectorAll('[data-trip-share]').forEach(b=>b.onclick=()=>openShareDialog(workspace.trips.find(t=>t.id===b.dataset.tripShare)));
    document.addEventListener('click',event=>{if(event.target.closest?.('.trip-card-menu')||event.target.closest?.('[data-trip-menu]'))return;grid.querySelectorAll('.trip-card-menu').forEach(x=>x.hidden=true)}, {once:true});
  }
  function escapeHtml(value){return String(value||'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}
  function encodeShareTrip(trip){const json=JSON.stringify({...trip,id:undefined,ownerId:undefined,status:'upcoming',sharedAt:Date.now()});return btoa(unescape(encodeURIComponent(json))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')}
  function decodeShareTrip(value){try{let normalized=String(value||'').replace(/-/g,'+').replace(/_/g,'/');while(normalized.length%4)normalized+='=';return JSON.parse(decodeURIComponent(escape(atob(normalized))))}catch{return null}}
  function shareUrlFor(trip){let url=new URL(location.href);url.search='';url.hash='';url.searchParams.set('share',encodeShareTrip(trip));return url.href}
  let pendingSharedTrip=null;
  function openShareDialog(trip){if(!trip)return;let link=shareUrlFor(trip),dialog=document.querySelector('#workspace-share-dialog'),input=document.querySelector('#workspace-share-link'),email=document.querySelector('#workspace-share-email');if(!dialog)return;input.value=link;email.href=`mailto:?subject=${encodeURIComponent(`Join my trip · ${trip.name}`)}&body=${encodeURIComponent(`I shared my trip “${trip.name}” with you. Open this link to preview it and add a copy to your own Orbis account:\n\n${link}`)}`;dialog.showModal()}
  function showSharedTrip(trip){if(!trip)return;pendingSharedTrip=trip;let dialog=document.querySelector('#workspace-import-dialog');if(!dialog)return;document.querySelector('#workspace-import-title').textContent=trip.name||'A shared journey';document.querySelector('#workspace-import-copy').textContent=`${trip.route||'A complete travel plan'} · ${dateLabel(trip.start)} — ${dateLabel(trip.end)}. Add a copy to your account; your existing trips stay unchanged.`;document.querySelector('#workspace-import-preview').innerHTML=`<b>${tripDays(trip)} days</b><span>${(trip.days||[]).reduce((sum,day)=>sum+(day.items||[]).length,0)} itinerary stops · ${(trip.hotels||[]).length} stays</span>`;dialog.showModal()}
  function importSharedTrip(){if(!pendingSharedTrip||!workspace.currentUserId){openAuth();return}let copy=JSON.parse(JSON.stringify(pendingSharedTrip));copy.id=id('trip');copy.ownerId=workspace.currentUserId;copy.status='upcoming';copy.name=`${copy.name||'Shared journey'}${ownedTrips().some(t=>t.name===copy.name)?' (copy)':''}`;delete copy.sharedAt;workspace.trips.push(copy);workspace.currentTripId=copy.id;save();pendingSharedTrip=null;history.replaceState({},'',location.pathname);document.querySelector('#workspace-import-dialog')?.close();loadTrip(copy);toast?.('Trip added to your account')}
  function updateWorkspaceChrome(){const user=currentUser(),trip=workspace.trips.find(t=>t.id===workspace.currentTripId)||ownedTrips()[0];if(user){document.body.classList.add('workspace-glass');document.documentElement.style.setProperty('--workspace-cover',`linear-gradient(135deg,${tripColor(trip||{})}22 0%,#121512 72%)`);const name=document.querySelector('#workspace-user-name');if(name)name.textContent=user.name;const avatar=document.querySelector('#workspace-profile');if(avatar)avatar.textContent=(user.avatar||user.name||'T').slice(0,1).toUpperCase();const welcome=document.querySelector('#workspace-welcome-copy');if(welcome)welcome.textContent=`Welcome back, ${user.name.split(' ')[0]}. Your trips, places and memories stay together here.`;const cap=document.querySelector('#workspace-trip-caption');if(cap&&trip)cap.innerHTML=`${escapeHtml(trip.name)}<br>${dateLabel(trip.start)} — ${dateLabel(trip.end)}`;}}
  function openAuth(){const dialog=document.querySelector('#workspace-auth-dialog');if(dialog&&!dialog.open)dialog.showModal()}
  function signIn(name,email,googleId,avatar){
    const cleanName=(name||'Traveller').trim(),cleanEmail=(email||`${cleanName.toLowerCase().replace(/\s+/g,'.')}@local.tabi`).trim().toLowerCase();
    let user=workspace.users.find(u=>(googleId&&u.googleId===googleId)||u.email===cleanEmail);
    if(!user&&googleId){
      // The first Google account claims the original Japan seed so Ivan's existing
      // planning work is preserved. Every later Google account starts empty.
      const seedRecord=workspace.users.find(u=>u.id===seedUser.id);
      const hasGoogleUser=workspace.users.some(u=>u.googleId);
      const hasSeedTrip=workspace.trips.some(t=>t.ownerId===seedUser.id||(!t.ownerId&&seedUser.id===workspace.currentUserId));
      if(seedRecord&&!hasGoogleUser&&hasSeedTrip&&window.confirm('Save your existing Japan trip to this Google account?\n\nChoose Cancel for a fresh, empty workspace.'))user=seedRecord;
    }
    if(!user){user={id:googleId||id('user'),googleId:googleId||'',name:cleanName,email:cleanEmail,avatar:avatar||cleanName.slice(0,1)};workspace.users.push(user)}
    else{user.name=cleanName||user.name;user.email=cleanEmail;user.googleId=googleId||user.googleId;user.avatar=avatar||user.avatar}
    workspace.currentUserId=user.id;
    let trip=workspace.trips.find(t=>t.ownerId===user.id);
    // Google accounts do not receive a copied demo trip. They can create their
    // first journey from the Trips page, keeping each account's archive private.
    if(!trip&&!googleId){trip=JSON.parse(JSON.stringify(seedTrip));trip.id=id('trip');trip.ownerId=user.id;trip.name=`${cleanName.split(' ')[0]}'s Japan journey`;workspace.trips.push(trip)}
    workspace.currentTripId=trip?.id||null;save();document.querySelector('#workspace-auth-dialog')?.close();
    if(trip)loadTrip(trip);else{window.loadTripScopedData?.(null);updateWorkspaceChrome();renderTrips();if(typeof showPage==='function')showPage('trips');toast?.(`Welcome, ${cleanName.split(' ')[0]}. Create your first trip when you are ready.`)}
    if(pendingSharedTrip)setTimeout(()=>showSharedTrip(pendingSharedTrip),120);
  }
  let googleLoader;
  function loadGoogleIdentity(){
    if(window.google?.accounts?.id)return Promise.resolve(window.google);
    if(googleLoader)return googleLoader;
    googleLoader=new Promise((resolve,reject)=>{const script=document.createElement('script');script.src='https://accounts.google.com/gsi/client';script.async=true;script.defer=true;script.onload=()=>resolve(window.google);script.onerror=reject;document.head.appendChild(script)});
    return googleLoader;
  }
  function decodeGoogleCredential(credential){try{const payload=credential.split('.')[1].replace(/-/g,'+').replace(/_/g,'/');return JSON.parse(decodeURIComponent(atob(payload).split('').map(c=>`%${(`00${c.charCodeAt(0).toString(16)}`).slice(-2)}`).join('')))}catch{return null}}
  function startGoogleSignIn(){
    const clientId=window.TABI_GOOGLE_CLIENT_ID;
    if(!clientId){document.querySelector('#workspace-auth-name')?.focus();return}
    const button=document.querySelector('#workspace-google-sign-in');if(button){button.disabled=true;button.textContent='Connecting to Google…'}
    loadGoogleIdentity().then(()=>{
      window.google.accounts.id.initialize({client_id:clientId,callback:response=>{const profile=decodeGoogleCredential(response.credential);if(profile?.email)signIn(profile.name,profile.email,profile.sub,profile.picture);else toast?.('Google sign-in did not return an account');}});
      window.google.accounts.id.prompt(notification=>{if(notification.isNotDisplayed?.()||notification.isSkippedMoment?.()){if(button){button.disabled=false;button.textContent='Continue with Google'}toast?.('Google sign-in was closed. You can use the local profile below.')}});
    }).catch(()=>{if(button){button.disabled=false;button.textContent='Continue with Google'}toast?.('Google sign-in could not load. Check your connection.')});
  }
  function openTripDialog(){const d=document.querySelector('#workspace-trip-dialog');if(d&&!d.open){d.showModal();document.querySelector('#workspace-trip-name')?.focus()}}
  function openEditTripDialog(trip){if(!trip)return;const d=document.querySelector('#workspace-edit-trip-dialog');if(!d)return;document.querySelector('#edit-trip-id').value=trip.id;document.querySelector('#edit-trip-name').value=trip.name||'';document.querySelector('#edit-trip-start').value=trip.start||'';document.querySelector('#edit-trip-end').value=trip.end||'';document.querySelector('#edit-trip-route').value=trip.route||'';d.showModal()}
  function saveEditedTrip(event){event.preventDefault();const trip=workspace.trips.find(t=>t.id===document.querySelector('#edit-trip-id').value);if(!trip)return;const name=document.querySelector('#edit-trip-name').value.trim(),start=document.querySelector('#edit-trip-start').value,end=document.querySelector('#edit-trip-end').value,route=document.querySelector('#edit-trip-route').value.trim();if(!name||!start||!end)return;Object.assign(trip,{name,start,end,route,updatedAt:Date.now()});save();document.querySelector('#workspace-edit-trip-dialog').close();renderTrips(document.querySelector('.trip-filter.active')?.dataset.tripFilter||tripStatus(trip));if(workspace.currentTripId===trip.id)loadTrip(trip);toast?.('Trip information updated')}
  function createTrip(event){event.preventDefault();const name=document.querySelector('#workspace-trip-name').value.trim(),start=document.querySelector('#workspace-trip-start').value,end=document.querySelector('#workspace-trip-end').value,route=document.querySelector('#workspace-trip-route').value.trim();if(!name||!start||!end)return;syncLegacyToTrip();const trip={id:id('trip'),ownerId:workspace.currentUserId,name,start,end,route,color:tripColors[workspace.trips.length%tripColors.length],status:'upcoming',travellers:2,days:[{iso:start,date:String(new Date(`${start}T12:00:00`).getDate()).padStart(2,'0'),dow:new Date(`${start}T12:00:00`).toLocaleDateString('en',{weekday:'short'}).toUpperCase(),city:(route.split('·')[0]||'New place').trim(),title:`${name} <i>at your own pace</i>`,theme:'A day to shape',hotel:'—',notice:'Add your first stop when you are ready.',items:[['10:00','Free time','A blank page','Add your first stop whenever you are ready.','—']]}],hotels:[],saved:[]};workspace.trips.push(trip);workspace.currentTripId=trip.id;save();document.querySelector('#workspace-trip-dialog').close();document.querySelector('#workspace-trip-form').reset();loadTrip(trip);toast?.('New trip created')}
  function deleteTrip(tripId){const trip=workspace.trips.find(t=>t.id===tripId);if(!trip||!confirm(`Delete “${trip.name}”?`))return;workspace.trips=workspace.trips.filter(t=>t.id!==tripId);const remaining=ownedTrips();if(workspace.currentTripId===tripId)workspace.currentTripId=remaining[0]?.id||null;save();renderTrips(document.querySelector('.trip-filter.active')?.dataset.tripFilter||'upcoming');if(workspace.currentTripId){loadTrip(remaining.find(t=>t.id===workspace.currentTripId))}else{window.loadTripScopedData?.(null);updateWorkspaceChrome();if(typeof showPage==='function')showPage('trips')}toast?.('Trip deleted — the list is updated.')}
  function toggleArchive(tripId){const trip=workspace.trips.find(t=>t.id===tripId);if(!trip)return;trip.status=tripStatus(trip)==='archive'?'upcoming':'archive';save();renderTrips(document.querySelector('.trip-filter.active')?.dataset.tripFilter||'upcoming')}
  function signOut(){syncLegacyToTrip();workspace.currentUserId=null;workspace.currentTripId=null;save();openAuth()}
  window.TabiWorkspace={get state(){return workspace},openTripDialog,renderTrips,signIn,signOut,loadTrip,openAuth,persist:save};
  const originalPersist=window.persistTrip;window.persistTrip=function(){if(originalPersist)originalPersist();syncLegacyToTrip()};
  const originalRenderItinerary=window.renderItinerary;
  window.renderItinerary=function(){if(originalRenderItinerary)originalRenderItinerary();syncAmbientBackground()};
  const originalShow=window.showPage;window.showPage=function(page){if(page==='trips'){document.querySelectorAll('.page').forEach(p=>p.classList.toggle('active',p.id==='trips'));document.querySelectorAll('[data-page]').forEach(a=>a.classList.toggle('active',a.dataset.page==='trips'));document.querySelector('#top-location').textContent='YOUR TRIPS';renderTrips();window.scrollTo({top:0,behavior:'smooth'});return}if(originalShow)originalShow(page);updateWorkspaceChrome()};
  document.addEventListener('DOMContentLoaded',()=>{});
  const sharedValue=new URLSearchParams(location.search).get('share');
  if(sharedValue)pendingSharedTrip=decodeShareTrip(sharedValue);
  const storedUser=workspace.currentUserId&&currentUser();
  if(!storedUser){workspace.currentUserId=null;workspace.currentTripId=null;save();setTimeout(()=>window.loadTripScopedData?.(null),0)}
  const activeTrip=workspace.trips.find(t=>t.id===workspace.currentTripId)||ownedTrips()[0];if(activeTrip)loadTrip(activeTrip);syncAmbientBackground();updateWorkspaceChrome();renderTrips();if(!storedUser)openAuth();else if(pendingSharedTrip)setTimeout(()=>showSharedTrip(pendingSharedTrip),180);
  const assistant=document.querySelector('.ai-planner');
  if(assistant){
    assistant.classList.add('global-ai-dialog');
    document.querySelector('.shell')?.append(assistant);
    const assistantToggle=document.createElement('button');
    assistantToggle.type='button';
    assistantToggle.className='ai-assistant-orb';
    assistantToggle.setAttribute('aria-label','Open AI Trip Assistant');
    assistantToggle.setAttribute('aria-expanded','false');
    assistantToggle.innerHTML='<span aria-hidden="true">✦</span>';
    document.querySelector('.shell')?.append(assistantToggle);
    assistant.hidden=true;
    const closeAssistant=()=>{assistant.hidden=true;assistantToggle.hidden=false;assistantToggle.setAttribute('aria-expanded','false');assistantToggle.setAttribute('aria-label','Open AI Trip Assistant')};
    assistantToggle.onclick=()=>{assistant.hidden=false;assistantToggle.hidden=true;assistantToggle.setAttribute('aria-expanded','true');assistant.querySelector('#ai-place')?.focus()};
    assistant.querySelector('.ai-copy')?.insertAdjacentHTML('beforebegin','<button type="button" class="ai-dialog-close" aria-label="Close AI Trip Assistant">×</button>');
    assistant.querySelector('.ai-dialog-close').onclick=closeAssistant;
    document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!assistant.hidden)closeAssistant()});
  }
  document.querySelector('#dashboard')?.remove();
  document.querySelector('.days-panel')?.remove();document.querySelector('.language-switch')?.remove();
  document.querySelector('#workspace-new-trip')?.addEventListener('click',openTripDialog);document.querySelector('#workspace-new-trip-inline')?.addEventListener('click',openTripDialog);document.querySelector('#workspace-trip-form')?.addEventListener('submit',createTrip);document.querySelector('#workspace-trip-close')?.addEventListener('click',()=>document.querySelector('#workspace-trip-dialog').close());document.querySelector('#workspace-trip-cancel')?.addEventListener('click',()=>document.querySelector('#workspace-trip-dialog').close());document.querySelector('#workspace-edit-trip-form')?.addEventListener('submit',saveEditedTrip);document.querySelector('#edit-trip-close')?.addEventListener('click',()=>document.querySelector('#workspace-edit-trip-dialog').close());document.querySelector('#edit-trip-cancel')?.addEventListener('click',()=>document.querySelector('#workspace-edit-trip-dialog').close());document.querySelector('#workspace-sign-out')?.addEventListener('click',signOut);document.querySelector('#workspace-profile')?.addEventListener('click',openAuth);
  document.querySelector('#workspace-share-copy')?.addEventListener('click',async()=>{let input=document.querySelector('#workspace-share-link');try{await navigator.clipboard.writeText(input.value);toast?.('Share link copied')}catch{input.select();document.execCommand('copy');toast?.('Share link copied')}});
  document.querySelector('#workspace-share-close')?.addEventListener('click',()=>document.querySelector('#workspace-share-dialog')?.close());document.querySelector('#workspace-share-cancel')?.addEventListener('click',()=>document.querySelector('#workspace-share-dialog')?.close());
  document.querySelector('#workspace-import-form')?.addEventListener('submit',event=>{event.preventDefault();importSharedTrip()});document.querySelector('#workspace-import-close')?.addEventListener('click',()=>{pendingSharedTrip=null;document.querySelector('#workspace-import-dialog')?.close()});document.querySelector('#workspace-import-cancel')?.addEventListener('click',()=>{pendingSharedTrip=null;document.querySelector('#workspace-import-dialog')?.close()});
  document.addEventListener('click',event=>{
    const open=event.target.closest?.('[data-trip-open]');
    if(open){
      event.preventDefault();event.stopImmediatePropagation();
      document.querySelectorAll('.page').forEach(page=>page.classList.toggle('active',page.id==='itinerary'));
      document.querySelectorAll('[data-page]').forEach(link=>link.classList.toggle('active',link.dataset.page==='itinerary'));
      document.querySelector('#top-location')?.replaceChildren(document.createTextNode('ITINERARY'));
      try{syncLegacyToTrip();const trip=workspace.trips.find(t=>t.id===open.dataset.tripOpen);if(trip)loadTrip(trip)}catch(error){console.error('Unable to load trip',error)}
      window.scrollTo({top:0,behavior:'smooth'});setTimeout(()=>window.showPage?.('itinerary'),0);return
    }
  },true);
  document.querySelectorAll('[data-trip-filter]').forEach(b=>b.addEventListener('click',()=>{document.querySelectorAll('[data-trip-filter]').forEach(x=>x.classList.toggle('active',x===b));renderTrips(b.dataset.tripFilter)}));
  document.querySelector('#workspace-auth-form')?.addEventListener('submit',e=>{e.preventDefault();signIn(document.querySelector('#workspace-auth-name').value,document.querySelector('#workspace-auth-email').value)});
  document.querySelector('#workspace-google-sign-in')?.addEventListener('click',startGoogleSignIn);
})();
