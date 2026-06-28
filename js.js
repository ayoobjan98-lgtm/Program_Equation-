import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';

document.addEventListener("DOMContentLoaded", function () {
  const select = document.getElementById("change");
  const container = document.getElementById("solverContainer");
  const solveBtn = document.getElementById("solveBtn");
  const resultBox = document.getElementById("resultBox");
  const stepsBox = document.getElementById("stepsBox");
  const plotContainer = document.getElementById("plotContainer");
  const coordsHud = document.getElementById("coordsHud");
  const coordDisplay = document.getElementById("coordDisplay");

  let n = parseInt(select.value) || 2;
  const STORAGE_KEY = "object";

  // ---- نام مجهولات ----
  function getVarName(n, idx) {
    if (n === 1) return 'x';
    if (n === 2) return (idx === 0 ? 'x' : 'y');
    if (n === 3) return ['x', 'y', 'z'][idx];
    if (n === 4) return ['x', 'y', 'z', 'w'][idx];
    return `x${idx+1}`;
  }

  // ---- placeholder ضرایب ----
  function getCoeffPlaceholder(n, row, col) {
    if (n === 1) return 'a';
    if (n === 2) {
      const map = [['a','b'], ['d','e']];
      return map[row][col];
    }
    if (n === 3) {
      const map = [['a','b','c'], ['e','f','g'], ['i','j','k']];
      return map[row][col];
    }
    if (n === 4) {
      const map = [['a','b','c','d'], ['f','g','h','i'], ['k','l','m','n'], ['p','q','r','s']];
      return map[row][col];
    }
    return `a${row+1}${col+1}`;
  }

  // ---- placeholder سمت راست ----
  function getRHSPlaceholder(n, row) {
    if (n === 1) return 'c';
    if (n === 2) return (row === 0 ? 'c' : 'f');
    if (n === 3) return (row === 0 ? 'd' : row === 1 ? 'h' : 'l');
    if (n === 4) return (row === 0 ? 'e' : row === 1 ? 'j' : row === 2 ? 'o' : 't');
    return `b${row+1}`;
  }

  // ---- ساخت ورودی‌ها ----
  function buildInputs(size) {
    let html = '';
    for (let i = 0; i < size; i++) {
      html += `<div class="equation-row" dir="ltr">`;
      if (size === 1) {
        html += `
          <input type="number" class="coef" data-row="0" data-col="0" placeholder="a" step="any">
          <span class="var-label">x</span>
          <span class="op">+</span>
          <input type="number" class="const" data-row="0" placeholder="b" step="any">
          <span class="eq-sign">=</span>
          <input type="number" class="rhs" data-row="0" placeholder="c" step="any">
        `;
      } else {
        for (let j = 0; j < size; j++) {
          html += `
            <input type="number" class="coef" data-row="${i}" data-col="${j}" placeholder="${getCoeffPlaceholder(size, i, j)}" step="any">
            <span class="var-label">${getVarName(size, j)}</span>
          `;
          if (j < size - 1) html += `<span class="op">+</span>`;
        }
        html += `<span class="eq-sign">=</span>`;
        html += `<input type="number" class="rhs" data-row="${i}" placeholder="${getRHSPlaceholder(size, i)}" step="any">`;
      }
      html += `</div>`;
    }
    container.innerHTML = html;
  }

  buildInputs(n);

  // ---- تغییر تعداد مجهولات ----
  select.addEventListener("change", function () {
    n = parseInt(this.value);
    buildInputs(n);
    resultBox.style.display = "none";
    stepsBox.style.display = "none";
    plotContainer.style.display = "none";
    coordsHud.style.display = "none";
    // پاک کردن Three.js
    if (window._sceneCleanup) {
      window._sceneCleanup();
      window._sceneCleanup = null;
    }
    // پاک کردن Plotly
    if (window.Plotly) {
      Plotly.purge(plotContainer);
    }
  });

  // ---- جمع‌آوری ماتریس ----
  function getMatrix() {
    const A = Array.from({ length: n }, () => Array(n).fill(0));
    const b = Array(n).fill(0);

    document.querySelectorAll(".coef").forEach(inp => {
      const r = parseInt(inp.dataset.row);
      const c = parseInt(inp.dataset.col);
      A[r][c] = parseFloat(inp.value) || 0;
    });

    document.querySelectorAll(".rhs").forEach(inp => {
      const r = parseInt(inp.dataset.row);
      b[r] = parseFloat(inp.value) || 0;
    });

    if (n === 1) {
      const constInputs = document.querySelectorAll(".const");
      if (constInputs.length > 0) {
        const bVal = parseFloat(constInputs[0].value) || 0;
        b[0] = b[0] - bVal;
      }
    }

    return { A, b };
  }

  // ---- حل با گاوس-جردن ----
  function solveWithSteps(A, b) {
    const M = A.map(row => row.slice());
    const rhs = [...b];
    const size = M.length;
    const steps = [];
    const EPS = 1e-10;

    function matrixToString(mat, vec) {
      let s = "";
      for (let i = 0; i < mat.length; i++) {
        s += "[ " + mat[i].map(v => v.toFixed(3)).join("  ") + " | " + vec[i].toFixed(3) + " ]\n";
      }
      return s;
    }

    steps.push("📌 ماتریس اولیه:\n" + matrixToString(M, rhs));

    let rank = 0;
    for (let col = 0; col < size; col++) {
      let pivot = -1, maxVal = 0;
      for (let r = rank; r < size; r++) {
        if (Math.abs(M[r][col]) > maxVal) {
          maxVal = Math.abs(M[r][col]);
          pivot = r;
        }
      }
      if (pivot === -1 || maxVal < EPS) continue;

      if (pivot !== rank) {
        [M[rank], M[pivot]] = [M[pivot], M[rank]];
        [rhs[rank], rhs[pivot]] = [rhs[pivot], rhs[rank]];
        steps.push(`↕️ جابجایی سطر ${rank+1} و ${pivot+1}:\n` + matrixToString(M, rhs));
      }

      const pivVal = M[rank][col];
      for (let c = col; c < size; c++) M[rank][c] /= pivVal;
      rhs[rank] /= pivVal;
      steps.push(`➗ نرمال‌سازی سطر ${rank+1} (تقسیم بر ${pivVal.toFixed(3)}):\n` + matrixToString(M, rhs));

      for (let r = 0; r < size; r++) {
        if (r === rank) continue;
        const factor = M[r][col];
        if (Math.abs(factor) < EPS) continue;
        for (let c = col; c < size; c++) M[r][c] -= factor * M[rank][c];
        rhs[r] -= factor * rhs[rank];
        steps.push(`✖️ حذف از سطر ${r+1} (ضریب ${factor.toFixed(3)}):\n` + matrixToString(M, rhs));
      }
      rank++;
    }

    for (let r = 0; r < size; r++) {
      const allZero = M[r].every(v => Math.abs(v) < EPS);
      if (allZero && Math.abs(rhs[r]) > EPS) {
        return { type: "inconsistent", steps };
      }
    }

    if (rank === size) return { type: "unique", solution: rhs, steps };
    else return { type: "infinite", steps };
  }

  // ---- تابع رسم با Plotly برای ۱ و ۲ بعد ----
  function plotWithPlotly(n, result, A, b) {
    plotContainer.style.display = 'block';
    coordsHud.style.display = 'none';

    // پاک کردن محتوای قبلی Plotly
    if (window.Plotly) {
      Plotly.purge(plotContainer);
    }

    if (result.type === 'inconsistent') {
      plotContainer.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;height:100%;background:#f8f9fa;color:#e74c3c;font-family:Vazir;font-size:18px;">❌ دستگاه ناسازگار است، قابل رسم نیست.</div>`;
      return;
    }

    if (n === 1) {
      // ---- رسم روی محور اعداد ----
      const xVal = result.solution[0];
      const trace = {
        x: [xVal],
        y: [0],
        mode: 'markers',
        marker: { size: 20, color: 'red' },
        name: 'جواب'
      };
      const layout = {
        title: 'جواب روی محور اعداد',
        xaxis: { title: 'x', range: [xVal - 5, xVal + 5] },
        yaxis: { showticklabels: false, showgrid: false, zeroline: false }
      };
      Plotly.newPlot(plotContainer, [trace], layout);
      return;
    }

    if (n === 2) {
      if (result.type === 'unique') {
        // ---- نقطه ----
        const x = result.solution[0];
        const y = result.solution[1];
        const trace = {
          x: [x],
          y: [y],
          mode: 'markers',
          marker: { size: 18, color: 'red' },
          name: 'جواب یکتا'
        };
        const layout = {
          title: 'دستگاه مختصات دو بعدی',
          xaxis: { title: 'x', range: [x - 5, x + 5] },
          yaxis: { title: 'y', range: [y - 5, y + 5] },
          showlegend: true
        };
        Plotly.newPlot(plotContainer, [trace], layout);
      } else if (result.type === 'infinite') {
        // ---- رسم خط ----
        const a = A[0][0];
        const bb = A[0][1];
        const c = b[0];
        let pts = [];
        const range = 15;
        if (Math.abs(bb) > 1e-10) {
          const x1 = -range;
          const y1 = (c - a * x1) / bb;
          const x2 = range;
          const y2 = (c - a * x2) / bb;
          pts = [{ x: x1, y: y1 }, { x: x2, y: y2 }];
        } else if (Math.abs(a) > 1e-10) {
          const x0 = c / a;
          pts = [{ x: x0, y: -range }, { x: x0, y: range }];
        } else {
          plotContainer.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;height:100%;background:#f8f9fa;color:#e67e22;font-family:Vazir;font-size:16px;">⚠️ خط قابل تشخیص نیست.</div>`;
          return;
        }
        const trace = {
          x: pts.map(p => p.x),
          y: pts.map(p => p.y),
          mode: 'lines',
          line: { color: 'blue', width: 4 },
          name: 'خط جواب'
        };
        const layout = {
          title: 'دستگاه مختصات دو بعدی (بی‌نهایت جواب)',
          xaxis: { title: 'x', range: [-range, range] },
          yaxis: { title: 'y', range: [-range, range] },
          showlegend: true
        };
        Plotly.newPlot(plotContainer, [trace], layout);
      }
      return;
    }
  }

  // ---- تابع رسم با Three.js برای ۳ بعد ----
  function plotThreeSolution(point) {
    // پاک کردن محتوای قبلی
    plotContainer.innerHTML = '';
    plotContainer.style.display = 'block';
    coordsHud.style.display = 'block';
    coordDisplay.textContent = `(${point.x.toFixed(3)}, ${point.y.toFixed(3)}, ${point.z.toFixed(3)})`;

    // ---------- صحنه ----------
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0f0c29);

    // ---------- دوربین ----------
    const rect = plotContainer.getBoundingClientRect();
    const width = rect.width || 600;
    const height = rect.height || 450;
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    const dist = Math.max(Math.abs(point.x), Math.abs(point.y), Math.abs(point.z)) + 6;
    camera.position.set(point.x + dist * 0.8, point.y + dist * 0.6, point.z + dist);
    camera.lookAt(point.x, point.y, point.z);

    // ---------- رندرر WebGL ----------
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    plotContainer.appendChild(renderer.domElement);

    // ---------- رندرر CSS2D ----------
    const labelRenderer = new CSS2DRenderer();
    labelRenderer.setSize(width, height);
    labelRenderer.domElement.style.position = 'absolute';
    labelRenderer.domElement.style.top = '0';
    labelRenderer.domElement.style.left = '0';
    labelRenderer.domElement.style.pointerEvents = 'none';
    plotContainer.appendChild(labelRenderer.domElement);

    // ---------- کنترل‌ها ----------
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(point.x, point.y, point.z);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 1.5;
    controls.update();

    // ---------- نورپردازی ----------
    const ambient = new THREE.AmbientLight(0x404060);
    scene.add(ambient);
    const mainLight = new THREE.DirectionalLight(0xffeedd, 1.2);
    mainLight.position.set(5, 10, 7);
    mainLight.castShadow = true;
    scene.add(mainLight);
    const fillLight = new THREE.DirectionalLight(0x4488ff, 0.6);
    fillLight.position.set(-4, -2, 3);
    scene.add(fillLight);
    const backLight = new THREE.DirectionalLight(0x4466ff, 0.4);
    backLight.position.set(-3, 1, -5);
    scene.add(backLight);

    // ---------- محورهای مختصات با تیک و برچسب ----------
    function createAxesWithTicks(origin, length) {
      const colors = [0xff4444, 0x44ff44, 0x4488ff];
      const labels = ['X', 'Y', 'Z'];
      const dirs = [
        new THREE.Vector3(1,0,0),
        new THREE.Vector3(0,1,0),
        new THREE.Vector3(0,0,1)
      ];

      dirs.forEach((dir, i) => {
        // فلش محور
        const arrow = new THREE.ArrowHelper(dir, origin, length, colors[i], 0.6, 0.3);
        scene.add(arrow);

        // برچسب انتهای محور
        const div = document.createElement('div');
        div.textContent = labels[i];
        div.style.color = '#fff';
        div.style.fontSize = '22px';
        div.style.fontWeight = 'bold';
        div.style.textShadow = '0 0 15px rgba(0,0,0,0.9)';
        div.style.fontFamily = 'Arial, sans-serif';
        const labelObj = new CSS2DObject(div);
        const pos = dir.clone().multiplyScalar(length + 0.8);
        labelObj.position.copy(pos);
        scene.add(labelObj);

        // تیک‌های درجه‌بندی
        const step = 1;
        const tickLength = 0.15;
        const maxVal = Math.floor(length);
        for (let v = -maxVal; v <= maxVal; v++) {
          if (Math.abs(v) < 0.01) continue;
          const posTick = dir.clone().multiplyScalar(v);
          
          const perpDir = new THREE.Vector3();
          if (i === 0) perpDir.set(0, 1, 0);
          else if (i === 1) perpDir.set(1, 0, 0);
          else perpDir.set(0, 1, 0);
          
          const p1 = posTick.clone().add(perpDir.clone().multiplyScalar(-tickLength));
          const p2 = posTick.clone().add(perpDir.clone().multiplyScalar(tickLength));
          const geo = new THREE.BufferGeometry().setFromPoints([p1, p2]);
          const mat = new THREE.LineBasicMaterial({ 
            color: colors[i], 
            transparent: true, 
            opacity: 0.5 
          });
          const line = new THREE.Line(geo, mat);
          scene.add(line);

          // عدد تیک
          const numDiv = document.createElement('div');
          numDiv.textContent = v;
          numDiv.style.color = '#aaa';
          numDiv.style.fontSize = '12px';
          numDiv.style.textShadow = '0 0 8px rgba(0,0,0,0.9)';
          numDiv.style.fontFamily = 'Arial, sans-serif';
          const numLabel = new CSS2DObject(numDiv);
          const offset = new THREE.Vector3();
          if (i === 0) offset.set(0, -0.4, 0);
          else if (i === 1) offset.set(-0.4, 0, 0);
          else offset.set(0, 0.4, 0);
          numLabel.position.copy(posTick.clone().add(offset));
          scene.add(numLabel);
        }
      });
    }

    const axisLength = Math.max(
      Math.abs(point.x) + 2,
      Math.abs(point.y) + 2,
      Math.abs(point.z) + 2,
      5
    );
    createAxesWithTicks(new THREE.Vector3(0,0,0), axisLength);

    // ---------- شبکه ----------
    const gridHelper = new THREE.GridHelper(axisLength * 2, 20, 0x88aaff, 0x335588);
    gridHelper.position.y = -0.01;
    scene.add(gridHelper);

    // ---------- نقطه جواب ----------
    const sphereGeo = new THREE.SphereGeometry(0.6, 48, 48);
    const sphereMat = new THREE.MeshStandardMaterial({
      color: 0xff3333,
      emissive: 0x441111,
      roughness: 0.2,
      metalness: 0.1,
    });
    const sphere = new THREE.Mesh(sphereGeo, sphereMat);
    sphere.position.set(point.x, point.y, point.z);
    sphere.castShadow = true;
    scene.add(sphere);

    // حلقه‌های پالس
    const ringMat = new THREE.MeshStandardMaterial({
      color: 0xff6666,
      transparent: true,
      opacity: 0.6,
      side: THREE.DoubleSide,
    });
    const ring1 = new THREE.Mesh(new THREE.RingGeometry(0.7, 0.9, 32), ringMat);
    ring1.position.set(point.x, point.y, point.z);
    ring1.lookAt(camera.position);
    scene.add(ring1);
    const ring2 = new THREE.Mesh(new THREE.RingGeometry(0.7, 0.9, 32), ringMat);
    ring2.position.set(point.x, point.y, point.z);
    ring2.lookAt(camera.position);
    ring2.rotation.x = Math.PI / 2;
    scene.add(ring2);

    const glowLight = new THREE.PointLight(0xff3333, 1, 5);
    glowLight.position.set(point.x, point.y, point.z);
    scene.add(glowLight);

    // ---------- خطوط پرتاب ----------
    function addProjection(axis, color, coordValue) {
      const proj = new THREE.Vector3(0,0,0);
      if (axis === 'x') proj.set(point.x, 0, 0);
      else if (axis === 'y') proj.set(0, point.y, 0);
      else if (axis === 'z') proj.set(0, 0, point.z);

      const pts = [new THREE.Vector3(point.x, point.y, point.z), proj];
      const geo = new THREE.BufferGeometry().setFromPoints(pts);
      const mat = new THREE.LineDashedMaterial({
        color: color,
        dashSize: 0.15,
        gapSize: 0.1,
      });
      const line = new THREE.Line(geo, mat);
      line.computeLineDistances();
      scene.add(line);

      const dotGeo = new THREE.SphereGeometry(0.12, 16, 16);
      const dotMat = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.3 });
      const dot = new THREE.Mesh(dotGeo, dotMat);
      dot.position.copy(proj);
      scene.add(dot);

      const valDiv = document.createElement('div');
      valDiv.textContent = coordValue.toFixed(2);
      valDiv.style.color = '#fff';
      valDiv.style.fontSize = '14px';
      valDiv.style.fontWeight = 'bold';
      valDiv.style.textShadow = '0 0 8px rgba(0,0,0,0.9)';
      valDiv.style.backgroundColor = 'rgba(0,0,0,0.55)';
      valDiv.style.padding = '2px 10px';
      valDiv.style.borderRadius = '14px';
      valDiv.style.border = `1px solid ${new THREE.Color(color).getStyle()}`;
      valDiv.style.fontFamily = 'Arial, sans-serif';
      valDiv.style.backdropFilter = 'blur(2px)';
      const valLabel = new CSS2DObject(valDiv);
      const offset = new THREE.Vector3(0,0,0);
      if (axis === 'x') offset.set(0, -0.5, 0);
      else if (axis === 'y') offset.set(0.5, 0, 0);
      else if (axis === 'z') offset.set(0, 0.5, 0);
      valLabel.position.copy(proj.clone().add(offset));
      scene.add(valLabel);
    }

    addProjection('x', 0xff4444, point.x);
    addProjection('y', 0x44ff44, point.y);
    addProjection('z', 0x4488ff, point.z);

    // ---------- انیمیشن ----------
    function animate() {
      const elapsed = performance.now() / 1000;
      ring1.rotation.z = elapsed * 0.5;
      ring2.rotation.x = Math.PI / 2 + elapsed * 0.5;
      const scale = 1 + Math.sin(elapsed * 2) * 0.15;
      ring1.scale.set(scale, scale, scale);
      ring2.scale.set(scale, scale, scale);
      ring1.material.opacity = 0.5 + Math.sin(elapsed * 2) * 0.3;
      ring2.material.opacity = 0.5 + Math.sin(elapsed * 2 + 1) * 0.3;

      controls.update();
      renderer.render(scene, camera);
      labelRenderer.render(scene, camera);
      requestAnimationFrame(animate);
    }
    animate();

    // ---------- تغییر اندازه ----------
    function resize() {
      const r = plotContainer.getBoundingClientRect();
      const w = r.width || 600;
      const h = r.height || 450;
      renderer.setSize(w, h);
      labelRenderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }
    window.addEventListener('resize', resize);

    // ---------- پاک‌سازی ----------
    function cleanup() {
      window.removeEventListener('resize', resize);
      renderer.dispose();
      labelRenderer.domElement.remove();
      plotContainer.innerHTML = '';
      coordsHud.style.display = 'none';
    }
    window._sceneCleanup = cleanup;
  }

  // ---- دکمه حل ----
  solveBtn.addEventListener("click", function () {
    const { A, b } = getMatrix();

    let allFilled = true;
    document.querySelectorAll(".coef, .rhs, .const").forEach(inp => {
      if (inp.value.trim() === "") allFilled = false;
    });
    if (!allFilled) {
      resultBox.style.display = "block";
      resultBox.style.background = "#ffeaa7";
      resultBox.style.borderColor = "#fdcb6e";
      resultBox.innerHTML = "⚠️ لطفاً همه کادرها را پر کنید.";
      stepsBox.style.display = "none";
      plotContainer.style.display = "none";
      coordsHud.style.display = "none";
      return;
    }

    const result = solveWithSteps(A, b);

    resultBox.style.display = "block";
    resultBox.style.background = "#e8f4fd";
    resultBox.style.borderColor = "#0984e3";
    let displayText = "";
    if (result.type === "unique") {
      const vars = result.solution.map((val, idx) => `${getVarName(n, idx)} = ${val.toFixed(4)}`);
      displayText = "✅ جواب یکتا: " + vars.join(" | ");
    } else if (result.type === "infinite") {
      displayText = "♾️ دستگاه بی‌نهایت جواب دارد";
    } else {
      displayText = "❌ دستگاه ناسازگار (بدون جواب)";
    }
    resultBox.innerHTML = displayText;

    if (result.steps && result.steps.length > 0) {
      stepsBox.style.display = "block";
      stepsBox.innerHTML = "🧾 <strong>مراحل حل (گاوس-جردن):</strong><br><br>" +
        result.steps.map(s => `<div>${s.replace(/\n/g, '<br>')}</div>`).join("");
    } else {
      stepsBox.style.display = "none";
    }

    // ===== انتخاب روش رسم =====
    // برای ۱ و ۲ بعد از Plotly استفاده کن
    if (n <= 2) {
      // پاک کردن Three.js اگر فعال بود
      if (window._sceneCleanup) {
        window._sceneCleanup();
        window._sceneCleanup = null;
      }
      plotWithPlotly(n, result, A, b);
    }
    // برای ۳ بعد از Three.js استفاده کن
    else if (n === 3 && result.type === 'unique') {
      // پاک کردن Plotly
      if (window.Plotly) {
        Plotly.purge(plotContainer);
      }
      if (window._sceneCleanup) {
        window._sceneCleanup();
        window._sceneCleanup = null;
      }
      plotThreeSolution({
        x: result.solution[0],
        y: result.solution[1],
        z: result.solution[2]
      });
    } else if (n === 3) {
      plotContainer.style.display = 'block';
      coordsHud.style.display = 'none';
      plotContainer.innerHTML = `
        <div style="display:flex;align-items:center;justify-content:center;height:100%;background:#1a1a2e;color:#f39c12;font-family:Vazir;font-size:18px;text-align:center;padding:20px;">
          ♾️ بی‌نهایت جواب یا ناسازگار<br><span style="font-size:14px;color:#aaa;">رسم برای این حالت با Three.js در حال توسعه است</span>
        </div>
      `;
    } else {
      // n > 3
      plotContainer.style.display = 'block';
      coordsHud.style.display = 'none';
      plotContainer.innerHTML = `
        <div style="display:flex;align-items:center;justify-content:center;height:100%;background:#1a1a2e;color:#3498db;font-family:Vazir;font-size:18px;text-align:center;padding:20px;">
          🔵 رسم برای ${n} مجهول<br><span style="font-size:14px;color:#aaa;">پشتیبانی نمی‌شود</span>
        </div>
      `;
    }

    // ذخیره در localStorage
    const stored = localStorage.getItem(STORAGE_KEY);
    let history = stored ? JSON.parse(stored) : [];
    history.push({
      title: `${n} معادله و ${n} مجهول`,
      text: displayText.replace(/<[^>]*>/g, ''),
      like: false,
      date: new Date().toISOString()
    });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
  });

});
