const SOURCE_URL = './orario-source.html';
const DAY_NAMES = ['Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì'];
const DAY_SHORT = ['LUN', 'MAR', 'MER', 'GIO', 'VEN'];
const SEMESTER_START = new Date(2026, 8, 28);
const SEMESTER_END = new Date(2027, 0, 16);
const HOUR_START = 8;
const HOUR_END = 19;
const GOOGLE_IMPORT_URL = 'https://calendar.google.com/calendar/u/0/r/settings/export';
const OFFICIAL_SOURCE_URL = 'https://www.phys.uniroma1.it/sites/default/files/allegati/orariolezioni/orario_s1_2627_v9.html';
const COURSE_COLORS = ['#751a2c', '#3d6c7f', '#46705a', '#8b5f25', '#6d4a73', '#a34b3c', '#356c68'];
const TRACK_COLORS = { T1: '#3575a5', T2: '#b66b25', T3: '#b53b43', M1: '#3d7a59', M2: '#765184', S: '#77706d' };

const ROOM_BUILDINGS = {
  'Edificio Marconi': ['Amaldi', 'Conversi', 'Rasetti', 'Careri', 'Laboratorio di Sistemi e Segnali e Astrofisica', 'Majorana'],
  'Edificio Fermi': ['Cabibbo', 'Aula 3 “Nella Mortara”', 'Aula 4 “Giustina Baroni”', 'Aula 8', 'Sala Calcolo'],
  'Altre sedi': ['Aula I (edificio Caglioti di Chimica - CU032)', 'Aula III (edificio Caglioti di Chimica - CU032)', 'Aula 17 (Laboratori di Via Tiburtina – RM025)', 'Laboratorio di Termodinamica (Laboratori di Via Tiburtina – RM025)']
};

const state = {
  view: 'personal',
  degree: 'T',
  year: 1,
  date: clampDate(new Date()),
  channelByTrack: {},
  choicesByTrack: {},
  building: 'Edificio Marconi',
  room: 'Amaldi',
  datasets: {},
  rooms: {}
};

const els = {};

document.addEventListener('DOMContentLoaded', init);

async function init() {
  bindElements();
  restoreState();
  bindEvents();
  els.datePicker.value = isoDate(state.date);
  try {
    const response = await fetch(SOURCE_URL);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const source = await response.text();
    const doc = new DOMParser().parseFromString(source, 'text/html');
    parseSource(doc);
    populateYears();
    populateBuildings();
    syncControls();
    render();
  } catch (error) {
    console.error(error);
    els.loadError.hidden = false;
    els.weekGrid.innerHTML = '<div class="loading-message">Dati non disponibili</div>';
  }
}

function bindElements() {
  Object.assign(els, {
    viewTabs: [...document.querySelectorAll('.view-tab')],
    personalPanel: document.querySelector('#panel-personal'),
    roomsPanel: document.querySelector('#panel-rooms'),
    degreeButtons: [...document.querySelectorAll('[data-degree]')],
    yearSelect: document.querySelector('#year-select'),
    channelGroup: document.querySelector('#channel-group'),
    channelSelect: document.querySelector('#channel-select'),
    choiceGroup: document.querySelector('#choice-group'),
    choicePicker: document.querySelector('#choice-picker'),
    choiceSummary: document.querySelector('#choice-summary'),
    choiceOptions: document.querySelector('#choice-options'),
    clearChoices: document.querySelector('#clear-choices'),
    selectionStrip: document.querySelector('#selection-strip'),
    emptyChoice: document.querySelector('#empty-choice'),
    buildingSelect: document.querySelector('#building-select'),
    roomSelect: document.querySelector('#room-select'),
    roomStatValue: document.querySelector('#room-stat-value'),
    calendarKicker: document.querySelector('#calendar-kicker'),
    weekTitle: document.querySelector('#week-title'),
    weekGrid: document.querySelector('#week-grid'),
    legendItems: document.querySelector('#legend-items'),
    datePicker: document.querySelector('#date-picker'),
    prevWeek: document.querySelector('#prev-week'),
    nextWeek: document.querySelector('#next-week'),
    todayButton: document.querySelector('#today-button'),
    addCalendar: document.querySelector('#add-calendar'),
    calendarDialog: document.querySelector('#calendar-dialog'),
    calendarDialogIntro: document.querySelector('#calendar-dialog-intro'),
    exportApple: document.querySelector('#export-apple'),
    exportGoogle: document.querySelector('#export-google'),
    exportAndroid: document.querySelector('#export-android'),
    exportStatus: document.querySelector('#export-status'),
    mobileAgenda: document.querySelector('#mobile-agenda'),
    loadError: document.querySelector('#load-error')
  });
}

