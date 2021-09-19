global.THREE = require('three');
global.Worker = require('worker_threads').Worker;
const { createCanvas, ImageData } = require('node-canvas-webgl/lib');
const fs = require('fs');
const Vec3 = require('vec3').Vec3;
const { Viewer, WorldView } = require('prismarine-viewer').viewer;
const { parse, simplify } = require('prismarine-nbt');
const version = '1.17';
const World = require('prismarine-world')(version);
const Chunk = require('prismarine-chunk')(version);
const Block = require('prismarine-block')(version);
const mcData = require('minecraft-data')(version);
const GLTFExporter = require('three-gltf-exporter');
const { Blob, FileReader } = require('vblob');
const viewDistance = 4;
const width = 512;
const height = 512;
const center = new Vec3(30, 90, 30);
const canvas = createCanvas(width, height);
const renderer = new THREE.WebGLRenderer({ canvas });
const viewer = new Viewer(renderer, false);
// Patch global scope to imitate browser environment.
global.window = global;
global.Blob = Blob;
global.FileReader = FileReader;
global.THREE = THREE;
global.ImageData = ImageData;
global.document = {
    createElement: (nodeName) => {
        if (nodeName !== 'canvas') throw new Error(`Cannot create node ${nodeName}`);
        const canvas = createCanvas(256, 256);
        return canvas;
    }
}
const express = require('express');
const fileUpload = require('express-fileupload');
const app = express();
const port = 3000;

if (fs.existsSync('./tmp/')) {
    fs.rmdirSync('./tmp/', { recursive: true });
}

if (!fs.existsSync('./gltf_out/')){
    fs.mkdirSync('./gltf_out/');
}

app.use(fileUpload({
    useTempFiles: true,
    tempFileDir: './tmp/'
}));

app.use(express.static('gltf_out'));
app.use(express.static('public'));

app.post('/nbt', async (req, res) => {
    let nbtFile = req.files.nbt;
    let buffer = await fs.promises.readFile(nbtFile.tempFilePath);
    let modeFileName = await saveNBT(buffer);
    res.send({ fileLocation: modeFileName });
})

function saveNBT(buffer) {

    return new Promise(async (resolve, reject) => {
        const world = new World(() => new Chunk());
        const { parsed, _ } = await parse(buffer);

        let formattedPalette = {};
        let rawPalette = parsed.value.palette.value.value;
        for (let i = 0; i < rawPalette.length; i++) {
            let blockType = rawPalette[i].Name.value;
            let properties = {};
            if (rawPalette[i].Properties != null) {
                properties = convertToDataType(simplify(rawPalette[i].Properties));
            }
            formattedPalette[i] = { type: blockType, properties: properties };
        }
        let blocks = parsed.value.blocks.value.value;
        blocks.forEach(block => {
            let type = formattedPalette[block.state.value].type;
            let properties = formattedPalette[block.state.value].properties;

            if (type != 'minecraft:air') {
                let id = 0;
                let blockRef = mcData.blocksByName[type.split(':')[1]];
                if (blockRef != undefined) id = blockRef.id;
                let newBlock = Block.fromProperties(id, properties, 1);
                let rawPos = block.pos.value.value;
                let pos = new Vec3(rawPos[0], rawPos[1], rawPos[2]);
                world.setBlock(pos, newBlock);
            }
        });

        viewer.setVersion(version);

        // Load world
        const worldView = new WorldView(world, viewDistance, center);
        viewer.listen(worldView);

        viewer.camera.position.set(center.x, center.y, center.z);

        const point = new THREE.Vector3(0, 60, 0);

        viewer.camera.lookAt(point);

        await worldView.init(center);
        await new Promise(resolve => setTimeout(resolve, 3000));
        renderer.render(viewer.scene, viewer.camera);

        const exporter = new GLTFExporter();

        let name = randomString(20);

        exporter.parse(viewer.scene, ((gltf) => {
            fs.writeFile(`./gltf_out/${name}.gltf`, JSON.stringify(gltf), function (err) {
                if (err) console.log(err);
                resolve(`${name}.gltf`);
            });
        }));
    });
}

function convertToDataType(properties) {
    for (const [key, value] of Object.entries(properties)) {
        if (!isNaN(value)) {
            properties[key] = parseInt(value);
        }
        if (value == 'true' || value == 'false') {
            properties[key] = value == 'true';
        }
    }
    return properties;
}

function randomString(length) {
    var text = '';
    var possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (var i = 0; i < length; i++)
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    return text;
}

app.listen(port, () => {
    console.log(`Example app listening at http://localhost:${port}`);
})