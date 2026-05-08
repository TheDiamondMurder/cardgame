const creditsEl = document.querySelector("#credits");
const ownedCountEl = document.querySelector("#owned-count");
const packCountEl = document.querySelector("#pack-count");
const packShop = document.querySelector("#pack-shop");
const ownedPacks = document.querySelector("#owned-packs");
const inventoryGrid = document.querySelector("#inventory-grid");
const catalogGrid = document.querySelector("#catalog-grid");
const inventorySearch = document.querySelector("#inventory-search");
const inventoryEdition = document.querySelector("#inventory-edition");
const inventoryLimited = document.querySelector("#inventory-limited");
const inventorySort = document.querySelector("#inventory-sort");
const catalogSearch = document.querySelector("#catalog-search");
const catalogEdition = document.querySelector("#catalog-edition");
const catalogLimited = document.querySelector("#catalog-limited");
const catalogSort = document.querySelector("#catalog-sort");
const redeemForm = document.querySelector("#redeem-form");
const redeemCode = document.querySelector("#redeem-code");
const redeemMessage = document.querySelector("#redeem-message");
const cardDialog = document.querySelector("#card-dialog");
const cardDetail = document.querySelector("#card-detail");
const closeCard = document.querySelector("#close-card");
const sellCard = document.querySelector("#sell-card");
const renderCard = document.querySelector("#render-card");
const renderCanvas = document.querySelector("#render-canvas");
const openingDialog = document.querySelector("#opening-dialog");
const packOpening = document.querySelector("#pack-opening");
const nextReveal = document.querySelector("#next-reveal");
const tabs = document.querySelectorAll(".tab");
const panels = document.querySelectorAll(".panel");

const storageKey = "jakublabsCards";
const editionColors = {
  Basic: "#d9d9d2",
  Uncommon: "#80ffaa",
  Rare: "#7fb7ff",
  Epic: "#d78cff",
  Legendary: "#ffd36b",
  Mythic: "#ff5ce1",
};

const isAvailable = (card) => card.available !== false;

let cards = [];
let packs = [];
let codes = [];
let selectedCard = null;
let revealQueue = [];
let revealIndex = 0;
let openingPhase = "sealed";
let state = loadState();

function loadState() {
  return JSON.parse(localStorage.getItem(storageKey) || "null") || {
    credits: 100,
    inventory: [],
    packs: [],
    redeemedCodes: [],
  };
}

function saveState() {
  state.redeemedCodes ||= [];
  localStorage.setItem(storageKey, JSON.stringify(state));
}

function getCard(id) {
  return cards.find((card) => card.id === id);
}

function getPack(id) {
  return packs.find((pack) => pack.id === id);
}

function updateWallet() {
  creditsEl.textContent = state.credits.toLocaleString();
  ownedCountEl.textContent = state.inventory.length.toLocaleString();
  packCountEl.textContent = state.packs.length.toLocaleString();
  saveState();
}

function countOwned(cardId) {
  return state.inventory.filter((id) => id === cardId).length;
}

function renderCardElement(card, options = {}) {
  const owned = countOwned(card.id);
  const showUnobtainableState = options.showAvailability !== false && !isAvailable(card);
  const cardEl = document.createElement(options.clickable ? "button" : "article");
  cardEl.className = `trading-card ${card.edition.toLowerCase()} ${options.clickable ? "" : "static-card"} ${
    showUnobtainableState ? "unobtainable-card" : ""
  }`;
  if (options.clickable) cardEl.type = "button";
  cardEl.innerHTML = `
    <div class="card-topline">
      <strong>${card.name}</strong>
      <span>${card.power}</span>
    </div>
    ${card.limitedEdition ? `<div class="limited-ribbon">limited edition</div>` : ""}
    <div class="card-art"><img src="${card.image}" alt="" /></div>
    <div class="edition">${card.edition}</div>
    <p>${card.description}</p>
    <div class="attributes">
      ${Object.entries(card.attributes)
        .map(([name, value]) => `<span>${name}: ${value}</span>`)
        .join("")}
    </div>
    ${showUnobtainableState ? `<div class="unobtainable-label">unobtainable</div>` : ""}
    ${options.showOwned ? `<small>owned x${owned}</small>` : ""}
  `;
  if (options.clickable) cardEl.addEventListener("click", () => openCard(card));
  return cardEl;
}

function editionRank(edition) {
  return ["Basic", "Uncommon", "Rare", "Epic", "Legendary", "Mythic"].indexOf(edition);
}

function getControls(kind) {
  return kind === "inventory"
    ? {
        search: inventorySearch.value,
        edition: inventoryEdition.value,
        limited: inventoryLimited.value,
        sort: inventorySort.value,
      }
    : {
        search: catalogSearch.value,
        edition: catalogEdition.value,
        limited: catalogLimited.value,
        sort: catalogSort.value,
      };
}