function bindEvents() {
  els.viewTabs.forEach(button => button.addEventListener('click', () => {
    state.view = button.dataset.view;
    syncView();
    render();
    saveState();
  }));

  els.degreeButtons.forEach(button => button.addEventListener('click', () => {
    state.degree = button.dataset.degree;
    state.year = 1;
    populateYears();
    syncControls();
    render();
    saveState();
  }));

  els.yearSelect.addEventListener('change', () => {
    state.year = Number(els.yearSelect.value);
    syncControls();
    render();
    saveState();
  });

  els.channelSelect.addEventListener('change', () => {
    state.channelByTrack[currentTrack()] = els.channelSelect.value;
    render();
    saveState();
  });

  els.choiceOptions.addEventListener('change', event => {
    if (!event.target.matches('input[type="checkbox"]')) return;
    const selected = selectedChoices();
    if (event.target.checked) selected.add(event.target.value);
    else selected.delete(event.target.value);
    state.choicesByTrack[currentTrack()] = [...selected];
    render();
    saveState();
  });

  els.clearChoices.addEventListener('click', event => {
    event.preventDefault();
    state.choicesByTrack[currentTrack()] = [];
    syncChoicePicker();
    render();
    saveState();
  });

  els.selectionStrip.addEventListener('click', event => {
    const button = event.target.closest('[data-remove-course]');
    if (!button) return;
    const selected = selectedChoices();
    selected.delete(button.dataset.removeCourse);
    state.choicesByTrack[currentTrack()] = [...selected];
    syncChoicePicker();
    render();
    saveState();
  });

  els.buildingSelect.addEventListener('change', () => {
    state.building = els.buildingSelect.value;
    state.room = availableRoomsForBuilding()[0] || '';
    populateRooms();
    render();
    saveState();
  });

  els.roomSelect.addEventListener('change', () => {
    state.room = els.roomSelect.value;
    render();
    saveState();
  });

  els.datePicker.addEventListener('change', () => {
    state.date = clampDate(parseIso(els.datePicker.value));
    els.datePicker.value = isoDate(state.date);
    render();
  });

  els.prevWeek.addEventListener('click', () => shiftWeek(-7));
  els.nextWeek.addEventListener('click', () => shiftWeek(7));
  els.todayButton.addEventListener('click', () => {
    state.date = clampDate(new Date());
    els.datePicker.value = isoDate(state.date);
    render();
  });

  els.addCalendar.addEventListener('click', openCalendarDialog);
  els.exportApple.addEventListener('click', () => exportCalendar('apple'));
  els.exportAndroid.addEventListener('click', () => exportCalendar('android'));
  els.exportGoogle.addEventListener('click', () => exportCalendar('google'));
}

function parseSource(doc) {
  const studyTables = [...doc.querySelectorAll('table.studgroup')];
  ['T1', 'T2', 'T3', 'M1', 'M2'].forEach((track, index) => {
    state.datasets[track] = parseStudyTable(studyTables[index], track);
  });

  [...doc.querySelectorAll('table.classroom')].forEach(table => {
    let heading = table.previousElementSibling;
    while (heading && heading.tagName !== 'H3') heading = heading.previousElementSibling;
    if (!heading) return;
    const roomName = clean(heading.textContent);
    state.rooms[roomName] = parseClassroomTable(table, roomName);
  });
}

