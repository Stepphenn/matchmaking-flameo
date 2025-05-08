const players = [];
let sheetPlayers = []; // Simpan data dari Google Sheets
let courtMatches = {}; // Menyimpan match per court
const matchHistory = new Set(); // Menyimpan pasangan yang sudah pernah bermain
const teamHistory = new Set();


const SHEET_API_URL = 'https://script.google.com/macros/s/AKfycbweiR4a730izHUTAddfjTKohV0WNjTcX9CEObaCK65GzmaHiv8R8N8i2rDXnmZwZlrt/exec';

$(document).ready(function () {
  loadPlayersFromSheet();
  loadListPemain();
});

// 🔄 Ambil data pemain dari Google Sheets
function loadPlayersFromSheet() {
  $.get(SHEET_API_URL, function (data) {
    if (Array.isArray(data)) {
      sheetPlayers = data; // Simpan ke memori lokal

      const options = data.map(p => ({
        id: JSON.stringify(p),
        text: `${p.name} (Level ${p.level})`
      }));

      $('#search-player').empty().select2({
        data: [{ id: '', text: 'Pilih pemain...' }, ...options],
        placeholder: 'Ketik nama pemain untuk mencari...',
        allowClear: true,
        minimumInputLength: 1
      });
    } else {
      alert("Gagal memuat data dari Google Sheets.");
    }
  });
}

// ➕ Tambah pemain baru ke Google Sheets
document.getElementById('player-form').addEventListener('submit', function (e) {
  e.preventDefault();
  const name = document.getElementById('player-name').value.trim();
  const level = parseInt(document.getElementById('player-level').value);

  if (!name || isNaN(level) || level < 1 || level > 100) {
    alert('Nama harus diisi dan level harus angka antara 1-100.');
    return;
  }

  // Cek duplikat di sheet
  if (sheetPlayers.some(p => p.name.toLowerCase() === name.toLowerCase())) {
    alert('Pemain sudah ada di database.');
    return;
  }

  $.post(SHEET_API_URL, { name, level })
    .done(() => {
      alert(`Pemain ${name} (Level ${level}) berhasil ditambahkan.`);
      this.reset();
      loadPlayersFromSheet(); // Refresh data dari sheet
    })
    .fail(() => {
      alert('Gagal menyimpan pemain ke Google Sheets.');
    });
});

// ➕ Tambah pemain dari dropdown ke daftar lokal
document.getElementById('add-selected-player').addEventListener('click', () => {
  const selected = $('#search-player').val();
  if (!selected) return;

  let player;
  try {
    player = JSON.parse(selected);
  } catch {
    alert('Gagal membaca data pemain.');
    return;
  }

  // Simpan ke sheet "List Pemain" SAJA, tanpa dimasukkan ke daftar lokal
  $.post(SHEET_API_URL, {
    name: player.name,
    level: player.level,
    targetSheet: 'List Pemain'
  })
  .done(() => {
    alert(`Pemain ${player.name} berhasil ditambahkan ke List Pemain.`);
    loadListPemain(); // Refresh tampilan daftar
  })
  .fail(() => {
    alert('Gagal menyimpan ke sheet List Pemain.');
  });

  $('#search-player').val(null).trigger('change');
});

// 📝 Tampilkan daftar pemain lokal
function updatePlayerList() {
  const list = document.getElementById('player-list');
  list.innerHTML = '';
  players.forEach((p, i) => {
    const li = document.createElement('li');
    li.textContent = `${i + 1}. ${p.name} (Level ${p.level})`;
    list.appendChild(li);
  });
}

function loadListPemain() {
  $.get(SHEET_API_URL + '?targetSheet=List Pemain', function (data) {
    if (Array.isArray(data)) {
      // Pastikan semua data memiliki kolom "match", jika kosong set ke 0
      data.forEach(p => p.match = parseInt(p.match || 0));
      
      // Urutkan pemain berdasarkan jumlah match yang lebih sedikit (ascending)
      data.sort((a, b) => a.match - b.match);

      // Update daftar pemain di UI
      const list = document.getElementById('player-list');
      list.innerHTML = '';
      data.forEach((p, i) => {
        const li = document.createElement('li');
        li.textContent = `${i + 1}. ${p.name} (Level ${p.level}, Match: ${p.match})`;
        list.appendChild(li);
      });
    } else {
      alert('Gagal memuat daftar pemain.');
    }
  });
}

document.getElementById('clear-list').addEventListener('click', function () {
  if (!confirm('Yakin ingin menghapus semua pemain dari List Pemain?')) return;

  $.post(SHEET_API_URL, { 
    action: 'delete', 
    targetSheet: 'List Pemain' 
  })
  .done(() => {
    alert('Semua pemain telah dihapus dari List Pemain.');
    loadListPemain(); // Refresh tampilan
    document.getElementById('match-results').innerHTML = ''; // Kosongkan hasil match
  })
  .fail(() => {
    alert('Gagal menghapus data.');
  });
});

