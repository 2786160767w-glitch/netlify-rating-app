const IMAGE_LIST = [
  "2_down.jpg",
  "5_up.jpg",
  "20_down.jpg",
  "29_down.jpg",
  "55_down.jpg",
  "76_up.jpg",
  "84_up.jpg",
  "87_down.jpg",
  "90_up.jpg",
  "100_down.jpg",
  "112_down.jpg",
  "114_down.jpg",
  "121_up.jpg",
  "137_down.jpg",
  "143_down.jpg",
  "178_down.jpg",
  "180_down.jpg",
  "192_down.jpg",
  "226_up.jpg",
  "273_down.jpg"
];

const DIMENSIONS = [
  {
    key: "attractiveness",
    label: "吸引力",
    instruction:
      "请仅根据整体视觉吸引力进行判断，选择两张图片中你认为更具吸引力的一张。这里的吸引力不仅指视觉上更吸引人，也包括更愿意前往、接近或停留的主观意愿。请不要受舒适性或自然性的影响作答。",
    targetTrials: 40
  },
  {
    key: "comfort",
    label: "舒适性",
    instruction:
      "请仅根据空间是否让人感觉舒适、宜停留、放松进行判断，选择两张图片中你认为更舒适的一张。请不要受吸引力或自然性的影响作答。",
    targetTrials: 40
  },
  {
    key: "naturalness",
    label: "自然性",
    instruction:
      "请仅根据空间的自然感进行判断，选择两张图片中你认为更自然的一张。这里的自然性不仅指自然景观要素的多少，也包括自然景观与人工干扰要素之间是否协调。即使两张图片中的自然要素都较少，也请比较哪一张相对更具有自然感。请不要受吸引力或舒适性的影响作答。",
    targetTrials: 40
  }
];

let participant = null;
let currentDimensionIndex = 0;
let currentTrial = null;

const thumbGrid = document.getElementById("thumbGrid");
const intro = document.getElementById("intro");
const moduleIntro = document.getElementById("moduleIntro");
const trialSection = document.getElementById("trialSection");
const doneSection = document.getElementById("doneSection");

const moduleTitle = document.getElementById("moduleTitle");
const moduleInstruction = document.getElementById("moduleInstruction");
const enterModuleBtn = document.getElementById("enterModuleBtn");

const participantText = document.getElementById("participantText");
const progressText = document.getElementById("progressText");
const promptText = document.getElementById("promptText");
const leftImg = document.getElementById("leftImg");
const rightImg = document.getElementById("rightImg");

function renderThumbs() {
  thumbGrid.innerHTML = "";
  IMAGE_LIST.forEach((img) => {
    const div = document.createElement("div");
    div.innerHTML = `<img src="./images/${img}" alt="${img}" />`;
    thumbGrid.appendChild(div);
  });
}

function showModuleIntro() {
  const dim = DIMENSIONS[currentDimensionIndex];
  intro.classList.add("hidden");
  trialSection.classList.add("hidden");
  doneSection.classList.add("hidden");
  moduleIntro.classList.remove("hidden");
  moduleTitle.textContent = `当前模块：${dim.label}`;
  moduleInstruction.textContent = dim.instruction;
}

async function startExperiment() {
  const majorType = document.getElementById("majorType").value;
  const grade = document.getElementById("grade").value.trim();
  const note = document.getElementById("note").value.trim();

  if (!majorType || !grade) {
    alert("请先填写专业类型和年级。");
    return;
  }

  const res = await fetch("/api/start", {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({
      majorType,
      grade,
      note,
      images: IMAGE_LIST,
      dimensions: DIMENSIONS
    })
  });

  participant = await res.json();
  currentDimensionIndex = 0;
  showModuleIntro();
}

async function loadTrial() {
  const dim = DIMENSIONS[currentDimensionIndex];
  const res = await fetch("/api/get-trial", {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({
      participantId: participant.participantId,
      dimension: dim.key,
      images: IMAGE_LIST,
      targetTrials: dim.targetTrials,
      label: dim.label
    })
  });

  const data = await res.json();

  if (data.doneDimension) {
    currentDimensionIndex += 1;
    if (currentDimensionIndex >= DIMENSIONS.length) {
      trialSection.classList.add("hidden");
      doneSection.classList.remove("hidden");
      document.getElementById("doneText").textContent = `受试者编号：${participant.participantId}`;
      return;
    }
    showModuleIntro();
    return;
  }

  currentTrial = data;
  moduleIntro.classList.add("hidden");
  trialSection.classList.remove("hidden");

  participantText.textContent = `受试者编号：${participant.participantId}`;
  progressText.textContent = `进度：${data.progress}/${data.total}`;
  promptText.textContent = `以下两张图片中，哪一张你认为更具有${dim.label}？`;

  leftImg.src = `./images/${data.leftImage}`;
  rightImg.src = `./images/${data.rightImage}`;
}

async function submitChoice(choice) {
  const dim = DIMENSIONS[currentDimensionIndex];
  await fetch("/api/submit-trial", {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({
      participantId: participant.participantId,
      dimension: dim.key,
      leftImage: currentTrial.leftImage,
      rightImage: currentTrial.rightImage,
      choice,
      servedAt: currentTrial.servedAt
    })
  });

  await loadTrial();
}

document.getElementById("startBtn").addEventListener("click", startExperiment);
enterModuleBtn.addEventListener("click", loadTrial);
document.getElementById("chooseLeft").addEventListener("click", () => submitChoice("left"));
document.getElementById("chooseRight").addEventListener("click", () => submitChoice("right"));

renderThumbs();