import { Graphics } from 'pixi.js';

import GraphBar from '../bar';
import { getActiveFramesRanges } from '../utils';

export default class BarFreezeTime extends GraphBar {
    constructor(graph) {
        super(graph);

        this.setLabel('freezetime');

        graph.on('dataLoaded', () => this.drawBar());
    }

    drawBar() {
        var freezeTimeGraphics = this.getIsFreezeTimeGraphics();

        this.addBarElement(freezeTimeGraphics);
    }

    getIsFreezeTimeGraphics() {
        var framesRanges = getActiveFramesRanges(this.graph.totalFrames, this.isFreezeTime.bind(this)),
            graphics = new Graphics();

        graphics.beginFill(0x00CCCC, 1);

        for (var i = 0; i < framesRanges.length; i++) {
            graphics.drawRect(framesRanges[i][0], 0, framesRanges[i][1] - framesRanges[i][0] + 1, this.height);
        }

        graphics.endFill();

        return graphics;
    }

    isFreezeTime(frame) {
        return !!(this.graph.data['cd']['iuser3'].getAt(frame) & (1 << 1));
    }
};