function hasPlayedTogether(p1, p2) {
  const key = [p1.name, p2.name].sort().join('|');
  return matchHistory.has(key);
}

function markAsPlayed(p1, p2) {
  const key = [p1.name, p2.name].sort().join('|');
  matchHistory.add(key);
}

function generateMatch(players, courtCount) {
  const availableCourts = [];
  for (let i = 1; i <= courtCount; i++) {
    if (!courtMatches[i]) availableCourts.push(i);
  }

  // Prioritaskan pemain dengan match sedikit dan sort berdasarkan level
  const sortedPlayers = players.sort((a, b) => {
    // Prioritaskan match lebih sedikit
    const matchCountA = a.match || 0;
    const matchCountB = b.match || 0;
    if (matchCountA !== matchCountB) return matchCountA - matchCountB;

    // Jika match sama, urutkan berdasarkan level
    return a.level - b.level;
  });

  const activePlayers = getActivePlayers();
  let availablePlayers = sortedPlayers.filter(p => !activePlayers.has(p.name));
  let unused = [...availablePlayers];

  const usedPlayers = new Set();

  for (let court of availableCourts) {
    if (unused.length < 4) break;

    let bestMatch = null;
    let smallestDiff = Infinity;

    for (let i = 0; i < unused.length - 3; i++) {
      for (let j = i + 1; j < unused.length - 2; j++) {
        for (let k = j + 1; k < unused.length - 1; k++) {
          for (let l = k + 1; l < unused.length; l++) {
            const group = [unused[i], unused[j], unused[k], unused[l]];

            const combos = [
              [[group[0], group[1]], [group[2], group[3]]],
              [[group[0], group[2]], [group[1], group[3]]],
              [[group[0], group[3]], [group[1], group[2]]]
            ];

            for (let [team1, team2] of combos) {
              const pair1 = team1.map(p => p.name).sort().join('|');
              const pair2 = team2.map(p => p.name).sort().join('|');

              if (teamHistory.has(pair1) || teamHistory.has(pair2)) {
                continue; // skip pasangan yang sudah pernah
              }

              const level1 = team1[0].level + team1[1].level;
              const level2 = team2[0].level + team2[1].level;
              const diff = Math.abs(level1 - level2);

              if (diff < smallestDiff) {
                smallestDiff = diff;
                bestMatch = { team1, team2, group, pair1, pair2 };
              }
            }
          }
        }
      }
    }

    if (bestMatch) {
      courtMatches[court] = {
        team1: bestMatch.team1,
        team2: bestMatch.team2
      };

      bestMatch.group.forEach(p => usedPlayers.add(p.name));
      unused = unused.filter(p => !usedPlayers.has(p.name));

      // 🔒 Simpan ke history agar tidak dipasangkan lagi
      teamHistory.add(bestMatch.pair1);
      teamHistory.add(bestMatch.pair2);
    }
  }

  renderCourts();
}

function renderCourts() {
  const container = document.getElementById('match-results');
  container.innerHTML = '';

  Object.entries(courtMatches).forEach(([courtNumber, match]) => {
    const div = document.createElement('div');
    div.className = 'court';
    div.id = `court-${courtNumber}`;
    
    div.innerHTML = `
      <h4>Court ${courtNumber}</h4>
      <div class="player-pair">
        ${match.team1[0].name}    /   
        ${match.team1[1].name}
      </div>
      <div class="vs-text">VS</div>
      <div class="player-pair">
        ${match.team2[0].name}    /   
        ${match.team2[1].name}
      </div>
      <button onclick="finishMatch(${courtNumber})" style="margin-top: 10px;">Match Selesai</button>
    `;

    container.appendChild(div);
  });
}

function finishMatch(courtNumber) {
  const match = courtMatches[courtNumber];
  if (!match) return;

  const players = [...match.team1, ...match.team2];
  const names = players.map(p => p.name);

  // Kirim data ke Google Sheets untuk update kolom Match
  $.post(SHEET_API_URL, {
    action: 'incrementMatch',
    targetSheet: 'List Pemain',
    names: JSON.stringify(names)
  })
  .done(() => {
    console.log("Match count updated");
    loadListPemain(); // refresh daftar
  })
  .fail(() => {
    alert('Gagal update jumlah match.');
  });

  delete courtMatches[courtNumber];
  const courtDiv = document.getElementById(`court-${courtNumber}`);
  if (courtDiv) courtDiv.remove();
}

document.getElementById('match-btn').addEventListener('click', () => {
  const courtCount = parseInt(document.getElementById('court-count').value);
  
  $.get(SHEET_API_URL + '?targetSheet=List Pemain', function (data) {
    if (Array.isArray(data)) {
      generateMatch(data, courtCount);
    } else {
      alert('Gagal memuat daftar pemain.');
    }
  });
});

function getActivePlayers() {
  const active = new Set();
  Object.values(courtMatches).forEach(match => {
    [...match.team1, ...match.team2].forEach(p => active.add(p.name));
  });
  return active;
}