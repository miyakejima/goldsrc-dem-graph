import { Graphics } from 'pixi.js';

import GraphBar from '../bar';
import { flags } from '../../consts';
import { getActiveFramesRanges } from '../utils';

export default class BarDuckState extends GraphBar {
    constructor(graph) {
        super(graph);

        this.setLabel('duckstate');

        graph.on('dataLoaded', () => this.drawBar());
    }

    drawBar() {
        var duckStateGraphics = this.getDuckStateGraphics();

        this.addBarElement(duckStateGraphics);
    }

    getDuckStateGraphics() {
        var duckState1frames = getActiveFramesRanges(this.graph.totalFrames, frame => this.getDuckState(frame) === 1),
            duckState2frames = getActiveFramesRanges(this.graph.totalFrames, frame => this.getDuckState(frame) === 2),
            graphics = new Graphics(),
            i;

        graphics.beginFill(0xFF8800, 1);
        for (i = 0; i < duckState1frames.length; i++) {
            graphics.drawRect(duckState1frames[i][0], 0, duckState1frames[i][1] - duckState1frames[i][0] + 1, this.height);
        }
        graphics.endFill();

        graphics.beginFill(0x00FF88, 1);
        for (i = 0; i < duckState2frames.length; i++) {
            graphics.drawRect(duckState2frames[i][0], 0, duckState2frames[i][1] - duckState2frames[i][0] + 1, this.height);
        }
        graphics.endFill();

        return graphics;
    }

    getDuckState(frame) {
        var bInDuck = !!this.graph.data['cd']['bInDuck'].getAt(frame),
            flDucking = !!(this.graph.data['cd']['flags'].getAt(frame) & flags.DUCKING);

        if (!bInDuck && !flDucking) {
            return 0;
        }

        if (bInDuck && !flDucking) {
            return 1;
        }

        if (!bInDuck && flDucking) {
            return 2;
        }
    }
};

