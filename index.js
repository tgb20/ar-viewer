/* global THREE */

/*
This is an example of using only the core API (.viewer) to implement rendering a world and saving a screenshot of it
*/

global.THREE = require('three')
global.Worker = require('worker_threads').Worker
const { createCanvas, ImageData } = require('node-canvas-webgl/lib')
const fs = require('fs')
const Vec3 = require('vec3').Vec3
const { Viewer, WorldView } = require('prismarine-viewer').viewer
const { parse, simplify } = require('prismarine-nbt')

const express = require('express')
const fileUpload = require('express-fileupload');
const app = express()
const port = 3000

// fs.rmdirSync('./tmp/', { recursive: true });

app.use(fileUpload({
    useTempFiles: true,
    tempFileDir: './tmp/'
}));

app.use(express.static('gltf_out'))

app.get('/', (req, res) => {
    res.send('Hello World!')
})

app.post('/nbt', async (req, res) => {
    let nbtFile = req.files.nbt;
    let name = nbtFile.name.split('.')[0];
    let buffer = await fs.promises.readFile(nbtFile.tempFilePath);
    let modeFileName = await saveNBT(name, buffer);
    res.send({ fileLocation: modeFileName });
})

function saveNBT(name, buffer) {

    return new Promise(async (resolve, reject) => {
        const viewDistance = 4
        const width = 512
        const height = 512
        const version = '1.17'
        const World = require('prismarine-world')(version)
        const Chunk = require('prismarine-chunk')(version)
        const Block = require('prismarine-block')(version)
        const mcData = require('minecraft-data')(version)
        const center = new Vec3(30, 90, 30)
        const canvas = createCanvas(width, height)
        const renderer = new THREE.WebGLRenderer({ canvas })
        const viewer = new Viewer(renderer, false)

        const world = new World(() => new Chunk())
        const { parsed, _ } = await parse(buffer)

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
                let newBlock = Block.fromProperties(id, properties, 1)
                let rawPos = block.pos.value.value;
                let pos = new Vec3(rawPos[0], rawPos[1], rawPos[2]);
                world.setBlock(pos, newBlock);
            }
        });

        viewer.setVersion(version)

        // Load world
        const worldView = new WorldView(world, viewDistance, center)
        viewer.listen(worldView)

        viewer.camera.position.set(center.x, center.y, center.z)

        const point = new THREE.Vector3(0, 60, 0)

        viewer.camera.lookAt(point)

        await worldView.init(center)
        await new Promise(resolve => setTimeout(resolve, 3000))
        renderer.render(viewer.scene, viewer.camera)

        const { Blob, FileReader } = require('vblob')

        // Patch global scope to imitate browser environment.
        global.window = global
        global.Blob = Blob
        global.FileReader = FileReader
        global.THREE = THREE
        global.ImageData = ImageData
        global.document = {
            createElement: (nodeName) => {
                if (nodeName !== 'canvas') throw new Error(`Cannot create node ${nodeName}`)
                const canvas = createCanvas(256, 256)
                return canvas
            }
        }

        const GLTFExporter = require('three-gltf-exporter')

        const exporter = new GLTFExporter();

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

app.listen(port, () => {
    console.log(`Example app listening at http://localhost:${port}`)
})