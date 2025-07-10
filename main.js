// main.js
import * as THREE          from 'https://cdn.jsdelivr.net/npm/three@0.178.0/build/three.module.js';
import { GLTFLoader }      from 'https://cdn.jsdelivr.net/npm/three@0.178.0/examples/jsm/loaders/GLTFLoader.js';
import { ARButton }        from 'https://cdn.jsdelivr.net/npm/three@0.178.0/examples/jsm/webxr/ARButton.js';

let camera, scene, renderer;
let reticle, model;
let hitTestSource = null, localSpace = null;

init();
animate();

function init() {
  // scene & camera
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.01, 20);

  // renderer
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.xr.enabled = true;
  document.body.appendChild(renderer.domElement);

  // ARButton: immersive-ar + hit-test
  document.body.appendChild(ARButton.createButton(renderer, { requiredFeatures: ['hit-test'] }));

  // light
  const light = new THREE.HemisphereLight(0xffffff, 0xbbbbff, 1);
  scene.add(light);

  // reticle for hit-test
  const ringGeo = new THREE.RingGeometry(0.15, 0.2, 32).rotateX(-Math.PI / 2);
  const ringMat = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
  reticle = new THREE.Mesh(ringGeo, ringMat);
  reticle.matrixAutoUpdate = false;
  reticle.visible = false;
  scene.add(reticle);

  // load glTF model (hidden until placed)
  new GLTFLoader().load('./model/table_set.glb', gltf => {
    model = gltf.scene;
    model.visible = false;
    model.scale.set(0.3, 0.3, 0.3);
    scene.add(model);
  });

  // on select (screen tap)
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
  if (frame) {
    const session = renderer.xr.getSession();
    const referenceSpace = renderer.xr.getReferenceSpace();

    if (!hitTestSource) {
      // request hit test ONCE
      session.requestReferenceSpace('viewer').then(viewerRefSpace => {
        session.requestHitTestSource({ space: viewerRefSpace }).then(source => {
          hitTestSource = source;
        });
      });
    }

    if (hitTestSource) {
      const hitTestResults = frame.getHitTestResults(hitTestSource);
      if (hitTestResults.length) {
        const hit = hitTestResults[0];
        const pose = hit.getPose(referenceSpace);
        reticle.visible = true;
        reticle.matrix.fromArray(pose.transform.matrix);
      } else {
        reticle.visible = false;
      }
    }
  }

  renderer.render(scene, camera);
}
