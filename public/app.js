'use strict';

const chat = document.getElementById('chat');
const composer = document.getElementById('composer');
const mainInput = document.getElementById('mainInput');
const mainLabel = document.getElementById('mainLabel');
const helperText = document.getElementById('helperText');
const submitButton = document.getElementById('submitButton');
const dmFields = document.getElementById('dmFields');
const profileInput = document.getElementById('profileInput');
const topicInput = document.getElementById('topicInput');
const triggerInput = document.getElementById('triggerInput');
const stageInput = document.getElementById('stageInput');
const template = document.getElementById('messageTemplate');
const modeButtons = Array.from(document.querySelectorAll('[data-mode]'));
const todoList = document.getElementById('todoList');
const todoDate = document.getElementById('todoDate');

let mode = 'comment';
const todoStorageKey = `linkedin-ui-todos-${new Date().toISOString().slice(0, 10)}`;
const todoDefinitions = [
  {
    id: 'comments',
    title: '5 Kommentare auf fremden Posts',
    hint: 'Tägliches Engagement aus der Strategie',
    target: 5,
    stage: 'Kommentar auf fremden Post',
  },
  {
    id: 'connections',
    title: '2 Verbindungsanfragen',
    hint: 'Nur nach echter Interaktion',
    target: 2,
    stage: 'Verbindungsanfrage nach echter Interaktion',
    defaultTrigger: 'echte Interaktion mit fremdem Post',
    triggerPlaceholder: 'z. B. Kommentar auf fremden Post',
    selectableInDm: true,
  },
  {
    id: 'dms',
    title: '2 DMs an warme Leads',
    hint: 'Reaktiv nach Signal oder Antwort',
    target: 2,
    stage: 'DM an warmen Lead nach Signal oder Antwort',
    defaultTrigger: 'warmes Signal oder Antwort',
    triggerPlaceholder: 'z. B. Kommentar auf meinen Post',
    selectableInDm: true,
  },
];

function loadTodos() {
  try {
    const saved = JSON.parse(localStorage.getItem(todoStorageKey) || '{}');
    return todoDefinitions.map((item) => ({
      ...item,
      count: Number.isFinite(saved[item.id]) ? saved[item.id] : 0,
    }));
  } catch (error) {
    return todoDefinitions.map((item) => ({ ...item, count: 0 }));
  }
}

let todos = loadTodos();

function saveTodos() {
  const payload = todos.reduce((accumulator, item) => {
    accumulator[item.id] = item.count;
    return accumulator;
  }, {});
  localStorage.setItem(todoStorageKey, JSON.stringify(payload));
}

function formatTodoDate() {
  todoDate.textContent = new Intl.DateTimeFormat('de-DE', {
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
  }).format(new Date());
}

function updateTodo(id, nextCount) {
  todos = todos.map((item) => {
    if (item.id !== id) return item;
    return {
      ...item,
      count: Math.max(0, Math.min(item.target, nextCount)),
    };
  });
  saveTodos();
  renderTodos();
}

function incrementTodo(id) {
  updateTodo(id, (todos.find((item) => item.id === id)?.count || 0) + 1);
}

function getTodoDefinition(id) {
  return todoDefinitions.find((item) => item.id === id) || todoDefinitions.find((item) => item.id === 'dms');
}

function getSelectedDmTask() {
  return getTodoDefinition(stageInput.value);
}

function renderDmTaskOptions() {
  stageInput.innerHTML = '';
  todoDefinitions
    .filter((item) => item.selectableInDm)
    .forEach((item) => {
      const option = document.createElement('option');
      option.value = item.id;
      option.textContent = item.title;
      stageInput.appendChild(option);
    });
}

function syncDmTaskFields() {
  const selectedTask = getSelectedDmTask();
  triggerInput.placeholder = selectedTask.triggerPlaceholder || 'z. B. Signal oder Kontext';
}

function renderTodos() {
  todoList.innerHTML = '';

  todos.forEach((item) => {
    const row = document.createElement('div');
    row.className = `todo-item${item.count >= item.target ? ' done' : ''}`;

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'todo-check';
    checkbox.checked = item.count >= item.target;
    checkbox.addEventListener('change', () => {
      updateTodo(item.id, checkbox.checked ? item.target : 0);
    });

    const copy = document.createElement('div');
    copy.className = 'todo-copy';
    const title = document.createElement('div');
    title.className = 'todo-title';
    title.textContent = item.title;
    const hint = document.createElement('div');
    hint.className = 'todo-hint';
    hint.textContent = item.hint;
    copy.appendChild(title);
    copy.appendChild(hint);

    const counter = document.createElement('div');
    counter.className = 'todo-counter';
    const minus = document.createElement('button');
    minus.type = 'button';
    minus.textContent = '−';
    minus.addEventListener('click', () => updateTodo(item.id, item.count - 1));
    const count = document.createElement('div');
    count.className = 'todo-count';
    count.textContent = `${item.count}/${item.target}`;
    const plus = document.createElement('button');
    plus.type = 'button';
    plus.textContent = '+';
    plus.addEventListener('click', () => updateTodo(item.id, item.count + 1));

    counter.appendChild(minus);
    counter.appendChild(count);
    counter.appendChild(plus);

    row.appendChild(checkbox);
    row.appendChild(copy);
    row.appendChild(counter);
    todoList.appendChild(row);
  });
}