function parseStudyTable(table, track) {
  if (!table) return [];
  return [...table.querySelectorAll('tr')].slice(1).map((row, rowIndex) => {
    const cells = [...row.querySelectorAll(':scope > td')];
    if (cells.length < 7) return null;
    const title = clean(cells[0].textContent);
    const teacher = clean(cells[1].textContent);
    const channelMatch = track.startsWith('T') ? title.match(/\s+\(([^()]*(?:-|–)[^()]*)\)$/) : null;
    const channel = channelMatch ? channelMatch[1] : null;
    const baseTitle = channel ? title.slice(0, title.length - channelMatch[0].length) : title;
    const events = cells.slice(2, 7).flatMap((cell, day) => parseStudyCell(cell).map(event => ({
      ...event,
      day,
      title,
      baseTitle,
      teacher,
      track,
      id: `${track}-${rowIndex}-${day}-${event.start}`
    })));
    return { id: `${track}-${rowIndex}`, title, baseTitle, teacher, channel, events };
  }).filter(Boolean);
}

function parseStudyCell(cell) {
  const tokens = [];
  [...cell.childNodes].forEach(node => {
    if (node.nodeType === Node.TEXT_NODE) {
      const value = clean(node.textContent);
      if (value) tokens.push(value);
    } else if (node.nodeType === Node.ELEMENT_NODE && node.tagName === 'SMALL') {
      tokens.push({ date: clean(node.textContent) });
    }
  });

  const events = [];
  for (let i = 0; i < tokens.length - 1; i += 1) {
    if (typeof tokens[i] !== 'string' || typeof tokens[i + 1] !== 'string') continue;
    const time = tokens[i + 1].match(/^(\d{1,2})\s*[-–]\s*(\d{1,2})$/);
    if (!time) continue;
    const event = {
      room: tokens[i],
      start: Number(time[1]),
      end: Number(time[2]),
      from: null,
      to: null
    };
    if (tokens[i + 2] && typeof tokens[i + 2] === 'object') {
      const range = parseDateRange(tokens[i + 2].date);
      event.from = range.from;
      event.to = range.to;
      i += 1;
    }
    events.push(event);
    i += 1;
  }
  return events;
}

function parseClassroomTable(table, room) {
  const hourly = [];
  [...table.querySelectorAll('tr')].slice(1).forEach(row => {
    const cells = [...row.querySelectorAll(':scope > td')];
    const time = clean(cells[0]?.textContent || '').match(/^(\d{1,2})\s*[-–]\s*(\d{1,2})$/);
    if (!time) return;
    cells.slice(1, 6).forEach((cell, day) => {
      const spans = [...cell.querySelectorAll(':scope > span')];
      spans.forEach((span, index) => {
        const parts = [];
        let node = span.nextSibling;
        while (node && !(node.nodeType === Node.ELEMENT_NODE && node.tagName === 'SPAN')) {
          if (node.nodeType === Node.TEXT_NODE) parts.push(node.textContent);
          if (node.nodeType === Node.ELEMENT_NODE && node.tagName !== 'BR') parts.push(node.textContent);
          node = node.nextSibling;
        }
        const detail = clean(parts.join(' ')).replace(/^[-–·.\s]+/, '');
        const range = parseDateRange(detail);
        const normalizedDetail = detail.replace(/dal\s+\d{1,2}\/\d{1,2}\/\d{2}\s*al\s+\d{1,2}\/\d{1,2}\/\d{2}/i, '').trim();
        hourly.push({
          room,
          day,
          start: Number(time[1]),
          end: Number(time[2]),
          title: clean(span.textContent),
          detail: normalizedDetail,
          track: [...span.classList][0] || 'S',
          from: range.from,
          to: range.to,
          id: `${slug(room)}-${day}-${time[1]}-${index}`
        });
      });
    });
  });
  return mergeHourlyEvents(hourly);
}

function mergeHourlyEvents(events) {
  const result = [];
  const sorted = [...events].sort((a, b) => a.day - b.day || a.start - b.start || a.title.localeCompare(b.title));
  sorted.forEach(event => {
    const previous = result.find(item => item.day === event.day && item.end === event.start && item.title === event.title && item.detail === event.detail && item.track === event.track && sameDate(item.from, event.from) && sameDate(item.to, event.to));
    if (previous) previous.end = event.end;
    else result.push({ ...event });
  });
  return result;
}

