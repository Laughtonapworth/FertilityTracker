// calendar-render.js

let viewMonth = 0;
let viewYear = 0;
let allEntries = [];

// Utility: left-pad numbers
function pad(num) {
  return String(num).padStart(2, '0');
}

// Helper: YYYY-MM-DD local ISO
function formatISO(input) {
  const d = new Date(input);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * Compute average cycle length, fertile offset, and ovulation offset
 * across all completed cycles.
 */
function computeAverages(entries) {
  const day1Entries = entries
    .filter(e => (e.phase || '').toLowerCase() === 'day1-period')
    .map(e => ({ iso: formatISO(e.entryDate), date: new Date(e.entryDate) }))
    .sort((a, b) => a.date - b.date);

  if (day1Entries.length < 2) return null;

  const cycleLengths = [];
  const fertileOffsets = [];
  const ovOffsets = [];

  for (let i = 0; i < day1Entries.length - 1; i++) {
    const start = day1Entries[i];
    const end = day1Entries[i + 1];
    cycleLengths.push(Math.round((end.date - start.date) / 86400000));

    const window = entries.filter(e => {
      const iso = formatISO(e.entryDate);
      return iso >= start.iso && iso < end.iso;
    });

    // first confirmed fertile
    const fertDates = window
      .filter(e => {
        const v = parseFloat(e.opk);
        return !isNaN(v) && v >= 0 && v < 1;
      })
      .map(e => new Date(e.entryDate))
      .sort((a, b) => a - b);
    if (fertDates.length) {
      const periodEnd = new Date(start.date);
      periodEnd.setDate(periodEnd.getDate() + 4);
      fertileOffsets.push(
        Math.round((fertDates[0] - periodEnd) / 86400000)
      );
    }

    // confirmed ovulation = last surge + 1
    const surges = window
      .filter(e => {
        const v = parseFloat(e.opk);
        return !isNaN(v) && v >= 1;
      })
      .map(e => new Date(e.entryDate))
      .sort((a, b) => a - b);
    if (surges.length) {
      const ov = new Date(surges.pop());
      ov.setDate(ov.getDate() + 1);
      ovOffsets.push(
        Math.round((ov - start.date) / 86400000)
      );
    }
  }

  const avg = arr => Math.round(arr.reduce((a, b) => a + b, 0) / arr.length);
  const avgCycleLength   = cycleLengths.length   ? avg(cycleLengths)   : null;
  const avgFertileOffset = fertileOffsets.length ? avg(fertileOffsets) : null;
  const avgOvOffset      = ovOffsets.length      ? avg(ovOffsets)      : null;
  const lastDay1         = day1Entries.pop().date;

  return { avgCycleLength, avgFertileOffset, avgOvOffset, lastDay1 };
}

/**
 * Render the calendar grid and apply all highlights.
 */
function renderUnifiedCalendar(entries, month, year) {
  allEntries = entries;
  viewMonth  = month;
  viewYear   = year;

  // Update month label
  const label = document.getElementById('monthLabel');
  if (label) {
    const monthNames = [
      "January","February","March","April","May","June",
      "July","August","September","October","November","December"
    ];
    const shortYear = String(year).slice(-2);
    label.textContent = `${monthNames[month]}-${shortYear}`;
  }

  // Build grid
  const grid = document.getElementById('calendarGrid');
  if (!grid) return;
  grid.innerHTML = '';
  ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].forEach(d => {
    const hdr = document.createElement('div');
    hdr.className = 'weekday';
    hdr.textContent = d;
    grid.appendChild(hdr);
  });
  const firstDow = new Date(year, month, 1).getDay();
  for (let i = 0; i < firstDow; i++) {
    const blank = document.createElement('div');
    blank.className = 'day-box empty';
    grid.appendChild(blank);
  }
  const daysCount = new Date(year, month + 1, 0).getDate();
  for (let d = 1; d <= daysCount; d++) {
    const cell = document.createElement('div');
    cell.className = 'day-box';
    const iso = `${year}-${pad(month + 1)}-${pad(d)}`;
    cell.dataset.date = iso;
    cell.innerHTML = `<div class="date-label">${d}</div>`;
    grid.appendChild(cell);
  }

  // Logged highlights
  applyLoggedPeriod(entries);
  applyLoggedFertile(entries);
  applyLoggedSurge(entries);
  applyLoggedOvulation(entries);
  applyLoggedSymptoms(entries);
  applyLoggedLuteal(entries);

  // Predicted highlights for current + 3 future cycles
  const preds = computeAverages(entries);
  if (preds) applyPredictedCycles(preds, 3);
}

/**
 * Move calendar by month offset
 */
function changeMonth(offset) {
  viewMonth += offset;
  if (viewMonth < 0) { viewMonth = 11; viewYear--; }
  if (viewMonth > 11) { viewMonth = 0; viewYear++; }
  renderUnifiedCalendar(allEntries, viewMonth, viewYear);
}

