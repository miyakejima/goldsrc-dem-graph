import { Color, Graphics } from 'pixi.js';

import GraphBar from '../bar';
import { flags } from '../../consts';
import { getActiveFramesRanges } from '../utils';

const barsConfig = [
    { flag: flags.ONGROUND, color: new Color('#555555'), offset: 0 },
    { flag: flags.FROZEN, color: new Color('#ffff00'), offset: 3 },
    { flag: flags.DORMANT, color: new Color('#ff8800'), offset: 3 },
    { flag: flags.INWATER, color: new Color('#0000ff'), offset: 3 },
    { flag: flags.WATERJUMP, color: new Color('#0099ff'), offset: 3 },
];

export default class BarGround extends GraphBar {
    constructor(graph) {
        super(graph);

        this.setLabel('ground');

        graph.on('dataLoaded', () => this.drawBar());
    }

    drawBar() {
        barsConfig.forEach(bar => {
            this.addBarElement(this.getFlagGraphics(bar));
        }, this);
    }

    getFlagGraphics(bar) {
        var framesRanges = getActiveFramesRanges(this.graph.totalFrames, this.getHasFlagIsActiveFunc(bar.flag).bind(this)),
            graphics = new Graphics();

        graphics.position.y = bar.offset;
        graphics.beginFill(bar.color, 1);

        for (var i = 0; i < framesRanges.length; i++) {
            graphics.drawRect(framesRanges[i][0], 0, framesRanges[i][1] - framesRanges[i][0] + 1, this.height - 2 * bar.offset);
        }

        graphics.endFill();

        return graphics;
    }

    getHasFlagIsActiveFunc(flag) {
        return function (frame) {
            return !!(this.graph.data['cd']['flags'].getAt(frame) & flag);
        };
    }
};

