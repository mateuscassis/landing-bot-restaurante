const SHEET_NAME = "players";

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
    { id: 1, name: "Lolis", goals: 0, assists: 2, championships: 0 },
    { id: 2, name: "Lisso", goals: 2, assists: 0, championships: 0 },
    { id: 3, name: "Neithan", goals: 0, assists: 0, championships: 0 },
    { id: 4, name: "Gab", goals: 2, assists: 0, championships: 0 },
    { id: 5, name: "Limite", goals: 0, assists: 0, championships: 0 },
    { id: 6, name: "Kadu", goals: 0, assists: 0, championships: 0 },
    { id: 7, name: "Geraldo", goals: 0, assists: 0, championships: 0 },
    { id: 8, name: "Mateus", goals: 0, assists: 0, championships: 0 },
    { id: 9, name: "Lucas", goals: 1, assists: 1, championships: 0 },
    { id: 10, name: "Baguete", goals: 0, assists: 0, championships: 0 },
    { id: 11, name: "Dibre", goals: 1, assists: 0, championships: 0 },
    { id: 12, name: "Flex", goals: 0, assists: 1, championships: 0 },
    { id: 13, name: "Mose", goals: 0, assists: 0, championships: 0 },
    { id: 14, name: "Farinha", goals: 1, assists: 1, championships: 0 },
    { id: 15, name: "Mesenha", goals: 0, assists: 0, championships: 0 },
    { id: 16, name: "Aranha", goals: 0, assists: 0, championships: 0 },
    { id: 17, name: "Kaue", goals: 1, assists: 1, championships: 0 },
    { id: 18, name: "Misto", goals: 0, assists: 2, championships: 0 },
    { id: 19, name: "Medina", goals: 2, assists: 0, championships: 0 }
  ];
  writePlayers_(seedPlayers);
}

function readPlayers_() {
  const sheet = getSheet_();
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) {
    return [];
  }

  return data.slice(1).filter(function(row) {
    return String(row[1]).trim() !== "";
  }).map(function(row) {
    return {
      id: Number(row[0]) || 0,
      name: String(row[1] || ""),
      goals: Number(row[2]) || 0,
      assists: Number(row[3]) || 0,
      championships: Number(row[4]) || 0,
    };
  });
}

function writePlayers_(players) {
  const sheet = getSheet_();
  sheet.clearContents();
  sheet.appendRow(["id", "name", "goals", "assists", "championships"]);

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
    ];
  });

  sheet.getRange(2, 1, rows.length, 5).setValues(rows);
}

function getSheet_() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = spreadsheet.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = spreadsheet.insertSheet(SHEET_NAME);
  }

  if (sheet.getLastRow() === 0) {
    sheet.appendRow(["id", "name", "goals", "assists", "championships"]);
  }

  return sheet;
}

function jsonOutput_(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}
