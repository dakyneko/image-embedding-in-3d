const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.01, 1000);
camera.position.set(6.28, 1.04, 1.16);
camera.setRotationFromQuaternion(new THREE.Quaternion(-0.07, 0, 0.99, -0.042))

function setBgColor(c) {
  fog = new THREE.Fog( c, 1, 1000 );
  scene.fog = fog;
  scene.background = new THREE.Color( c );
}
setBgColor( 0x888888 );

const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight-50);
const elem = renderer.domElement
document.body.prepend(elem);
elem.style.display = 'none';

const flyControls = new THREE.FlyControls(camera, elem);
var adjust_speed_v = 0.01;
flyControls.movementSpeed = adjust_speed_v;

const groupSprites = new THREE.Group();
scene.add(groupSprites);

// parse js params after # of the url
const hashParams = window.location.hash.substring(1).split('&').reduce((res, item) => {
  const idx = item.indexOf('=')
  const [k, v] = [item.substring(0, idx), item.substring(idx+1)];
  res[k] = v;
  return res;
}, {});

const bsize = 0.02
const aratio = 1.*(hashParams.aratio || 0.5625);
var adjust_sprite_v = 20;
const make_sprite = function(x, y, z, imgb64) {
    const image = new Image();
    image.src = imgb64;
    const texture = new THREE.Texture();
    texture.image = image;
    const material = new THREE.SpriteMaterial( { map: texture } );
    const sprite = new THREE.Sprite( material );
    groupSprites.add( sprite );
    image.onload = () => {
        texture.needsUpdate = true;
    }
    sprite.position.set(x, y, z)
    sprite.scale.set(adjust_sprite_v*bsize*aratio, adjust_sprite_v*bsize, adjust_sprite_v*bsize)
    return sprite;
}

const scale_sprite = (factor) => {
    groupSprites.children.forEach(s => {
        s.scale.set(factor*bsize*aratio, factor*bsize, factor*bsize);
    });
};

const $status = document.getElementById('status');
const status = (txt) => { $status.innerHTML = txt };
const $popup = document.querySelector('#popup .content');

const chunks = (hashParams.chunks | 0)
const scale = (hashParams.scale | 1)
const fpaths = (chunks > 0)
?  Array(chunks).fill(0).map(
  (_, i) => hashParams.file.replace('%d', i)
)
:  [ hashParams.file ];

Promise.all(fpaths.map((fpath, i) => new Promise((resolve, reject) => {
  status(`downloading ${i+1}/${fpaths.length}: ${fpath}`);
  return fetch(fpath).then(resp => {
    if (!resp.ok)
      return reject(`fetch failure ${resp.status}: ${resp.statusText}`);

    resp.json().then(j => resolve(j))
  })
}).then(j => {
  j.forEach(({umap, image, ...m}) => {
    s = make_sprite((umap[0] || 0)*scale, (umap[1] || 0)*scale, (umap[2] || 0)*scale, "data:image/webp;base64," + image);
    s.userData = m;
  });
  status(`loaded: ${fpath} (total: ${groupSprites.children.length})`);
})))
.then(_ => {
  // done
  status(`ready (total: ${groupSprites.children.length}) ${fpaths[0]}`);
  elem.style.display = 'block';
})
.catch(err => status("error: "+ err));

const clock = new THREE.Clock()
clock.start()

function animate() {
  requestAnimationFrame( animate );
  //const dt = clock.getElapsedTime()
    flyControls.update(1);
	renderer.render( scene, camera );
}
animate();

function adjust_sprite(direction) {
  adjust_sprite_v *= direction > 0 ? 1.5 : 0.75;
  scale_sprite(adjust_sprite_v);
}

function adjust_speed(direction) {
  adjust_speed_v *= direction > 0 ? 1.5 : 0.75;
  flyControls.movementSpeed = adjust_speed_v;
}
document.addEventListener('wheel', (event) => {
  const direction = event.wheelDelta > 0 ? +1 : -1;
  adjust_sprite(direction);
  adjust_speed(direction);
});

var adjust_far_v = 1000;
function adjust_far(direction) {
  adjust_far_v *= direction > 0 ? 2 : 0.5;
  camera.far = adjust_far_v;
  fog.far = adjust_far_v;
  camera.updateProjectionMatrix();
}

function click_bg_color(color) {
  setBgColor(color);
}

function highlightFilter(f) {
  count = 0
  groupSprites.children.forEach(s => {
    isTarget = f(s.userData);
    s.material.color.set( isTarget ? 0xffffff : 0x444444 );
    if (isTarget) {
      s.scale.multiplyScalar(2);
      count++;
    }
  });
  return count;
}

var selected = null;
var history_selected = [];
elem.addEventListener('pointerdown', (event) => {
  if ( event.button != 0 ) return;

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  pointer.x = ( (event.clientX - elem.clientLeft) / elem.width ) * 2 - 1;
  pointer.y = - ( (event.clientY - elem.clientTop) / elem.height ) * 2 + 1;
  raycaster.setFromCamera( pointer, camera );
  const intersects = raycaster
    .intersectObjects( groupSprites.children )
    // only insersect with the ones visible (far in fog = hidden)
    .filter(s => s.distance <= fog.far);
  //console.log(['intersects', intersects])

  if (selected != null)
    selected.material.color.set( 0xffffff );
  if (intersects.length > 0) { // closest intersection
    selected = intersects[0].object;
    selected.material.color.set( 0x8888ff );
    m = selected.userData;
    tagsStr = ''; // m.targetPlayer.avatar?.anns?.tags?.join(", ")
    aid = m.name; // m.targetPlayer.avatar.id
    status(`selected 1/${intersects.length}: ident=${m.ident} name=${m.name} ${tagsStr ? `tags=${tagsStr}` : ""} <button onclick='showPopup();'>more</button>`);
    $popup.innerHTML = `<pre>${JSON.stringify(m, null, 2)}</pre>`;
    history_selected.push(selected);
  }
  else {
    selected = null;
    status(`no selection`);
  }
});

function showPopup() {
  $popup.parentElement.style.display = 'block';
}