function populateYears() {
  const years = state.degree === 'T' ? [1, 2, 3] : [1, 2];
  if (!years.includes(state.year)) state.year = 1;
  els.yearSelect.innerHTML = years.map(year => `<option value="${year}">${roman(year)} anno</option>`).join('');
  els.yearSelect.value = String(state.year);
}

function syncControls() {
  els.degreeButtons.forEach(button => button.classList.toggle('is-active', button.dataset.degree === state.degree));
  els.yearSelect.value = String(state.year);
  syncChannels();
  syncChoicePicker();
  syncView();
}

function syncView() {
  els.viewTabs.forEach(button => {
    const active = button.dataset.view === state.view;
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-selected', String(active));
    button.tabIndex = active ? 0 : -1;
  });
  els.personalPanel.hidden = state.view !== 'personal';
  els.roomsPanel.hidden = state.view !== 'rooms';
  els.addCalendar.hidden = state.view !== 'personal';
}

function syncChannels() {
  const courses = state.datasets[currentTrack()] || [];
  const channels = [...new Set(courses.map(course => course.channel).filter(Boolean))];
  const show = state.degree === 'T' && channels.length > 0;
  els.channelGroup.hidden = !show;
  if (!show) return;
  const track = currentTrack();
  if (!channels.includes(state.channelByTrack[track])) state.channelByTrack[track] = channels[0];
  els.channelSelect.innerHTML = channels.map(channel => `<option value="${escapeHtml(channel)}">${escapeHtml(channel)}</option>`).join('');
  els.channelSelect.value = state.channelByTrack[track];
}

function syncChoicePicker() {
  const choices = choiceCourses();
  const selected = selectedChoices();
  els.choiceGroup.hidden = choices.length === 0;
  els.choiceOptions.innerHTML = choices.map(course => `
    <label class="choice-option">
      <input type="checkbox" value="${escapeHtml(course.id)}" aria-label="${escapeHtml(course.title)}" ${selected.has(course.id) ? 'checked' : ''} />
      <span><strong>${escapeHtml(course.title)}</strong><small>${escapeHtml(course.teacher)}</small></span>
    </label>
  `).join('');
  els.choiceSummary.textContent = selected.size ? `${selected.size} ${selected.size === 1 ? 'insegnamento' : 'insegnamenti'}` : 'Seleziona insegnamenti';
}

function populateBuildings() {
  const nonEmptyBuildings = Object.entries(ROOM_BUILDINGS).filter(([, rooms]) => rooms.some(room => state.rooms[room]));
  els.buildingSelect.innerHTML = nonEmptyBuildings.map(([building]) => `<option>${escapeHtml(building)}</option>`).join('');
  if (!nonEmptyBuildings.some(([building]) => building === state.building)) state.building = nonEmptyBuildings[0]?.[0] || '';
  els.buildingSelect.value = state.building;
  populateRooms();
}

function populateRooms() {
  const rooms = availableRoomsForBuilding();
  if (!rooms.includes(state.room)) state.room = rooms[0] || '';
  els.roomSelect.innerHTML = rooms.map(room => `<option>${escapeHtml(room)}</option>`).join('');
  els.roomSelect.value = state.room;
}

function availableRoomsForBuilding() {
  return (ROOM_BUILDINGS[state.building] || []).filter(room => state.rooms[room]);
}

function render() {
  const monday = startOfWeek(state.date);
  const friday = addDays(monday, 4);
  els.weekTitle.textContent = `${formatDayMonth(monday)} — ${formatDayMonth(friday)}`;
  els.calendarKicker.textContent = state.view === 'personal' ? 'Calendario personale' : `Disponibilità · ${shortRoomName(state.room)}`;

  let events;
  if (state.view === 'personal') {
    const courses = visibleCourses();
    events = courses.flatMap(course => course.events).filter(event => activeInWeek(event, monday));
    renderSelectionStrip(courses);
    els.emptyChoice.hidden = !(state.degree === 'M' && courses.length === 0);
    renderLegend(courses.map(course => ({ label: course.baseTitle, color: colorFor(course.baseTitle) })));
  } else {
    events = (state.rooms[state.room] || []).filter(event => activeInWeek(event, monday));
    const occupied = occupiedHours(events);
    els.roomStatValue.textContent = String(occupied);
    renderLegend(Object.entries(TRACK_COLORS).map(([track, color]) => ({ label: trackLabel(track), color })));
  }
  renderWeek(events, monday);
  renderMobileAgenda(events, monday);
}