/* — Logged highlight functions — */

function applyLoggedPeriod(entries) {
  const day1Dates = entries
    .filter(e => (e.phase || '').toLowerCase() === 'day1-period')
    .map(e => formatISO(e.entryDate));
  day1Dates.forEach(isoStart => {
    const [y, m, d] = isoStart.split('-').map(Number);
    const start = new Date(y, m - 1, d);
    for (let i = 0; i < 5; i++) {
      const dt = new Date(start);
      dt.setDate(start.getDate() + i);
      if (dt.getFullYear() === viewYear && dt.getMonth() === viewMonth) {
        const box = document.querySelector(`.day-box[data-date="${formatISO(dt)}"]`);
        if (box) box.classList.add(i === 0 ? 'deep-red' : 'red');
      }
    }
  });
}

function applyLoggedFertile(entries) {
  document.querySelectorAll('.day-box.fertile').forEach(b => b.classList.remove('fertile'));
  entries.forEach(e => {
    const v = parseFloat(e.opk);
    if (isNaN(v) || v < 0 || v >= 1) return;
    const iso = formatISO(e.entryDate);
    const [y, m] = iso.split('-').map(Number);
    if (y === viewYear && (m - 1) === viewMonth) {
      const box = document.querySelector(`.day-box[data-date="${iso}"]`);
      if (box && !box.classList.contains('deep-red') && !box.classList.contains('red')) {
        box.classList.add('fertile');
      }
    }
  });
}

function applyLoggedSurge(entries) {
  document.querySelectorAll('.day-box.surge').forEach(b => b.classList.remove('surge'));
  entries.forEach(e => {
    const v = parseFloat(e.opk);
    if (isNaN(v) || v < 1) return;
    const iso = formatISO(e.entryDate);
    const [y, m] = iso.split('-').map(Number);
    if (y === viewYear && (m - 1) === viewMonth) {
      const box = document.querySelector(`.day-box[data-date="${iso}"]`);
      if (box && !box.classList.contains('deep-red') && !box.classList.contains('red')) {
        box.classList.add('surge');
      }
    }
  });
}

function applyLoggedOvulation(entries) {
  document.querySelectorAll('.day-box.ovulation').forEach(b => b.classList.remove('ovulation'));
  const day1Isos = entries
    .filter(e => (e.phase || '').toLowerCase() === 'day1-period')
    .map(e => formatISO(e.entryDate))
    .sort();
  day1Isos.forEach((startIso, idx) => {
    const endIso = day1Isos[idx + 1] || null;
    const surges = entries
      .map(e => ({ iso: formatISO(e.entryDate), v: parseFloat(e.opk) }))
      .filter(o => !isNaN(o.v) && o.v >= 1 && o.iso > startIso && (!endIso || o.iso < endIso))
      .map(o => o.iso);
    if (!surges.length) return;
    const last = surges.pop();
    const [y, m, d] = last.split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    dt.setDate(dt.getDate() + 1);
    const isoOv = formatISO(dt);
    const [yO, mO] = isoOv.split('-').map(Number);
    if (yO === viewYear && (mO - 1) === viewMonth) {
      const box = document.querySelector(`.day-box[data-date="${isoOv}"]`);
      if (box) {
        box.classList.remove('fertile');
        box.classList.add('ovulation');
      }
    }
  });
}

/**
 * Overlay symptom & sex icons on each day-box,
 * but skip spotting 🩸 on any red/deep-red (period) day.
 */
/**
 * Overlay symptom & sex icons on each day-box,
 * but skip spotting 🩸 on any red/deep-red (period) day.
 * Debugging: logs each date’s classList and our decision.
 */
/**
 * Overlay symptom & sex icons on each day-box,
 * but skip spotting 🩸 on any actual period day (Day1 + next 4).
 * Debugs periodSet and skip decisions.
 */
/**
 * Overlay symptom & sex icons on each day-box,
 * but skip spotting 🩸 on any logged period day.
 */
