let viewMonth = 0;
let viewYear = 0;
let allEntries = [];
let currentCycleIndex = 0;
let cycleViewEnabled = false;
let cycleBoundaries = [];

// Utility: left-pad numbers
function pad(num) {
  return String(num).padStart(2, '0');
}

// Helper: YYYY-MM-DD local ISO
function formatISO(input) {
  const d = new Date(input);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function normalizeStartDate(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);  // Start of day
  return d;
}

function normalizeEndDate(date) {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);  // End of day
  return d;
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

function initializeCycleView(entries) {
  allEntries = entries;

  const day1Entries = entries
    .filter(e => e.entryDate && (e.phase || '').toLowerCase() === 'day1-period')
    .map(e => new Date(e.entryDate))
    .sort((a, b) => a - b);

  let boundaries = [];

  // Compute averages once here
  const averages = computeAverages(entries);

  for (let i = 0; i < day1Entries.length; i++) {
    const start = day1Entries[i];
    let end;
    if (i + 1 < day1Entries.length) {
      end = new Date(day1Entries[i + 1]);
      end.setDate(end.getDate() - 1);  // one day before next cycle start
    } else {
      // If last cycle, extend end by average cycle length if available
      if (averages && averages.avgCycleLength) {
        end = new Date(start);
        end.setDate(end.getDate() + averages.avgCycleLength - 1);
      } else {
        end = new Date();  // fallback to today
      }
    }
    if (end < start) end = new Date(start); // safeguard
    boundaries.push({ start, end });
  }

  cycleBoundaries = boundaries;
  currentCycleIndex = cycleBoundaries.length - 1;
}

function renderCycleCalendar(entries, startDate, endDate) {
  console.log('renderCycleCalendar called', { startDate, endDate });
  const grid = document.getElementById('calendarGrid');
  if (!grid) {
    console.warn('No calendarGrid element found');
    return;
  }

  grid.innerHTML = '';
  ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].forEach(d => {
    const hdr = document.createElement('div');
    hdr.className = 'weekday';
    hdr.textContent = d;
    grid.appendChild(hdr);
  });

  const start = new Date(startDate);
  const end = new Date(endDate || Date.now());
  const firstDow = start.getDay();
  for (let i = 0; i < firstDow; i++) {
    const blank = document.createElement('div');
    blank.className = 'day-box empty';
    grid.appendChild(blank);
  }

  const day = new Date(start);
  while (day <= end) {
    const iso = formatISO(day);
    const cell = document.createElement('div');
    cell.className = 'day-box';
    cell.dataset.date = iso;
    cell.innerHTML = `<div class="date-label">${day.getDate()}</div>`;
    grid.appendChild(cell);
    day.setDate(day.getDate() + 1);
  }

  // Pass the start and end dates to all highlight functions
  applyLoggedPeriod(entries, start, end);
  applyLoggedFertile(entries, start, end);
  applyLoggedSurge(entries, start, end);
  applyLoggedOvulation(entries, start, end);
  applyLoggedSymptoms(entries, start, end);
  applyLoggedLuteal(entries, start, end);

  const preds = computeAverages(entries);
  if (preds) applyPredictedCycles(preds, 3, start, end);
}

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

  // Logged highlights (month view uses old filters)
  applyLoggedPeriod(entries, new Date(year, month, 1), new Date(year, month, daysCount));
  applyLoggedFertile(entries, new Date(year, month, 1), new Date(year, month, daysCount));
  applyLoggedSurge(entries, new Date(year, month, 1), new Date(year, month, daysCount));
  applyLoggedOvulation(entries, new Date(year, month, 1), new Date(year, month, daysCount));
  applyLoggedSymptoms(entries, new Date(year, month, 1), new Date(year, month, daysCount));
  applyLoggedLuteal(entries, new Date(year, month, 1), new Date(year, month, daysCount));

  // Predicted highlights for current + 3 future cycles
  const preds = computeAverages(entries);
  if (preds) applyPredictedCycles(preds, 3, new Date(year, month, 1), new Date(year, month, daysCount));
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

function applyLoggedPeriod(entries, startDate, endDate) {
  console.log('Checking Day1 periods in range:', startDate, 'to', endDate);
  entries.forEach(e => {
    if ((e.phase || '').toLowerCase() === 'day1-period') {
      console.log('Day1-period entry found:', e.entryDate);
    }
  });

  const day1Dates = entries
    .filter(e => (e.phase || '').toLowerCase() === 'day1-period')
    .map(e => formatISO(e.entryDate));
  day1Dates.forEach(isoStart => {
    const [y, m, d] = isoStart.split('-').map(Number);
    const start = new Date(y, m - 1, d);
    for (let i = 0; i < 5; i++) {
      const dt = new Date(start);
      dt.setDate(start.getDate() + i);
      if (dt >= startDate && dt <= endDate) {
        const box = document.querySelector(`.day-box[data-date="${formatISO(dt)}"]`);
        if (box) box.classList.add(i === 0 ? 'deep-red' : 'red');
      }
    }
  });
}

function applyLoggedFertile(entries, startDate, endDate) {
  document.querySelectorAll('.day-box.fertile').forEach(b => b.classList.remove('fertile'));
  entries.forEach(e => {
    const v = parseFloat(e.opk);
    if (isNaN(v) || v < 0 || v >= 1) return;
    const iso = formatISO(e.entryDate);
    const [y, m, d] = iso.split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    if (dt >= startDate && dt <= endDate) {
      const box = document.querySelector(`.day-box[data-date="${iso}"]`);
      if (box && !box.classList.contains('deep-red') && !box.classList.contains('red')) {
        box.classList.add('fertile');
      }
    }
  });
}

