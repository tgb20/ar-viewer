let scene, exporter;

window.onload = () => {
    document.getElementById('file-input').addEventListener('change', readSingleFile, false);
    scene = new THREE.Scene();
    scene.background = new THREE.Color('lightblue')
    const camera = new THREE.PerspectiveCamera(75, 640 / 480, 0.1, 1000);

    exporter = new THREE.GLTFExporter();

    const ambientLight = new THREE.AmbientLight(0xcccccc)
    scene.add(ambientLight)

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5)
    directionalLight.position.set(1, 1, 0.5).normalize()
    scene.add(directionalLight)

    const renderer = new THREE.WebGLRenderer();
    renderer.setSize(640, 480);

    const controls = new THREE.OrbitControls(camera, renderer.domElement);

    camera.position.z = 5;

    controls.update();

    function animate() {
        requestAnimationFrame(animate);
        controls.update();
        renderer.render(scene, camera);
    }
    animate();
}

function readSingleFile(e) {
    var file = e.target.files[0];
    if (!file) {
        return;
    }
    var reader = new FileReader();
    reader.onload = function (e) {
        var contents = e.target.result;
        var buffer = stringToArrayBuffer(contents);
        nbt.parse(buffer, function (error, data) {
            if (error) { throw error; }

            // Load Palette
            let formattedPalette = {};
            let rawPalette = data.value.palette.value.value;

            for (let i = 0; i < rawPalette.length; i++) {
                let blockType = rawPalette[i].Name.value;
                formattedPalette[i] = blockType;
            }

            let blocks = data.value.blocks.value.value;

            blocks.forEach(block => {
                let type = formattedPalette[block.state.value];

                if (type != 'minecraft:air') {
                    let pos = block.pos.value.value;

                    let x = pos[0];
                    let y = pos[1];
                    let z = pos[2];

                    const geometry = new THREE.BoxGeometry();
                    const material = new THREE.MeshBasicMaterial({ color: getRandomColor() });
                    const cube = new THREE.Mesh(geometry, material);
                    cube.position.set(x, y, z);
                    scene.add(cube);
                }
            });

            exporter.parse( scene, function ( gltf ) {
                const blob = new Blob([gltf], {type: 'text/json'});
                let url = window.URL.createObjectURL(blob);
                document.getElementById('viewer').src = url;                
            }, {} );
        });
    };
    reader.readAsBinaryString(file);
}

// Generate random hex color
function getRandomColor() {
    var letters = '0123456789ABCDEF';
    var color = '#';
    for (var i = 0; i < 6; i++) {
        color += letters[Math.floor(Math.random() * 16)];
    }
    return color;
}


function stringToArrayBuffer(str) {
    if (typeof str !== 'string') throw 'str must be a string';
    var i, x, arr = new Uint8Array(str.length);
    for (i = 0; i < str.length; i++) {
        x = str.charCodeAt(i);
        if (x < 0 || x > 255) throw 'Element ' + i + ' out of range: ' + x;
        arr[i] = x;
    }
    return arr.buffer;
}