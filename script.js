const creditsEl = document.querySelector("#credits");
const ownedCountEl = document.querySelector("#owned-count");
const packCountEl = document.querySelector("#pack-count");
const packShop = document.querySelector("#pack-shop");
const ownedPacks = document.querySelector("#owned-packs");
const inventoryGrid = document.querySelector("#inventory-grid");
const catalogGrid = document.querySelector("#catalog-grid");
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

let cards = [];
let packs = [];
let selectedCard = null;
let revealQueue = [];
let revealIndex = 0;
let state = loadState();

function loadState() {
  return JSON.parse(localStorage.getItem(storageKey) || "null") || {
    credits: 100,
    inventory: [],
    packs: [],
  };
}

function saveState() {
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
  const cardEl = document.createElement("button");
  cardEl.className = `trading-card ${card.edition.toLowerCase()}`;
  cardEl.type = "button";
  cardEl.innerHTML = `
    <div class="card-topline">
      <strong>${card.name}</strong>
      <span>${card.power}</span>
    </div>
    <div class="card-art"><img src="${card.image}" alt="" /></div>
    <div class="edition">${card.edition}</div>
    <p>${card.description}</p>
    <div class="attributes">
      ${Object.entries(card.attributes)
        .map(([name, value]) => `<span>${name}: ${value}</span>`)
        .join("")}
    </div>
    ${options.showOwned ? `<small>owned x${owned}</small>` : ""}
  `;
  cardEl.addEventListener("click", () => openCard(card));
  return cardEl;
}

function renderCatalog() {
  catalogGrid.replaceChildren(...cards.map((card) => renderCardElement(card, { showOwned: true })));
}

function renderInventory() {
  const uniqueCards = [...new Set(state.inventory)].map(getCard).filter(Boolean);
  if (!uniqueCards.length) {
    inventoryGrid.innerHTML = `<p class="empty">No cards yet. Buy a pack.</p>`;
    return;
  }
  inventoryGrid.replaceChildren(
    ...uniqueCards.map((card) => renderCardElement(card, { showOwned: true })),
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
  const pool = cards.filter((card) => card.edition === edition);
  const fallback = cards.filter((card) => card.edition === "Basic");
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
  revealQueue.forEach((card) => state.inventory.push(card.id));
  updateAll();
  openingDialog.showModal();
  renderReveal();
}

function renderReveal() {
  const card = revealQueue[revealIndex];
  packOpening.innerHTML = "";
  const wrapper = document.createElement("div");
  wrapper.className = "reveal-wrap";
  wrapper.append(renderCardElement(card));
  packOpening.append(wrapper);
  nextReveal.textContent = revealIndex === revealQueue.length - 1 ? "Done" : "Next Card";
}

function openCard(card) {
  selectedCard = card;
  const owned = countOwned(card.id);
  cardDetail.innerHTML = "";
  cardDetail.append(renderCardElement(card, { showOwned: true }));
  const meta = document.createElement("div");
  meta.className = "card-meta";
  meta.innerHTML = `
    <strong>${card.name}</strong>
    <span>${card.edition} / power ${card.power}</span>
    <p>${card.description}</p>
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
  openCard(selectedCard);
}

function drawRenderedCard(card) {
  const ctx = renderCanvas.getContext("2d");
  const color = editionColors[card.edition];
  ctx.fillStyle = "#111113";
  ctx.fillRect(0, 0, renderCanvas.width, renderCanvas.height);
  ctx.fillStyle = color;
  ctx.fillRect(40, 40, 820, 1180);
  ctx.fillStyle = "#f5f5f0";
  ctx.fillRect(74, 74, 752, 1112);
  ctx.fillStyle = "#111113";
  ctx.fillRect(104, 104, 692, 440);

  const image = new Image();
  image.addEventListener("load", () => {
    ctx.drawImage(image, 104, 104, 692, 440);
    ctx.fillStyle = "#111113";
    ctx.font = "900 64px Inter, Arial, sans-serif";
    ctx.fillText(card.name, 104, 640);
    ctx.font = "800 42px Inter, Arial, sans-serif";
    ctx.fillText(`${card.edition} / ${card.power} power`, 104, 700);
    ctx.font = "700 34px Inter, Arial, sans-serif";
    wrapCanvasText(ctx, card.description, 104, 790, 680, 44);
    ctx.font = "800 30px Inter, Arial, sans-serif";
    let y = 980;
    Object.entries(card.attributes).forEach(([name, value]) => {
      ctx.fillText(`${name.toUpperCase()} ${value}`, 104, y);
      y += 42;
    });
    ctx.textAlign = "right";
    ctx.fillText("jakublabs.xyz", 792, 1140);
    ctx.textAlign = "left";
    const link = document.createElement("a");
    link.href = renderCanvas.toDataURL("image/png");
    link.download = `${card.id}.png`;
    link.click();
  });
  image.src = card.image;
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
  revealIndex += 1;
  if (revealIndex >= revealQueue.length) {
    openingDialog.close();
    return;
  }
  renderReveal();
});

Promise.all([fetch("cards.json").then((res) => res.json()), fetch("packs.json").then((res) => res.json())])
  .then(([cardsData, packsData]) => {
    cards = cardsData;
    packs = packsData;
    renderPackShop();
    updateAll();
  })
  .catch(() => {
    document.body.insertAdjacentHTML("beforeend", "<p>Could not load card data.</p>");
  });