function applyLoggedSurge(entries, startDate, endDate) {
  document.querySelectorAll('.day-box.surge').forEach(b => b.classList.remove('surge'));
  entries.forEach(e => {
    const v = parseFloat(e.opk);
    if (isNaN(v) || v < 1) return;
    const iso = formatISO(e.entryDate);
    const [y, m, d] = iso.split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    if (dt >= startDate && dt <= endDate) {
      const box = document.querySelector(`.day-box[data-date="${iso}"]`);
      if (box && !box.classList.contains('deep-red') && !box.classList.contains('red')) {
        box.classList.add('surge');
      }
    }
  });
}

function applyLoggedOvulation(entries, startDate, endDate) {
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
    if (dt >= startDate && dt <= endDate) {
      const isoOv = formatISO(dt);
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
function applyLoggedSymptoms(entries, startDate, endDate) {
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
    const [y, m, d] = iso.split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    if (dt < startDate || dt > endDate) {
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
function applyLoggedLuteal(entries, startDate, endDate) {
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
    const endDateCalc = nextDay1Iso ? new Date(nextDay1Iso) : endDate;

    let dt = new Date(ovDate);
    while (dt <= endDateCalc) {
      if (dt >= startDate && dt <= endDate) {
        const iso = formatISO(dt);
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

function applyPredictedCycles({ avgCycleLength, avgFertileOffset, avgOvOffset, lastDay1 }, count, startDate, endDate) {
  for (let cycle = 0; cycle <= count; cycle++) {
    const start = new Date(lastDay1);
    start.setDate(start.getDate() + avgCycleLength * cycle);

    // Skip predictions outside the visible range
    if (start > endDate) break;

    // 🩸 Period
    for (let i = 0; i < 5; i++) {
      const dt = new Date(start);
      dt.setDate(dt.getDate() + i);
      if (dt >= startDate && dt <= endDate) markPrediction(dt, '🩸');
    }

    // 🔵 Fertile
    const pe = new Date(start);
    pe.setDate(pe.getDate() + 4);
    const fs = new Date(pe);
    fs.setDate(fs.getDate() + avgFertileOffset);
    const fe = new Date(start);
    fe.setDate(fe.getDate() + avgOvOffset);
    for (let dt = new Date(fs); dt <= fe; dt.setDate(dt.getDate() + 1)) {
      if (dt >= startDate && dt <= endDate) markPrediction(dt, '🔵');
    }

    // 🔷 Ovulation
    const ov = new Date(start);
    ov.setDate(ov.getDate() + avgOvOffset);
    if (ov >= startDate && ov <= endDate) markPrediction(ov, '🔷');
  }
}

// Helper to drop an icon into the correct cell
function markPrediction(date, icon) {
  const iso = formatISO(date);
  // For predictions, we rely on the actual calendar day-box presence, so no year/month filter here
  const cell = document.querySelector(`.day-box[data-date="${iso}"]`);
  if (!cell) return;
  const ico = document.createElement('div');
  ico.className = 'prediction';
  ico.textContent = icon;
  cell.appendChild(ico);
}

function changeCycle(offset) {
  const lastCycleIndex = allCycles.length - 1;
  let newIndex = currentCycleIndex + offset;

  // Allow forward navigation 3 cycles beyond last known cycle for predictions
  const maxIndex = lastCycleIndex + 3;

  if (newIndex < 0) newIndex = 0;
  if (newIndex > maxIndex) newIndex = maxIndex;

  currentCycleIndex = newIndex;

  const label = document.getElementById('monthLabel');
  if (!label) return;

  // If newIndex is beyond lastCycleIndex, show predicted months only (no logged data)
  if (newIndex > lastCycleIndex) {
    const preds = computeAverages([]); // Empty entries for no data
    if (!preds) return; // No predictions possible without data

    // Calculate predicted start based on lastDay1 + avgCycleLength * (newIndex - lastCycleIndex)
    const predictedStart = new Date(preds.lastDay1);
    predictedStart.setDate(predictedStart.getDate() + preds.avgCycleLength * (newIndex - lastCycleIndex));

    const predictedEnd = new Date(predictedStart);
    predictedEnd.setDate(predictedEnd.getDate() + preds.avgCycleLength - 1);

    renderCycleCalendar([], predictedStart, predictedEnd);
    label.textContent = `Predicted ${newIndex - lastCycleIndex} Month(s) Ahead`;

    // Clear table and charts for predicted (no data)
    renderTable([]);
    renderCharts([]);

    return;
  }

  // Otherwise, render logged data cycle
  const cycle = allCycles[newIndex];
  if (!cycle) return;

  renderTable(cycle.entries);
  renderCharts(cycle.entries);

  const { start, end } = cycleBoundaries[newIndex] || {};

  // Extend end date for current cycle with average length if needed
  const averages = computeAverages(allEntries);
  if (newIndex === cycleBoundaries.length - 1 && averages && averages.avgCycleLength) {
    const predictedEnd = new Date(start);
    predictedEnd.setDate(predictedEnd.getDate() + averages.avgCycleLength - 1);
    if (predictedEnd > end) {
      // Use predicted end if it's after current end
      renderCycleCalendar(cycle.entries, start, predictedEnd);
    } else {
      renderCycleCalendar(cycle.entries, start, end);
    }
  } else {
    renderCycleCalendar(cycle.entries, start, end);
  }

  label.textContent = (newIndex === lastCycleIndex) ? 'Current' : `Cycle ${newIndex + 1}`;
}

// Expose to global
window.run = run;
window.renderCycleCalendar = renderCycleCalendar;
window.changeCycle = changeCycle;