function applyCardFilters(list, kind) {
  const controls = getControls(kind);
  const query = controls.search.trim().toLowerCase();
  return list
    .filter((card) => {
      const matchesEdition = controls.edition === "All" || card.edition === controls.edition;
      const matchesLimited =
        controls.limited === "All" ||
        (controls.limited === "Limited" && card.limitedEdition) ||
        (controls.limited === "Standard" && !card.limitedEdition);
      const matchesSearch =
        !query ||
        card.name.toLowerCase().includes(query) ||
        card.description.toLowerCase().includes(query) ||
        Object.keys(card.attributes).some((attribute) => attribute.toLowerCase().includes(query));
      return matchesEdition && matchesLimited && matchesSearch;
    })
    .sort((a, b) => {
      switch (controls.sort) {
        case "power-desc":
          return b.power - a.power;
        case "power-asc":
          return a.power - b.power;
        case "worth-desc":
          return b.worth - a.worth;
        case "edition":
          return editionRank(b.edition) - editionRank(a.edition) || a.name.localeCompare(b.name);
        case "owned-desc":
          return countOwned(b.id) - countOwned(a.id) || a.name.localeCompare(b.name);
        default:
          return a.name.localeCompare(b.name);
      }
    });
}

function renderCatalog() {
  const filteredCards = applyCardFilters(cards, "catalog");
  if (!filteredCards.length) {
    catalogGrid.innerHTML = `<p class="empty">No catalog cards match that.</p>`;
    return;
  }
  catalogGrid.replaceChildren(...filteredCards.map((card) => renderCardElement(card, { showOwned: true })));
}

function renderInventory() {
  const uniqueCards = [...new Set(state.inventory)].map(getCard).filter(Boolean);
  const filteredCards = applyCardFilters(uniqueCards, "inventory");
  if (!uniqueCards.length) {
    inventoryGrid.innerHTML = `<p class="empty">No cards yet. Buy a pack.</p>`;
    return;
  }
  if (!filteredCards.length) {
    inventoryGrid.innerHTML = `<p class="empty">No owned cards match that.</p>`;
    return;
  }
  inventoryGrid.replaceChildren(
    ...filteredCards.map((card) => renderCardElement(card, { showOwned: true, clickable: true })),
  );
}

function renderPackShop() {
  packShop.replaceChildren(
    ...packs.map((pack) => {
      const card = document.createElement("article");
      card.className = "pack-card";
      card.innerHTML = `
        <span>${pack.cards} cards</span>
        <h3>${pack.name}</h3>
        <p>${pack.cost} credits</p>
        <div class="odds">
          ${Object.entries(pack.odds)
            .filter(([, chance]) => chance > 0)
            .map(([edition, chance]) => `<small>${edition}: ${chance}%</small>`)
            .join("")}
        </div>
      `;
      const button = document.createElement("button");
      button.className = "button button-light";
      button.type = "button";
      button.textContent = "Buy Pack";
      button.addEventListener("click", () => buyPack(pack));
      card.append(button);
      return card;
    }),
  );
}

function renderOwnedPacks() {
  const counts = state.packs.reduce((map, packId) => {
    map[packId] = (map[packId] || 0) + 1;
    return map;
  }, {});
  const entries = Object.entries(counts);
  if (!entries.length) {
    ownedPacks.innerHTML = `<p class="empty">No unopened packs.</p>`;
    return;
  }

  ownedPacks.replaceChildren(
    ...entries.map(([packId, count]) => {
      const pack = getPack(packId);
      const item = document.createElement("div");
      item.className = "owned-pack";
      item.innerHTML = `<strong>${pack.name}</strong><span>x${count}</span>`;
      const button = document.createElement("button");
      button.className = "button button-dark";
      button.type = "button";
      button.textContent = "Open";
      button.addEventListener("click", () => openPack(pack));
      item.append(button);
      return item;
    }),
  );
}

function buyPack(pack) {
  if (state.credits < pack.cost) {
    alert("Not enough credits.");
    return;
  }
  state.credits -= pack.cost;
  state.packs.push(pack.id);
  updateAll();
}

function pickEdition(odds) {
  const roll = Math.random() * 100;
  let total = 0;
  for (const [edition, chance] of Object.entries(odds)) {
    total += chance;
    if (roll <= total) return edition;
  }
  return "Basic";
}

function pickCardForEdition(edition) {
  const pool = cards.filter((card) => card.edition === edition && isAvailable(card));
  const fallback = cards.filter((card) => card.edition === "Basic" && isAvailable(card));
  const choices = pool.length ? pool : fallback;
  return choices[Math.floor(Math.random() * choices.length)];
}