function addMessage(role, body) {
  const fragment = template.content.cloneNode(true);
  const article = fragment.querySelector('.message');
  const roleEl = fragment.querySelector('.message-role');
  const bodyEl = fragment.querySelector('.message-body');

  article.classList.add(role);
  roleEl.textContent = role === 'user' ? 'Du' : role === 'system' ? 'System' : 'Copilot';
  bodyEl.textContent = body;
  chat.appendChild(fragment);
  chat.scrollTop = chat.scrollHeight;
}

function setMode(nextMode) {
  mode = nextMode;
  modeButtons.forEach((button) => {
    button.classList.toggle('active', button.dataset.mode === nextMode);
  });

  if (nextMode === 'comment') {
    mainLabel.textContent = 'LinkedIn-Beitrag einfügen';
    mainInput.placeholder = 'Hier den fremden LinkedIn-Post einfügen ...';
    helperText.textContent = 'Post rein, Klick auf Senden, Kommentar zurück.';
    submitButton.textContent = 'Kommentar holen';
    dmFields.classList.add('hidden');
  } else {
    mainLabel.textContent = 'Signal oder Kontext einfügen';
    mainInput.placeholder = 'z. B. Was die Person kommentiert hat oder worauf die DM reagieren soll ...';
    helperText.textContent = 'Signal rein, Tagesziel wählen, Vorlage zurück.';
    submitButton.textContent = 'Vorlage holen';
    dmFields.classList.remove('hidden');
  }
}

function renderCommentResponse(data) {
  if (!data.ok || !data.primaryComment) {
    addMessage('assistant', data.message || 'Kein Kommentar erzeugt.');
    return;
  }

  incrementTodo('comments');

  let text = `Primärer Kommentar\n\n${data.primaryComment.text}`;

  if (data.primaryComment.why) {
    text += `\n\nWarum\n${data.primaryComment.why}`;
  }

  if (data.primaryComment.modelModeration) {
    text += `\n\nModellprüfung\n${data.primaryComment.modelModeration.decision} · ${data.primaryComment.modelModeration.model}`;
    if (data.primaryComment.modelModeration.reason) {
      text += `\n${data.primaryComment.modelModeration.reason}`;
    }
  }

  if (Array.isArray(data.connectionDrafts) && data.connectionDrafts.length > 0) {
    incrementTodo('connections');
    text += `\n\nPassende Verbindungsnachricht\n\n${data.connectionDrafts[0].text}`;
  }

  if (Array.isArray(data.commentDrafts) && data.commentDrafts.length > 1) {
    const alternatives = data.commentDrafts
      .slice(1)
      .map((draft, index) => `Alternative ${index + 1}\n${draft.text}`)
      .join('\n\n');
    text += `\n\n${alternatives}`;
  }

  addMessage('assistant', text);
}

function renderDmResponse(data, todoId) {
  if (!data.ok || !data.primaryDm) {
    addMessage('assistant', data.message || 'Keine DM-Vorlage erzeugt.');
    return;
  }

  incrementTodo(todoId || 'dms');

  const title = todoId === 'connections' ? 'Primäre Verbindungsnachricht' : 'Primäre DM-Vorlage';
  let text = `${title}\n\n${data.primaryDm.text}`;

  if (data.primaryDm.modelModeration) {
    text += `\n\nModellprüfung\n${data.primaryDm.modelModeration.decision} · ${data.primaryDm.modelModeration.model}`;
    if (data.primaryDm.modelModeration.reason) {
      text += `\n${data.primaryDm.modelModeration.reason}`;
    }
  }

  if (Array.isArray(data.dmDrafts) && data.dmDrafts.length > 1) {
    const alternatives = data.dmDrafts
      .slice(1)
      .map((draft, index) => `Alternative ${index + 1}\n${draft.text}`)
      .join('\n\n');
    text += `\n\n${alternatives}`;
  }

  addMessage('assistant', text);
}

async function callApi(endpoint, payload) {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Unbekannter Fehler');
  }
  return data;
}

modeButtons.forEach((button) => {
  button.addEventListener('click', () => setMode(button.dataset.mode));
});

stageInput.addEventListener('change', syncDmTaskFields);

composer.addEventListener('submit', async (event) => {
  event.preventDefault();
  const input = mainInput.value.trim();
  if (!input) return;

  submitButton.disabled = true;
  addMessage('user', input);
  addMessage('system', mode === 'comment' ? 'Kommentar wird erzeugt ...' : 'Vorlage wird erzeugt ...');

  try {
    if (mode === 'comment') {
      const data = await callApi('/api/linkedin/comment', { postText: input });
      chat.removeChild(chat.lastElementChild);
      renderCommentResponse(data);
    } else {
      const selectedTask = getSelectedDmTask();
      const data = await callApi('/api/linkedin/dm', {
        signalText: input,
        profile: profileInput.value.trim(),
        postTopic: topicInput.value.trim(),
        trigger: triggerInput.value.trim() || selectedTask.defaultTrigger,
        stage: selectedTask.stage,
        dailyTaskId: selectedTask.id,
      });
      chat.removeChild(chat.lastElementChild);
      renderDmResponse(data, selectedTask.id);
    }
  } catch (error) {
    chat.removeChild(chat.lastElementChild);
    addMessage('assistant', `Fehler\n\n${error.message}`);
  } finally {
    submitButton.disabled = false;
  }
});

renderDmTaskOptions();
syncDmTaskFields();
setMode('comment');
formatTodoDate();
renderTodos();
addMessage('assistant', 'Post einfügen und Kommentar holen. Oder auf DM-Vorlage wechseln und ein Signal eingeben.');