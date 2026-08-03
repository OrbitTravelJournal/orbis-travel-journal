/* Keeps every legacy Tabi surface attached to the active workspace trip.
   The original prototype stored these collections globally; this bridge moves
   them into the current trip object without changing the existing UI code. */
(function(){
  const clone=value=>JSON.parse(JSON.stringify(value??[]));
  const state=()=>window.TabiWorkspace?.state;
  const trip=()=>{const s=state();return s?.trips?.find(item=>item.id===s.currentTripId)};
  const saveWorkspace=()=>window.TabiWorkspace?.persist?.();
  function capture(){
    const active=trip();if(!active)return;
    active.days=clone(typeof days!=='undefined'?days:active.days||[]);
    active.hotels=clone(typeof hotels!=='undefined'?hotels:active.hotels||[]);
    active.saved=clone(typeof savedPlaces!=='undefined'?savedPlaces:active.saved||[]);
    active.restaurantBookings=clone(typeof restaurantBookings!=='undefined'?restaurantBookings:active.restaurantBookings||[]);
    active.hotelMedia=clone(typeof hotelMedia!=='undefined'?hotelMedia:active.hotelMedia||{});
    active.hiddenHotelBookings=clone(typeof hiddenHotelBookings!=='undefined'?[...hiddenHotelBookings]:active.hiddenHotelBookings||[]);
    active.note=document.querySelector('#notes textarea')?.value||active.note||'';
    active.updatedAt=Date.now();saveWorkspace();
  }
  function clearLegacy(){
    if(typeof days!=='undefined')days.splice(0,days.length);
    if(typeof hotels!=='undefined')hotels.splice(0,hotels.length);
    if(typeof savedPlaces!=='undefined')savedPlaces=[];
    if(typeof restaurantBookings!=='undefined')restaurantBookings=[];
    if(typeof hotelMedia!=='undefined')hotelMedia={};
    if(typeof hiddenHotelBookings!=='undefined')hiddenHotelBookings=new Set();
    const note=document.querySelector('#notes textarea');if(note)note.value='';
  }
  window.loadTripScopedData=function(active){
    if(!active){clearLegacy();window.renderSavedPlaces?.();window.renderHotels?.();window.renderItinerary?.();return}
    if(typeof days!=='undefined')days.splice(0,days.length,...clone(active.days||[]));
    if(typeof hotels!=='undefined')hotels.splice(0,hotels.length,...clone(active.hotels||[]));
    if(typeof savedPlaces!=='undefined')savedPlaces=clone(active.saved||[]);
    if(typeof restaurantBookings!=='undefined')restaurantBookings=clone(active.restaurantBookings||[]);
    if(typeof hotelMedia!=='undefined')hotelMedia=clone(active.hotelMedia||{});
    if(typeof hiddenHotelBookings!=='undefined')hiddenHotelBookings=new Set(active.hiddenHotelBookings||[]);
    const note=document.querySelector('#notes textarea');if(note)note.value=active.note||'';
    if(typeof selected!=='undefined')selected=Math.min(selected,Math.max(0,days.length-1));
    window.renderSavedPlaces?.();window.renderHotels?.();window.renderItinerary?.();window.renderMap?.();
  };
  const originalPersist=window.persistTrip;
  window.persistTrip=function(){if(originalPersist)originalPersist();capture()};
  document.querySelector('#notes textarea')?.addEventListener('input',capture);
  // The existing Japan data is captured once before another account can switch in.
  if(trip())capture();
  window.addEventListener('beforeunload',capture);
})();
