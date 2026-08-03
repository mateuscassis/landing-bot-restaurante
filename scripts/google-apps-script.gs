const SHEET_NAME = "players";

function normalizeRole_(role) {
  return String(role || "").toLowerCase() === "goleiro" ? "goleiro" : "linha";
}

function normalizeWeight_(weight) {
  var parsed = Number(weight);
  if (isNaN(parsed)) {
    return 5;
  }
  return Math.max(1, Math.min(10, parsed));
}

function normalizeRating_(value, fallback) {
  var parsed = Number(value);
  if (isNaN(parsed)) {
    return fallback;
  }
  return Math.max(1, Math.min(10, parsed));
}

function normalizeLinePosition_(position) {
  var normalized = String(position || "").toLowerCase();
  if (normalized === "defesa" || normalized === "meio" || normalized === "ataque") {
    return normalized;
  }
  return "meio";
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

    if (String(body.action || "") === "register_event") {
      const result = registerMatchEvent_(body);
      return jsonOutput_(result);
    }

    const players = Array.isArray(body.players) ? body.players : [];
    writePlayers_(players);
    return jsonOutput_({ ok: true, count: players.length });
  } catch (error) {
    return jsonOutput_({ ok: false, error: String(error) });
  }
}

function seedFromJson() {
  const seedPlayers = [
    { id: 1, name: "Lolis", goals: 0, assists: 2, championships: 0, speed: 5, finishing: 5, defense: 5, passing: 5, linePosition: "meio", role: "linha" },
    { id: 2, name: "Lisso", goals: 2, assists: 0, championships: 0, speed: 5, finishing: 5, defense: 5, passing: 5, linePosition: "meio", role: "linha" },
    { id: 3, name: "Neithan", goals: 0, assists: 0, championships: 0, speed: 5, finishing: 5, defense: 5, passing: 5, linePosition: "meio", role: "linha" },
    { id: 4, name: "Gab", goals: 2, assists: 0, championships: 0, speed: 5, finishing: 5, defense: 5, passing: 5, linePosition: "meio", role: "linha" },
    { id: 5, name: "Limite", goals: 0, assists: 0, championships: 0, speed: 5, finishing: 5, defense: 5, passing: 5, linePosition: "meio", role: "linha" },
    { id: 6, name: "Kadu", goals: 0, assists: 0, championships: 0, speed: 5, finishing: 5, defense: 5, passing: 5, linePosition: "meio", role: "linha" },
    { id: 7, name: "Geraldo", goals: 0, assists: 0, championships: 0, speed: 5, finishing: 5, defense: 5, passing: 5, linePosition: "meio", role: "linha" },
    { id: 8, name: "Mateus", goals: 0, assists: 0, championships: 0, speed: 5, finishing: 5, defense: 5, passing: 5, linePosition: "meio", role: "linha" },
    { id: 9, name: "Lucas", goals: 1, assists: 1, championships: 0, speed: 5, finishing: 5, defense: 5, passing: 5, linePosition: "meio", role: "linha" },
    { id: 10, name: "Baguete", goals: 0, assists: 0, championships: 0, speed: 5, finishing: 5, defense: 5, passing: 5, linePosition: "meio", role: "linha" },
    { id: 11, name: "Dibre", goals: 2, assists: 0, championships: 0, speed: 5, finishing: 5, defense: 5, passing: 5, linePosition: "meio", role: "linha" },
    { id: 12, name: "Flex", goals: 0, assists: 1, championships: 0, speed: 5, finishing: 5, defense: 5, passing: 5, linePosition: "meio", role: "linha" },
    { id: 13, name: "Mose", goals: 0, assists: 0, championships: 0, speed: 5, finishing: 5, defense: 5, passing: 5, linePosition: "meio", role: "linha" },
    { id: 14, name: "Farinha", goals: 1, assists: 1, championships: 0, speed: 5, finishing: 5, defense: 5, passing: 5, linePosition: "meio", role: "linha" },
    { id: 15, name: "Mesenha", goals: 0, assists: 0, championships: 0, speed: 5, finishing: 5, defense: 5, passing: 5, linePosition: "meio", role: "linha" },
    { id: 16, name: "Aranha", goals: 0, assists: 0, championships: 0, speed: 5, finishing: 5, defense: 5, passing: 5, linePosition: "meio", role: "linha" },
    { id: 17, name: "Kaue", goals: 1, assists: 1, championships: 0, speed: 5, finishing: 5, defense: 5, passing: 5, linePosition: "meio", role: "linha" },
    { id: 18, name: "Misto", goals: 1, assists: 2, championships: 0, speed: 5, finishing: 5, defense: 5, passing: 5, linePosition: "meio", role: "linha" },
    { id: 19, name: "Medina", goals: 2, assists: 0, championships: 0, speed: 5, finishing: 5, defense: 5, passing: 5, linePosition: "meio", role: "linha" }
  ];
  writePlayers_(seedPlayers);
}



