const tableBody = document.getElementById("devicesTableBody");
const emptyState = document.getElementById("emptyState");
const searchInput = document.getElementById("searchInput");

const modalOverlay = document.getElementById("modalOverlay");
const openModalBtn = document.getElementById("openModalBtn");
const closeModalBtn = document.getElementById("closeModalBtn");
const cancelBtn = document.getElementById("cancelBtn");
const deviceForm = document.getElementById("deviceForm");
const toast = document.getElementById("toast");

const pingAllBtn = document.getElementById("pingAllBtn");
const excelInput = document.getElementById("excelInput");
const modalTitle = document.getElementById("modalTitle");
const saveBtn = document.getElementById("saveBtn");

const totalCount = document.getElementById("totalCount");
const onlineCount = document.getElementById("onlineCount");
const offlineCount = document.getElementById("offlineCount");
const unknownCount = document.getElementById("unknownCount");

const deleteSelectedBtn = document.getElementById("deleteSelectedBtn");
const selectAllCheckbox = document.getElementById("selectAllCheckbox");

let devices = [];
let selectedIds = new Set();
let editingId = null;

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("active");

  setTimeout(() => {
    toast.classList.remove("active");
  }, 4000);
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function openModal(device = null) {
  editingId = device ? device.id : null;

  if (device) {
    modalTitle.textContent = "Editar Equipamento";
    saveBtn.textContent = "Salvar alterações";

    document.getElementById("vlan").value = device.vlan || "";
    document.getElementById("nome").value = device.nome || "";
    document.getElementById("ip").value = device.ip || "";
    document.getElementById("area").value = device.area || "";
    document.getElementById("servicoModelo").value = device.servicoModelo || "";
  } else {
    modalTitle.textContent = "Cadastrar Novo Equipamento";
    saveBtn.textContent = "Salvar";
    deviceForm.reset();
  }

  modalOverlay.classList.add("active");
}

function closeModal() {
  modalOverlay.classList.remove("active");
  deviceForm.reset();
  editingId = null;
}

function getStatusBadge(status) {
  if (status === "Online") {
    return `<span class="badge badge-online">● Online</span>`;
  }

  if (status === "Offline") {
    return `<span class="badge badge-offline">● Offline</span>`;
  }

  return `<span class="badge badge-unknown">● Não testado</span>`;
}

function updateCounters(data) {
  const total = data.length;
  const online = data.filter((item) => item.status === "Online").length;
  const offline = data.filter((item) => item.status === "Offline").length;

  const unknown = data.filter((item) => {
    return (
      !item.status ||
      item.status === "Não testado" ||
      item.status === "Desconhecido"
    );
  }).length;

  totalCount.textContent = total;
  onlineCount.textContent = online;
  offlineCount.textContent = offline;
  unknownCount.textContent = unknown;
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function updateSelectionUi() {
  const selectedCount = selectedIds.size;

  deleteSelectedBtn.disabled = selectedCount === 0;

  deleteSelectedBtn.textContent = selectedCount > 0
    ? `Excluir selecionados (${selectedCount})`
    : "Excluir selecionados";

  const visibleIds = devices.map((device) => Number(device.id));

  const allVisibleSelected =
    visibleIds.length > 0 &&
    visibleIds.every((id) => selectedIds.has(id));

  selectAllCheckbox.checked = allVisibleSelected;

  selectAllCheckbox.indeterminate =
    selectedCount > 0 && !allVisibleSelected;
}

function toggleSelectDevice(id, checked) {
  const numericId = Number(id);

  if (checked) {
    selectedIds.add(numericId);
  } else {
    selectedIds.delete(numericId);
  }

  const row = document.querySelector(`tr[data-id="${numericId}"]`);

  if (row) {
    row.classList.toggle("selected-row", checked);
  }

  updateSelectionUi();
}

function toggleSelectAll(checked) {
  devices.forEach((device) => {
    const id = Number(device.id);

    if (checked) {
      selectedIds.add(id);
    } else {
      selectedIds.delete(id);
    }
  });

  renderTable(devices);
}

async function deleteSelectedDevices() {
  if (!selectedIds.size) {
    showToast("Nenhum equipamento selecionado.");
    return;
  }

  const ids = Array.from(selectedIds);

  const confirmar = confirm(
    `Deseja realmente excluir ${ids.length} equipamento(s) selecionado(s)?`
  );

  if (!confirmar) return;

  deleteSelectedBtn.disabled = true;
  deleteSelectedBtn.textContent = "Excluindo...";

  try {
    const response = await fetch("/api/equipamentos/bulk-delete", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        ids
      })
    });

    const result = await response.json();

    if (!response.ok) {
      showToast(result.message || "Erro ao excluir equipamentos.");
      return;
    }

    selectedIds.clear();

    showToast(`${result.removidos} equipamento(s) excluído(s) com sucesso.`);

    await loadDevices();
  } catch (error) {
    console.error(error);
    showToast("Erro ao excluir equipamentos selecionados.");
  } finally {
    updateSelectionUi();
  }
}