function renderSelectionStrip(courses) {
  const core = coreCourses();
  const elective = courses.filter(course => !core.some(item => item.id === course.id));
  const coreLabel = core.length ? `<span class="chip chip-core">Canale ${escapeHtml(state.channelByTrack[currentTrack()] || '')} · ${core.length} corsi</span>` : '';
  const electives = elective.map(course => `<span class="chip">${escapeHtml(course.title)}<button type="button" aria-label="Rimuovi ${escapeHtml(course.title)}" data-remove-course="${escapeHtml(course.id)}">×</button></span>`).join('');
  els.selectionStrip.innerHTML = coreLabel + electives;
}

function renderWeek(events, monday) {
  const headers = DAY_NAMES.map((day, index) => {
    const date = addDays(monday, index);
    const today = sameDate(date, new Date());
    return `<div class="day-head ${today ? 'is-today' : ''}" style="grid-column:${index + 2}"><strong>${day}</strong><span>${date.getDate()} ${shortMonth(date)}</span></div>`;
  }).join('');

  const labels = Array.from({ length: HOUR_END - HOUR_START + 1 }, (_, index) => {
    const hour = HOUR_START + index;
    return `<span class="time-label" style="top:calc(var(--hour-height) * ${index})">${String(hour).padStart(2, '0')}:00</span>`;
  }).join('');

  const columns = DAY_NAMES.map((_, day) => {
    const dayEvents = layoutLanes(events.filter(event => event.day === day));
    const cards = dayEvents.map(event => eventCard(event)).join('');
    return `<div class="day-column" style="grid-column:${day + 2}">${cards}</div>`;
  }).join('');

  els.weekGrid.innerHTML = `<div class="corner-cell"></div>${headers}<div class="time-axis">${labels}</div>${columns}`;
}

function renderMobileAgenda(events, monday) {
  els.mobileAgenda.innerHTML = DAY_NAMES.map((dayName, day) => {
    const date = addDays(monday, day);
    const dayEvents = [...events].filter(event => event.day === day).sort((a, b) => a.start - b.start || a.title.localeCompare(b.title));
    const items = dayEvents.length
      ? dayEvents.map(event => agendaItem(event)).join('')
      : '<p class="agenda-empty">Nessun impegno</p>';
    return `<section class="agenda-day">
      <div class="agenda-day-head"><strong>${dayName}</strong><span>${date.getDate()} ${shortMonth(date)}</span></div>
      <div class="agenda-list">${items}</div>
    </section>`;
  }).join('');
}

function agendaItem(event) {
  const color = state.view === 'rooms' ? (TRACK_COLORS[event.track] || TRACK_COLORS.S) : colorFor(event.baseTitle || event.title);
  const secondary = state.view === 'rooms' ? (event.detail || trackLabel(event.track)) : `${event.teacher} · ${roomWithBuilding(event.room)}`;
  return `<article class="agenda-item" style="--event-color:${color}">
    <span class="agenda-time">${pad(event.start)}:00<br>${pad(event.end)}:00</span>
    <span class="agenda-bar" aria-hidden="true"></span>
    <span class="agenda-copy"><strong>${escapeHtml(event.title)}</strong><span>${escapeHtml(secondary)}</span></span>
  </article>`;
}