function applyLoggedSymptoms(entries) {
  console.group('🔍 applyLoggedSymptoms');

  // 1) Clear old icons
  document.querySelectorAll('.day-box .symptom-icon')
    .forEach(el => el.remove());

  // 2) Build set of all actual logged period dates (Day1 + any 'period')
  const periodSet = new Set();
  entries
    .filter(e => {
      const p = (e.phase || '').toLowerCase();
      return p === 'day1-period' || p === 'period';
    })
    .forEach(e => {
      const dt = new Date(e.entryDate);
      // If it's Day1, also include next 4 days
      const isDay1 = (e.phase || '').toLowerCase() === 'day1-period';
      const days = isDay1 ? 5 : 1;
      for (let i = 0; i < days; i++) {
        const d2 = new Date(dt);
        d2.setDate(dt.getDate() + i);
        periodSet.add(formatISO(d2));
      }
    });
  console.log(' periodSet:', Array.from(periodSet));

  // 3) Group emojis by date
  const iconsByDate = {};
  entries.forEach(e => {
    const iso = formatISO(e.entryDate);
    if (!iconsByDate[iso]) iconsByDate[iso] = new Set();
    if (e.spotting     && e.spotting     !== 'none') iconsByDate[iso].add('🚩');
    if (e.cramps       && e.cramps       !== 'none') iconsByDate[iso].add('🤕');
    if (e.breastChanges&& e.breastChanges!=='none') iconsByDate[iso].add('🤱');
    if (e.digestive    && e.digestive    !== 'none') iconsByDate[iso].add('🤢');
    if (e.sex          && e.sex.toLowerCase()==='yes') iconsByDate[iso].add('❤️');
  });

  // 4) Render, skipping 🩸 on any true period date
  Object.entries(iconsByDate).forEach(([iso, set]) => {
    console.group(`Date ${iso}`);
    const [y,m] = iso.split('-').map(Number);
    if (y !== viewYear || m - 1 !== viewMonth) {
      console.log(' → not in view, skip');
      console.groupEnd();
      return;
    }

    const box = document.querySelector(`.day-box[data-date="${iso}"]`);
    console.log(' classes:', box && Array.from(box.classList).join(' '));

    set.forEach(emoji => {
      if (emoji === '🩸' && periodSet.has(iso)) {
        console.log('  🩸 skipped (in periodSet)');
        return;
      }
      const span = document.createElement('span');
      span.className = 'symptom-icon';
      span.textContent = emoji;
      box.appendChild(span);
      console.log('  added', emoji);
    });

    console.groupEnd();
  });

  console.groupEnd();
}

/**
 * Highlight logged luteal days for any real ovulation (surge+1),
 * up to the next actual Day1 or today.
 */
function applyLoggedLuteal(entries) {
  document.querySelectorAll('.day-box.luteal').forEach(b => b.classList.remove('luteal'));

  const ovIsos = entries
    .filter(e => parseFloat(e.opk) >= 1)
    .map(e => {
      const d = new Date(e.entryDate);
      d.setDate(d.getDate() + 1);
      return formatISO(d);
    })
    .sort();

  const day1Isos = entries
    .filter(e => (e.phase || '').toLowerCase() === 'day1-period')
    .map(e => formatISO(e.entryDate))
    .sort();

  ovIsos.forEach(ovIso => {
    const ovDate = new Date(ovIso);
    const nextDay1Iso = day1Isos.find(d1 => d1 > ovIso);
    const endDate = nextDay1Iso ? new Date(nextDay1Iso) : new Date();

    let dt = new Date(ovDate);
    while (dt < endDate) {
      const iso = formatISO(dt);
      const [y, m] = iso.split('-').map(Number);
      if (y === viewYear && (m - 1) === viewMonth) {
        const cell = document.querySelector(`.day-box[data-date="${iso}"]`);
        if (cell && !cell.classList.contains('deep-red') && !cell.classList.contains('ovulation')) {
          cell.classList.add('luteal');
        }
      }
      dt.setDate(dt.getDate() + 1);
    }
  });
}

/* — Predictions (period, fertile, ovulation) — */

function applyPredictedCycles({ avgCycleLength, avgFertileOffset, avgOvOffset, lastDay1 }, count) {
  for (let cycle = 0; cycle <= count; cycle++) {
    const start = new Date(lastDay1);
    start.setDate(start.getDate() + avgCycleLength * cycle);

    // 🩸 Period
    for (let i = 0; i < 5; i++) {
      const dt = new Date(start);
      dt.setDate(dt.getDate() + i);
      markPrediction(dt, '🩸');
    }

    // 🔵 Fertile
    const pe = new Date(start);
    pe.setDate(pe.getDate() + 4);
    const fs = new Date(pe);
    fs.setDate(fs.getDate() + avgFertileOffset);
    const fe = new Date(start);
    fe.setDate(fe.getDate() + avgOvOffset);
    for (let dt = new Date(fs); dt <= fe; dt.setDate(dt.getDate() + 1)) {
      markPrediction(dt, '🔵');
    }

    // 🔷 Ovulation
    const ov = new Date(start);
    ov.setDate(ov.getDate() + avgOvOffset);
    markPrediction(ov, '🔷');
  }
}

// Helper to drop an icon into the correct cell
function markPrediction(date, icon) {
  const iso = formatISO(date);
  const [y, m] = iso.split('-').map(Number);
  if (y !== viewYear || (m - 1) !== viewMonth) return;
  const cell = document.querySelector(`.day-box[data-date="${iso}"]`);
  if (!cell) return;
  const ico = document.createElement('div');
  ico.className = 'prediction';
  ico.textContent = icon;
  cell.appendChild(ico);
}

// Expose for navigation
window.renderUnifiedCalendar = renderUnifiedCalendar;
window.changeMonth         = changeMonth;