function renderTable(data) {
  tableBody.innerHTML = "";

  updateCounters(data);

  if (!data.length) {
    emptyState.style.display = "block";
    updateSelectionUi();
    return;
  }

  emptyState.style.display = "none";

  data.forEach((device) => {
    const tr = document.createElement("tr");
    const deviceId = Number(device.id);
    const isSelected = selectedIds.has(deviceId);

    tr.setAttribute("data-id", deviceId);

    if (isSelected) {
      tr.classList.add("selected-row");
    }

    tr.innerHTML = `
      <td class="select-column"

>         <input
          type="checkbox"
          class="row-checkbox"
          ${isSelected ? "checked" : ""}
          onchange="toggleSelectDevice(${deviceId}, this.checked)"
        />
      </td>

      <td>${escapeHtml(device.vlan) || "-"}</td>

      <td class="device-name"

>         ${escapeHtml(device.nome) || "-"}
      </td>

      <td class="ip-link"

>         ${escapeHtml(device.ip) || "-"}
      </td>

      <td>${escapeHtml(device.area) || "-"}</td>

      <td>${escapeHtml(device.servicoModelo) || "-"}</td>

      <td>${getStatusBadge(device.status)}</td>

      <td>
        <div class="actions"

>           <button class="btn-outline" onclick="testPing(${deviceId})"

>             Testar Ping
          </button>

          <button class="btn-outline" onclick="editDevice(${deviceId})"

>             Editar
          </button>

          <button class="btn-outline btn-danger" onclick="deleteDevice(${deviceId})"

>             Excluir
          </button>
        </div>
      </td>
    `;

    tableBody.appendChild(tr);
  });

  updateSelectionUi();
}

async function loadDevices() {
  try {
    const search = searchInput.value.trim();

    const response = await fetch(`/api/equipamentos?search=${encodeURIComponent(search)}`);

    if (!response.ok) {
      showToast("Erro ao carregar equipamentos.");
      return;
    }

    devices = await response.json();

    const validVisibleIds = new Set(devices.map((item) => Number(item.id)));

    selectedIds.forEach((id) => {
      if (!validVisibleIds.has(id)) {
        selectedIds.delete(id);
      }
    });

    renderTable(devices);
  } catch (error) {
    console.error(error);
    showToast("Não foi possível conectar ao servidor.");
  }
}

async function testPing(id) {
  const device = devices.find((item) => Number(item.id) === Number(id));

  if (!device) {
    showToast("Equipamento não encontrado.");
    return;
  }

  showToast(`Testando ping para ${device.ip}...`);

  try {
    const response = await fetch(`/api/equipamentos/${id}/ping`, {
      method: "POST"
    });

    const result = await response.json();

    if (!response.ok) {
      showToast(result.message || "Erro ao testar ping.");
      return;
    }

    await loadDevices();

    const status = result.equipamento.status;
    const tempo = result.equipamento.tempoResposta || "-";

    if (status === "Online") {
      showToast(`${device.nome} está online. Tempo: ${tempo} ms`);
    } else {
      showToast(`${device.nome} está offline ou não respondeu.`);
    }
  } catch (error) {
    console.error(error);
    showToast("Não foi possível executar o teste de ping.");
  }
}

