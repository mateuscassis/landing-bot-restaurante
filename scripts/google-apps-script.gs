const SHEET_NAME = "players";

function normalizeRole_(role) {
  return String(role || "").toLowerCase() === "goleiro" ? "goleiro" : "linha";
}

function normalizeWeight_(weight) {
  var parsed = Number(weight);
  if (isNaN(parsed)) {
    return 3;
  }
  return Math.max(1, Math.min(5, parsed));
}

function doGet() {
  try {
    const players = readPlayers_();
    return jsonOutput_({ players: players });
  } catch (error) {
    return jsonOutput_({ error: String(error) });
  }
}

function doPost(e) {
  try {
    const body = JSON.parse((e && e.postData && e.postData.contents) || "{}");
    const players = Array.isArray(body.players) ? body.players : [];
    writePlayers_(players);
    return jsonOutput_({ ok: true, count: players.length });
  } catch (error) {
    return jsonOutput_({ ok: false, error: String(error) });
  }
}

function seedFromJson() {
  const seedPlayers = [
    { id: 1, name: "Lolis", goals: 0, assists: 2, championships: 0, weight: 3, role: "linha" },
    { id: 2, name: "Lisso", goals: 2, assists: 0, championships: 0, weight: 3, role: "linha" },
    { id: 3, name: "Neithan", goals: 0, assists: 0, championships: 0, weight: 3, role: "linha" },
    { id: 4, name: "Gab", goals: 2, assists: 0, championships: 0, weight: 3, role: "linha" },
    { id: 5, name: "Limite", goals: 0, assists: 0, championships: 0, weight: 3, role: "linha" },
    { id: 6, name: "Kadu", goals: 0, assists: 0, championships: 0, weight: 3, role: "linha" },
    { id: 7, name: "Geraldo", goals: 0, assists: 0, championships: 0, weight: 3, role: "linha" },
    { id: 8, name: "Mateus", goals: 0, assists: 0, championships: 0, weight: 3, role: "linha" },
    { id: 9, name: "Lucas", goals: 1, assists: 1, championships: 0, weight: 3, role: "linha" },
    { id: 10, name: "Baguete", goals: 0, assists: 0, championships: 0, weight: 3, role: "linha" },
    { id: 11, name: "Dibre", goals: 2, assists: 0, championships: 0, weight: 3, role: "linha" },
    { id: 12, name: "Flex", goals: 0, assists: 1, championships: 0, weight: 3, role: "linha" },
    { id: 13, name: "Mose", goals: 0, assists: 0, championships: 0, weight: 3, role: "linha" },
    { id: 14, name: "Farinha", goals: 1, assists: 1, championships: 0, weight: 3, role: "linha" },
    { id: 15, name: "Mesenha", goals: 0, assists: 0, championships: 0, weight: 3, role: "linha" },
    { id: 16, name: "Aranha", goals: 0, assists: 0, championships: 0, weight: 3, role: "linha" },
    { id: 17, name: "Kaue", goals: 1, assists: 1, championships: 0, weight: 3, role: "linha" },
    { id: 18, name: "Misto", goals: 1, assists: 2, championships: 0, weight: 3, role: "linha" },
    { id: 19, name: "Medina", goals: 2, assists: 0, championships: 0, weight: 3, role: "linha" }
  ];
  writePlayers_(seedPlayers);
}

function readPlayers_() {
  const sheet = getSheet_();
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) {
    return [];
  }

  const headers = data[0].map(function(header) {
    return String(header || "").trim().toLowerCase();
  });

  const idIndex = headers.indexOf("id");
  const nameIndex = headers.indexOf("name");
  const goalsIndex = headers.indexOf("goals");
  const assistsIndex = headers.indexOf("assists");
  const championshipsIndex = headers.indexOf("championships");
  const weightIndex = headers.indexOf("weight");
  const roleIndex = headers.indexOf("role");

  const safeIdIndex = idIndex >= 0 ? idIndex : 0;
  const safeNameIndex = nameIndex >= 0 ? nameIndex : 1;
  const safeGoalsIndex = goalsIndex >= 0 ? goalsIndex : 2;
  const safeAssistsIndex = assistsIndex >= 0 ? assistsIndex : 3;
  const safeChampionshipsIndex = championshipsIndex >= 0 ? championshipsIndex : 4;
  const safeWeightIndex = weightIndex >= 0 ? weightIndex : -1;

  return data.slice(1).filter(function(row) {
    return String(row[safeNameIndex]).trim() !== "";
  }).map(function(row) {
    return {
      id: Number(row[safeIdIndex]) || 0,
      name: String(row[safeNameIndex] || ""),
      goals: Number(row[safeGoalsIndex]) || 0,
      assists: Number(row[safeAssistsIndex]) || 0,
      championships: Number(row[safeChampionshipsIndex]) || 0,
      weight: normalizeWeight_(safeWeightIndex >= 0 ? row[safeWeightIndex] : 3),
      role: normalizeRole_(roleIndex >= 0 ? row[roleIndex] : "linha"),
    };
  });
}

function writePlayers_(players) {
  const sheet = getSheet_();
  sheet.clearContents();
  sheet.appendRow(["id", "name", "goals", "assists", "championships", "weight", "role"]);

  if (!players.length) {
    return;
  }

  const rows = players.map(function(player, index) {
    return [
      Number(player.id) || index + 1,
      String(player.name || ""),
      Number(player.goals) || 0,
      Number(player.assists) || 0,
      Number(player.championships) || 0,
      normalizeWeight_(player.weight),
      normalizeRole_(player.role),
    ];
  });

  sheet.getRange(2, 1, rows.length, 7).setValues(rows);
}

function getSheet_() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = spreadsheet.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = spreadsheet.insertSheet(SHEET_NAME);
  }

  if (sheet.getLastRow() === 0) {
    sheet.appendRow(["id", "name", "goals", "assists", "championships", "weight", "role"]);
  }

  return sheet;
}

function jsonOutput_(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}