function eventCard(event) {
  const top = (event.start - HOUR_START) * 58 + 2;
  const height = Math.max(28, (event.end - event.start) * 58 - 4);
  const color = state.view === 'rooms' ? (TRACK_COLORS[event.track] || TRACK_COLORS.S) : colorFor(event.baseTitle || event.title);
  const left = event.lanes > 1 ? `calc(${(event.lane / event.lanes) * 100}% + 2px)` : '3px';
  const width = event.lanes > 1 ? `calc(${100 / event.lanes}% - 4px)` : 'calc(100% - 6px)';
  const secondary = state.view === 'rooms'
    ? `${event.detail || trackLabel(event.track)}`
    : `${event.teacher} · ${roomWithBuilding(event.room)}`;
  const reservation = event.track === 'S' ? ' is-reservation' : '';
  const short = event.end - event.start <= 1 ? ' is-short' : '';
  const label = `${event.title}, ${event.start}:00-${event.end}:00, ${secondary}`;
  return `<article class="event-card${reservation}${short}" tabindex="0" aria-label="${escapeHtml(label)}" title="${escapeHtml(label)}" style="top:${top}px;height:${height}px;left:${left};width:${width};--event-color:${color}">
    <span class="event-mainline"><span class="event-time">${pad(event.start)}:00–${pad(event.end)}:00</span><strong>${escapeHtml(event.title)}</strong></span>
    <span class="event-meta">${escapeHtml(secondary)}</span>
  </article>`;
}

function layoutLanes(events) {
  const sorted = [...events].sort((a, b) => a.start - b.start || b.end - a.end);
  const groups = [];
  let current = [];
  let groupEnd = -Infinity;
  sorted.forEach(event => {
    if (event.start >= groupEnd && current.length) {
      groups.push(current);
      current = [];
      groupEnd = -Infinity;
    }
    current.push({ ...event });
    groupEnd = Math.max(groupEnd, event.end);
  });
  if (current.length) groups.push(current);

  return groups.flatMap(group => {
    const laneEnds = [];
    group.forEach(event => {
      let lane = laneEnds.findIndex(end => end <= event.start);
      if (lane === -1) lane = laneEnds.length;
      laneEnds[lane] = event.end;
      event.lane = lane;
    });
    group.forEach(event => { event.lanes = laneEnds.length; });
    return group;
  });
}

function renderLegend(items) {
  const unique = [];
  const seen = new Set();
  items.forEach(item => {
    if (!item.label || seen.has(item.label)) return;
    seen.add(item.label);
    unique.push(item);
  });
  els.legendItems.innerHTML = unique.slice(0, 8).map(item => `<span class="legend-item"><span class="legend-swatch" style="--swatch:${item.color}"></span>${escapeHtml(item.label)}</span>`).join('');
}

function visibleCourses() {
  return [...coreCourses(), ...choiceCourses().filter(course => selectedChoices().has(course.id))];
}

function openCalendarDialog() {
  const courses = visibleCourses();
  els.exportStatus.textContent = '';
  els.calendarDialogIntro.textContent = courses.length
    ? `${courses.length} ${courses.length === 1 ? 'insegnamento' : 'insegnamenti'} verranno aggiunti come eventi settimanali, rispettando le date di inizio e fine.`
    : 'Seleziona almeno un insegnamento prima di esportare il calendario.';
  [els.exportApple, els.exportGoogle, els.exportAndroid].forEach(button => { button.disabled = courses.length === 0; });
  if (typeof els.calendarDialog.showModal === 'function') els.calendarDialog.showModal();
  else els.calendarDialog.setAttribute('open', '');
}

function exportCalendar(platform) {
  const courses = visibleCourses();
  if (!courses.length) return;
  const events = compactCalendarEvents(courses.flatMap(course => course.events));
  const ics = buildIcs(events);
  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `orario-fisica-${currentTrack().toLowerCase()}.ics`;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);

  if (platform === 'google') {
    els.exportStatus.textContent = 'File scaricato. Si apre ora la pagina Importa di Google Calendar.';
    window.open(GOOGLE_IMPORT_URL, '_blank', 'noopener,noreferrer');
  } else if (platform === 'apple') {
    els.exportStatus.textContent = 'File scaricato: aprilo per aggiungerlo ad Apple Calendar.';
  } else {
    els.exportStatus.textContent = 'File scaricato: aprilo con l’app calendario del telefono.';
  }
}

function compactCalendarEvents(events) {
  const result = [];
  [...events].sort((a, b) => a.day - b.day || a.start - b.start || a.title.localeCompare(b.title)).forEach(event => {
    const previous = result.find(item => item.day === event.day && item.end === event.start && item.title === event.title && item.teacher === event.teacher && item.room === event.room && sameDate(item.from, event.from) && sameDate(item.to, event.to));
    if (previous) previous.end = event.end;
    else result.push({ ...event });
  });
  return result;
}

