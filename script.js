// ---------- State ----------
const STORAGE_KEY = "learningHubTasks";
let tasks = loadTasks();
let currentFilter = "all";

// ---------- Elements ----------
const form = document.getElementById("task-form");
const input = document.getElementById("task-input");
const categorySelect = document.getElementById("category-select");
const taskList = document.getElementById("task-list");
const emptyState = document.getElementById("empty-state");
const totalCount = document.getElementById("total-count");
const completedCount = document.getElementById("completed-count");
const remainingCount = document.getElementById("remaining-count");
const progressFill = document.getElementById("progress-fill");
const progressText = document.getElementById("progress-text");
const progressBar = document.getElementById("progress-bar");
const message = document.getElementById("message");
const clearBtn = document.getElementById("clear-completed");
const filterButtons = document.querySelectorAll(".filter");
const streakCount = document.getElementById("streak-count");
const todayCount = document.getElementById("today-count");
const weekCount = document.getElementById("week-count");
const weekChart = document.getElementById("week-chart");
const categoryProgress = document.getElementById("category-progress");

// ---------- Storage ----------
function loadTasks() {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        const list = saved ? JSON.parse(saved) : [];
        // Upgrade tasks saved by the older version (they had no dates).
        return list.map(t => ({
            ...t,
            createdAt: t.createdAt || t.id,
            completedAt: t.done ? (t.completedAt || t.id) : null
        }));
    } catch (e) {
        return [];
    }
}

function saveTasks() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
    } catch (e) {
        // Storage unavailable: the app still works, it just won't remember.
    }
}

// ---------- Date helpers ----------
// A day key like "2026-10-13" in the user's local time zone.
function dayKey(value) {
    const d = new Date(value);
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return d.getFullYear() + "-" + month + "-" + day;
}

function daysAgo(n) {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - n);
    return d;
}

// ---------- Actions ----------
function addTask(text, category) {
    tasks.push({
        id: Date.now(),
        text: text,
        category: category,
        done: false,
        createdAt: Date.now(),
        completedAt: null
    });
    saveTasks();
    render();
}

function toggleTask(id) {
    const task = tasks.find(t => t.id === id);
    if (task) {
        task.done = !task.done;
        task.completedAt = task.done ? Date.now() : null;
        saveTasks();
        render();
    }
}

function deleteTask(id) {
    tasks = tasks.filter(t => t.id !== id);
    saveTasks();
    render();
}

function clearCompleted() {
    tasks = tasks.filter(t => !t.done);
    saveTasks();
    render();
}

// ---------- Insights ----------
// Counts of completed tasks per local day, e.g. { "2026-10-13": 3 }
function completionsByDay() {
    const counts = {};
    tasks.forEach(t => {
        if (t.done && t.completedAt) {
            const key = dayKey(t.completedAt);
            counts[key] = (counts[key] || 0) + 1;
        }
    });
    return counts;
}

// Days in a row with at least one completed task.
// If nothing is done yet today, the streak still counts through yesterday.
function calcStreak(counts) {
    const d = daysAgo(0);
    if (!counts[dayKey(d)]) d.setDate(d.getDate() - 1);
    let streak = 0;
    while (counts[dayKey(d)]) {
        streak++;
        d.setDate(d.getDate() - 1);
    }
    return streak;
}

function renderWeekChart(counts) {
    const days = [];
    for (let i = 6; i >= 0; i--) {
        const d = daysAgo(i);
        days.push({
            label: d.toLocaleDateString("en-US", { weekday: "short" }),
            count: counts[dayKey(d)] || 0,
            isToday: i === 0
        });
    }

    const max = Math.max(1, ...days.map(d => d.count));
    const maxHeight = 130; // pixels for the tallest bar

    weekChart.innerHTML = "";
    const labels = document.createElement("div");
    labels.className = "bar-labels";

    days.forEach(day => {
        const col = document.createElement("div");
        col.className = "bar-col";

        const value = document.createElement("span");
        value.className = "bar-value";
        value.textContent = day.count;

        const bar = document.createElement("div");
        bar.className = "bar" + (day.count === 0 ? " empty" : "") + (day.isToday ? " today" : "");
        bar.style.height = Math.round((day.count / max) * maxHeight) + "px";

        col.append(value, bar);
        weekChart.appendChild(col);

        const label = document.createElement("span");
        label.className = day.isToday ? "today" : "";
        label.textContent = day.isToday ? "Today" : day.label;
        labels.appendChild(label);
    });

    // Put the day labels directly under the chart.
    const old = weekChart.nextElementSibling;
    if (old && old.classList.contains("bar-labels")) old.remove();
    weekChart.after(labels);

    return days;
}

