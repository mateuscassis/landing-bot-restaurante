import { PHOTO_BACKGROUNDS } from "./backgrounds";
import { TEAM_COLORS } from "./tournament";

// Draws the weekly teams into a 1080x1350 image (WhatsApp friendly) and opens the share sheet,
// or downloads the file when sharing files is not supported. Each export picks a random theme
// and caption; an optional photo chosen by the user replaces the themed background.

const WIDTH = 1080;
const HEIGHT = 1350;
const PHOTO_CHANCE = 0.75;

const CAPTIONS = [
  "Escalação aprovada pelo VAR",
  "Sorteio 100% honesto (confia)",
  "Quem perder paga a cerveja",
  "Reclamação só depois do primeiro gol",
  "O técnico é o algoritmo. Reclama com ele",
  "Hoje tem caneta, chapéu e resenha",
  "Nenhum time foi ajudado. Talvez um",
  "Joga bonito ou joga no gol",
];

const POSITION_LABELS = { defesa: "DEF", meio: "MEI", ataque: "ATA" };
const TIER_COLORS = { gold: "#f5c842", silver: "#c9d1de", bronze: "#cd8a4f" };

function pick(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

function roundRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + width, y, x + width, y + height, radius);
  ctx.arcTo(x + width, y + height, x, y + height, radius);
  ctx.arcTo(x, y + height, x, y, radius);
  ctx.arcTo(x, y, x + width, y, radius);
  ctx.closePath();
}

function fitText(ctx, text, maxWidth) {
  if (ctx.measureText(text).width <= maxWidth) {
    return text;
  }
  let trimmed = text;
  while (trimmed.length > 1 && ctx.measureText(`${trimmed}…`).width > maxWidth) {
    trimmed = trimmed.slice(0, -1);
  }
  return `${trimmed}…`;
}

const THEMES = [
  {
    name: "estadio",
    draw(ctx) {
      const sky = ctx.createLinearGradient(0, 0, 0, HEIGHT);
      sky.addColorStop(0, "#050914");
      sky.addColorStop(0.55, "#0c1f17");
      sky.addColorStop(1, "#0f3a22");
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, WIDTH, HEIGHT);
      // Floodlight beams
      [[120, -40], [960, -40]].forEach(([x, y]) => {
        const beam = ctx.createRadialGradient(x, y, 10, x, y, 900);
        beam.addColorStop(0, "rgba(255,255,230,0.35)");
        beam.addColorStop(1, "rgba(255,255,230,0)");
        ctx.fillStyle = beam;
        ctx.fillRect(0, 0, WIDTH, HEIGHT);
      });
    },
  },
  {
    name: "gramado",
    draw(ctx) {
      for (let i = 0; i < 12; i += 1) {
        ctx.fillStyle = i % 2 ? "#1d6b34" : "#1a5f2e";
        ctx.fillRect(0, (HEIGHT / 12) * i, WIDTH, HEIGHT / 12 + 1);
      }
      ctx.strokeStyle = "rgba(255,255,255,0.18)";
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.arc(WIDTH / 2, HEIGHT / 2, 170, 0, Math.PI * 2);
      ctx.moveTo(0, HEIGHT / 2);
      ctx.lineTo(WIDTH, HEIGHT / 2);
      ctx.stroke();
    },
  },
  {
    name: "ouro",
    draw(ctx) {
      const gold = ctx.createLinearGradient(0, 0, WIDTH, HEIGHT);
      gold.addColorStop(0, "#2a1f05");
      gold.addColorStop(0.5, "#5c4410");
      gold.addColorStop(1, "#140f03");
      ctx.fillStyle = gold;
      ctx.fillRect(0, 0, WIDTH, HEIGHT);
      ctx.strokeStyle = "rgba(245,200,66,0.12)";
      ctx.lineWidth = 3;
      for (let x = -HEIGHT; x < WIDTH; x += 48) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x + HEIGHT, HEIGHT);
        ctx.stroke();
      }
    },
  },
  {
    name: "neon",
    draw(ctx) {
      ctx.fillStyle = "#07060f";
      ctx.fillRect(0, 0, WIDTH, HEIGHT);
      [["#ff2d95", 200, 260], ["#2de2ff", 880, 1100], ["#8a2dff", 540, 700]].forEach(([color, x, y]) => {
        const glow = ctx.createRadialGradient(x, y, 0, x, y, 520);
        glow.addColorStop(0, `${color}55`);
        glow.addColorStop(1, `${color}00`);
        ctx.fillStyle = glow;
        ctx.fillRect(0, 0, WIDTH, HEIGHT);
      });
    },
  },
];