async function testAllPings() {
  if (!devices.length) {
    showToast("Não há equipamentos para testar.");
    return;
  }

  const confirmar = confirm(
    `Deseja testar o ping de todos os ${devices.length} equipamentos? Os testes serão feitos em lotes de 5.`
  );

  if (!confirmar) return;

  const batchSize = 5;
  const devicesToTest = [...devices];
  const total = devicesToTest.length;

  let processed = 0;
  let online = 0;
  let offline = 0;
  let errors = 0;

  pingAllBtn.disabled = true;
  pingAllBtn.textContent = `Testando 0/${total}`;

  showToast("Iniciando teste de ping em lotes de 5 equipamentos...");

  try {
    for (let i = 0; i < devicesToTest.length; i += batchSize) {
      const batch = devicesToTest.slice(i, i + batchSize);

      const ids = batch.map((device) => Number(device.id));

      const response = await fetch("/api/equipamentos/ping-batch", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          ids
        })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "Erro ao testar lote de pings.");
      }

      result.resultados.forEach((item) => {
        processed++;

        if (!item.encontrado || !item.equipamento) {
          errors++;
          return;
        }

        const updatedDevice = item.equipamento;

        const index = devices.findIndex((device) => {
          return Number(device.id) === Number(updatedDevice.id);
        });

        if (index >= 0) {
          devices[index] = updatedDevice;
        }

        if (updatedDevice.status === "Online") {
          online++;
        } else if (updatedDevice.status === "Offline") {
          offline++;
        } else {
          errors++;
        }
      });

      renderTable(devices);

      pingAllBtn.textContent = `Testando ${processed}/${total}`;

      showToast(
        `Progresso: ${processed}/${total}. Online: ${online}, Offline: ${offline}, Erros: ${errors}.`
      );

      await delay(300);
    }

    await loadDevices();

    showToast(
      `Teste concluído. Total: ${total}, Online: ${online}, Offline: ${offline}, Erros: ${errors}.`
    );
  } catch (error) {
    console.error(error);
    showToast("Erro ao executar teste geral de ping.");
  } finally {
    pingAllBtn.disabled = false;
    pingAllBtn.textContent = "Testar todos os pings";
  }
}

function editDevice(id) {
  const device = devices.find((item) => Number(item.id) === Number(id));

  if (!device) {
    showToast("Equipamento não encontrado.");
    return;
  }

  openModal(device);
}

async function deleteDevice(id) {
  const confirmDelete = confirm("Deseja realmente excluir este equipamento?");

  if (!confirmDelete) return;

  try {
    const response = await fetch(`/api/equipamentos/${id}`, {
      method: "DELETE"
    });

    const result = await response.json();

    if (!response.ok) {
      showToast(result.message || "Erro ao excluir equipamento.");
      return;
    }

    selectedIds.delete(Number(id));

    showToast("Equipamento excluído com sucesso.");
    await loadDevices();
  } catch (error) {
    console.error(error);
    showToast("Erro ao excluir equipamento.");
  }
}

deviceForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const payload = {
    vlan: document.getElementById("vlan").value.trim(),
    nome: document.getElementById("nome").value.trim(),
    ip: document.getElementById("ip").value.trim(),
    area: document.getElementById("area").value.trim(),
    servicoModelo: document.getElementById("servicoModelo").value.trim()
  };

  const isEditing = editingId !== null;

  const url = isEditing
    ? `/api/equipamentos/${editingId}`
    : "/api/equipamentos";

  const method = isEditing ? "PUT" : "POST";

  try {
    const response = await fetch(url, {
      method,
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    const result = await response.json();

    if (!response.ok) {
      showToast(result.message || "Erro ao salvar equipamento.");
      return;
    }

    showToast(
      isEditing
        ? "Equipamento atualizado com sucesso."
        : "Equipamento cadastrado com sucesso."
    );

    closeModal();
    await loadDevices();
  } catch (error) {
    console.error(error);
    showToast("Erro ao salvar equipamento.");
  }
});

