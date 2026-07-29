import { Graphics } from 'pixi.js';

import { movetype, obs } from '../consts';
import { getActiveFramesRanges } from './utils';

const config = {
    dying: [0xFF0000, 0.15],
    dead: [0xFF0000, 0.15],
    deadObs: [0xFF0000, 0.15],
    startBorder: [0xFFFFFF, 0.25],
};

export default class Death {
    constructor(graph) {
        this.graph = graph;
        this.graphics = new Graphics();

        graph.on('init', () => this.init());
        graph.on('dataLoaded', () => this.drawGraphic());
        graph.on('resize', () => this.resize());
    }

    init() {
        this.graph.graphic.addChildAt(this.graphics, 0);
    }

    resize() {
        if (this.graph.data) {
            this.drawGraphic();
        }
    }

    drawGraphic() {
        this.graphics.clear();
        this.drawDying();
        this.drawDead();
        this.drawDeadObs();
    }

    drawDying() {
        this.graphics.beginFill(config.dying[0], config.dying[1]);

        const framesRanges = getActiveFramesRanges(this.graph.totalFrames, this.isDying.bind(this));
        const height = this.graph.getGraphicWindowBounds().height;

        for (let i = 0; i < framesRanges.length; i++) {
            this.graphics.drawRect(framesRanges[i][0], 0, framesRanges[i][1] - framesRanges[i][0] + 1, height);
        }

        this.graphics.endFill();
    }

    drawDead() {
        const framesRanges = getActiveFramesRanges(this.graph.totalFrames, this.isDead.bind(this));
        const height = this.graph.getGraphicWindowBounds().height;

        this.graphics.beginFill(config.dead[0], config.dead[1]);
        for (let i = 0; i < framesRanges.length; i++) {
            this.graphics.drawRect(framesRanges[i][0], 0, framesRanges[i][1] - framesRanges[i][0] + 1, height);
        }
        this.graphics.endFill();

        this.graphics.beginFill(config.startBorder[0], config.startBorder[1]);
        framesRanges.forEach(function (rangeData) {
            this.graphics.drawRect(rangeData[0], 0, 1, height);
        }, this);
        this.graphics.endFill();
    }

    drawDeadObs() {
        const framesRanges = getActiveFramesRanges(this.graph.totalFrames, this.isDeadObs.bind(this));
        const height = this.graph.getGraphicWindowBounds().height;

        this.graphics.beginFill(config.deadObs[0], config.deadObs[1]);
        for (let i = 0; i < framesRanges.length; i++) {
            this.graphics.drawRect(framesRanges[i][0], 0, framesRanges[i][1] - framesRanges[i][0] + 1, height);
        }
        this.graphics.endFill();

        this.graphics.beginFill(config.startBorder[0], config.startBorder[1]);
        framesRanges.forEach(function (rangeData) {
            this.graphics.drawRect(rangeData[0], 0, 1, height);
        }, this);
        this.graphics.endFill();
    }

    isDying(frame) {
        const health = this.graph.data['cd']['health'].getAt(frame);
        const movetypeValue = this.graph.data['esp']['movetype'].getAt(frame);

        return health <= 0 && movetypeValue === movetype.TOSS;
    }

    isDead(frame) {
        const health = this.graph.data['cd']['health'].getAt(frame);
        const movetypeValue = this.graph.data['esp']['movetype'].getAt(frame);

        return health <= 0 && movetypeValue === movetype.NONE;
    }

    isDeadObs(frame) {
        const iuser1 = this.graph.data['cd']['iuser1'].getAt(frame);
        const iuser2 = this.graph.data['cd']['iuser2'].getAt(frame);
        const movetypeValue = this.graph.data['esp']['movetype'].getAt(frame);

        return ((iuser2 > 0 && iuser2 != this.graph.data['player_index']) || iuser1 === obs.ROAMING)
            && movetypeValue === movetype.NONE;
    }
};