function drawPhotoBackground(ctx, image) {
  const scale = Math.max(WIDTH / image.width, HEIGHT / image.height);
  const width = image.width * scale;
  const height = image.height * scale;
  ctx.drawImage(image, (WIDTH - width) / 2, (HEIGHT - height) / 2, width, height);
}

function drawTeamCard(ctx, team, color, x, y, width, height, helpers) {
  ctx.save();
  roundRect(ctx, x, y, width, height, 28);
  ctx.fillStyle = "rgba(10, 12, 20, 0.82)";
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.strokeStyle = color;
  ctx.stroke();

  // Header band
  ctx.save();
  roundRect(ctx, x, y, width, 96, 28);
  ctx.clip();
  ctx.fillStyle = color;
  ctx.fillRect(x, y, width, 96);
  ctx.restore();

  ctx.fillStyle = "#111";
  ctx.font = '64px "Bebas Neue", Arial, sans-serif';
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  ctx.fillText(team.name.toUpperCase(), x + 28, y + 52);
  ctx.font = '700 28px "Montserrat", Arial, sans-serif';
  ctx.textAlign = "right";
  ctx.fillText(`OVR ${team.ovr}`, x + width - 28, y + 50);

  const rowHeight = (height - 96 - 24) / Math.max(4, team.players.length);
  team.players.forEach((player, index) => {
    const rowY = y + 96 + 12 + rowHeight * index + rowHeight / 2;
    const tierColor = TIER_COLORS[helpers.getCardTier(player)] || TIER_COLORS.silver;

    roundRect(ctx, x + 24, rowY - 26, 72, 52, 12);
    ctx.fillStyle = tierColor;
    ctx.fill();
    ctx.fillStyle = "#111";
    ctx.font = '40px "Bebas Neue", Arial, sans-serif';
    ctx.textAlign = "center";
    ctx.fillText(String(helpers.displayOVR(player)), x + 60, rowY + 2);

    ctx.fillStyle = "#f2f4fa";
    ctx.font = '700 34px "Montserrat", Arial, sans-serif';
    ctx.textAlign = "left";
    ctx.fillText(fitText(ctx, player.name, width - 220), x + 116, rowY + 2);

    ctx.fillStyle = "rgba(255,255,255,0.55)";
    ctx.font = '600 22px "Montserrat", Arial, sans-serif';
    ctx.textAlign = "right";
    ctx.fillText(POSITION_LABELS[player.linePosition] || "", x + width - 28, rowY + 2);
  });
  ctx.restore();
}