function openPack(pack) {
  const packIndex = state.packs.indexOf(pack.id);
  if (packIndex === -1) return;
  state.packs.splice(packIndex, 1);
  revealQueue = Array.from({ length: pack.cards }, () => {
    const edition = pickEdition(pack.odds);
    return pickCardForEdition(edition);
  });
  revealIndex = 0;
  openingPhase = "sealed";
  revealQueue.forEach((card) => state.inventory.push(card.id));
  updateAll();
  openingDialog.showModal();
  renderReveal();
}

function renderReveal() {
  if (openingPhase === "sealed") {
    packOpening.innerHTML = `
      <div class="sealed-pack">
        <div class="pack-shine"></div>
        <strong>jakublabs.xyz</strong>
        <span>sealed pack</span>
      </div>
    `;
    nextReveal.textContent = "Open Pack";
    return;
  }
  const card = revealQueue[revealIndex];
  packOpening.innerHTML = "";
  const wrapper = document.createElement("div");
  wrapper.className = "reveal-wrap";
  wrapper.append(renderCardElement(card, { showOwned: true }));
  packOpening.append(wrapper);
  nextReveal.textContent = revealIndex === revealQueue.length - 1 ? "Done" : "Next Card";
}

function openCard(card) {
  selectedCard = card;
  const owned = countOwned(card.id);
  cardDetail.innerHTML = "";
  cardDetail.append(renderCardElement(card, { showOwned: true, showAvailability: false }));
  const meta = document.createElement("div");
  meta.className = "card-meta";
  meta.innerHTML = `
    <strong>${card.name}</strong>
    <span>${card.edition} / power ${card.power}</span>
    <p>${card.description}</p>
    ${card.limitedEdition ? `<small>limited edition</small>` : ""}
    ${!isAvailable(card) ? `<small>unobtainable from packs</small>` : ""}
    <small>sell value: ${card.worth} credits</small>
  `;
  cardDetail.append(meta);
  sellCard.disabled = owned < 1;
  cardDialog.showModal();
}

function sellSelectedCard() {
  if (!selectedCard) return;
  const index = state.inventory.indexOf(selectedCard.id);
  if (index === -1) return;
  state.inventory.splice(index, 1);
  state.credits += selectedCard.worth;
  updateAll();
  cardDialog.close();
  selectedCard = null;
}

function drawRenderedCard(card) {
  const ctx = renderCanvas.getContext("2d");
  const color = editionColors[card.edition];
  ctx.fillStyle = "#030303";
  ctx.fillRect(0, 0, renderCanvas.width, renderCanvas.height);
  const gradient = ctx.createRadialGradient(120, 120, 30, 280, 360, 980);
  gradient.addColorStop(0, "rgba(233, 255, 112, 0.18)");
  gradient.addColorStop(0.42, "rgba(255, 255, 255, 0.04)");
  gradient.addColorStop(1, "rgba(3, 3, 3, 1)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, renderCanvas.width, renderCanvas.height);
  ctx.strokeStyle = "rgba(255,255,255,0.07)";
  ctx.lineWidth = 1;
  for (let x = 0; x <= renderCanvas.width; x += 72) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, renderCanvas.height);
    ctx.stroke();
  }
  for (let y = 0; y <= renderCanvas.height; y += 72) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(renderCanvas.width, y);
    ctx.stroke();
  }

  ctx.fillStyle = "#f5f5f0";
  ctx.textAlign = "center";
  ctx.font = "900 86px Inter, Arial, sans-serif";
  ctx.fillText("I own:", renderCanvas.width / 2, 136);

  const cardX = 140;
  const cardY = 210;
  const cardW = 620;
  const cardH = 870;
  const pad = 28;
  ctx.fillStyle = color;
  roundRect(ctx, cardX, cardY, cardW, cardH, 30);
  ctx.fill();
  ctx.fillStyle = "#f5f5f0";
  roundRect(ctx, cardX + 24, cardY + 24, cardW - 48, cardH - 48, 22);
  ctx.fill();
  ctx.fillStyle = "#111113";
  roundRect(ctx, cardX + pad + 14, cardY + pad + 14, cardW - (pad + 14) * 2, 310, 16);
  ctx.fill();

  const image = new Image();
  image.addEventListener("load", () => {
    ctx.drawImage(image, cardX + pad + 14, cardY + pad + 14, cardW - (pad + 14) * 2, 310);
    ctx.fillStyle = "#111113";
    ctx.textAlign = "left";
    ctx.font = "900 44px Inter, Arial, sans-serif";
    wrapCanvasText(ctx, card.name, cardX + 46, cardY + 420, cardW - 140, 48);
    ctx.textAlign = "center";
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(cardX + cardW - 72, cardY + 414, 36, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#111113";
    ctx.font = "900 28px Inter, Arial, sans-serif";
    ctx.fillText(card.power, cardX + cardW - 72, cardY + 424);
    ctx.textAlign = "left";
    ctx.font = "800 30px Inter, Arial, sans-serif";
    ctx.fillText(`${card.edition} / ${card.power} power`, cardX + 46, cardY + 510);
    ctx.font = "700 24px Inter, Arial, sans-serif";
    wrapCanvasText(ctx, card.description, cardX + 46, cardY + 585, cardW - 92, 32);
    ctx.font = "800 22px Inter, Arial, sans-serif";
    let y = cardY + 745;
    Object.entries(card.attributes).forEach(([name, value]) => {
      ctx.fillText(`${name.toUpperCase()} ${value}`, cardX + 46, y);
      y += 30;
    });
    ctx.textAlign = "right";
    ctx.fillText("jakublabs.xyz", cardX + cardW - 46, cardY + cardH - 48);
    ctx.textAlign = "center";
    ctx.fillStyle = "#a6a6a0";
    ctx.font = "800 34px Inter, Arial, sans-serif";
    ctx.fillText("certificate of ownership", renderCanvas.width / 2, 1176);
    const link = document.createElement("a");
    link.href = renderCanvas.toDataURL("image/png");
    link.download = `${card.id}.png`;
    link.click();
  });
  image.src = card.image;
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

function wrapCanvasText(ctx, text, x, y, maxWidth, lineHeight) {
  const words = text.split(/\s+/);
  let line = "";
  words.forEach((word) => {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width <= maxWidth) {
      line = test;
      return;
    }
    ctx.fillText(line, x, y);
    y += lineHeight;
    line = word;
  });
  if (line) ctx.fillText(line, x, y);
}

