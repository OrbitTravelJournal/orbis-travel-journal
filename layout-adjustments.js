/* Itinerary layout: recommendations belong to the end of the page, not the side rail. */
(() => {
  const citySunset = { Osaka: '17:05', Kyoto: '17:00', Miyazu: '17:02', Kinosaki: '17:03', Awaji: '17:04' };
  const moveRecommendations = () => {
    const page = document.querySelector('#itinerary');
    const picks = page?.querySelector('.nearby-picks');
    if (page && picks && picks.parentElement !== page) page.append(picks);
  };
  const minutes = value => {
    const match = String(value || '').match(/(\d{1,2}):(\d{2})/);
    return match ? Number(match[1]) * 60 + Number(match[2]) : null;
  };
  const formatDuration = total => `${Math.floor(total / 60)}h ${String(total % 60).padStart(2, '0')}m`;
  const syncDayStats = () => {
    const items = [...document.querySelectorAll('#timeline .timeline-item')];
    if (!items.length) return;
    const times = items.map(item => minutes(item.querySelector('.item-time')?.textContent)).filter(Number.isFinite);
    const walking = Math.max(0, (items.length - items.filter(item => item.classList.contains('transport')).length) * 12);
    const first = Math.min(...times), last = Math.max(...times);
    const duration = Math.max(0, last - first + (items.length > 1 ? 30 : 60));
    const walkingNode = document.querySelector('#walking-time');
    const plannedNode = document.querySelector('#planned-time');
    const walkingText = formatDuration(walking), plannedText = formatDuration(duration);
    if (walkingNode && walkingNode.textContent !== walkingText) walkingNode.textContent = walkingText;
    if (plannedNode && plannedNode.textContent !== plannedText) plannedNode.textContent = plannedText;
    const city = document.querySelector('#day-subtitle')?.textContent?.split('·').pop()?.trim();
    const sunsetNode = document.querySelector('.timeline-side dl dt:first-child')?.parentElement?.querySelector('dd');
    if (sunsetNode && citySunset[city] && sunsetNode.textContent !== citySunset[city]) sunsetNode.textContent = citySunset[city];
  };
  document.addEventListener('click', event => {
    const deleteButton = event.target.closest('[data-calendar-delete]');
    if (!deleteButton) return;
    const label = deleteButton.closest('.calendar-day-row')?.querySelector('b')?.textContent || 'this travel day';
    if (!window.confirm(`Delete ${label} from your calendar?`)) {
      event.preventDefault();
      event.stopImmediatePropagation();
      return;
    }
    window.setTimeout(() => {
      window.persistTrip?.();
      window.renderCalendarDays?.();
      window.renderItinerary?.();
    }, 30);
  }, true);
  document.addEventListener('submit', event => {
    if (event.target?.id !== 'calendar-form') return;
    window.setTimeout(() => {
      const dialog = document.querySelector('#calendar-dialog');
      if (dialog?.open) dialog.close();
      document.querySelector('#itinerary')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      window.setTimeout(() => document.querySelector('.date-tab.active')?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' }), 80);
    }, 0);
  }, true);
  document.addEventListener('DOMContentLoaded', moveRecommendations);
  document.addEventListener('DOMContentLoaded', syncDayStats);
  new MutationObserver(() => { moveRecommendations(); syncDayStats(); }).observe(document.body, { childList: true, subtree: true });
})();