async function renderTeamsImage(teams, keepers, backgroundSrc, helpers) {
  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext("2d");

  try {
    await Promise.all([
      document.fonts.load('64px "Bebas Neue"'),
      document.fonts.load('700 34px "Montserrat"'),
    ]);
  } catch {
    // Fall back to system fonts.
  }

  // A photo chosen by the user wins; otherwise most exports get a random stadium/player photo and
  // the rest a drawn theme.
  const stockPhoto = !backgroundSrc && Math.random() < PHOTO_CHANCE ? pick(PHOTO_BACKGROUNDS) : null;
  let usedPhoto = false;
  let photoCredit = "";
  const photoSrc = backgroundSrc || stockPhoto?.src;
  if (photoSrc) {
    try {
      drawPhotoBackground(ctx, await loadImage(photoSrc));
      usedPhoto = true;
      photoCredit = stockPhoto ? `Foto: ${stockPhoto.credit} · ${stockPhoto.license} · Wikimedia Commons` : "";
    } catch {
      usedPhoto = false;
    }
  }
  if (!usedPhoto) {
    pick(THEMES).draw(ctx);
  }

  // Darken the edges so text stays readable on any background.
  const shade = ctx.createLinearGradient(0, 0, 0, HEIGHT);
  shade.addColorStop(0, "rgba(0,0,0,0.65)");
  shade.addColorStop(0.25, "rgba(0,0,0,0.2)");
  shade.addColorStop(0.8, "rgba(0,0,0,0.2)");
  shade.addColorStop(1, "rgba(0,0,0,0.75)");
  ctx.fillStyle = shade;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#f5c842";
  ctx.font = '120px "Bebas Neue", Arial, sans-serif';
  ctx.fillText("FUT DE TERÇA", WIDTH / 2, 110);
  ctx.fillStyle = "#ffffff";
  ctx.font = '600 30px "Montserrat", Arial, sans-serif';
  const today = new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long" });
  ctx.fillText(`Times da semana · ${today}`, WIDTH / 2, 190);

  const decorated = teams.map((team, index) => ({
    ...team,
    color: TEAM_COLORS[index % TEAM_COLORS.length],
    ovr: Math.round(team.players.reduce((sum, player) => sum + helpers.displayOVR(player), 0) / Math.max(1, team.players.length)),
  }));

  const gap = 32;
  const margin = 48;
  const top = 240;
  const columns = 2;
  const rows = Math.ceil(decorated.length / columns);
  const cardWidth = (WIDTH - margin * 2 - gap) / columns;
  const cardHeight = Math.min(420, (HEIGHT - top - 200 - gap * (rows - 1)) / rows);
  decorated.forEach((team, index) => {
    const column = index % columns;
    const row = Math.floor(index / columns);
    drawTeamCard(ctx, team, team.color, margin + column * (cardWidth + gap), top + row * (cardHeight + gap), cardWidth, cardHeight, helpers);
  });

  const footerY = top + rows * cardHeight + (rows - 1) * gap + 50;
  ctx.textAlign = "center";
  ctx.fillStyle = "#ffffff";
  ctx.font = '600 30px "Montserrat", Arial, sans-serif';
  if (keepers.length) {
    ctx.fillText(`🧤 Goleiros: ${keepers.map((player) => player.name).join(" e ")}`, WIDTH / 2, footerY);
  }

  const favorite = [...decorated].sort((a, b) => b.ovr - a.ovr)[0];
  ctx.fillStyle = "rgba(255,255,255,0.75)";
  ctx.font = '600 26px "Montserrat", Arial, sans-serif';
  if (favorite) {
    ctx.fillText(`Favorito do algoritmo: ${favorite.name} (OVR ${favorite.ovr})`, WIDTH / 2, footerY + 48);
  }

  ctx.fillStyle = "#f5c842";
  ctx.font = '56px "Bebas Neue", Arial, sans-serif';
  ctx.fillText(`“${pick(CAPTIONS)}”`, WIDTH / 2, HEIGHT - 60);

  if (photoCredit) {
    ctx.fillStyle = "rgba(255,255,255,0.6)";
    ctx.font = '500 18px "Montserrat", Arial, sans-serif';
    ctx.textAlign = "right";
    ctx.fillText(photoCredit, WIDTH - 24, HEIGHT - 18);
  }

  return new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
}

export async function exportTeamsImage(teams, keepers, backgroundSrc, helpers) {
  if (!teams.length) {
    return;
  }
  const blob = await renderTeamsImage(teams, keepers, backgroundSrc, helpers);
  if (!blob) {
    return;
  }
  const file = new File([blob], "times-fut-de-terca.png", { type: "image/png" });

  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: "Times da semana" });
      return;
    } catch (error) {
      if (error?.name === "AbortError") {
        return;
      }
    }
  }

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = file.name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