function updateAll() {
  updateWallet();
  renderInventory();
  renderCatalog();
  renderOwnedPacks();
}

function normalizeCode(code) {
  return code.trim().toUpperCase();
}

function redeemEnteredCode(event) {
  event.preventDefault();
  state.redeemedCodes ||= [];
  const entered = normalizeCode(redeemCode.value);
  if (!entered) {
    redeemMessage.textContent = "Enter a code first.";
    return;
  }
  const code = codes.find((item) => normalizeCode(item.code || item.id || "") === entered);
  if (!code) {
    redeemMessage.textContent = "That code does not exist.";
    return;
  }
  const codeId = normalizeCode(code.code || code.id);
  if (state.redeemedCodes.includes(codeId)) {
    redeemMessage.textContent = "You already used that code.";
    return;
  }
  const credits = Number(code.credits || 0);
  if (!credits) {
    redeemMessage.textContent = "That code is not set up yet.";
    return;
  }
  state.credits += credits;
  state.redeemedCodes.push(codeId);
  redeemCode.value = "";
  redeemMessage.textContent = `Redeemed ${credits.toLocaleString()} credits.`;
  updateAll();
}

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    tabs.forEach((item) => item.classList.remove("active"));
    panels.forEach((panel) => panel.classList.remove("active"));
    tab.classList.add("active");
    document.querySelector(`#${tab.dataset.panel}`).classList.add("active");
  });
});

closeCard.addEventListener("click", () => cardDialog.close());
sellCard.addEventListener("click", sellSelectedCard);
renderCard.addEventListener("click", () => selectedCard && drawRenderedCard(selectedCard));
nextReveal.addEventListener("click", () => {
  if (openingPhase === "sealed") {
    openingPhase = "revealing";
    renderReveal();
    return;
  }
  revealIndex += 1;
  if (revealIndex >= revealQueue.length) {
    openingDialog.close();
    return;
  }
  renderReveal();
});
redeemForm.addEventListener("submit", redeemEnteredCode);
[inventorySearch, inventoryEdition, inventoryLimited, inventorySort].forEach((control) =>
  control.addEventListener("input", renderInventory),
);
[catalogSearch, catalogEdition, catalogLimited, catalogSort].forEach((control) =>
  control.addEventListener("input", renderCatalog),
);

Promise.all([
  fetch("cards.json?v=2").then((res) => res.json()),
  fetch("packs.json?v=1").then((res) => res.json()),
  fetch("codes.json?v=2").then((res) => res.json()).catch(() => []),
])
  .then(([cardsData, packsData, codesData]) => {
    cards = cardsData;
    packs = packsData;
    codes = Array.isArray(codesData) ? codesData : [];
    renderPackShop();
    updateAll();
  })
  .catch(() => {
    document.body.insertAdjacentHTML("beforeend", "<p>Could not load card data.</p>");
  });
