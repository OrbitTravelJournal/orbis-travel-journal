/* Collapsible mobile navigation reuses the existing page links and handlers. */
(() => {
  const nav=document.querySelector('.mobile-nav'); if(!nav)return;
  const panel=document.createElement('div');panel.id='mobile-nav-panel';panel.className='mobile-nav-panel';panel.inert=true;
  nav.querySelectorAll('a').forEach((link,index)=>{
    const label=link.querySelector('span:not(.orbis-icon)');if(label)label.classList.add('mobile-nav-label');
    link.style.setProperty('--nav-delay',`${index*25}ms`);panel.append(link);
  });
  const toggle=document.createElement('button');toggle.type='button';toggle.className='mobile-nav-toggle';toggle.setAttribute('aria-label','打开导航');toggle.setAttribute('aria-expanded','false');toggle.setAttribute('aria-controls',panel.id);
  toggle.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/></svg>';
  nav.replaceChildren(panel,toggle);
  function setOpen(open){nav.classList.toggle('is-open',open);panel.inert=!open;toggle.setAttribute('aria-expanded',String(open));toggle.setAttribute('aria-label',open?'收起导航':'打开导航');}
  toggle.onclick=()=>setOpen(!nav.classList.contains('is-open'));
  panel.addEventListener('click',event=>{if(event.target.closest('a'))setOpen(false);});
  document.addEventListener('click',event=>{if(!nav.contains(event.target))setOpen(false);});
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&nav.classList.contains('is-open')){setOpen(false);toggle.focus();}});
  window.matchMedia('(min-width:921px)').addEventListener('change',()=>setOpen(false));
})();
