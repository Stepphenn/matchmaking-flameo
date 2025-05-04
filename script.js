const SHEET_WEBAPP_URL = 'https://script.google.com/macros/s/AKfycbzhCA3RanX0ycM8ET7BD_9N9QrYljhKZmJD0d_Y-WKtPa2Ww_c0n1sEv7HPJjqb1O8R/exec';

const players = [];
const matchHistory = [];

document.getElementById('player-form').addEventListener('submit', function(e) {
  e.preventDefault();
  const name = document.getElementById('player-name').value.trim();
  const level = parseInt(document.getElementById('player-level').value);
  if (name && level >= 1 && level <= 100) {
    const player = { name, level };
    players.push(player);
    alert(`Pemain ${name} (Level ${level}) ditambahkan.`);
    updatePlayerList();
    this.reset();

    // Kirim ke Google Sheets
    fetch(SHEET_WEBAPP_URL, {
      method: 'POST',
      body: JSON.stringify(player),
      headers: { 'Content-Type': 'application/json' }
    })
    .then(res => res.text())
    .then(response => console.log('Google Sheets:', response))
    .catch(err => console.error('Error kirim ke Sheets:', err));
  }
});

document.getElementById('match-btn').addEventListener('click', function() {
  const matchCopy = JSON.parse(JSON.stringify(players));
  const matches = generateMatches(matchCopy, matchHistory, 6);
  displayMatches(matches);
});

function updatePlayerList() {
  const list = document.getElementById('player-list');
  list.innerHTML = '';
  players.forEach((p, index) => {
    const li = document.createElement('li');
    li.textContent = `${index + 1}. ${p.name} (Level ${p.level})`;
    list.appendChild(li);
  });
}

function generateMatches(players, history, maxCourts = 6) {
  players.sort((a, b) => b.level - a.level);
  const matches = [];

  while (players.length >= 4 && matches.length < maxCourts) {
    let bestMatch = null;
    let minDiff = Infinity;

    for (let i = 0; i < players.length; i++) {
      for (let j = i + 1; j < players.length; j++) {
        for (let k = 0; k < players.length; k++) {
          if (k === i || k === j) continue;
          for (let l = k + 1; l < players.length; l++) {
            if (l === i || l === j) continue;
            const team1 = [players[i], players[j]];
            const team2 = [players[k], players[l]];
            if (hasPlayedTogether(team1, history) || hasPlayedTogether(team2, history)) continue;
            const diff = Math.abs((team1[0].level + team1[1].level) - (team2[0].level + team2[1].level));
            if (diff < minDiff) {
              minDiff = diff;
              bestMatch = [team1, team2];
            }
          }
        }
      }
    }

    if (bestMatch) {
      matches.push(bestMatch);
      matchHistory.push(bestMatch.flat());
      bestMatch.flat().forEach(p => {
        const index = players.findIndex(x => x.name === p.name);
        if (index !== -1) players.splice(index, 1);
      });
    } else {
      break;
    }
  }

  return matches;
}

function hasPlayedTogether(team, history) {
  return history.some(pair => team.every(p => pair.some(x => x.name === p.name)));
}

function displayMatches(matches) {
  const resultDiv = document.getElementById('match-results');
  resultDiv.innerHTML = '';
  matches.forEach((match, index) => {
    const div = document.createElement('div');
    div.className = 'court';
    div.innerHTML = `
      <strong>Court ${index + 1}</strong><br>
      Team A: ${match[0].map(p => p.name + ' (' + p.level + ')').join(' & ')}<br>
      VS<br>
      Team B: ${match[1].map(p => p.name + ' (' + p.level + ')').join(' & ')}
    `;
    resultDiv.appendChild(div);
  });
}
