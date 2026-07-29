import { Graphics } from 'pixi.js';

export default class StartStopLines {
    constructor(graph) {
        this.graph = graph;
        this.graphics = new Graphics();

        graph.on('init', () => this.init());
        graph.on('dataLoaded', () => this.drawStartStopLines());
        graph.on('resize', () => this.resize());
    }

    init() {
        this.graph.graphic.addChildAt(this.graphics, 0);
    }

    resize() {
        if (this.graph.data) {
            this.drawStartStopLines();
        }
    }

    drawStartStopLines() {
        var height = this.graph.getGraphicWindowBounds().height;

        this.graphics.clear();
        this.graphics.beginFill(0xFF0000, 1);

        if (this.graph.data.timer) {
            this.graphics.drawRect(this.graph.data.timer['start_frame'], 0, 1, height);
            this.graphics.drawRect(this.graph.data.timer['stop_frame'], 0, 1, height);
        }

        this.graphics.endFill();
    }
};