function renderCategories() {
    const groups = {};
    tasks.forEach(t => {
        if (!groups[t.category]) groups[t.category] = { total: 0, done: 0 };
        groups[t.category].total++;
        if (t.done) groups[t.category].done++;
    });

    const names = Object.keys(groups).sort((a, b) => groups[b].total - groups[a].total);
    categoryProgress.innerHTML = "";

    if (names.length === 0) {
        const empty = document.createElement("p");
        empty.className = "category-empty";
        empty.textContent = "Add tasks to see your progress by category.";
        categoryProgress.appendChild(empty);
        return;
    }

    names.forEach(name => {
        const g = groups[name];
        const percent = Math.round((g.done / g.total) * 100);

        const row = document.createElement("div");
        row.className = "category-row";

        const head = document.createElement("div");
        head.className = "category-head";
        const left = document.createElement("span");
        left.textContent = name;
        const right = document.createElement("span");
        right.textContent = g.done + "/" + g.total + " (" + percent + "%)";
        head.append(left, right);

        const track = document.createElement("div");
        track.className = "category-track";
        const fill = document.createElement("div");
        fill.className = "category-fill" + (percent === 100 ? " full" : "");
        fill.style.width = percent + "%";
        track.appendChild(fill);

        row.append(head, track);
        categoryProgress.appendChild(row);
    });
}

function renderInsights() {
    const counts = completionsByDay();
    const days = renderWeekChart(counts);

    streakCount.textContent = calcStreak(counts);
    todayCount.textContent = days[days.length - 1].count;
    weekCount.textContent = days.reduce((sum, d) => sum + d.count, 0);

    renderCategories();
}

// ---------- Rendering ----------
function getMessage(percent, total) {
    if (total === 0) return "Add your first task to get started.";
    if (percent === 100) return "🎉 Amazing! You completed everything!";
    if (percent >= 50) return "Great progress, keep going!";
    if (percent > 0) return "Good start, one task at a time.";
    return "Pick a task and begin. You've got this.";
}

function render() {
    // Stats
    const total = tasks.length;
    const completed = tasks.filter(t => t.done).length;
    const remaining = total - completed;
    const percent = total === 0 ? 0 : Math.round((completed / total) * 100);

    totalCount.textContent = total;
    completedCount.textContent = completed;
    remainingCount.textContent = remaining;
    progressFill.style.width = percent + "%";
    progressText.textContent = percent + "% completed";
    progressBar.setAttribute("aria-valuenow", percent);
    message.textContent = getMessage(percent, total);

    // Task list (respecting the filter)
    const visible = tasks.filter(t => {
        if (currentFilter === "active") return !t.done;
        if (currentFilter === "done") return t.done;
        return true;
    });

    taskList.innerHTML = "";

    visible.forEach(task => {
        const li = document.createElement("li");
        li.className = "task-item" + (task.done ? " done" : "");

        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.checked = task.done;
        checkbox.addEventListener("change", () => toggleTask(task.id));

        const text = document.createElement("span");
        text.className = "task-text";
        text.textContent = task.text; // textContent keeps user input safe

        const tag = document.createElement("span");
        tag.className = "tag";
        tag.textContent = task.category;

        const del = document.createElement("button");
        del.className = "delete-btn";
        del.type = "button";
        del.setAttribute("aria-label", "Delete task");
        del.textContent = "✕";
        del.addEventListener("click", () => deleteTask(task.id));

        li.append(checkbox, text, tag, del);
        taskList.appendChild(li);
    });

    // Empty state and clear button
    emptyState.style.display = visible.length === 0 ? "block" : "none";
    emptyState.textContent = total === 0
        ? "No tasks yet. Add your first one above!"
        : "No tasks in this view.";
    clearBtn.style.display = completed > 0 ? "inline-block" : "none";

    renderInsights();
}

// ---------- Events ----------
form.addEventListener("submit", (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text) return;
    addTask(text, categorySelect.value);
    input.value = "";
    input.focus();
});

clearBtn.addEventListener("click", clearCompleted);

filterButtons.forEach(btn => {
    btn.addEventListener("click", () => {
        currentFilter = btn.dataset.filter;
        filterButtons.forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        render();
    });
});

// ---------- Start ----------
render();
