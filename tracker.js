import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore, collection, addDoc, onSnapshot,
  doc, updateDoc, getDoc, query, orderBy
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBid7QHCLVAziG2dUd6Rn_6QfZmMWnWXAQ",
  authDomain: "pooltracker419.firebaseapp.com",
  projectId: "pooltracker419",
  storageBucket: "pooltracker419.firebasestorage.app",
  messagingSenderId: "1020574633552",
  appId: "1:1020574633552:web:cfa3a57b76b23e58ea0b55",
  measurementId: "G-25FP4Y7MNR"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const poolRef = doc(db, "pool", "main");
const transactionsCol = collection(db, "transactions");
const usersCol = collection(db, "users");

const poolDisplay = document.getElementById("pool-balance");
const transactionsList = document.getElementById("transactions-list");
const userSelect = document.getElementById("user-select");
const filterSelect = document.getElementById("filter-user");
const poolChart = document.getElementById("pool-chart");
const chartTooltip = document.getElementById("chart-tooltip");

let allTransactions = [];
let chartView = null;
let chartDragState = null;

function formatDisplayDate(dateStr) {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  }).format(new Date(dateStr + "T00:00:00"));
}

function buildHistory() {
  return [...allTransactions]
    .sort((a, b) => a.date.localeCompare(b.date))
    .reduce((result, transaction) => {
      const amount = Number(transaction.amount || 0);
      const previousBalance = result.length ? result[result.length - 1].balance : 0;
      const updatedBalance = transaction.type === "deposit"
        ? previousBalance + amount
        : previousBalance - amount;

      result.push({ date: transaction.date, balance: updatedBalance });
      return result;
    }, []);
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function ensureChartView(history) {
  if (!history.length) {
    chartView = { startIndex: 0, endIndex: 0 };
    return;
  }

  if (!chartView || chartView.startIndex > chartView.endIndex || chartView.startIndex >= history.length) {
    chartView = { startIndex: 0, endIndex: history.length - 1 };
    return;
  }

  chartView.startIndex = clamp(chartView.startIndex, 0, history.length - 1);
  chartView.endIndex = clamp(chartView.endIndex, chartView.startIndex, history.length - 1);
}

function renderTransactions() {
  const selectedUser = filterSelect.value;
  const filtered = selectedUser === "all"
    ? allTransactions
    : allTransactions.filter(t => t.user === selectedUser);

  transactionsList.innerHTML = "";

  filtered
    .sort((a, b) => b.date.localeCompare(a.date))
    .forEach(data => {
      const div = document.createElement("div");
      div.className = "transaction";
      div.innerHTML = `<strong>${data.user}</strong>$${Number(data.amount).toFixed(2)} on ${formatDisplayDate(data.date)} (${data.type})<br><em>${data.note ?? ''}</em>`;
      transactionsList.appendChild(div);
    });
}

function renderPoolChart() {
  const ctx = poolChart.getContext("2d");
  const canvas = poolChart;
  const padding = { top: 20, right: 20, bottom: 32, left: 48 };
  const plotWidth = canvas.width - padding.left - padding.right;
  const plotHeight = canvas.height - padding.top - padding.bottom;
  const history = buildHistory();

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  if (history.length === 0) {
    chartTooltip.style.display = "none";
    ctx.fillStyle = "#6c757d";
    ctx.font = "16px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("No transactions yet", canvas.width / 2, canvas.height / 2);
    return;
  }

  ensureChartView(history);
  const visibleHistory = history.slice(chartView.startIndex, chartView.endIndex + 1);
  const visibleCount = visibleHistory.length;
  const balances = visibleHistory.map(point => point.balance);
  const minBalance = Math.min(0, ...balances);
  const maxBalance = Math.max(0, ...balances);
  const range = maxBalance - minBalance || 1;

  const xForIndex = index => visibleCount === 1
    ? padding.left + plotWidth / 2
    : padding.left + (index / (visibleCount - 1)) * plotWidth;
  const yForValue = value => canvas.height - padding.bottom - ((value - minBalance) / range) * plotHeight;

  ctx.strokeStyle = "#dfe3e8";
  ctx.lineWidth = 1;
  ctx.font = "11px sans-serif";
  ctx.fillStyle = "#6c757d";
  ctx.textAlign = "right";

  for (let i = 0; i <= 4; i++) {
    const value = minBalance + (range / 4) * i;
    const y = yForValue(value);
    ctx.beginPath();
    ctx.moveTo(padding.left, y);
    ctx.lineTo(canvas.width - padding.right, y);
    ctx.stroke();
    ctx.fillText(`$${value.toFixed(0)}`, padding.left - 8, y + 3);
  }

  ctx.beginPath();
  visibleHistory.forEach((point, index) => {
    const x = xForIndex(index);
    const y = yForValue(point.balance);
    index === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  });
  ctx.strokeStyle = "#007bff";
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = "rgba(0, 123, 255, 0.18)";
  ctx.beginPath();
  visibleHistory.forEach((point, index) => {
    const x = xForIndex(index);
    const y = yForValue(point.balance);
    index === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  });
  ctx.lineTo(xForIndex(visibleCount - 1), canvas.height - padding.bottom);
  ctx.lineTo(xForIndex(0), canvas.height - padding.bottom);
  ctx.closePath();
  ctx.fill();

  visibleHistory.forEach((point, index) => {
    ctx.beginPath();
    ctx.arc(xForIndex(index), yForValue(point.balance), 4, 0, Math.PI * 2);
    ctx.fillStyle = "#007bff";
    ctx.fill();
  });

  ctx.fillStyle = "#6c757d";
  ctx.textAlign = "left";
  ctx.fillText(formatDisplayDate(visibleHistory[0].date), padding.left, canvas.height - 8);
  ctx.textAlign = "right";
  ctx.fillText(formatDisplayDate(visibleHistory[visibleHistory.length - 1].date), canvas.width - padding.right, canvas.height - 8);

  ctx.save();
  ctx.translate(12, canvas.height / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.textAlign = "center";
  ctx.fillText("Pool Balance", 0, 0);
  ctx.restore();
}

function updateChartTooltip(event) {
  const history = buildHistory();
  if (!history.length) {
    chartTooltip.style.display = "none";
    return;
  }

  ensureChartView(history);
  const visibleHistory = history.slice(chartView.startIndex, chartView.endIndex + 1);
  const canvas = poolChart;
  const padding = { top: 20, right: 20, bottom: 32, left: 48 };
  const plotWidth = canvas.width - padding.left - padding.right;
  const plotHeight = canvas.height - padding.top - padding.bottom;
  const visibleCount = visibleHistory.length;
  const balances = visibleHistory.map(point => point.balance);
  const minBalance = Math.min(0, ...balances);
  const maxBalance = Math.max(0, ...balances);
  const range = maxBalance - minBalance || 1;
  const xForIndex = index => visibleCount === 1
    ? padding.left + plotWidth / 2
    : padding.left + (index / (visibleCount - 1)) * plotWidth;
  const yForValue = value => canvas.height - padding.bottom - ((value - minBalance) / range) * plotHeight;

  let closestPoint = null;
  let closestDistance = Infinity;
  visibleHistory.forEach((point, index) => {
    const distance = Math.hypot(event.offsetX - xForIndex(index), event.offsetY - yForValue(point.balance));
    if (distance < 12 && distance < closestDistance) {
      closestDistance = distance;
      closestPoint = point;
    }
  });

  if (!closestPoint) {
    chartTooltip.style.display = "none";
    return;
  }

  chartTooltip.style.display = "block";
  chartTooltip.innerHTML = `<strong>$${closestPoint.balance.toFixed(2)}</strong><br><span>${formatDisplayDate(closestPoint.date)}</span>`;
  const tooltipWidth = 120;
  chartTooltip.style.left = `${clamp(event.offsetX + 14, 10, canvas.width - tooltipWidth - 10)}px`;
  chartTooltip.style.top = `${clamp(event.offsetY - 26, 10, canvas.height - 50)}px`;
}

poolChart.addEventListener("wheel", event => {
  event.preventDefault();
  const history = buildHistory();
  if (!history.length) return;

  ensureChartView(history);
  const visibleCount = chartView.endIndex - chartView.startIndex + 1;
  const scaledCount = clamp(Math.round(visibleCount * (event.deltaY < 0 ? 0.8 : 1.2)), 2, history.length);
  const padding = { top: 20, right: 20, bottom: 32, left: 48 };
  const plotWidth = poolChart.width - padding.left - padding.right;
  const anchorRatio = clamp((event.offsetX - padding.left) / Math.max(plotWidth, 1), 0, 1);
  const anchorIndex = chartView.startIndex + anchorRatio * Math.max(visibleCount - 1, 0);
  const newStart = clamp(Math.round(anchorIndex - anchorRatio * (scaledCount - 1)), 0, history.length - scaledCount);

  chartView.startIndex = newStart;
  chartView.endIndex = newStart + scaledCount - 1;
  renderPoolChart();
}, { passive: false });

poolChart.addEventListener("pointerdown", event => {
  const history = buildHistory();
  if (!history.length) return;

  ensureChartView(history);
  chartDragState = {
    startX: event.clientX,
    startIndex: chartView.startIndex,
    visibleCount: chartView.endIndex - chartView.startIndex + 1
  };
  poolChart.setPointerCapture(event.pointerId);
});

poolChart.addEventListener("pointermove", event => {
  if (chartDragState) {
    const history = buildHistory();
    if (!history.length) return;

    const padding = { top: 20, right: 20, bottom: 32, left: 48 };
    const plotWidth = poolChart.width - padding.left - padding.right;
    const pixelsPerIndex = Math.max(plotWidth / Math.max(chartDragState.visibleCount - 1, 1), 1);
    const dragDelta = Math.round((event.clientX - chartDragState.startX) / pixelsPerIndex);
    const newStart = clamp(chartDragState.startIndex - dragDelta, 0, history.length - chartDragState.visibleCount);

    chartView.startIndex = newStart;
    chartView.endIndex = newStart + chartDragState.visibleCount - 1;
    renderPoolChart();
    return;
  }

  updateChartTooltip(event);
});

poolChart.addEventListener("pointerup", () => {
  chartDragState = null;
  chartTooltip.style.display = "none";
});

poolChart.addEventListener("pointerleave", () => {
  chartDragState = null;
  chartTooltip.style.display = "none";
});

onSnapshot(poolRef, snap => {
  if (snap.exists()) {
    poolDisplay.textContent = `Pool: $${(snap.data().balance ?? 0).toFixed(2)}`;
  }
});

onSnapshot(query(transactionsCol, orderBy("date")), snap => {
  allTransactions = [];
  snap.forEach(docSnap => allTransactions.push(docSnap.data()));
  renderTransactions();
  renderPoolChart();
});

onSnapshot(usersCol, snap => {
  userSelect.innerHTML = "";
  filterSelect.innerHTML = '<option value="all">All Users</option>';
  snap.forEach(docSnap => {
    const name = docSnap.data().name;
    const opt1 = document.createElement("option");
    opt1.value = name;
    opt1.textContent = name;
    userSelect.appendChild(opt1);

    const opt2 = document.createElement("option");
    opt2.value = name;
    opt2.textContent = name;
    filterSelect.appendChild(opt2);
  });
});

filterSelect.addEventListener("change", renderTransactions);

document.getElementById("add-user-btn").addEventListener("click", async () => {
  const newUser = document.getElementById("new-user").value.trim();
  if (!newUser) return;
  await addDoc(usersCol, { name: newUser });
  document.getElementById("new-user").value = "";
});

document.getElementById("add-transaction-btn").addEventListener("click", async () => {
  const user = userSelect.value;
  const amount = parseFloat(document.getElementById("amount").value);
  const dateInput = document.getElementById("date").value;
  const date = dateInput || new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York'
  }).format(new Date());
  const type = document.getElementById("transaction-type").value;
  const note = document.getElementById("note").value.trim();

  if (!user || isNaN(amount) || amount <= 0) return;

  const snap = await getDoc(poolRef);
  const currentBalance = snap.exists() ? (snap.data().balance ?? 0) : 0;
  const newBalance = type === "deposit" ? currentBalance + amount : currentBalance - amount;

  await addDoc(transactionsCol, { user, amount, date, type, note });
  await updateDoc(poolRef, { balance: newBalance });

  document.getElementById("amount").value = "";
  document.getElementById("date").value = "";
  document.getElementById("note").value = "";
});
