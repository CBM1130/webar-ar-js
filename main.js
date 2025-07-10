// main.js
import * as THREE          from 'https://cdn.jsdelivr.net/npm/three@0.178.0/build/three.module.js';
import { GLTFLoader }      from 'https://cdn.jsdelivr.net/npm/three@0.178.0/examples/jsm/loaders/GLTFLoader.js';
import { ARButton }        from 'https://cdn.jsdelivr.net/npm/three@0.178.0/examples/jsm/webxr/ARButton.js';

let camera, scene, renderer;
let reticle, model, hitTestSource;

init();
animate();

async function init() {
  // 안내용 DOM
  const info = document.getElementById('info');

  // Scene & Camera
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.01, 20);

  // Renderer 설정
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.xr.enabled = true;
  document.body.appendChild(renderer.domElement);

  // 1) WebXR AR 지원 여부 체크
  if (navigator.xr) {
    try {
      const supported = await navigator.xr.isSessionSupported('immersive-ar');
      if (!supported) {
        info.textContent = '죄송합니다: 이 기기는 AR을 지원하지 않습니다.';
        return;
      }
    } catch (err) {
      console.error('WebXR 지원 체크 실패', err);
      info.textContent = 'AR 지원 여부를 확인할 수 없습니다.';
      return;
    }
  } else {
    info.textContent = 'WebXR API를 찾을 수 없습니다.';
    return;
  }

  // 2) ARButton 생성
  const arBtn = ARButton.createButton(renderer, { requiredFeatures: ['hit-test'] });
  arBtn.style.position = 'absolute';
  arBtn.style.top = '10px';
  arBtn.style.left = '50%';
  arBtn.style.transform = 'translateX(-50%)';
  document.body.appendChild(arBtn);

  // 안내 숨기기
  info.style.display = 'none';

  // 3) 조명
  const light = new THREE.HemisphereLight(0xffffff, 0xbbbbff, 1);
  scene.add(light);

  // 4) Reticle (평면 위치 표시)
  const ringGeo = new THREE.RingGeometry(0.15, 0.2, 32).rotateX(-Math.PI / 2);
  const ringMat = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
  reticle = new THREE.Mesh(ringGeo, ringMat);
  reticle.matrixAutoUpdate = false;
  reticle.visible = false;
  scene.add(reticle);

  // 5) 모델 로드 (초기에는 숨김)
  try {
    const gltf = await new GLTFLoader().loadAsync('./model/table_set.glb');
    model = gltf.scene;
    model.visible = false;
    model.scale.set(0.3, 0.3, 0.3);
    scene.add(model);
  } catch (err) {
    console.error('모델 로드 실패', err);
    info.style.display = 'block';
    info.textContent = '3D 모델을 불러오는 데 실패했습니다.';
  }

  // 6) 터치(Select) 이벤트: 모델 배치
  const controller = renderer.xr.getController(0);
  controller.addEventListener('select', () => {
    if (reticle.visible && model) {
      model.position.setFromMatrixPosition(reticle.matrix);
      model.quaternion.setFromRotationMatrix(reticle.matrix);
      model.visible = true;
    }
  });
  scene.add(controller);

  window.addEventListener('resize', onWindowResize);
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
  renderer.setAnimationLoop(render);
}

function render(timestamp, frame) {
  if (frame && !hitTestSource) {
    // 한 번만 Hit Test Source 요청
    const session = renderer.xr.getSession();
    session.requestReferenceSpace('viewer')
      .then(space => session.requestHitTestSource({ space }))
      .then(source => { hitTestSource = source; })
      .catch(err => console.error('Hit test 소스 요청 실패', err));
  }

  if (frame && hitTestSource) {
    const referenceSpace = renderer.xr.getReferenceSpace();
    const hits = frame.getHitTestResults(hitTestSource);
    if (hits.length > 0) {
      const pose = hits[0].getPose(referenceSpace);
      reticle.visible = true;
      reticle.matrix.fromArray(pose.transform.matrix);
    } else {
      reticle.visible = false;
    }
  }

  renderer.render(scene, camera);
}