function normalizeNameKey_(name) {
  return String(name || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function findPlayerIndexByName_(players, name) {
  var target = normalizeNameKey_(name);
  if (!target) {
    return -1;
  }

  for (var i = 0; i < players.length; i += 1) {
    if (normalizeNameKey_(players[i].name) === target) {
      return i;
    }
  }

  return -1;
}

function registerMatchEvent_(payload) {
  var expectedSecret = PropertiesService.getScriptProperties().getProperty("WEBHOOK_SECRET") || "";
  if (expectedSecret && String(payload.secret || "") !== expectedSecret) {
    throw new Error("Invalid webhook secret");
  }

  var scorerName = String(payload.scorerName || "").trim();
  var assistName = String(payload.assistName || "").trim();
  var messageId = String(payload.messageId || "").trim();

  if (!scorerName) {
    throw new Error("scorerName is required");
  }

  var scriptProps = PropertiesService.getScriptProperties();
  if (messageId) {
    var dedupeKey = "whatsapp_event_" + messageId;
    if (scriptProps.getProperty(dedupeKey)) {
      return { ok: true, duplicate: true, messageId: messageId };
    }
  }

  var players = readPlayers_();
  var scorerIndex = findPlayerIndexByName_(players, scorerName);
  if (scorerIndex < 0) {
    return { ok: false, error: "Scorer not found", scorerName: scorerName };
  }

  players[scorerIndex].goals = Number(players[scorerIndex].goals || 0) + 1;

  var assistApplied = false;
  if (assistName) {
    var assistIndex = findPlayerIndexByName_(players, assistName);
    if (assistIndex >= 0) {
      players[assistIndex].assists = Number(players[assistIndex].assists || 0) + 1;
      assistApplied = true;
    }
  }

  writePlayers_(players);

  if (messageId) {
    scriptProps.setProperty("whatsapp_event_" + messageId, new Date().toISOString());
  }

  return {
    ok: true,
    scorerName: players[scorerIndex].name,
    assistName: assistApplied ? assistName : "",
    assistApplied: assistApplied,
    messageId: messageId || "",
  };
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
  const speedIndex = headers.indexOf("speed");
  const finishingIndex = headers.indexOf("finishing");
  const attackIndex = headers.indexOf("attack");
  const defenseIndex = headers.indexOf("defense");
  const passingIndex = headers.indexOf("passing");
  const linePositionIndex = headers.indexOf("lineposition");
  const positionIndex = headers.indexOf("position");
  const weightIndex = headers.indexOf("weight");
  const roleIndex = headers.indexOf("role");

  const safeIdIndex = idIndex >= 0 ? idIndex : 0;
  const safeNameIndex = nameIndex >= 0 ? nameIndex : 1;
  const safeGoalsIndex = goalsIndex >= 0 ? goalsIndex : 2;
  const safeAssistsIndex = assistsIndex >= 0 ? assistsIndex : 3;
  const safeChampionshipsIndex = championshipsIndex >= 0 ? championshipsIndex : 4;
  const safeSpeedIndex = speedIndex >= 0 ? speedIndex : -1;
  const safeFinishingIndex = finishingIndex >= 0 ? finishingIndex : -1;
  const safeAttackIndex = attackIndex >= 0 ? attackIndex : -1;
  const safeDefenseIndex = defenseIndex >= 0 ? defenseIndex : -1;
  const safePassingIndex = passingIndex >= 0 ? passingIndex : -1;
  const safeLinePositionIndex = linePositionIndex >= 0 ? linePositionIndex : (positionIndex >= 0 ? positionIndex : -1);
  const safeWeightIndex = weightIndex >= 0 ? weightIndex : -1;

  return data.slice(1).filter(function(row) {
    return String(row[safeNameIndex]).trim() !== "";
  }).map(function(row) {
    var legacyWeight = normalizeWeight_(safeWeightIndex >= 0 ? row[safeWeightIndex] : 5);
    var legacyAttack = normalizeRating_(safeAttackIndex >= 0 ? row[safeAttackIndex] : legacyWeight, legacyWeight);
    var legacyDefense = normalizeRating_(safeDefenseIndex >= 0 ? row[safeDefenseIndex] : legacyWeight, legacyWeight);
    return {
      id: Number(row[safeIdIndex]) || 0,
      name: String(row[safeNameIndex] || ""),
      goals: Number(row[safeGoalsIndex]) || 0,
      assists: Number(row[safeAssistsIndex]) || 0,
      championships: Number(row[safeChampionshipsIndex]) || 0,
      speed: normalizeRating_(safeSpeedIndex >= 0 ? row[safeSpeedIndex] : legacyAttack, legacyAttack),
      finishing: normalizeRating_(safeFinishingIndex >= 0 ? row[safeFinishingIndex] : legacyAttack, legacyAttack),
      defense: normalizeRating_(safeDefenseIndex >= 0 ? row[safeDefenseIndex] : legacyDefense, legacyDefense),
      passing: normalizeRating_(safePassingIndex >= 0 ? row[safePassingIndex] : (legacyAttack + legacyDefense) / 2, 5),
      linePosition: normalizeLinePosition_(safeLinePositionIndex >= 0 ? row[safeLinePositionIndex] : "meio"),
      role: normalizeRole_(roleIndex >= 0 ? row[roleIndex] : "linha"),
    };
  });
}

function writePlayers_(players) {
  const sheet = getSheet_();
  sheet.clearContents();
  sheet.appendRow(["id", "name", "goals", "assists", "championships", "speed", "finishing", "defense", "passing", "linePosition", "role"]);

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
      normalizeRating_(player.speed, 5),
      normalizeRating_(player.finishing, 5),
      normalizeRating_(player.defense, 5),
      normalizeRating_(player.passing, 5),
      normalizeLinePosition_(player.linePosition),
      normalizeRole_(player.role),
    ];
  });

  sheet.getRange(2, 1, rows.length, 11).setValues(rows);
}

function getSheet_() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = spreadsheet.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = spreadsheet.insertSheet(SHEET_NAME);
  }

  if (sheet.getLastRow() === 0) {
    sheet.appendRow(["id", "name", "goals", "assists", "championships", "speed", "finishing", "defense", "passing", "linePosition", "role"]);
  }

  return sheet;
}

function jsonOutput_(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}
