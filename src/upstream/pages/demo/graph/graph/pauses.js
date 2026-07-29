import { Graphics } from 'pixi.js';
import { getActiveFramesRanges } from './utils';

export default class Pauses {
    constructor(graph) {
        this.graph = graph;

        this.graphics = new Graphics();

        graph.on('init', () => this.init());
        graph.on('dataLoaded', () => this.drawPauses());
        graph.on('resize', () => this.resize());
    }

    init() {
        this.graph.graphic.addChildAt(this.graphics, 0);
    }

    resize() {
        if (this.graph.data) {
            this.drawPauses();
        }
    }

    drawPauses() {
        this.graphics.clear();
        this.graphics.beginFill(0xFFFFFF, 0.1);

        var framesRanges = getActiveFramesRanges(this.graph.totalFrames, this.isPaused.bind(this)),
            height = this.graph.getGraphicWindowBounds().height;

        for (var i = 0; i < framesRanges.length; i++) {
            this.graphics.drawRect(framesRanges[i][0], 0, framesRanges[i][1] - framesRanges[i][0] + 1, height);
        }

        this.graphics.endFill();
    }

    isPaused(frame) {
        return !!this.graph.data['is_paused'][frame];
    }
};

