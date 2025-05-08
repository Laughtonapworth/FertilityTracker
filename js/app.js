document.addEventListener('DOMContentLoaded', () => {
  const app = document.getElementById('app');

  function createInput(label, id, type = 'text', options = null) {
    const div = document.createElement('div');
    const lbl = document.createElement('label');
    lbl.setAttribute('for', id);
    lbl.textContent = label;
    div.appendChild(lbl);
    let input;
    if (options) {
      input = document.createElement('select');
      input.id = id;
      options.forEach(opt => {
        const o = document.createElement('option');
        o.text = opt;
        input.add(o);
      });
    } else {
      input = document.createElement('input');
      input.type = type;
      input.id = id;
    }
    div.appendChild(input);
    return div;
  }

  function getFieldsForPhase(phase) {
    const common = [
      createInput('Date', 'date', 'date'),
      createInput('Cycle Day', 'cycleDay', 'number')
    ];
    if (phase === 'period') {
      return common.concat([
        createInput('Period Flow', 'flow', null, ['None', 'Light', 'Medium', 'Heavy'])
      ]);
    } else if (phase === 'pre-ovulation') {
      return common.concat([
        createInput('BBT (°C)', 'bbt', 'number'),
        createInput('Cervical Mucus', 'cm', null, ['Dry', 'Sticky', 'Creamy', 'Watery', 'Egg white']),
        createInput('Ovulation Test Result', 'opk', null, ['Blank circle', 'Flashing face', 'Solid face']),
        createInput('Second OPK Test Taken', 'secondOpk', null, ['No', 'Yes']),
        createInput('Sex', 'sexPre', null, ['Y', 'N'])
      ]);
    } else if (phase === 'ovulation') {
      return common.concat([
        createInput('DPO', 'dpoOvulation', 'number'),
        createInput('BBT (°C)', 'bbtOv', 'number'),
        createInput('Cervical Mucus', 'cmOv', null, ['Dry', 'Sticky', 'Creamy', 'Watery', 'Egg white']),
        createInput('Sex', 'sexOv', null, ['Y', 'N'])
      ]);
    } else if (phase === 'post-ovulation') {
      return common.concat([
        createInput('DPO', 'dpoPost', 'number'),
        createInput('BBT (°C)', 'bbtPost', 'number'),
        createInput('Cervical Mucus', 'cmPost', null, ['Dry', 'Sticky', 'Creamy', 'Watery', 'Egg white']),
        createInput('Mood', 'mood', null, ['Calm', 'Happy', 'Irritable', 'Low']),
        createInput('Appetite/Digestion', 'appetite', null, ['Normal', 'Cravings', 'Nausea', 'Constipation']),
        createInput('Spotting', 'spotting', null, ['None', 'Pink', 'Brown', 'Red']),
        createInput('Cramps', 'cramps', null, ['None', 'Mild', 'Moderate', 'Strong']),
        createInput('Breast Changes', 'breast', null, ['None', 'Tender', 'Swollen', 'Nipple pain']),
        createInput('Frequent Urination', 'urination', null, ['No', 'Occasional', 'Frequent']),
        createInput('Pregnancy Test Taken', 'pregnancyTest', null, ['No', 'Yes']),
        createInput('Pregnancy Test Result', 'pregnancyResult', null, ['Negative', 'Faint Line', 'Positive'])
      ]);
    }
    return [];
  }

  function renderTracker() {
    app.innerHTML = '';
    const form = document.createElement('div');
    form.appendChild(createInput('Cycle Phase', 'phase', null, [
      'period', 'pre-ovulation', 'ovulation', 'post-ovulation'
    ]));

    const fieldContainer = document.createElement('div');
    form.appendChild(fieldContainer);

    form.querySelector('#phase').addEventListener('change', (e) => {
      fieldContainer.innerHTML = '';
      const phase = e.target.value;
      getFieldsForPhase(phase).forEach(field => fieldContainer.appendChild(field));
    });

    const saveBtn = document.createElement('button');
    saveBtn.textContent = 'Save Entry';
    saveBtn.onclick = () => {
      const inputs = form.querySelectorAll('input, select');
      const entry = {};
      inputs.forEach(i => entry[i.id] = i.value);
      localStorage.setItem(`cycleEntry-${entry.date}`, JSON.stringify(entry));
      alert('Saved!');
    };
    form.appendChild(saveBtn);
    app.appendChild(form);
  }

  function renderHistory() {
    app.innerHTML = '<h2>Cycle History</h2>';
    const table = document.createElement('table');
    const thead = document.createElement('thead');
    thead.innerHTML = '<tr><th>Date</th><th>Phase</th><th>Cycle Day</th></tr>';
    table.appendChild(thead);
    const tbody = document.createElement('tbody');
    Object.keys(localStorage).filter(k => k.startsWith('cycleEntry-')).sort().forEach(key => {
      const e = JSON.parse(localStorage.getItem(key));
      const row = document.createElement('tr');
      row.innerHTML = `<td>${e.date}</td><td>${e.phase}</td><td>${e.cycleDay || ''}</td>`;
      tbody.appendChild(row);
    });
    table.appendChild(tbody);
    app.appendChild(table);

    const btn = document.createElement('button');
    btn.textContent = 'Export as CSV';
    btn.onclick = () => {
      let csv = 'Date,Phase,Cycle Day\n';
      Object.keys(localStorage).filter(k => k.startsWith('cycleEntry-')).forEach(key => {
        const e = JSON.parse(localStorage.getItem(key));
        csv += `${e.date},${e.phase},${e.cycleDay || ''}\n`;
      });
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'cycle_data.csv';
      a.click();
      URL.revokeObjectURL(url);
    };
    app.appendChild(btn);
  }

  window.renderTracker = renderTracker;
  window.renderHistory = renderHistory;
  renderTracker();
});