function buildIcs(events) {
  const now = formatIcsUtc(new Date());
  const blocks = events.map((event, index) => {
    const rangeStart = event.from && event.from > SEMESTER_START ? event.from : SEMESTER_START;
    const rangeEnd = event.to && event.to < SEMESTER_END ? event.to : SEMESTER_END;
    const first = firstOccurrence(rangeStart, event.day);
    if (first > rangeEnd) return '';
    const start = localDateTime(first, event.start);
    const end = localDateTime(first, event.end);
    const until = `${rangeEnd.getFullYear()}${pad(rangeEnd.getMonth() + 1)}${pad(rangeEnd.getDate())}T225959Z`;
    const uid = `${slug(event.title)}-${event.day}-${event.start}-${index}@orari-fisica`;
    return [
      'BEGIN:VEVENT',
      `UID:${escapeIcs(uid)}`,
      `DTSTAMP:${now}`,
      `DTSTART;TZID=Europe/Rome:${start}`,
      `DTEND;TZID=Europe/Rome:${end}`,
      `RRULE:FREQ=WEEKLY;UNTIL=${until}`,
      `SUMMARY:${escapeIcs(event.title)}`,
      `DESCRIPTION:${escapeIcs(`Docente: ${event.teacher}\nAula: ${roomWithBuilding(event.room)}\nFonte: ${OFFICIAL_SOURCE_URL}`)}`,
      `LOCATION:${escapeIcs(roomWithBuilding(event.room))}`,
      `CATEGORIES:${escapeIcs(trackLabel(event.track))}`,
      'END:VEVENT'
    ].join('\r\n');
  }).filter(Boolean);

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Orari Fisica Sapienza//IT',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:Orario Fisica Sapienza',
    'X-WR-TIMEZONE:Europe/Rome',
    'BEGIN:VTIMEZONE',
    'TZID:Europe/Rome',
    'BEGIN:DAYLIGHT',
    'TZOFFSETFROM:+0100',
    'TZOFFSETTO:+0200',
    'TZNAME:CEST',
    'DTSTART:19700329T020000',
    'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU',
    'END:DAYLIGHT',
    'BEGIN:STANDARD',
    'TZOFFSETFROM:+0200',
    'TZOFFSETTO:+0100',
    'TZNAME:CET',
    'DTSTART:19701025T030000',
    'RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU',
    'END:STANDARD',
    'END:VTIMEZONE',
    ...blocks,
    'END:VCALENDAR',
    ''
  ].join('\r\n');
}

function firstOccurrence(start, dayIndex) {
  const date = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const targetDay = dayIndex + 1;
  const delta = (targetDay - date.getDay() + 7) % 7;
  date.setDate(date.getDate() + delta);
  return date;
}

