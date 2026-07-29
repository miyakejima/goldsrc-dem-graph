import { Graphics } from 'pixi.js';
import GraphicsBase from './base';
import _ from 'lodash';

const config = {
    drawingHeight: 155,
    fpsPoints: [100, 83, 50, 25, 0],
    lineColorFn: fps => 0x444444,
    labelColorFn(fps) {
        var r, g, b;
        r = (0xFF - Math.max(fps - 50, 0) / 50 * 0xFF);
        g = (Math.max(fps - 50, 0) / 50 * 0xFF);
        b = 0;//(0x44 - Math.max(fps - 50, 0) / 50 * 0x44);

        return (Math.max(Math.min(Math.floor(r), 0xFF), 0) << 16) +
            (Math.max(Math.min(Math.floor(g), 0xFF), 0) << 8) +
            Math.max(Math.min(Math.floor(b), 0xFF), 0);
    },
};

export default class GraphicsRealFps extends GraphicsBase {
    constructor(graph) {
        super(graph);

        graph.on('init', () => this.init());
        graph.on('dataLoaded', () => this.drawRealFps());
        graph.on('resize', () => this.drawGui());
    }

    init() {
        this.drawGui();

        this.registerSwitcher('real fps');
    }

    drawGui() {
        this.labelsContainer.removeChildren();
        this.lines.clear();

        this.drawLabelAndLine('> 100 fps', 0xFF0000, 0x444444, 0);

        config.fpsPoints.forEach(fps => {
            this.drawLabelAndLine(
                fps + ' fps',
                config.labelColorFn(fps),
                config.lineColorFn(fps),
                25 + Math.round((100 - fps) * config.drawingHeight / 100),
            );
        });
    }

    drawRealFps() {
        const chunkSize = 2 ** 14;
        const chunks = _.chunk(this.graph.data['frametime'], chunkSize);

        for (let chunkNum in chunks) {
            const graphics = new Graphics();
            graphics.x = chunkNum * chunkSize;

            let color;
            let y, height;

            const fpsValues = Array.from(new Float32Array(chunks[chunkNum].map(function (frametime) {
                return 1 / frametime;
            })));

            for (let [fps, startFrame, endFrame] of this.getSequence(fpsValues)) {
                height = 1;
                color = 0xFF0000;

                if (fps > 100) {
                    y = 0;
                } else {
                    y = 25 + (100 - fps) * config.drawingHeight / 100;
                }

                graphics.beginFill(color, 1);
                graphics.drawRect(startFrame, y, endFrame - startFrame + 1, height);
                graphics.endFill();
            }

            graphics.cacheAsBitmap = true;

            this.graphicsContainer.addChild(graphics);
        }
    }
};

