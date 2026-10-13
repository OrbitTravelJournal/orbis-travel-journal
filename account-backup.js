/* Local recovery files contain only the currently signed-in account's trips. */
(() => {
  const state=()=>window.TabiWorkspace?.state;
  const user=()=>{const s=state();return s?.users.find(u=>u.id===s.currentUserId);};
  function makeBackup(){
    const current=user();if(!current)throw new Error('请先登录需要备份的账号');
    window.persistTrip?.();
    return {format:'orbis-account-backup',version:1,exportedAt:new Date().toISOString(),account:{email:current.email,name:current.name},trips:JSON.parse(JSON.stringify(state().trips.filter(t=>t.ownerId===current.id)))};
  }
  async function download(previous=false){
    try{
      const backup=makeBackup();if(previous===true){const owner=user()?.id,copy=await window.OrbisCloud?.getPreviousCopy();if(user()?.id!==owner)throw new Error('账号已变化，请重新下载');if(!copy?.length)throw new Error('当前账号没有同步前旧版');backup.trips=copy;backup.source='before-cloud-sync';}const url=URL.createObjectURL(new Blob([JSON.stringify(backup,null,2)],{type:'application/json'})),link=document.createElement('a');
      link.href=url;link.download=`Orbis-backup-${backup.exportedAt.slice(0,10)}.json`;link.textContent='下载 JSON 备份文件';link.className='account-backup-download';section.querySelector('.account-backup-download')?.remove();section.append(link);link.click();setTimeout(()=>URL.revokeObjectURL(url),300000);
      status.textContent=`已生成 ${backup.trips.length} 趟行程的备份。若未开始下载，请点击下方文件链接；它包含图片及个人资料。`;
    }catch(error){status.textContent=error.message;}
  }
  const dialog=document.querySelector('#workspace-auth-dialog');if(!dialog)return;
  const section=document.createElement('section');section.id='account-backup';
  section.innerHTML='<h3>数据备份</h3><p>下载当前账号的本机资料副本，包含图片与个人资料。</p><div><button type="button" id="account-export-backup">下载本机备份</button><button type="button" id="account-import-backup">导入备份副本</button><button type="button" id="account-export-previous">下载同步前旧版</button></div><p id="account-backup-status" role="status" aria-live="polite"></p>';
  dialog.querySelector('form').append(section);const status=section.querySelector('#account-backup-status');
  section.querySelector('#account-export-backup').onclick=()=>download();
  section.querySelector('#account-export-previous').onclick=()=>download(true);
  const input=document.createElement('input');input.type='file';input.accept='.json,application/json';input.hidden=true;document.body.append(input);
  section.querySelector('#account-import-backup').onclick=()=>{if(!user()){status.textContent='请先登录需要接收备份的账号';return;}input.value='';input.click();};
  input.onchange=async()=>{
    const file=input.files?.[0],current=user();if(!file||!current)return;
    const s=state(),initialLength=s.trips.length,previousId=s.currentTripId;
    try{
      if(file.size>40*1024*1024)throw new Error('备份文件过大，请分开导入');
      const backup=JSON.parse(await file.text());
      if(backup.format!=='orbis-account-backup'||backup.version!==1||!Array.isArray(backup.trips))throw new Error('这不是有效的 Orbis 备份文件');
      if(user()?.id!==current.id)throw new Error('登录账号已变化，请重新导入');
      if(!backup.trips.length)throw new Error('备份文件没有行程');
      for(const trip of backup.trips){if(!trip||typeof trip.name!=='string'||!Array.isArray(trip.days)||!Array.isArray(trip.hotels)||trip.days.some(d=>!d||!Array.isArray(d.items)))throw new Error('备份中的行程格式不完整');}
      const copies=backup.trips.map(trip=>({...trip,id:'backup-'+crypto.randomUUID(),ownerId:current.id,name:trip.name+'（备份副本）',importedFromShare:true,restoredAt:new Date().toISOString()}));
      s.trips.push(...copies);
      if(window.TabiWorkspace.persist()===false){s.trips.splice(initialLength);throw new Error('本机空间不足，导入未完成。原资料和备份文件保留。');}
      window.TabiWorkspace.renderTrips();status.textContent=`已导入 ${copies.length} 趟行程副本，原行程未覆盖。`;
    }catch(error){if(s.trips.length>initialLength)s.trips.splice(initialLength);s.currentTripId=previousId;status.textContent=error.message;}
    finally{input.value='';}
  };
})();