function normalizeHeader(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function extractVlanFromText(value) {
  const text = String(value || "").trim();

  const vlanMatch = text.match(/vlan\s*(\d+)/i);

  if (vlanMatch) {
    return vlanMatch[1];
  }

  const numberMatch = text.match(/\b\d{2,5}\b/);

  if (numberMatch) {
    return numberMatch[0];
  }

  return "";
}

function parseExcelRows(rows, sheetVlan = "") {
  const equipamentos = [];

  let currentVlan = sheetVlan;
  let headerMap = null;

  for (const row of rows) {
    const cells = row.map((cell) => String(cell || "").trim());
    const firstCell = cells[0] || "";

    const vlanFromText = extractVlanFromText(firstCell);

    if (!sheetVlan && vlanFromText) {
      currentVlan = vlanFromText;
    }

    const normalizedCells = cells.map(normalizeHeader);

    const hasNameHeader =
      normalizedCells.includes("name") ||
      normalizedCells.includes("nome");

    const hasIpHeader = normalizedCells.includes("ip");

    if (hasNameHeader && hasIpHeader) {
      headerMap = {
        vlan: normalizedCells.findIndex((cell) => cell === "vlan"),
        nome: normalizedCells.findIndex((cell) => {
          return cell === "name" || cell === "nome";
        }),
        ip: normalizedCells.findIndex((cell) => cell === "ip"),
        area: normalizedCells.findIndex((cell) => {
          return cell === "area";
        }),
        servicoModelo: normalizedCells.findIndex((cell) => {
          return (
            cell === "servico" ||
            cell === "serviço" ||
            cell === "servico / modelo" ||
            cell === "serviço / modelo" ||
            cell === "servico/modelo" ||
            cell === "serviço/modelo" ||
            cell === "modelo"
          );
        })
      };

      continue;
    }

    if (!headerMap) continue;

    const nome = cells[headerMap.nome] || "";
    const ip = cells[headerMap.ip] || "";

    if (!nome && !ip) continue;

    const item = {
      vlan: sheetVlan || currentVlan || (headerMap.vlan >= 0 ? cells[headerMap.vlan] : ""),
      nome,
      ip,
      area: headerMap.area >= 0 ? cells[headerMap.area] : "",
      servicoModelo: headerMap.servicoModelo >= 0 ? cells[headerMap.servicoModelo] : ""
    };

    if (item.nome && item.ip) {
      equipamentos.push(item);
    }
  }

  return equipamentos;
}

async function importExcelFile(file) {
  if (!file) return;

  if (typeof XLSX === "undefined") {
    showToast("Biblioteca de leitura Excel não carregou.");
    return;
  }

  showToast("Lendo arquivo Excel...");

  try {
    const arrayBuffer = await file.arrayBuffer();

    const workbook = XLSX.read(arrayBuffer, {
      type: "array"
    });

    let equipamentos = [];

    workbook.SheetNames.forEach((sheetName) => {
      const sheet = workbook.Sheets[sheetName];

      const sheetVlan = extractVlanFromText(sheetName);

      const rows = XLSX.utils.sheet_to_json(sheet, {
        header: 1,
        defval: ""
      });

      const parsed = parseExcelRows(rows, sheetVlan);
      equipamentos = equipamentos.concat(parsed);
    });

    if (!equipamentos.length) {
      showToast("Nenhum equipamento válido encontrado na planilha.");
      return;
    }

    const confirmar = confirm(
      `Foram encontrados ${equipamentos.length} equipamentos na planilha. Deseja importar agora?`
    );

    if (!confirmar) return;

    const response = await fetch("/api/importar", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        equipamentos
      })
    });

    const result = await response.json();

    if (!response.ok) {
      showToast(result.message || "Erro ao importar planilha.");
      return;
    }

    await loadDevices();

    showToast(
      `Importação concluída. Novos: ${result.importados}, Atualizados: ${result.atualizados}, Ignorados: ${result.ignorados}.`
    );
  } catch (error) {
    console.error(error);
    showToast("Erro ao ler ou importar a planilha.");
  } finally {
    excelInput.value = "";
  }
}

let searchTimeout = null;

searchInput.addEventListener("input", () => {
  clearTimeout(searchTimeout);

  searchTimeout = setTimeout(() => {
    selectedIds.clear();
    loadDevices();
  }, 250);
});

openModalBtn.addEventListener("click", () => openModal());
closeModalBtn.addEventListener("click", closeModal);
cancelBtn.addEventListener("click", closeModal);

pingAllBtn.addEventListener("click", testAllPings);

deleteSelectedBtn.addEventListener("click", deleteSelectedDevices);

selectAllCheckbox.addEventListener("change", (event) => {
  toggleSelectAll(event.target.checked);
});

excelInput.addEventListener("change", (event) => {
  const file = event.target.files[0];
  importExcelFile(file);
});

modalOverlay.addEventListener("click", (event) => {
  if (event.target === modalOverlay) {
    closeModal();
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && modalOverlay.classList.contains("active")) {
    closeModal();
  }
});

loadDevices();