function localDateTime(date, hour) {
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}T${pad(hour)}0000`;
}

function formatIcsUtc(date) {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

function escapeIcs(value) {
  return String(value).replace(/\\/g, '\\\\').replace(/\r?\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');
}

function coreCourses() {
  if (state.degree !== 'T') return [];
  const channel = state.channelByTrack[currentTrack()];
  return (state.datasets[currentTrack()] || []).filter(course => course.channel === channel);
}

function choiceCourses() {
  const courses = state.datasets[currentTrack()] || [];
  return state.degree === 'M' ? courses : courses.filter(course => !course.channel);
}

function selectedChoices() {
  return new Set(state.choicesByTrack[currentTrack()] || []);
}

function currentTrack() { return `${state.degree}${state.year}`; }

function activeInWeek(event, monday) {
  const occurrence = addDays(monday, event.day);
  if (occurrence < SEMESTER_START || occurrence > SEMESTER_END) return false;
  if (event.from && occurrence < event.from) return false;
  if (event.to && occurrence > event.to) return false;
  return true;
}

function shiftWeek(days) {
  state.date = clampDate(addDays(state.date, days));
  els.datePicker.value = isoDate(state.date);
  render();
}

function parseDateRange(text) {
  const match = String(text || '').match(/dal\s+(\d{1,2})\/(\d{1,2})\/(\d{2})\s*al\s+(\d{1,2})\/(\d{1,2})\/(\d{2})/i);
  if (!match) return { from: null, to: null };
  return {
    from: new Date(2000 + Number(match[3]), Number(match[2]) - 1, Number(match[1])),
    to: new Date(2000 + Number(match[6]), Number(match[5]) - 1, Number(match[4]))
  };
}

function trackLabel(track) {
  return ({ T1: 'Triennale I', T2: 'Triennale II', T3: 'Triennale III', M1: 'Magistrale I', M2: 'Magistrale II', S: 'Altra attività' })[track] || track;
}

function colorFor(value) {
  let hash = 0;
  for (const char of String(value)) hash = ((hash << 5) - hash + char.charCodeAt(0)) | 0;
  return COURSE_COLORS[Math.abs(hash) % COURSE_COLORS.length];
}

function shortRoomName(room) {
  return room.replace(/\s*\(.*$/, '');
}

function roomWithBuilding(room) {
  const value = clean(room);
  const rules = [
    [/^(Amaldi|Conversi|Rasetti|Careri|Majorana)\b/i, 'Edificio Marconi'],
    [/^(LabSS\/Astro|Laboratorio di Sistemi e Segnali e Astrofisica)\b/i, 'Edificio Marconi'],
    [/^(Cabibbo|Aula 3|Aula 4|Aula 8|Lab\. Calcolo|Sala Calcolo)\b/i, 'Edificio Fermi'],
    [/^Aula I(?:\s|\(|$)/i, 'Edificio Caglioti · CU032'],
    [/^Aula III(?:\s|\(|$)/i, 'Edificio Caglioti · CU032'],
    [/^(Aula 17|Lab\. Termo|Laboratorio di Termodinamica)\b/i, 'Laboratori di Via Tiburtina · RM025']
  ];
  const match = rules.find(([pattern]) => pattern.test(value));
  return match ? `${value} · ${match[1]}` : value;
}

function startOfWeek(date) {
  const result = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = result.getDay();
  result.setDate(result.getDate() - (day === 0 ? 6 : day - 1));
  return result;
}

function clampDate(date) {
  const value = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  if (value < SEMESTER_START) return new Date(SEMESTER_START);
  if (value > SEMESTER_END) return new Date(SEMESTER_END);
  return value;
}

function addDays(date, days) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function parseIso(value) {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function isoDate(date) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

function formatDayMonth(date) {
  return new Intl.DateTimeFormat('it-IT', { day: 'numeric', month: 'long' }).format(date);
}

function shortMonth(date) {
  return new Intl.DateTimeFormat('it-IT', { month: 'short' }).format(date).replace('.', '');
}

function roman(number) { return ['I', 'II', 'III'][number - 1]; }
function pad(value) { return String(value).padStart(2, '0'); }
function clean(value) { return String(value || '').replace(/\s+/g, ' ').trim(); }
function slug(value) { return clean(value).toLowerCase().replace(/[^a-z0-9]+/g, '-'); }
function sameDate(a, b) {
  if (!a && !b) return true;
  return Boolean(a && b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate());
}

function occupiedHours(events) {
  return DAY_NAMES.reduce((total, _, day) => {
    const slots = new Set();
    events.filter(event => event.day === day).forEach(event => {
      for (let hour = event.start; hour < event.end; hour += 1) slots.add(hour);
    });
    return total + slots.size;
  }, 0);
}
function escapeHtml(value) { return String(value).replace(/[&<>"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[char]); }

function saveState() {
  localStorage.setItem('orari-fisica-preferences', JSON.stringify({
    view: state.view,
    degree: state.degree,
    year: state.year,
    channelByTrack: state.channelByTrack,
    choicesByTrack: state.choicesByTrack,
    building: state.building,
    room: state.room
  }));
}

function restoreState() {
  try {
    const saved = JSON.parse(localStorage.getItem('orari-fisica-preferences') || '{}');
    Object.assign(state, saved);
  } catch (_) {
    // Prefer usable defaults if a previous value is no longer valid.
  }
}
